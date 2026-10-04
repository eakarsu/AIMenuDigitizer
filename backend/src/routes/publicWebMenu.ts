import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { publicMenuPayload } from '../domain/webMenu';

const router=Router();
router.get('/:token',async(req:Request,res:Response)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.token))return res.status(404).json({error:'Web menu not found'});
  try{
    const version=(await pool.query(`SELECT v.tenant_id,v.menu_ref,v.version,v.restaurant_ref,v.location_ref,v.currency,v.normalized_menu,v.availability
      FROM governed_web_menu_routes r JOIN menu_versions v ON v.tenant_id=r.tenant_id AND v.menu_ref=r.menu_ref AND v.version=r.live_version AND v.location_ref=r.location_ref
      WHERE r.public_token=$1 AND r.live_version IS NOT NULL AND v.status='published'`,[req.params.token])).rows[0];
    if(!version)return res.status(404).json({error:'Web menu not found'});
    const [labels,translations]=await Promise.all([
      pool.query("SELECT item_ref,label_type,label_name FROM menu_evidence_labels WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND review_status='approved'",[version.tenant_id,version.menu_ref,version.version]),
      pool.query("SELECT locale,translated_menu FROM menu_translations WHERE tenant_id=$1 AND menu_ref=$2 AND menu_version=$3 AND review_status='approved'",[version.tenant_id,version.menu_ref,version.version]),
    ]);
    res.set('Cache-Control','no-store');
    res.json(publicMenuPayload(version,labels.rows,translations.rows));
  }catch{res.status(500).json({error:'Could not load web menu'});}
});
export default router;
