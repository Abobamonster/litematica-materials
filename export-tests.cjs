const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const writes=[],properties=new Map();
const range=(...coordinates)=>new Proxy({}, {get:(_,method)=>(...args)=>{
  writes.push({coordinates,method,args});return range(...coordinates);
}});
const sheet={getFilter:()=>null,getDataRange:()=>range('all'),clear(){},setName(){},getMaxRows:()=>1000,getRange:range,
  setTabColor(){},setHiddenGridlines(){},setRowHeight(){},setRowHeights(){},setColumnWidth(){},setColumnWidths(){},setFrozenRows(){},setConditionalFormatRules(){}};
const book={getId:()=> 'test-book',getSheets:()=>[sheet],getUrl:()=> 'https://docs.google.com/spreadsheets/d/test-book/edit'};
const chain=()=>new Proxy({}, {get:(_,method)=>method==='build'?()=>({rule:true}):()=>chain()});
const context={console,SpreadsheetApp:{create:()=>book,openById:()=>book,flush(){},newConditionalFormatRule:chain,
  newCellImage(){let source,title;return {setSourceUrl(value){source=value;return this},setAltTextTitle(value){title=value;return this},build(){return {valueType:'IMAGE',source,title}}}}},
  LockService:{getUserLock:()=>{throw Error('Legacy UserLock must not be used');},getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getUserProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>s,base64Encode:s=>Buffer.from(s).toString('base64')}};
vm.createContext(context);vm.runInContext(fs.readFileSync('Code.gs','utf8'),context);
const rows=[{id:'minecraft:stone',name:'Камень',type:'Камень',count:100,done:true,image:'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/6c571b0825ee27b81f01127c2bd0d4ba2c89abb9/data/1.21.4/blocks/stone.png'},
  {id:'mod:unknown',name:'Неизвестный блок',count:3,done:false,image:''}];
context.createMaterialSheet({requestId:'12345678-1234-1234-1234-123456789abc',name:'Тест',access:'private',rows});
const table=writes.find(w=>w.method==='setValues'&&JSON.stringify(w.coordinates)==='[5,1,2,7]').args[0];
assert.equal(table[0].length,7);assert.equal(table[0][1].valueType,'IMAGE');assert.equal(table[0][1].source,rows[0].image);assert.equal(table[1][1],'◇');
assert.equal(table[0][3],'Камень');assert.equal(table[1][3],'Прочее');assert(writes.some(w=>w.method==='createFilter'&&w.coordinates[3]===7));assert.equal(table[0][4],100);assert.equal(table[0][0],true);assert.equal(table[1][0],false);assert(!JSON.stringify(table).includes('minecraft:'));
assert(!writes.some(w=>w.method==='setFormulas'));const summary=writes.find(w=>w.method==='setFormula').args[0];
assert.equal(summary,'="Собрано: "&SUMPRODUCT((A5:A6=TRUE)*E5:E6)&" / "&SUM(E5:E6)&" блоков"');assert(!summary.includes(','));
assert(!fs.readFileSync('Code.gs','utf8').split('// BEGIN GENERATED GOOGLE BRIDGE')[0].match(/#(?:1d3020|c2f39a|edf4e7|59624f|d7e9c7|e1f1d4|567047)/i));
assert(!fs.readFileSync('app.js','utf8').includes('class="block-id"'));
assert(!fs.readFileSync('app.js','utf8').includes("'Блок','ID'"));
console.log('PASS export regression: native images, 7 columns without IDs, counts and checkboxes preserved, summary independent of argument separators.');
assert(context.validImage_('https://raw.githubusercontent.com/Owen1212055/mc-assets/798494f03c20bbb577dd7fcd10e8737dbc0dfc0a/item-assets/OAK_STAIRS.png'));
assert(!context.validImage_('https://evil.example/item-assets/STONE.png'));
module.exports={context,writes};
