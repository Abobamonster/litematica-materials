(() => {
  const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('ru-RU'), inGoogle=!!globalThis.google?.script?.run;
  let model=null, key='', checked=new Set(), filter='all', limit=200, busy=false, exportBusy=false, pendingExport=null;
  const storage={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch{return false}}};
  function message(text,error=false){$('status').className='status'+(error?' error':'');$('status').textContent=text;}
  function operation({percent,label}){$('operation').classList.remove('hide');$('operation-label').textContent=label;if(percent===null){$('operation-progress').removeAttribute('value');$('operation-percent').textContent='';}else{$('operation-progress').value=percent;$('operation-percent').textContent=percent+'%';}}
  function human(id){const name=id.split(':')[1];return ASSETS.names[name]||name.replaceAll('_',' ');}
  function image(id){return id.startsWith('minecraft:')?ASSETS.images[id.slice(10)]||'':'';}
  function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function persist(){if(!model)return;if(!storage.set(key,JSON.stringify([...checked])))message('Браузер не разрешил сохранить отметки. Они останутся только до закрытия вкладки.',true);}
  function stats(){if(!model)return;const total=model.rows.reduce((a,r)=>a+r.count,0),done=model.rows.reduce((a,r)=>a+(checked.has(r.id)?r.count:0),0),pc=total?Math.round(done/total*100):0;
    $('total').textContent=fmt(total);$('types').textContent=fmt(model.rows.length);$('percent').textContent=pc+'%';$('completed').textContent=fmt(done)+' из '+fmt(total)+' блоков';$('bar').style.width=pc+'%';}
  function orderedRows(rows){return [...rows].sort((a,b)=>{
    if($('sort').value==='group'){const order=compareMaterialGroups(materialGroup(a.id),materialGroup(b.id));if(order)return order;}
    return $('sort').value==='name'?human(a.id).localeCompare(human(b.id),'ru'):b.count-a.count||a.id.localeCompare(b.id);
  });}
  function populateGroups(){const present=new Map();for(const r of model.rows){const g=materialGroup(r.id);if(!present.has(g.key))present.set(g.key,{...g,types:0});present.get(g.key).types++;}
    $('group').innerHTML='<option value="all">Все материалы</option>'+[...present.values()].sort(compareMaterialGroups).map(g=>'<option value="'+g.key+'">'+escape(g.label)+' · '+g.types+'</option>').join('');
  }
  function render(){stats();if(!model)return;
    const q=$('search').value.toLowerCase().trim();const rows=orderedRows(model.rows.filter(r=>(!q||(r.id+' '+human(r.id)).toLowerCase().includes(q))&&(filter==='all'||checked.has(r.id)===(filter==='done'))&&($('group').value==='all'||materialGroup(r.id).key===$('group').value)));
    let lastGroup='';$('rows').innerHTML=rows.slice(0,limit).map(r=>{const url=image(r.id),g=materialGroup(r.id);let header='';
      if($('sort').value==='group'&&lastGroup!==g.key){header='<tr class="group-heading"><th scope="rowgroup" colspan="4">'+escape(g.label)+'</th></tr>';lastGroup=g.key;}
      return header+'<tr class="'+(checked.has(r.id)?'done':'')+'"><td class="check-cell"><input type="checkbox" aria-label="Собран: '+escape(human(r.id))+'" data-id="'+escape(r.id)+'" '+(checked.has(r.id)?'checked':'')+'></td><td><div class="block-cell"><div class="thumb">'+(url?'<img loading="lazy" src="'+escape(url)+'" alt="'+escape(human(r.id))+'">':'<span class="missing" title="Нет ванильной текстуры">◇</span>')+'</div><div><div class="block-name">'+escape(human(r.id))+'</div></div></div></td><td class="num">'+fmt(r.count)+'</td><td class="pack">'+Math.floor(r.count/64)+' ст. '+(r.count%64?r.count%64+' шт.':'')+'</td></tr>';}).join('')||'<tr><td colspan="4" class="empty">Нет блоков, подходящих под фильтр.</td></tr>';
    $('shown').textContent='Показано '+fmt(Math.min(limit,rows.length))+' из '+fmt(rows.length)+' позиций';$('more').classList.toggle('hide',limit>=rows.length);
  }
  function adopt(result,fingerprint,demo=false){model=result;model.demo=demo;key='litematica-v1:'+fingerprint;
    pendingExport=null;$('google').textContent='Создать Google Таблицу ↗';$('operation').classList.add('hide');
    try{checked=new Set(JSON.parse(storage.get(key)||'[]').filter(x=>typeof x==='string'));}catch{checked=new Set();}
    $('name').textContent=result.name;$('metadata').textContent=(demo?'ПРИМЕР · ':'')+result.regionCount+' обл. · '+(result.format||'Litematica')+' v'+result.version+(result.dataVersion?' · DataVersion '+result.dataVersion:'');$('metadata').classList.toggle('demo-badge',demo);
    ['export','google','reset'].forEach(id=>$(id).disabled=!result.rows.length);populateGroups();limit=200;render();showPreview(result.preview);
    const notes=[];if(demo)notes.push('Открыта демонстрационная постройка. Для вашей постройки загрузите свой файл.');else notes.push('Схема разобрана. Можно собирать материалы или создать Google Таблицу.');
    if(result.overlaps)notes.push('Области пересекаются: блоки в каждой области посчитаны отдельно.');
    if(result.rows.some(r=>!r.id.startsWith('minecraft:')))notes.push('У блоков из модов может не быть картинки и русского названия.');message(notes.join(' '));
  }
  const viewer=new Schematic3D.SchematicViewer($('preview-canvas'),text=>$('preview-status').textContent=text);
  function showPreview(preview){$('preview-panel').classList.remove('hide');viewer.show(preview).catch(()=>{$('preview-status').textContent='Не удалось построить 3D-предпросмотр. Список материалов доступен.';});}
  $('view-left').onclick=()=>viewer.turn(-1);$('view-right').onclick=()=>viewer.turn(1);$('view-in').onclick=()=>viewer.zoom(1.25);$('view-out').onclick=()=>viewer.zoom(.8);$('view-reset').onclick=()=>viewer.reset();
  async function load(file){if(!file||busy||exportBusy)return;if(!/\.(litematic(a)?|schem)$/i.test(file.name)){message('Выберите файл .litematic, .litematica или .schem.',true);return;}if(file.size>32*1024*1024){message('Файл больше 32 МБ. Разделите большую схему на части.',true);return;}
    busy=true;$('drop').classList.add('busy');message('Читаю схему…');operation({percent:null,label:'Чтение и распаковка файла…'});let worker;
    try{const buffer=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');
      const code='const core=('+litematicaCore.toString()+')();onmessage=async e=>{try{postMessage({result:await core.parse(e.data,p=>postMessage({progress:p}))})}catch(e){postMessage({error:e.message})}}';
      let result;
      try{if(typeof Worker!=='undefined'){const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
        result=await new Promise((resolve,reject)=>{worker.onmessage=e=>{if(e.data.error)reject(Error(e.data.error));else if(e.data.result)resolve(e.data.result);else if(e.data.progress){const p=e.data.progress;if(p.stage==='count')operation({percent:Math.min(99,Math.round(p.done/p.total*100)),label:'Подсчёт блоков: '+fmt(p.done)+' / '+fmt(p.total)});else if(p.stage==='unpack')operation({percent:null,label:'Распаковано '+(p.bytes/1048576).toFixed(1)+' МБ…'});}};worker.onerror=()=>reject(Error('Не удалось запустить разбор схемы. Откройте приложение в Chrome или Edge.'));worker.postMessage(buffer,[buffer]);});
      }else result=await litematicaCore().parse(buffer);}catch(e){if(/запустить разбор|Security|denied|Worker|worker/i.test(e.message)){worker?.terminate();result=await litematicaCore().parse(await file.arrayBuffer());}else throw e;}
      if(result.name==='Схема')result.name=file.name.replace(/\.(litematic(a)?|schem)$/i,'');adopt(result,hash);
    }catch(e){$('operation').classList.add('hide');message('Не удалось прочитать схему: '+e.message,true);}finally{worker?.terminate();busy=false;$('drop').classList.remove('busy');$('file').value='';}
  }
  $('choose').onclick=()=>$('file').click();$('file').onchange=e=>load(e.target.files[0]);
  for(const event of ['dragover','dragenter'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('drag');});
  $('drop').ondragleave=()=>$('drop').classList.remove('drag');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');load(e.dataTransfer.files[0]);};
  document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
  $('demo').onclick=async()=>{if(busy||exportBusy)return;try{const bytes=Uint8Array.from(atob(DEMO_SCHEMATIC),c=>c.charCodeAt(0));adopt(await litematicaCore().parse(bytes.buffer),'demo-building',true);}catch(e){message(e.message,true);}};
  $('rows').onchange=e=>{const id=e.target.dataset.id;if(!id)return;e.target.checked?checked.add(id):checked.delete(id);persist();render();};
  $('rows').addEventListener('error',e=>{if(e.target.tagName==='IMG'){const s=document.createElement('span');s.textContent='◇';s.className='missing';s.title='Текстура недоступна';e.target.replaceWith(s);}},true);
  $('search').oninput=()=>{limit=200;render();};$('sort').onchange=()=>{limit=200;render();};$('group').onchange=()=>{limit=200;render();};
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;limit=200;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();});
  $('more').onclick=()=>{limit+=200;render();};$('reset').onclick=()=>{if(confirm('Снять все отметки собранного для этой схемы?')){checked.clear();persist();render();}};
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  $('export').onclick=()=>{const cell=x=>'"'+String(typeof x==='string'&&/^[=+\-@\t\r]/.test(x)?"'"+x:x).replaceAll('"','""')+'"';download('\ufeff'+[['Собрано','Блок','Тип','Количество','Стаки по 64','Остаток','Картинка URL'],...orderedRows(model.rows).map(r=>[checked.has(r.id)?'TRUE':'FALSE',human(r.id),materialGroup(r.id).label,r.count,Math.floor(r.count/64),r.count%64,image(r.id)])].map(row=>row.map(cell).join(';')).join('\r\n'),model.name.replace(/[^\p{L}\p{N}_. -]/gu,'_')+'.csv','text/csv;charset=utf-8');};
  $('endpoint').value=storage.get('litematica-google-url')||'';
  $('settings').onclick=()=>$('connect').showModal();$('close-connect').onclick=()=>$('connect').close();
  $('save-connect').onclick=()=>{const url=$('endpoint').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)){alert('Нужна ссылка веб-приложения Google Apps Script, заканчивающаяся на /exec.');return;}storage.set('litematica-google-url',url);$('connect').close();message('Ссылка сохранена. Теперь можно создать Google Таблицу.');};
  $('google').onclick=()=>{if(inGoogle&&pendingExport){exportToGoogle(pendingExport);return;}if(!inGoogle&&!storage.get('litematica-google-url')){$('connect').showModal();return;}$('publish').showModal();};$('close-publish').onclick=()=>$('publish').close();
  function payload(){return {requestId:crypto.randomUUID(),name:model.name.slice(0,185)+(model.demo?' (пример)':''),access:$('access').value,regionCount:model.regionCount,format:model.format,version:model.version,dataVersion:model.dataVersion,overlaps:!!model.overlaps,rows:orderedRows(model.rows).map(r=>({id:r.id,name:human(r.id),type:materialGroup(r.id).label,count:r.count,done:checked.has(r.id),image:image(r.id)}))};}
  async function exportToGoogle(data){if(exportBusy)return;pendingExport=data;exportBusy=true;['google','choose','demo'].forEach(id=>$(id).disabled=true);message('Создаю Google Таблицу. Не закрывайте вкладку до завершения.');
    try{const result=await runGoogleExport(data,materialGoogleRpc,operation);pendingExport=null;$('google').textContent='Создать Google Таблицу ↗';showResult(result);}
    catch(e){const detail=/not found|не найдена|не найден/i.test(e.message)?'Обновите Code.gs в Apps Script и разверните новую версию.':e.message;message('Создание приостановлено: '+detail+' Нажмите «Продолжить создание», чтобы повторить попытку в той же таблице.',true);$('google').textContent='Продолжить создание ↗';}
    finally{exportBusy=false;['google','choose','demo'].forEach(id=>$(id).disabled=false);}
  }
  $('confirm-publish').onclick=()=>{const data=payload();$('publish').close();
    if(inGoogle){exportToGoogle(data);}
    else {const form=document.createElement('form');form.method='POST';form.action=storage.get('litematica-google-url');form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(data);form.append(input);document.body.append(form);form.submit();form.remove();message('Список отправлен в ваш Apps Script в новой вкладке. Создание нужно подтвердить там. Если Google запросит вход, войдите и повторите отправку с сайта.');}
  };
  function showResult(result){message(result.warning||'Таблица создана. '+(result.access==='edit'?'Редактирование доступно по ссылке.':result.access==='view'?'Просмотр доступен по ссылке.':'Доступна только вам.'),!!result.warning);const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener';a.className='result';a.textContent='Открыть Google Таблицу ↗';$('status').append(a);}
  if(inGoogle){$('settings').textContent='Google подключён';$('google-mode').textContent='Программа уже работает в вашем Google Apps Script. Кнопка «Создать Google Таблицу» готова к работе.';$('publish-hint').textContent='Будет создана новая таблица с вашим списком материалов.';document.querySelector('#connect ol').classList.add('hide');$('kit').classList.add('hide');document.querySelector('label[for="endpoint"]').classList.add('hide');$('endpoint').classList.add('hide');$('save-connect').classList.add('hide');}
  if(inGoogle&&typeof MATERIAL_IMPORT_BASE64!=='undefined'){
    try{const imported=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(MATERIAL_IMPORT_BASE64),c=>c.charCodeAt(0))));
      adopt({...imported,regionCount:imported.regionCount||1,version:imported.version||6},'import-'+imported.requestId);
      checked=new Set(imported.rows.filter(r=>r.done).map(r=>r.id));render();$('access').value=imported.access;
      message('Список принят. Подтвердите создание Google Таблицы; затем появится прогресс записи.');$('publish').showModal();
    }catch(e){message('Не удалось принять список: '+e.message,true);}
  }
})();
