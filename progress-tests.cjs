const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {context,writes}=require('./export-tests.cjs');vm.runInContext(fs.readFileSync('export-client.js','utf8'),context);
const data={requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',name:'Large',access:'private',rows:Array.from({length:85},(_,i)=>({id:'minecraft:test_'+i,name:'Блок '+i,count:i+1,done:i%2===0,image:''}))};
(async()=>{
 const events=[];let lost=true;const writesBefore=writes.length;
 const rpc=async(method,...args)=>{const result=context[method](...args);if(method==='appendMaterialRows'&&lost){lost=false;throw Error('Lost response after committed chunk');}return result;};
 await assert.rejects(()=>context.runGoogleExport(data,rpc,p=>events.push(p)),/Lost response/);
 assert(!events.some(p=>p.percent===100));assert.equal(context.loadJob_(data.requestId).next,40);
 const beforeRetry=writes.length;assert.equal(context.appendMaterialRows(data.requestId,0,data.rows.slice(0,40)).next,40);assert.equal(writes.length,beforeRetry);
 assert.throws(()=>context.finishMaterialSheet(data.requestId),/Не все/);
 await context.runGoogleExport(data,rpc,p=>events.push(p));
 const record=context.loadJob_(data.requestId);assert.equal(record.next,85);assert.equal(record.writtenBlocks,3655);assert.equal(record.result.access,'private');
 const chunks=writes.slice(writesBefore).filter(w=>w.method==='setValues'&&w.coordinates.length===4&&w.coordinates[3]===7&&w.coordinates[0]>=5);
 assert.deepEqual(chunks.map(c=>c.coordinates),[[5,1,40,7],[45,1,40,7],[85,1,5,7]]);
 assert.equal(events.at(-1).percent,100);assert(events.some(p=>p.done===40));assert(events.some(p=>p.done===80));assert(events.some(p=>p.percent===94));
 const prev=writes.length;await context.runGoogleExport(data,rpc,()=>{});assert.equal(writes.length,prev);
 const first=context.loadJob_(data.requestId);assert.throws(()=>context.appendMaterialRows(data.requestId,0,data.rows.slice(0,40)),/порядок/);
 console.log('PASS real server/client chunk flow: 40/80/85 rows, failure after commit, resume without duplicate rows, final idempotency and 100% only after finish.');
})().catch(e=>{console.error(e);process.exit(1)});
