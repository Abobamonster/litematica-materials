function litematicaCore() {
  const MAX_BYTES = 160 * 1024 * 1024, MAX_BLOCKS = 30000000;
  async function unpack(buffer,progress=()=>{}) {
    let bytes = new Uint8Array(buffer);
    if (bytes.length > MAX_BYTES) throw Error('Файл слишком большой (лимит 160 МБ).');
    if (bytes[0] === 31 && bytes[1] === 139) {
      if (typeof DecompressionStream === 'undefined') throw Error('Откройте приложение в свежей версии Chrome или Edge.');
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      const chunks = []; let length = 0;
      try { for (;;) { const {value, done} = await reader.read(); if (done) break;
        length += value.length; if (length > MAX_BYTES) throw Error('Распакованная схема больше 160 МБ.'); chunks.push(value);
        if(chunks.length%64===0)progress({stage:'unpack',bytes:length});
      }} catch(e) { await reader.cancel().catch(()=>{}); throw e; }
      bytes = new Uint8Array(length); let p = 0; for (const c of chunks) { bytes.set(c,p); p += c.length; }
    }
    return parseNbt(bytes);
  }
  function parseNbt(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder('utf-8', {fatal:true});
    let p=0, nodes=0;
    function take(n) { if(!Number.isSafeInteger(n)||n<0||p+n>bytes.length) throw Error('Повреждённый NBT: файл обрывается.'); const a=p;p+=n;return a; }
    const u8=()=>view.getUint8(take(1)), i32=()=>view.getInt32(take(4));
    function str(){const n=view.getUint16(take(2)),s=take(n),part=bytes.subarray(s,s+n);
      try{return decoder.decode(part);}catch{
        // Java DataInput uses modified UTF-8: NUL and surrogate code units are special.
        let text='';for(let i=0;i<part.length;){const a=part[i++];let code;
          if(a<128)code=a;
          else if((a&224)===192){const b=part[i++];if(b===undefined||(b&192)!==128)throw Error('Некорректная строка NBT.');code=((a&31)<<6)|(b&63);if(code<128&&code!==0)throw Error('Некорректная строка NBT.');}
          else if((a&240)===224){const b=part[i++],c=part[i++];if(b===undefined||c===undefined||(b&192)!==128||(c&192)!==128)throw Error('Некорректная строка NBT.');code=((a&15)<<12)|((b&63)<<6)|(c&63);if(code<2048)throw Error('Некорректная строка NBT.');}
          else throw Error('Некорректная строка NBT.');text+=String.fromCharCode(code);
        }return text;
      }
    }
    function length(unit=1){const n=i32(); if(n<0||n>MAX_BYTES/unit)throw Error('Некорректная длина массива NBT.');return n;}
    function payload(type,depth=0) {
      if(depth>64||++nodes>4000000)throw Error('Слишком сложный NBT.');
      switch(type) {
        case 1:return view.getInt8(take(1)); case 2:return view.getInt16(take(2)); case 3:return i32();
        case 4:return view.getBigInt64(take(8)); case 5:return view.getFloat32(take(4)); case 6:return view.getFloat64(take(8));
        case 7:{const n=length(),s=take(n);return bytes.subarray(s,s+n);}
        case 8:return str();
        case 9:{const t=u8(),n=length();if(t===0&&n)throw Error('Некорректный список NBT.');if(n>2000000)throw Error('Список NBT слишком большой.');return Array.from({length:n},()=>payload(t,depth+1));}
        case 10:{const obj=Object.create(null);for(;;){const t=u8();if(!t)break;const key=str();if(Object.hasOwn(obj,key))throw Error('Повторяющийся ключ NBT.');obj[key]=payload(t,depth+1);}return obj;}
        case 11:{const n=length(4),s=take(n*4);return {kind:'intArray',bytes:bytes.subarray(s,s+n*4)};}
        case 12:{const n=length(8),s=take(n*8);return {kind:'longArray',view:new DataView(bytes.buffer,bytes.byteOffset+s,n*8),length:n};}
        default:throw Error('Неизвестный тип NBT: '+type);
      }
    }
    if(u8()!==10)throw Error('Это не схема Litematica: ожидается корневой NBT Compound.');str();return payload(10);
  }
  const isAir=id=>['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(id);
  function previewStep(dimensions){let step=1;while(dimensions.reduce((sum,d)=>sum+d.reduce((n,x)=>n*Math.ceil(x/step),1),0)>900000)step*=2;return step;}
  function previewRegion(dims,origin,step,palette){const grid=dims.map(x=>Math.ceil(x/step));return {dims:grid,origin,step,palette,cells:new Uint32Array(grid.reduce((a,b)=>a*b,1))};}
  function previewPut(region,dims,i,value){const x=i%dims[0],z=Math.floor(i/dims[0])%dims[2],y=Math.floor(i/(dims[0]*dims[2]));const q=(Math.floor(y/region.step)*region.dims[2]+Math.floor(z/region.step))*region.dims[0]+Math.floor(x/region.step);if(!region.cells[q])region.cells[q]=value;}
  function count(root,progress=()=>{}) {
    if(!root.Regions&&(root.Schematic||root.Width!==undefined))return countSponge(root.Schematic||root,progress);
    if(!root.Regions||!Number.isInteger(root.Version))throw Error('В файле нет структуры Litematica (Regions/Version).');
    if(root.Version<4||root.Version>7)throw Error('Версия схемы '+root.Version+' пока не поддерживается (нужна 4–7).');
    const regions=Object.entries(root.Regions);if(!regions.length)throw Error('В схеме нет областей.');
    const counts=new Map();let totalVolume=0,air=0;const boxes=[];
    const step=previewStep(regions.map(([,r])=>['x','y','z'].map(k=>Math.abs(r.Size?.[k]||0))));const preview={regions:[],simplified:step>1};
    const estimatedVolume=regions.reduce((sum,[,r])=>sum+Math.abs((r.Size?.x||0)*(r.Size?.y||0)*(r.Size?.z||0)),0);
    for (let ri=0;ri<regions.length;ri++) {
      const [regionName,r]=regions[ri], size=r.Size, palette=r.BlockStatePalette, storage=r.BlockStates;
      if(!size||!Array.isArray(palette)||!palette.length||palette.length>65536||storage?.kind!=='longArray')throw Error('Некорректная область: '+regionName);
      const dims=['x','y','z'].map(k=>Math.abs(size[k]));
      if(dims.some(x=>!Number.isSafeInteger(x)||!x))throw Error('Некорректный размер области.');
      const volume=dims.reduce((a,b)=>a*b,1);totalVolume+=volume;
      if(!Number.isSafeInteger(totalVolume)||totalVolume>MAX_BLOCKS)throw Error('Лимит — 30 млн ячеек суммарно по областям.');
      const bits=Math.max(2,Math.ceil(Math.log2(palette.length))), mask=(1<<bits)-1;
      if(storage.length!==Math.ceil(volume*bits/64))throw Error('Длина BlockStates не соответствует размеру области: '+regionName);
      const local=new Uint32Array(palette.length), v=storage.view;
      const visual=previewRegion(dims,['x','y','z'].map(k=>(r.Position?.[k]||0)+Math.min(0,size[k]+1)),step,palette.map(p=>p.Name+(p.Properties?'['+Object.entries(p.Properties).map(([k,v])=>k+'='+v).join(',')+']':'')));
      const visible=palette.map(p=>!isAir(p.Name));preview.regions.push(visual);
      function word(i){const q=Math.floor(i/2)*8;return v.getUint32(q+(i%2?0:4));}
      for(let i=0;i<volume;i++){
        if(i%262144===0)progress({stage:'count',done:totalVolume-volume+i,total:estimatedVolume});
        const bit=i*bits,w=Math.floor(bit/32),shift=bit%32;
        let id=word(w)>>>shift;if(shift+bits>32)id|=word(w+1)<<(32-shift);id&=mask;
        if(id>=palette.length)throw Error('Индекс блока вне палитры: '+regionName);local[id]++;
        if(visible[id])previewPut(visual,dims,i,id+1);
      }
      for(let i=0;i<palette.length;i++)if(local[i]){
        const id=palette[i].Name;if(typeof id!=='string'||!id.match(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/))throw Error('Некорректное имя блока.');
        if(['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(id)){air+=local[i];continue;}
        counts.set(id,(counts.get(id)||0)+local[i]);
      }
      if(r.Position&&boxes.length<1000){const min={},max={};for(const k of ['x','y','z']){min[k]=r.Position[k]+Math.min(0,size[k]+1);max[k]=r.Position[k]+Math.max(0,size[k]-1);}boxes.push({min,max});}
      progress({region:ri+1,total:regions.length});
    }
    let overlaps=false;for(let a=0;a<boxes.length;a++)for(let b=0;b<a;b++)if(['x','y','z'].every(k=>boxes[a].min[k]<=boxes[b].max[k]&&boxes[b].min[k]<=boxes[a].max[k]))overlaps=true;
    progress({stage:'count',done:totalVolume,total:totalVolume});
    return {name:typeof root.Metadata?.Name==='string'?root.Metadata.Name:'Схема',format:'Litematica',version:root.Version,dataVersion:root.MinecraftDataVersion||null,regionCount:regions.length,totalVolume,air,overlaps,
      preview,rows:[...counts].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id))};
  }
  function countSponge(root,progress) {
    if(![1,2,3].includes(root.Version))throw Error('Поддерживаются Sponge .schem версий 1, 2 и 3.');
    const dims=['Width','Height','Length'].map(k=>{const n=root[k];if(!Number.isInteger(n)||n<-32768||n>65535)throw Error('Некорректный размер .schem.');return n&65535;});
    const totalVolume=dims.reduce((a,b)=>a*b,1);
    if(!totalVolume||!Number.isSafeInteger(totalVolume)||totalVolume>MAX_BLOCKS)throw Error('Лимит — 30 млн ячеек; размеры .schem должны быть больше нуля.');
    const container=root.Version===3?root.Blocks:root,palette=container?.Palette,data=root.Version===3?container?.Data:root.BlockData;
    if(!palette||typeof palette!=='object'||Array.isArray(palette)||!(data instanceof Uint8Array))throw Error('В .schem отсутствует палитра или массив блоков. Схемы без палитры не поддерживаются.');
    const entries=Object.entries(palette),indices=new Map();if(!entries.length||entries.length>65536)throw Error('Некорректная палитра .schem.');
    for(const [state,index] of entries){
      let id=state.split('[')[0];if(!id.includes(':'))id='minecraft:'+id;
      if(!Number.isInteger(index)||index<0||index>2147483647||indices.has(index)||!id.match(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/))throw Error('Некорректная запись палитры .schem.');
      indices.set(index,{id,state:id+(state.includes('[')?state.slice(state.indexOf('[')):''),visual:indices.size+1,count:0});
    }
    const step=previewStep([dims]),visual=previewRegion(dims,[0,0,0],step,[...indices.values()].map(p=>p.state));
    let offset=0;
    for(let i=0;i<totalVolume;i++){
      if(i%262144===0)progress({stage:'count',done:i,total:totalVolume});
      let value=0,done=false;
      for(let byteIndex=0;byteIndex<5;byteIndex++){
        if(offset>=data.length)throw Error('Массив BlockData в .schem обрывается.');const b=data[offset++];
        if(byteIndex===4&&b>7)throw Error('Переполнение VarInt в .schem.');value+=(b&127)*2**(byteIndex*7);
        if(!(b&128)){done=true;break;}
      }
      if(!done||!indices.has(value))throw Error('Индекс блока .schem отсутствует в палитре.');indices.get(value).count++;
      const entry=indices.get(value);if(!isAir(entry.id))previewPut(visual,dims,i,entry.visual);
    }
    if(offset!==data.length)throw Error('В .schem больше блоков, чем задано размерами.');
    const counts=new Map();let air=0;for(const {id,count} of indices.values())if(count){
      if(['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(id))air+=count;else counts.set(id,(counts.get(id)||0)+count);
    }
    progress({stage:'count',done:totalVolume,total:totalVolume});
    return {name:typeof root.Metadata?.Name==='string'?root.Metadata.Name:'Схема',format:'Sponge',version:root.Version,dataVersion:root.DataVersion||null,regionCount:1,totalVolume,air,overlaps:false,
      preview:{regions:[visual],simplified:step>1},rows:[...counts].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id))};
  }
  return {unpack,parseNbt,count,parse:async(buffer,progress)=>count(await unpack(buffer,progress),progress)};
}
