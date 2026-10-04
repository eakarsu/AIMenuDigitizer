import { Router, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateLabels, validateMenu, validateOcr, validateTranslation, validateTransition } from '../domain/menuWorkflow';
import { transitionMenu } from '../domain/menuWorkflowStore';
import { validateAvailability } from '../domain/webMenu';
import { detectMenuSource, sourceSha256 } from '../domain/menuSource';
import { extractImageOcrCandidate, extractPdfScanCandidate } from '../domain/imageOcr';

type MenuRequest = AuthRequest & { menuTenantId?: string };
const router=Router();router.use(authenticateToken);
const sourceUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
const tenantOf=(req:AuthRequest)=>String((req as MenuRequest).menuTenantId);
router.use(async(req:MenuRequest,res:Response,next:NextFunction)=>{
  const own=String(req.userId),requested=String(req.headers['x-menu-workspace-id']||own);
  if(requested===own){req.menuTenantId=own;return next();}
  try{
    const grant=await pool.query('SELECT 1 FROM menu_workflow_memberships WHERE tenant_id=$1 AND user_id=$2 AND active=TRUE',[requested,req.userId]);
    if(!grant.rows[0])return res.status(403).json({error:'Menu workspace membership required'});
    req.menuTenantId=requested;next();
  }catch{return res.status(503).json({error:'Menu workspace membership check unavailable'});}
});
router.get('/workspaces',async(req:MenuRequest,res:Response)=>{try{const q=await pool.query('SELECT tenant_id FROM menu_workflow_memberships WHERE user_id=$1 AND active=TRUE ORDER BY tenant_id',[req.userId]);res.json({items:[String(req.userId),...q.rows.map(row=>row.tenant_id)].filter((value,index,array)=>array.indexOf(value)===index)});}catch{res.json({items:[String(req.userId)]});}});
router.post('/ingestions/upload',(req:MenuRequest,res:Response,next:NextFunction)=>sourceUpload.single('source')(req,res,error=>{
  if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:'One source file up to 10 MB is required'});
  next();
}),async(req:MenuRequest,res:Response)=>{
  if(!['admin','manager','operator','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu editor role required'});
  const bytes=req.file?.buffer,detected=bytes?detectMenuSource(bytes):null;
  if(!bytes||!detected)return res.status(400).json({error:'PDF, JPEG, PNG, or WebP source bytes required'});
  const ingestionRef=String(req.body?.ingestion_ref||'').trim(),idempotencyKey=String(req.body?.idempotency_key||'').trim();
  if(!ingestionRef||!idempotencyKey||ingestionRef.length>180||idempotencyKey.length>180)return res.status(400).json({error:'Source reference and idempotency key required (up to 180 characters)'});
  const tenantId=tenantOf(req),sha=sourceSha256(bytes);
  let extractedText='',pageCount=1;
  if(detected.sourceType==='pdf'){
    try{const parsed=await pdfParse(bytes);extractedText=String(parsed.text||'').trim().slice(0,100000);pageCount=Math.max(1,Number(parsed.numpages)||1);}
    catch{return res.status(422).json({error:'PDF could not be parsed; choose a valid PDF or image'});}
  }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const existing=(await client.query('SELECT * FROM menu_ingestions WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE',[tenantId,idempotencyKey])).rows[0];
    if(existing){
      if(existing.source_checksum!==sha){await client.query('ROLLBACK');return res.status(409).json({error:'Idempotency key reused with different source bytes'});}
      const stored=(await client.query('SELECT extracted_text FROM menu_source_objects WHERE tenant_id=$1 AND ingestion_ref=$2',[tenantId,existing.ingestion_ref])).rows[0];
      if(!stored){await client.query('ROLLBACK');return res.status(409).json({error:'Idempotency key belongs to a metadata-only source'});}
      await client.query('COMMIT');return res.json({ingestion:existing,extractedText:stored.extracted_text||'',replayed:true});
    }
    const id=randomUUID(),objectRef=`db-source:${id}`;
    const ingestion=(await client.query(`INSERT INTO menu_ingestions(tenant_id,ingestion_ref,idempotency_key,source_type,source_checksum,object_ref,page_count,deskew_angle,ocr_confidence,layout_kind,handwriting,correction_required,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,0,$8,FALSE,TRUE,$9) RETURNING *`,[tenantId,ingestionRef,idempotencyKey,detected.sourceType,sha,objectRef,pageCount,extractedText?'pdf_text_layer':'manual_correction',String(req.userId)])).rows[0];
    await client.query(`INSERT INTO menu_source_objects(id,tenant_id,ingestion_ref,mime_type,sha256,bytes,byte_length,extracted_text)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,tenantId,ingestionRef,detected.mimeType,sha,bytes,bytes.length,extractedText]);
    await client.query('COMMIT');
    res.status(201).json({ingestion,extractedText,note:extractedText?'PDF text layer extracted; manually check names, prices, and layout against the stored file.':'No text layer extracted. Manual transcription or a separately validated OCR adapter is required.'});
  }catch(e:any){await client.query('ROLLBACK');res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Source reference already exists':'Could not store menu source'});}finally{client.release();}
});
router.get('/ingestions/:ref/source',async(req:MenuRequest,res:Response)=>{try{
  const stored=(await pool.query('SELECT mime_type,sha256,bytes FROM menu_source_objects WHERE tenant_id=$1 AND ingestion_ref=$2',[tenantOf(req),req.params.ref])).rows[0];
  if(!stored)return res.status(404).json({error:'Stored source not found'});
  if(sourceSha256(stored.bytes)!==stored.sha256)return res.status(500).json({error:'Stored source checksum failed'});
  res.set('Content-Type',stored.mime_type);res.set('Content-Disposition','attachment');res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','private, no-store');res.send(stored.bytes);
}catch{res.status(500).json({error:'Could not load stored source'});}});
router.get('/ingestions/:ref/text',async(req:MenuRequest,res:Response)=>{try{
  const stored=(await pool.query(`SELECT s.extracted_text,s.sha256,i.ocr_confidence,i.layout_kind,i.correction_required
    FROM menu_source_objects s JOIN menu_ingestions i ON i.tenant_id=s.tenant_id AND i.ingestion_ref=s.ingestion_ref
    WHERE s.tenant_id=$1 AND s.ingestion_ref=$2`,[tenantOf(req),req.params.ref])).rows[0];
  if(!stored)return res.status(404).json({error:'Stored source not found'});
  res.json({extractedText:stored.extracted_text,sourceSha256:stored.sha256,ocrConfidence:stored.ocr_confidence,layoutKind:stored.layout_kind,correctionRequired:stored.correction_required});
}catch{res.status(500).json({error:'Could not load source text'});}});
router.post(['/ingestions/:ref/image-ocr','/ingestions/:ref/scan-ocr'],async(req:MenuRequest,res:Response)=>{
  if(!['admin','manager','operator','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu editor role required'});
  const tenantId=tenantOf(req);
  try{
    const source=(await pool.query(`SELECT s.bytes,s.sha256,s.extracted_text,i.source_type,i.source_checksum,i.page_count,i.layout_kind
      FROM menu_source_objects s JOIN menu_ingestions i ON i.tenant_id=s.tenant_id AND i.ingestion_ref=s.ingestion_ref
      WHERE s.tenant_id=$1 AND s.ingestion_ref=$2`,[tenantId,req.params.ref])).rows[0];
    if(!source)return res.status(404).json({error:'Stored source scan not found'});
    if(!['image','pdf'].includes(source.source_type))return res.status(409).json({error:'Scan OCR requires a stored image or PDF source'});
    if(source.source_type==='pdf'&&source.layout_kind==='pdf_text_layer')return res.status(409).json({error:'PDF text layer already exists; use it for manual correction'});
    if(sourceSha256(source.bytes)!==source.sha256||source.sha256!==source.source_checksum)return res.status(409).json({error:'Stored source checksum does not match ingestion evidence'});
    const candidate=source.source_type==='pdf' ? await extractPdfScanCandidate(source.bytes,Number(source.page_count)) : await extractImageOcrCandidate(source.bytes);
    const layoutKind=source.source_type==='pdf'?'pdf_scan_ocr_candidate':'image_ocr_candidate';
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const textUpdate=await client.query(`UPDATE menu_source_objects SET extracted_text=$3 WHERE tenant_id=$1 AND ingestion_ref=$2 AND sha256=$4`,[tenantId,req.params.ref,candidate.text,source.sha256]);
      const ingestionUpdate=await client.query(`UPDATE menu_ingestions SET ocr_confidence=$3,layout_kind=$4,correction_required=TRUE
        WHERE tenant_id=$1 AND ingestion_ref=$2 AND source_checksum=$5`,[tenantId,req.params.ref,candidate.confidence,layoutKind,source.sha256]);
      if(textUpdate.rowCount!==1||ingestionUpdate.rowCount!==1){await client.query('ROLLBACK');return res.status(409).json({error:'Source changed during OCR; retry from the stored original'});}
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    res.json({extractedText:candidate.text,ocrConfidence:candidate.confidence,wordCount:candidate.wordCount,pagesProcessed:'pagesProcessed' in candidate?candidate.pagesProcessed:1,sourceSha256:source.sha256,correctionRequired:true,
      note:'OCR is an unreviewed candidate. Compare every name, price, and label with the stored scan before publication.'});
  }catch(error:any){
    if(error.code==='ENOENT')return res.status(503).json({error:'Tesseract or Poppler is not installed on this server; transcribe the source manually'});
    if(/supports 1 to 5 pages/.test(String(error.message)))return res.status(422).json({error:error.message});
    if(/No readable words found/.test(String(error.message)))return res.status(422).json({error:error.message});
    res.status(502).json({error:'Could not extract image OCR candidate'});
  }
});
router.post('/ingestions',async(req:AuthRequest,res:Response)=>{try{const tenantId=tenantOf(req);const v=validateOcr(req.body);for(const f of ['ingestion_ref','idempotency_key','object_ref'] as const)if(!req.body[f])return res.status(400).json({error:`${f} is required`});const existing=await pool.query('SELECT * FROM menu_ingestions WHERE tenant_id=$1 AND idempotency_key=$2',[tenantId,req.body.idempotency_key]);if(existing.rows[0]){if(existing.rows[0].source_checksum!==v.source_checksum)return res.status(409).json({error:'idempotency key reused with different source'});return res.json({...existing.rows[0],replayed:true});}const q=await pool.query(`INSERT INTO menu_ingestions(tenant_id,ingestion_ref,idempotency_key,source_type,source_checksum,object_ref,page_count,deskew_angle,ocr_confidence,layout_kind,handwriting,correction_required,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[tenantId,req.body.ingestion_ref,req.body.idempotency_key,req.body.source_type,v.source_checksum,req.body.object_ref,v.page_count,v.deskew_angle,v.ocr_confidence,req.body.layout_kind||null,Boolean(req.body.handwriting),v.manual_correction_required,String(req.userId)]);res.status(201).json(q.rows[0]);}catch(e:any){res.status(400).json({error:e.message});}});
router.get('/ingestions',async(req:AuthRequest,res:Response)=>{try{const q=await pool.query('SELECT id,ingestion_ref,source_type,source_checksum,object_ref,page_count,ocr_confidence,layout_kind,correction_required,status,created_at FROM menu_ingestions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[tenantOf(req)]);res.json({items:q.rows});}catch(e:any){res.status(500).json({error:'Could not load ingestions'});}});
router.get('/menus',async(req:AuthRequest,res:Response)=>{try{const q=await pool.query('SELECT menu_ref,version,restaurant_ref,location_ref,channel,currency,status,source_ingestion_ref,created_at FROM menu_versions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200',[tenantOf(req)]);res.json({items:q.rows});}catch(e:any){res.status(500).json({error:'Could not load menu versions'});}});
router.post('/menus/:menuRef/versions',async(req:AuthRequest,res:Response)=>{try{
  if(!['admin','manager','operator','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu editor role required'});
  const tenantId=tenantOf(req),body=req.body||{},menuRef=req.params.menuRef;
  const normalized=body.normalized_menu;
  validateMenu(normalized);
  const availability=validateAvailability(normalized,body.availability||{});
  if(!body.source_ingestion_ref||!body.restaurant_ref||!body.location_ref||!body.channel)return res.status(400).json({error:'Source, restaurant, location, and channel are required'});
  const ingestion=(await pool.query('SELECT ingestion_ref FROM menu_ingestions WHERE tenant_id=$1 AND ingestion_ref=$2',[tenantId,body.source_ingestion_ref])).rows[0];
  if(!ingestion)return res.status(404).json({error:'Source ingestion not found in this workspace'});
  const version=Number(body.version);
  if(!Number.isSafeInteger(version)||version<1)return res.status(400).json({error:'Positive menu version required'});
  const result=await pool.query(`INSERT INTO menu_versions(tenant_id,menu_ref,version,restaurant_ref,location_ref,channel,currency,normalized_menu,availability,source_ingestion_ref,status,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,'structured',$11) RETURNING *`,
    [tenantId,menuRef,version,body.restaurant_ref,body.location_ref,body.channel,normalized.currency,JSON.stringify(normalized),JSON.stringify(availability),body.source_ingestion_ref,String(req.userId)]);
  res.status(201).json(result.rows[0]);
}catch(e:any){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Menu version already exists':e.message});}});
router.get('/menus/:menuRef/versions/:version',async(req:AuthRequest,res:Response)=>{const q=await pool.query('SELECT * FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3',[tenantOf(req),req.params.menuRef,Number(req.params.version)]);if(!q.rows[0])return res.status(404).json({error:'menu version not found'});res.json(q.rows[0]);});
router.get('/menus/:menuRef/versions/:version/evidence',async(req:AuthRequest,res:Response)=>{try{const tenantId=tenantOf(req),version=Number(req.params.version);const [labels,translations,audit,publications]=await Promise.all([
  pool.query('SELECT * FROM menu_evidence_labels WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 ORDER BY id',[tenantId,req.params.menuRef,version]),
  pool.query('SELECT * FROM menu_translations WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 ORDER BY id',[tenantId,req.params.menuRef,version]),
  pool.query('SELECT * FROM menu_workflow_audit WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 ORDER BY occurred_at,id',[tenantId,req.params.menuRef,version]),
  pool.query('SELECT * FROM menu_publications WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 ORDER BY id',[tenantId,req.params.menuRef,version]),
]);res.json({labels:labels.rows,translations:translations.rows,audit:audit.rows,publications:publications.rows});}catch(e:any){res.status(500).json({error:'Could not load menu evidence'});}});
router.post('/menus/:menuRef/versions/:version/labels',async(req:AuthRequest,res:Response)=>{try{
  if(!['admin','manager','operator','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu editor role required'});
  const tenantId=tenantOf(req),version=Number(req.params.version),body=req.body||{};
  validateLabels([{name:body.label_name,type:body.label_type,evidence_ref:body.evidence_ref,evidence_version:body.evidence_version,safety_inferred:body.safety_inferred}]);
  if(!/^[a-f0-9]{64}$/i.test(String(body.evidence_checksum||'')))return res.status(400).json({error:'Source evidence SHA-256 required'});
  const menu=(await pool.query('SELECT normalized_menu FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3',[tenantId,req.params.menuRef,version])).rows[0];
  if(!menu)return res.status(404).json({error:'Menu version not found'});
  const items=(menu.normalized_menu?.sections||[]).flatMap((section:any)=>section.items||[]);
  if(!items.some((item:any)=>String(item.id)===String(body.item_ref)))return res.status(400).json({error:'Item reference is not in the corrected menu'});
  const result=await pool.query(`INSERT INTO menu_evidence_labels(tenant_id,menu_ref,menu_version,item_ref,label_type,label_name,evidence_ref,evidence_version,evidence_checksum)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[tenantId,req.params.menuRef,version,body.item_ref,body.label_type,body.label_name,body.evidence_ref,body.evidence_version,String(body.evidence_checksum).toLowerCase()]);
  res.status(201).json(result.rows[0]);
}catch(e:any){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Evidence label already exists':e.message});}});
router.post('/menus/:menuRef/versions/:version/labels/:id/review',async(req:AuthRequest,res:Response)=>{try{
  if(!['admin','manager','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu reviewer role required'});
  if(!['approved','rejected'].includes(req.body?.decision)||!String(req.body?.reason||'').trim())return res.status(400).json({error:'Decision and reason required'});
  const tenantId=tenantOf(req),version=Number(req.params.version);
  const menu=(await pool.query('SELECT created_by FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3',[tenantId,req.params.menuRef,version])).rows[0];
  if(!menu)return res.status(404).json({error:'Menu version not found'});
  if(String(menu.created_by)===String(req.userId))return res.status(403).json({error:'Menu creator cannot approve their own evidence'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`UPDATE menu_evidence_labels SET review_status=$1,reviewed_by=$2,reviewed_at=NOW()
      WHERE id=$3 AND tenant_id=$4 AND menu_ref=$5 AND menu_version=$6 AND review_status='pending' RETURNING *`,
      [req.body.decision,String(req.userId),req.params.id,tenantId,req.params.menuRef,version]);
    if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Pending label not found'});}
    await client.query(`INSERT INTO menu_workflow_audit(tenant_id,menu_ref,menu_version,from_status,to_status,actor_id,actor_role,reason,evidence,correlation_id)
      VALUES($1,$2,$3,'pending',$4,$5,$6,$7,$8::jsonb,$9)`,[tenantId,req.params.menuRef,version,req.body.decision,String(req.userId),req.userRole||'viewer',String(req.body.reason),JSON.stringify({evidenceKind:'label',evidenceId:result.rows[0].id}),randomUUID()]);
    await client.query('COMMIT');res.json(result.rows[0]);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}catch(e:any){res.status(500).json({error:'Could not review evidence label'});}});
router.post('/menus/:menuRef/versions/:version/translations',async(req:AuthRequest,res:Response)=>{try{
  if(!['admin','manager','operator','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu editor role required'});
  const tenantId=tenantOf(req),version=Number(req.params.version),body=req.body||{};
  const menu=(await pool.query('SELECT normalized_menu,currency FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3',[tenantId,req.params.menuRef,version])).rows[0];
  if(!menu)return res.status(404).json({error:'Menu version not found'});
  const names=Object.fromEntries((menu.normalized_menu?.sections||[]).flatMap((section:any)=>(section.items||[]).map((item:any)=>[item.name,item.name])));
  if(!body.translated_menu||Object.keys(names).some(name=>typeof body.translated_menu[name]!=='string'||!body.translated_menu[name].trim()))return res.status(400).json({error:'Every source dish needs a nonempty translated name'});
  validateTranslation({source:names,target:body.translated_menu,protected_names:body.protected_names,locale:body.locale,currency:menu.currency,round_trip_score:body.round_trip_score});
  if(!body.terminology_version)return res.status(400).json({error:'Terminology version required'});
  const result=await pool.query(`INSERT INTO menu_translations(tenant_id,menu_ref,menu_version,locale,terminology_version,translated_menu,protected_names,round_trip_score)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) RETURNING *`,[tenantId,req.params.menuRef,version,body.locale,body.terminology_version,JSON.stringify(body.translated_menu),JSON.stringify(body.protected_names),body.round_trip_score]);
  res.status(201).json(result.rows[0]);
}catch(e:any){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Translation already exists':e.message});}});
router.post('/menus/:menuRef/versions/:version/translations/:id/review',async(req:AuthRequest,res:Response)=>{try{
  if(!['admin','manager','menu_manager'].includes(req.userRole||''))return res.status(403).json({error:'Menu reviewer role required'});
  if(!['approved','rejected'].includes(req.body?.decision)||!String(req.body?.reason||'').trim())return res.status(400).json({error:'Decision and reason required'});
  const tenantId=tenantOf(req),version=Number(req.params.version);
  const menu=(await pool.query('SELECT created_by FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3',[tenantId,req.params.menuRef,version])).rows[0];
  if(!menu)return res.status(404).json({error:'Menu version not found'});
  if(String(menu.created_by)===String(req.userId))return res.status(403).json({error:'Menu creator cannot approve their own translation'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`UPDATE menu_translations SET review_status=$1,reviewed_by=$2,reviewed_at=NOW()
      WHERE id=$3 AND tenant_id=$4 AND menu_ref=$5 AND menu_version=$6 AND review_status='pending' RETURNING *`,
      [req.body.decision,String(req.userId),req.params.id,tenantId,req.params.menuRef,version]);
    if(!result.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Pending translation not found'});}
    await client.query(`INSERT INTO menu_workflow_audit(tenant_id,menu_ref,menu_version,from_status,to_status,actor_id,actor_role,reason,evidence,correlation_id)
      VALUES($1,$2,$3,'pending',$4,$5,$6,$7,$8::jsonb,$9)`,[tenantId,req.params.menuRef,version,req.body.decision,String(req.userId),req.userRole||'viewer',String(req.body.reason),JSON.stringify({evidenceKind:'translation',evidenceId:result.rows[0].id}),randomUUID()]);
    await client.query('COMMIT');res.json(result.rows[0]);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}catch(e:any){res.status(500).json({error:'Could not review translation'});}});

router.post('/menus/:menuRef/versions/:version/web-publish',async(req:AuthRequest,res:Response)=>{
  const tenantId=tenantOf(req),menuRef=req.params.menuRef,version=Number(req.params.version),actorId=String(req.userId),role=req.userRole||'viewer';
  if(!['operator','menu_manager','admin'].includes(role))return res.status(403).json({error:'Menu publishing authority required'});
  const reason=String(req.body?.reason||'').trim();
  if(!reason)return res.status(400).json({error:'Publication reason required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const menu=(await client.query('SELECT * FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3 FOR UPDATE',[tenantId,menuRef,version])).rows[0];
    if(!menu){await client.query('ROLLBACK');return res.status(404).json({error:'Menu version not found'});}
    if(menu.channel!=='web'){await client.query('ROLLBACK');return res.status(409).json({error:'Web publication requires a web-channel menu version'});}
    const existing=(await client.query('SELECT * FROM governed_web_menu_routes WHERE tenant_id=$1 AND menu_ref=$2 AND location_ref=$3 FOR UPDATE',[tenantId,menuRef,menu.location_ref])).rows[0];
    if(menu.status==='published'&&Number(existing?.live_version)===version){
      const prior=(await client.query("SELECT provider_receipt FROM menu_publications WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND channel='web' AND status='delivered' ORDER BY id DESC LIMIT 1",[tenantId,menuRef,version])).rows[0];
      if(!prior?.provider_receipt){await client.query('ROLLBACK');return res.status(409).json({error:'Live menu has no publication receipt'});}
      await client.query('COMMIT');return res.json({replayed:true,providerReceipt:prior.provider_receipt,publicPath:`/web-menu/${existing.public_token}`});
    }
    if(menu.status!=='scheduled'){await client.query('ROLLBACK');return res.status(409).json({error:'Approved and scheduled menu version required'});}
    const source=(await client.query(`SELECT s.bytes,s.sha256 FROM menu_source_objects s JOIN menu_ingestions i ON i.tenant_id=s.tenant_id AND i.ingestion_ref=s.ingestion_ref
      WHERE s.tenant_id=$1 AND s.ingestion_ref=$2 AND s.sha256=i.source_checksum LIMIT 1`,[tenantId,menu.source_ingestion_ref])).rows[0];
    if(!source||sourceSha256(source.bytes)!==source.sha256){await client.query('ROLLBACK');return res.status(409).json({error:'Stored, checksum-matched original menu source required for hosted publication'});}
    if(existing?.live_version!=null&&Number(existing.live_version)===version){await client.query('ROLLBACK');return res.status(409).json({error:'Scheduled version is already the live menu'});}
    const rollbackVersion=existing?.live_version==null?0:Number(existing.live_version);
    const publicToken=existing?.public_token||randomUUID();
    const receipt=`webmenu:${publicToken}:v${version}`;
    validateTransition('scheduled','published',{actorId,createdBy:menu.created_by,role,providerReceipt:receipt,rollbackVersion});
    if(existing){await client.query('UPDATE governed_web_menu_routes SET live_version=$1,previous_version=$2,updated_at=NOW() WHERE id=$3',[version,rollbackVersion||null,existing.id]);}
    else{await client.query('INSERT INTO governed_web_menu_routes(tenant_id,menu_ref,location_ref,public_token,live_version) VALUES($1,$2,$3,$4,$5)',[tenantId,menuRef,menu.location_ref,publicToken,version]);}
    if(rollbackVersion>0&&rollbackVersion!==version){await client.query("UPDATE menu_versions SET status='rolled_back' WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3 AND status='published'",[tenantId,menuRef,rollbackVersion]);}
    await client.query("UPDATE menu_versions SET status='published',effective_at=NOW(),supersedes_version=$1 WHERE tenant_id=$2 AND menu_ref=$3 AND version=$4",[rollbackVersion||null,tenantId,menuRef,version]);
    await client.query(`INSERT INTO menu_publications(tenant_id,menu_ref,menu_version,channel,idempotency_key,status,scheduled_at,availability,provider_receipt,rollback_version,attempts)
      VALUES($1,$2,$3,'web',$4,'delivered',NOW(),$5::jsonb,$6,$7,1)
      ON CONFLICT(tenant_id,channel,idempotency_key) DO UPDATE SET status='delivered',scheduled_at=NOW(),availability=EXCLUDED.availability,provider_receipt=EXCLUDED.provider_receipt,rollback_version=EXCLUDED.rollback_version,attempts=menu_publications.attempts+1`,[tenantId,menuRef,version,`webmenu:${menuRef}:v${version}`,JSON.stringify(menu.availability||{}),receipt,rollbackVersion]);
    await client.query(`INSERT INTO menu_workflow_audit(tenant_id,menu_ref,menu_version,from_status,to_status,actor_id,actor_role,reason,evidence,correlation_id)
      VALUES($1,$2,$3,'scheduled','published',$4,$5,$6,$7::jsonb,$8)`,[tenantId,menuRef,version,actorId,role,reason,JSON.stringify({provider:'hosted_web_menu',providerReceipt:receipt,rollbackVersion,publicToken}),randomUUID()]);
    await client.query('COMMIT');res.status(201).json({providerReceipt:receipt,rollbackVersion,publicPath:`/web-menu/${publicToken}`});
  }catch(e:any){await client.query('ROLLBACK');res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Web publication already exists':'Could not publish web menu'});}finally{client.release();}
});

router.post('/menus/:menuRef/versions/:version/web-rollback',async(req:AuthRequest,res:Response)=>{
  const tenantId=tenantOf(req),menuRef=req.params.menuRef,version=Number(req.params.version),actorId=String(req.userId),role=req.userRole||'viewer';
  if(!['operator','menu_manager','admin'].includes(role))return res.status(403).json({error:'Menu publishing authority required'});
  const reason=String(req.body?.reason||'').trim();
  if(!reason)return res.status(400).json({error:'Rollback reason required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const menu=(await client.query('SELECT * FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3 FOR UPDATE',[tenantId,menuRef,version])).rows[0];
    if(!menu){await client.query('ROLLBACK');return res.status(404).json({error:'Menu version not found'});}
    const route=(await client.query('SELECT * FROM governed_web_menu_routes WHERE tenant_id=$1 AND menu_ref=$2 AND location_ref=$3 FOR UPDATE',[tenantId,menuRef,menu.location_ref])).rows[0];
    if(!route||Number(route.live_version)!==version||menu.status!=='published'){await client.query('ROLLBACK');return res.status(409).json({error:'This version is not the live web menu'});}
    validateTransition('published','rolled_back',{actorId,createdBy:menu.created_by,role});
    const restoreVersion=route.previous_version==null?null:Number(route.previous_version);
    await client.query('UPDATE governed_web_menu_routes SET live_version=$1,previous_version=NULL,updated_at=NOW() WHERE id=$2',[restoreVersion,route.id]);
    await client.query("UPDATE menu_versions SET status='rolled_back' WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3",[tenantId,menuRef,version]);
    if(restoreVersion!==null){await client.query("UPDATE menu_versions SET status='published' WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3",[tenantId,menuRef,restoreVersion]);}
    await client.query("UPDATE menu_publications SET status='rolled_back' WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND channel='web' AND status='delivered'",[tenantId,menuRef,version]);
    await client.query(`INSERT INTO menu_workflow_audit(tenant_id,menu_ref,menu_version,from_status,to_status,actor_id,actor_role,reason,evidence,correlation_id)
      VALUES($1,$2,$3,'published','rolled_back',$4,$5,$6,$7::jsonb,$8)`,[tenantId,menuRef,version,actorId,role,reason,JSON.stringify({restoredVersion:restoreVersion,publicToken:route.public_token}),randomUUID()]);
    await client.query('COMMIT');res.json({restoredVersion:restoreVersion,publicPath:restoreVersion===null?null:`/web-menu/${route.public_token}`});
  }catch(e:any){await client.query('ROLLBACK');res.status(500).json({error:'Could not roll back web menu'});}finally{client.release();}
});

router.post('/menus/:menuRef/versions/:version/transition',async(req:AuthRequest,res:Response)=>{try{
  const tenantId=tenantOf(req),menuRef=req.params.menuRef,version=Number(req.params.version),to=String(req.body?.to||'');
  const context:Record<string,unknown>={};
  if(to==='approved'){
    const [labels,translations]=await Promise.all([
      pool.query("SELECT count(*)::int AS count FROM menu_evidence_labels WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND review_status='approved'",[tenantId,menuRef,version]),
      pool.query("SELECT 1 FROM menu_translations WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND review_status='approved' LIMIT 1",[tenantId,menuRef,version]),
    ]);
    context.labelEvidenceCount=labels.rows[0]?.count||0;
    context.translationReviewed=Boolean(translations.rows[0]);
  }
  if(to==='published'){
    const publication=await pool.query("SELECT provider_receipt,rollback_version FROM menu_publications WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND status='delivered' AND provider_receipt IS NOT NULL ORDER BY id DESC LIMIT 1",[tenantId,menuRef,version]);
    context.providerReceipt=publication.rows[0]?.provider_receipt||null;
    context.rollbackVersion=publication.rows[0]?.rollback_version||null;
  }
  res.json(await transitionMenu({tenantId,actorId:String(req.userId),role:req.userRole||'viewer',menuRef,version,to,reason:req.body?.reason,correlationId:req.body?.correlation_id,context}));
}catch(e:any){res.status(e.code==='NOT_FOUND'?404:409).json({error:e.message});}});
export default router;
