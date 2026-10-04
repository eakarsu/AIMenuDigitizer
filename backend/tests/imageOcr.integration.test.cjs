'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');

function available(binary){try{execFileSync(binary,[binary==='pdftoppm'?'-v':'--version'],{stdio:'ignore'});return true;}catch{return false;}}

test('stored image and scanned PDF OCR are tenant-scoped candidates tied to original bytes',{
  skip:!process.env.MENU_WORKFLOW_TEST_DATABASE_URL||!available('magick')||!available('tesseract')||!available('pdftoppm'),
},async()=>{
  process.env.DATABASE_URL=process.env.MENU_WORKFLOW_TEST_DATABASE_URL;
  process.env.JWT_SECRET='codex-disposable-menu-integration-secret-2026';
  const express=require('express');
  const jwt=require('jsonwebtoken');
  const pool=require('../dist/db/connection').default;
  const governed=require('../dist/routes/menuWorkflow').default;
  const app=express();app.use(express.json());app.use('/api/menu-workflow',governed);
  const server=await new Promise(resolve=>{const started=app.listen(0,'127.0.0.1',()=>resolve(started));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const token=id=>jwt.sign({userId:id,role:'menu_manager'},process.env.JWT_SECRET);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'menu-ocr-'));
  const imagePath=path.join(directory,'source.png');
  const sourceRef=`ocr-${Date.now()}`;
  try{
    execFileSync('magick',['-size','1200x360','xc:white','-font','Helvetica','-pointsize','70','-fill','black','-annotate','+40+130','Burger 12.00','-annotate','+40+250','Salad 9.50',imagePath]);
    const bytes=fs.readFileSync(imagePath);
    const upload=new FormData();upload.append('source',new Blob([bytes],{type:'image/png'}),'source.png');upload.append('ingestion_ref',sourceRef);upload.append('idempotency_key',sourceRef);
    const submitted=await fetch(`${base}/api/menu-workflow/ingestions/upload`,{method:'POST',headers:{Authorization:`Bearer ${token(101)}`},body:upload});
    assert.equal(submitted.status,201,await submitted.text());
    const extracted=await fetch(`${base}/api/menu-workflow/ingestions/${sourceRef}/image-ocr`,{method:'POST',headers:{Authorization:`Bearer ${token(101)}`,'Content-Type':'application/json'},body:'{}'});
    const candidate=await extracted.json();
    assert.equal(extracted.status,200,JSON.stringify(candidate));
    assert.match(candidate.extractedText,/Burger 12\.00/);
    assert.equal(candidate.correctionRequired,true);
    assert.ok(candidate.ocrConfidence>0);
    const saved=await fetch(`${base}/api/menu-workflow/ingestions/${sourceRef}/text`,{headers:{Authorization:`Bearer ${token(101)}`}});
    assert.equal(saved.status,200);
    assert.equal((await saved.json()).extractedText,candidate.extractedText);
    const other=await fetch(`${base}/api/menu-workflow/ingestions/${sourceRef}/text`,{headers:{Authorization:`Bearer ${token(102)}`}});
    assert.equal(other.status,404);

    const pdfPath=path.join(directory,'scanned.pdf');
    const PDFDocument=require('pdfkit');
    const document=new PDFDocument({size:[1200,360],margin:0});
    const output=fs.createWriteStream(pdfPath);
    document.pipe(output);document.image(imagePath,0,0,{width:1200,height:360});document.end();
    await once(output,'finish');
    const pdfRef=`pdf-${sourceRef}`;
    const pdfUpload=new FormData();pdfUpload.append('source',new Blob([fs.readFileSync(pdfPath)],{type:'application/pdf'}),'scanned.pdf');pdfUpload.append('ingestion_ref',pdfRef);pdfUpload.append('idempotency_key',pdfRef);
    const pdfSubmitted=await fetch(`${base}/api/menu-workflow/ingestions/upload`,{method:'POST',headers:{Authorization:`Bearer ${token(101)}`},body:pdfUpload});
    assert.equal(pdfSubmitted.status,201,await pdfSubmitted.text());
    const pdfExtracted=await fetch(`${base}/api/menu-workflow/ingestions/${pdfRef}/scan-ocr`,{method:'POST',headers:{Authorization:`Bearer ${token(101)}`,'Content-Type':'application/json'},body:'{}'});
    const pdfCandidate=await pdfExtracted.json();
    assert.equal(pdfExtracted.status,200,JSON.stringify(pdfCandidate));
    assert.equal(pdfCandidate.pagesProcessed,1);
    assert.match(pdfCandidate.extractedText,/Burger 12\.00/);
  }finally{
    fs.rmSync(directory,{recursive:true,force:true});
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
