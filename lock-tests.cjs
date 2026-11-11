const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {context}=require('./export-tests.cjs');vm.runInContext(fs.readFileSync('export-client.js','utf8'),context);
let held=false,blocked=false,claims=0,releases=0,creates=0,clock=1000000;
context.Date={now:()=>clock};
context.LockService={getUserLock(){throw Error('Exception: Тайм-аут блокировки: legacy process owns UserLock');},getScriptLock:()=>({tryLock(){if(blocked||held)return false;held=true;claims++;return true;},releaseLock(){assert(held);held=false;releases++;}})};
const baseBook=context.SpreadsheetApp.openById('test-book'),books=new Map();
const native=(fn)=>(...args)=>{assert(!held,'Sheets/Drive must never run inside the shared lock');return fn(...args);};
const spreadsheet={...context.SpreadsheetApp};
for(const [name,fn] of Object.entries(spreadsheet))if(typeof fn==='function')context.SpreadsheetApp[name]=native(fn);
context.SpreadsheetApp.create=native(()=>{const id='book-'+(++creates),book={...baseBook,getId:()=>id,getUrl:()=>'https://docs.google.com/spreadsheets/d/'+id+'/edit'};books.set(id,book);return book;});
context.SpreadsheetApp.openById=native(id=>books.get(id)||baseBook);
const meta=(id)=>({requestId:id,name:'Lock regression',access:'private',totalRows:1,totalBlocks:7});
const a=meta('10000000-0000-0000-0000-000000000001'),b=meta('10000000-0000-0000-0000-000000000002');
blocked=true;assert.equal(context.beginMaterialSheet(a).busy,true);assert.equal(creates,0);assert.equal(releases,0);blocked=false;
const create=context.SpreadsheetApp.create;let simultaneous=false;
context.SpreadsheetApp.create=native(()=>{
 if(!simultaneous){simultaneous=true;assert.equal(context.beginMaterialSheet(a).busy,true,'duplicate in-flight request waits');assert.equal(creates,0);assert(!context.beginMaterialSheet(b).busy,'independent job continues while A is creating');}
 return create();
});
context.beginMaterialSheet(a);assert.equal(creates,2);assert.notEqual(context.loadJob_(a.requestId).bookId,context.loadJob_(b.requestId).bookId);context.beginMaterialSheet(a);assert.equal(creates,2,'repeated begin reuses existing spreadsheet');
assert(!context.loadJob_(a.requestId).leaseUntil);assert.equal(claims,releases);
// An abandoned execution stops blocking only its own job once its claim expires.
let record=context.loadJob_(a.requestId);record.leaseUntil=clock+1000;context.saveJob_(a.requestId,record);assert(context.beginMaterialSheet(a).busy);clock+=1001;assert(!context.beginMaterialSheet(a).busy);assert.equal(creates,2);
// Formatting failure clears the reservation and preserves the created spreadsheet.
const c=meta('10000000-0000-0000-0000-000000000003'),flush=context.SpreadsheetApp.flush;let fail=true;
context.SpreadsheetApp.flush=native(()=>{if(fail){fail=false;throw Error('Formatting interrupted');}return flush();});
assert.throws(()=>context.beginMaterialSheet(c),/Formatting interrupted/);const created=creates;assert(context.loadJob_(c.requestId).bookId);assert(!context.loadJob_(c.requestId).leaseUntil);context.beginMaterialSheet(c);assert.equal(creates,created);context.SpreadsheetApp.flush=flush;
const rows=[{id:'minecraft:stone',name:'Камень',type:'Камень',count:7,done:false,image:''}];
(async()=>{
 const data={...meta('10000000-0000-0000-0000-000000000004'),rows},events=[],delays=[],calls={};let legacyFailures=2;
 const rpc=async(method,...args)=>{calls[method]=(calls[method]||0)+1;
  if(method==='beginMaterialSheet'&&legacyFailures-->0)throw Error('Exception: Тайм-аут блокировки: другой процесс слишком долго удерживает блокировку.');
  if(method!=='beginMaterialSheet'&&calls[method]===1)return {busy:true,message:'Ожидание запроса',retryAfterMs:1500};
  return context[method](...args);
 };
 const result=await context.runGoogleExport(data,rpc,p=>events.push(p),async ms=>delays.push(ms));assert(result.url);assert.equal(events.at(-1).percent,100);assert.equal(delays.length,4);assert.equal(context.loadJob_(data.requestId).writtenBlocks,7);assert(events.some(p=>p.label.includes('автоматически')));assert(events.some(p=>p.label==='Ожидание запроса'));
 const before=calls.beginMaterialSheet;await assert.rejects(()=>context.runGoogleExport({...data,requestId:'10000000-0000-0000-0000-000000000005'},async()=>{throw Error('Permission denied');},()=>{},async()=>{}),/Permission denied/);assert.equal(calls.beginMaterialSheet,before);
 let executionTimeout=true;await context.runGoogleExport({...data,requestId:'10000000-0000-0000-0000-000000000006'},async(method,...args)=>{if(executionTimeout){executionTimeout=false;throw Error('Превышено максимально допустимое время выполнения');}return context[method](...args);},()=>{},async()=>{});
 await assert.rejects(()=>context.runGoogleExport(data,async()=>{clock+=610000;throw Error('Lock timeout');},()=>{},async()=>{}),/слишком долго/);
 assert.equal(claims,releases);assert(!held);
 console.log('PASS contention: legacy UserLock cannot block new jobs; short metadata locks only; concurrent jobs independent; same-job deduplication; expired claims recover; formatting failure reuses book; client automatically retries busy/lock timeouts in all phases.');
})().catch(e=>{console.error(e);process.exit(1)});
