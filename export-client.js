async function runGoogleExport(data,rpc,onProgress=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  const meta={requestId:data.requestId,name:data.name,access:data.access,overlaps:!!data.overlaps,totalRows:data.rows.length,totalBlocks:data.rows.reduce((sum,r)=>sum+r.count,0)};
  let current={percent:2,label:'Подготовка Google Таблицы…',done:0,total:meta.totalRows};
  const progress=value=>{current=value;onProgress(value);};
  async function call(method,...args){
    let waited=0;const started=Date.now();
    for(;;){
      let result;
      try{result=await rpc(method,...args);}catch(error){
        if(!/lock timeout|тайм.?аут блокировки|exceeded maximum execution time|превышено максимально допустимое время выполнения/i.test(error.message))throw error;
        result={busy:true,retryAfterMs:2000,message:'Другой запрос ещё выполняется. Продолжу автоматически…'};
      }
      if(!result||!result.busy)return result;
      const delay=Math.max(500,Math.min(3000,Number(result.retryAfterMs)||1500));
      waited+=delay;if(Math.max(waited,Date.now()-started)>10*60*1000)throw Error('Google слишком долго выполняет предыдущий запрос. Закройте старые вкладки создания и нажмите «Продолжить создание».');
      onProgress({...current,label:result.message||'Ожидание предыдущего запроса. Продолжу автоматически…'});
      await wait(delay);
    }
  }
  progress(current);
  let job=await call('beginMaterialSheet',meta);
  if(job.result){progress({percent:100,label:'Таблица создана',done:meta.totalRows,total:meta.totalRows});return job.result;}
  const report=()=>progress({percent:5+Math.floor(85*job.next/meta.totalRows),label:'Записано видов блоков: '+job.next+' / '+meta.totalRows,done:job.next,total:meta.totalRows});
  report();
  while(job.next<meta.totalRows){
    const offset=job.next,next=await call('appendMaterialRows',data.requestId,offset,data.rows.slice(offset,offset+40));
    if(!Number.isInteger(next.next)||next.next<=offset||next.next>meta.totalRows)throw Error('Google вернул некорректный прогресс. Продолжите создание.');
    job=next;report();
  }
  progress({percent:94,label:'Все строки записаны. Настройка доступа…',done:job.next,total:meta.totalRows});
  const result=await call('finishMaterialSheet',data.requestId);
  progress({percent:100,label:'Таблица создана',done:job.next,total:meta.totalRows});return result;
}
function materialGoogleRpc(method,...args) {
  return new Promise((resolve,reject)=>{
    const run=google.script.run.withSuccessHandler(resolve).withFailureHandler(error=>reject(Error(error.message||String(error))));
    if(method==='beginMaterialSheet')run.beginMaterialSheet(...args);
    else if(method==='appendMaterialRows')run.appendMaterialRows(...args);
    else if(method==='finishMaterialSheet')run.finishMaterialSheet(...args);
    else reject(Error('Неизвестная операция экспорта.'));
  });
}
