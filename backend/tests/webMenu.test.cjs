require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'Node'}});
const test=require('node:test');
const assert=require('node:assert/strict');
const { validateAvailability, publicMenuPayload }=require('../src/domain/webMenu.ts');
const { detectMenuSource, sourceSha256 }=require('../src/domain/menuSource.ts');

const menu={restaurant_ref:'restaurant-a',location_ref:'location-b',menu_ref:'dinner',version:2,currency:'USD',normalized_menu:{sections:[{name:'Mains',items:[{id:'soup',name:'Soup',price:8.5},{id:'salad',name:'Salad',price:9}]}]},availability:{soup:false,salad:true}};

test('location availability can only cite real corrected items',()=>{
  assert.throws(()=>validateAvailability(menu.normalized_menu,{other:false}),/corrected menu item/);
  assert.throws(()=>validateAvailability(menu.normalized_menu,{soup:'false'}),/boolean state/);
  assert.deepEqual(validateAvailability(menu.normalized_menu,{soup:false}),{soup:false});
});

test('public payload marks unavailable items and includes only supplied reviewed labels',()=>{
  const result=publicMenuPayload(menu,[{item_ref:'soup',label_type:'ingredient',label_name:'milk'}],[]);
  assert.equal(result.locationRef,'location-b');
  assert.equal(result.sections[0].items[0].available,false);
  assert.equal(result.sections[0].items[1].available,true);
  assert.equal(result.reviewedLabels[0].name,'milk');
});

test('source type and checksum are derived from uploaded bytes',()=>{
  const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
  assert.equal(detectMenuSource(png).mimeType,'image/png');
  assert.equal(sourceSha256(png).length,64);
  assert.equal(detectMenuSource(Buffer.from('<script>bad')),null);
});
