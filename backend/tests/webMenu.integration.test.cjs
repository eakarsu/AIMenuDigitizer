'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');

test('two-account reviewed menu publishes to a location URL and rolls back', {skip:!process.env.MENU_WORKFLOW_TEST_DATABASE_URL}, async()=>{
  process.env.DATABASE_URL=process.env.MENU_WORKFLOW_TEST_DATABASE_URL;
  process.env.JWT_SECRET='codex-disposable-menu-integration-secret-2026';
  const express=require('express');
  const jwt=require('jsonwebtoken');
  const pool=require('../dist/db/connection').default;
  const governed=require('../dist/routes/menuWorkflow').default;
  const publicMenu=require('../dist/routes/publicWebMenu').default;
  const app=express();app.use(express.json());app.use('/api/menu-workflow',governed);app.use('/api/public-web-menu',publicMenu);
  const server=await new Promise(resolve=>{const started=app.listen(0,'127.0.0.1',()=>resolve(started));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const token=id=>jwt.sign({userId:id,role:'menu_manager'},process.env.JWT_SECRET);
  async function call(path,id,body,method='POST'){
    const response=await fetch(`${base}${path}`,{method,headers:{...(id?{Authorization:`Bearer ${token(id)}`,'X-Menu-Workspace-Id':'101'}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text.slice(0,500);}return {status:response.status,data};
  }
  const menuRef=`dinner-${Date.now()}`;
  const path=`/api/menu-workflow/menus/${menuRef}/versions/1`;
  try{
    await pool.query('INSERT INTO users(id) VALUES(101),(102) ON CONFLICT DO NOTHING');
    await pool.query('INSERT INTO menu_workflow_memberships(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',['101',102]);
    const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0,1,2,3]);
    const upload=new FormData();upload.append('source',new Blob([bytes],{type:'image/png'}),'menu.png');upload.append('ingestion_ref',`scan-${menuRef}`);upload.append('idempotency_key',`scan-${menuRef}`);
    const uploadResponse=await fetch(`${base}/api/menu-workflow/ingestions/upload`,{method:'POST',headers:{Authorization:`Bearer ${token(101)}`,'X-Menu-Workspace-Id':'101'},body:upload});
    assert.equal(uploadResponse.status,201,await uploadResponse.text());
    const storedSource=await fetch(`${base}/api/menu-workflow/ingestions/scan-${menuRef}/source`,{headers:{Authorization:`Bearer ${token(101)}`,'X-Menu-Workspace-Id':'101'}});
    assert.equal(storedSource.status,200);
    assert.deepEqual(Buffer.from(await storedSource.arrayBuffer()),bytes);
    const created=await call(`/api/menu-workflow/menus/${menuRef}/versions`,101,{version:1,restaurant_ref:'Restaurant A',location_ref:'Downtown',channel:'web',source_ingestion_ref:`scan-${menuRef}`,normalized_menu:{currency:'USD',sections:[{name:'Mains',items:[{id:'soup',name:'Soup',price:8.5}]}]},availability:{soup:false}});
    assert.equal(created.status,201,JSON.stringify(created.data));
    const label=await call(`${path}/labels`,101,{item_ref:'soup',label_type:'ingredient',label_name:'milk',evidence_ref:'supplier-1',evidence_version:'v1',evidence_checksum:'b'.repeat(64)});
    assert.equal(label.status,201,JSON.stringify(label.data));
    const translation=await call(`${path}/translations`,101,{locale:'tr',terminology_version:'v1',translated_menu:{Soup:'Soup'},protected_names:['Soup'],round_trip_score:0.96});
    assert.equal(translation.status,201,JSON.stringify(translation.data));
    assert.equal((await call(`${path}/labels/${label.data.id}/review`,102,{decision:'approved',reason:'Matched supplier label'})).status,200);
    assert.equal((await call(`${path}/translations/${translation.data.id}/review`,102,{decision:'approved',reason:'Checked protected name'})).status,200);
    for(const to of ['compliance_review','translation_review','approved','scheduled']){
      const result=await call(`${path}/transition`,102,{to,reason:`Reviewed ${to}`,correlation_id:crypto.randomUUID()});
      assert.equal(result.status,200,`${to}: ${JSON.stringify(result.data)}`);
    }
    const published=await call(`${path}/web-publish`,102,{reason:'Publish reviewed downtown menu'});
    assert.equal(published.status,201,JSON.stringify(published.data));
    const publicToken=published.data.publicPath.split('/').pop();
    const visible=await call(`/api/public-web-menu/${publicToken}`,null,null,'GET');
    assert.equal(visible.status,200,JSON.stringify(visible.data));
    assert.equal(visible.data.sections[0].items[0].available,false);
    assert.equal(visible.data.reviewedLabels[0].name,'milk');
    const path2=`/api/menu-workflow/menus/${menuRef}/versions/2`;
    const created2=await call(`/api/menu-workflow/menus/${menuRef}/versions`,101,{version:2,restaurant_ref:'Restaurant A',location_ref:'Downtown',channel:'web',source_ingestion_ref:`scan-${menuRef}`,normalized_menu:{currency:'USD',sections:[{name:'Mains',items:[{id:'soup',name:'Soup',price:10}]}]},availability:{soup:true}});
    assert.equal(created2.status,201,JSON.stringify(created2.data));
    const label2=await call(`${path2}/labels`,101,{item_ref:'soup',label_type:'ingredient',label_name:'milk',evidence_ref:'supplier-1',evidence_version:'v2',evidence_checksum:'c'.repeat(64)});
    const translation2=await call(`${path2}/translations`,101,{locale:'tr',terminology_version:'v2',translated_menu:{Soup:'Soup'},protected_names:['Soup'],round_trip_score:0.97});
    assert.equal(label2.status,201,JSON.stringify(label2.data));
    assert.equal(translation2.status,201,JSON.stringify(translation2.data));
    assert.equal((await call(`${path2}/labels/${label2.data.id}/review`,102,{decision:'approved',reason:'Matched updated supplier label'})).status,200);
    assert.equal((await call(`${path2}/translations/${translation2.data.id}/review`,102,{decision:'approved',reason:'Checked updated protected name'})).status,200);
    for(const to of ['compliance_review','translation_review','approved','scheduled']){
      const result=await call(`${path2}/transition`,102,{to,reason:`Reviewed version 2 ${to}`,correlation_id:crypto.randomUUID()});
      assert.equal(result.status,200,`${to}: ${JSON.stringify(result.data)}`);
    }
    const published2=await call(`${path2}/web-publish`,102,{reason:'Publish reviewed second version'});
    assert.equal(published2.status,201,JSON.stringify(published2.data));
    assert.equal(published2.data.publicPath,published.data.publicPath);
    const secondVisible=await call(`/api/public-web-menu/${publicToken}`,null,null,'GET');
    assert.equal(secondVisible.data.version,2);
    assert.equal(secondVisible.data.sections[0].items[0].available,true);
    assert.equal((await call(`${path2}/web-rollback`,102,{reason:'Restore prior published menu'})).status,200);
    const restored=await call(`/api/public-web-menu/${publicToken}`,null,null,'GET');
    assert.equal(restored.data.version,1);
    assert.equal(restored.data.sections[0].items[0].available,false);
    assert.equal((await call(`${path}/web-rollback`,102,{reason:'Withdraw outdated menu'})).status,200);
    assert.equal((await call(`/api/public-web-menu/${publicToken}`,null,null,'GET')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
