const fs=require('node:fs'),assert=require('node:assert/strict');
const {context,writes}=require('./export-tests.cjs');let indexReads=0;
const htmlOutput=html=>({getContent:()=>html,setTitle(){return this},addMetaTag(){return this}});
context.HtmlService={createHtmlOutput:htmlOutput,createHtmlOutputFromFile(){indexReads++;throw Error('HTML-файл с именем Index не найден.');}};
context.Utilities.Charset={UTF_8:'utf-8'};
const data={requestId:'dddddddd-dddd-dddd-dddd-dddddddddddd',name:'Проверка передачи · дом 🏠',access:'private',rows:[{id:'minecraft:stone',name:'Камень',type:'Камень',count:100,done:true,image:''},{id:'minecraft:andesite',name:'Андезит',type:'Андезит',count:3,done:false,image:''}]};
const landing=context.doGet().getContent();assert(landing.includes('Google подключён'));assert(!landing.includes('Index не найден'));assert.equal(indexReads,1);
for(const event of [{parameter:{payload:JSON.stringify(data)}},{postData:{contents:JSON.stringify(data)}},{postData:{contents:'payload='+encodeURIComponent(JSON.stringify(data))}}]){
 const html=context.doPost(event).getContent();assert.equal(indexReads,1,'POST must not read Index');
 const encoded=html.match(/id="bridge-payload">([^<]*)<\/textarea>/)[1];assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')),data);
 assert(html.includes('Создать таблицу'));assert(html.includes('async function runGoogleExport'));assert(!html.includes('/*BRIDGE_CLIENT*/'));
}
assert(context.doPost({}).getContent().includes('Список не передан'));
assert(context.doPost({parameter:{payload:'broken'}}).getContent().includes('Список повреждён'));
assert(context.doPost({parameter:{payload:JSON.stringify({...data,access:'bad'})}}).getContent().includes('Некорректные параметры'));
const escaped=context.materialBridgePage_(null,'<img src=x onerror=alert(1)>').getContent();assert(escaped.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(!escaped.includes('<img src=x'));
console.log('PASS Google bridge: reproduced missing Index; GET and POST recover; UTF-8 form/raw payloads and type survive; errors are specific and escaped.');
if(process.argv.includes('--preview')){
 const http=require('node:http');
 const shim=`<script>google={script:{run:new Proxy({},{get(_,method){if(method==='withSuccessHandler')return success=>new Proxy({},{get(_,key){if(key==='withFailureHandler')return failure=>new Proxy({},{get(_,name){return async(...args)=>{try{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:name,args})});const data=await r.json();if(data.error)throw Error(data.error);success(data.result);}catch(e){failure(e);}}}});}});}})}};</script>`;
 http.createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url==='/rpc'){let body='';for await(const chunk of req)body+=chunk;try{const {method,args}=JSON.parse(body);if(!['beginMaterialSheet','appendMaterialRows','finishMaterialSheet'].includes(method))throw Error('Unknown RPC');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result:context[method](...args)}));}catch(e){res.end(JSON.stringify({error:e.message}));}return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end((req.url==='/empty'?landing:context.doPost({parameter:{payload:JSON.stringify(data)}}).getContent()).replace('</head>',shim+'</head>'));
 }).listen(8786,'127.0.0.1',()=>console.log('Bridge QA: http://127.0.0.1:8786/ (Google service mocked; actual Code.gs export handlers)'));
}
