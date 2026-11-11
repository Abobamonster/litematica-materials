(() => {
  const $=id=>document.getElementById(id),format=n=>n.toLocaleString('ru-RU');let data,busy=false;
  function feedback(text,error=false){$('feedback').textContent=text;$('feedback').className=error?'error':'';}
  const encoded=$('bridge-payload').textContent.trim();if(!encoded)return;
  try{
    data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))));
    if(!Array.isArray(data.rows)||!data.rows.length)throw Error('Список пуст. Повторите отправку с сайта.');
    $('heading').textContent='Создать таблицу материалов';$('landing').classList.add('hide');$('confirmation').classList.remove('hide');
    $('scheme-name').textContent=data.name;$('scheme-count').textContent='Позиций: '+format(data.rows.length)+' · Блоков: '+format(data.rows.reduce((sum,r)=>sum+r.count,0));
    $('scheme-access').textContent=({private:'Доступ: только вам',view:'Доступ по ссылке: просмотр',edit:'Доступ по ссылке: редактирование'})[data.access];
  }catch(error){feedback('Не удалось прочитать список: '+error.message,true);return;}
  $('create-sheet').onclick=async()=>{
    if(busy)return;busy=true;$('create-sheet').disabled=true;$('progress-area').classList.remove('hide');feedback('Не закрывайте вкладку до завершения.');
    try{
      const result=await runGoogleExport(data,materialGoogleRpc,({percent,label})=>{$('progress').value=percent;$('progress-percent').textContent=percent+'%';$('progress-label').textContent=label;});
      if(!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(result.url))throw Error('Google не вернул ссылку на таблицу. Нажмите «Продолжить создание».');
      $('sheet-link').href=result.url;$('result').classList.remove('hide');$('create-sheet').classList.add('hide');feedback(result.warning||'Таблица готова. Нажмите кнопку ниже, чтобы открыть её.',!!result.warning);
    }catch(error){feedback('Создание приостановлено: '+error.message+' Нажмите «Продолжить создание».',true);$('create-sheet').textContent='Продолжить создание';}
    finally{busy=false;$('create-sheet').disabled=false;}
  };
})();
