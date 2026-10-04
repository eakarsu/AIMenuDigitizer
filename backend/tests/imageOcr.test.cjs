require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'Node'}});
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseImageOcrTsv}=require('../src/domain/imageOcr.ts');

test('groups OCR words into source lines and preserves confidence as an unreviewed score',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const rows=[
    '5\t1\t1\t1\t1\t1\t1\t2\t30\t10\t92\tBurger',
    '5\t1\t1\t1\t1\t2\t32\t2\t30\t10\t84\t$12.00',
    '5\t1\t1\t1\t2\t1\t1\t20\t30\t10\t88\tSalad',
    '5\t1\t1\t1\t2\t2\t32\t20\t30\t10\t-1\t',
  ];
  assert.deepEqual(parseImageOcrTsv([header,...rows].join('\n')),{text:'Burger $12.00\nSalad',confidence:0.88,wordCount:3});
  assert.deepEqual(parseImageOcrTsv(header),{text:'',confidence:0,wordCount:0});
});
