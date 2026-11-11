import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';

// Geometry uses the block models shipped with the vanilla resource pack.
const directions={east:[1,0,0],west:[-1,0,0],up:[0,1,0],down:[0,-1,0],south:[0,0,1],north:[0,0,-1]};
const faceCorners={east:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],west:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],up:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],down:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],south:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],north:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]};
const cube=texture=>[{f:[0,0,0],t:[16,16,16],s:Object.keys(directions).map(d=>[d,texture,null,0,-1,d])}];
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function modelFor(state,coarse){
  const [id,properties='']=state.split('['),name=id.replace('minecraft:',''),p=Object.fromEntries(properties.replace(']','').split(',').filter(Boolean).map(s=>s.split('=')));
  let key=name,approx=false;
  if(name.endsWith('_slab'))key=p.type==='top'?name+'_top':name;
  if(name.endsWith('_stairs'))key=name+(p.shape?.startsWith('inner')?'_inner':p.shape?.startsWith('outer')?'_outer':'');
  if(name.endsWith('_door'))key=name+'_'+(p.half==='upper'?'top':'bottom')+'_'+(p.hinge==='right'?'right':'left');
  if(!BLOCK_MODELS[key]&&BLOCK_MODELS[name+'_post']){key=name+'_post';approx=true;}
  if(!BLOCK_MODELS[key]&&BLOCK_MODELS[name+'_inventory']){key=name+'_inventory';approx=true;}
  let elements=id.startsWith('minecraft:')?BLOCK_MODELS[key]:null;
  if(elements&&name.endsWith('_slab')&&p.type==='double')elements=elements.map(e=>({...e,f:[0,0,0],t:[16,16,16],s:e.s.map(f=>[f[0],f[1],null,f[3],f[4],f[5]])}));
  if(!elements){elements=cube('blocks/'+name);approx=true;}
  if(/fence|pane|wall|redstone|rail/.test(name))approx=true;
  if(coarse)elements=cube(elements[0].s[0][1]);
  let angle=0;
  if(['east','south','west','north'].includes(p.facing)){const base=name.endsWith('_stairs')?'east':'north';angle=({east:0,south:1,west:2,north:3}[p.facing]-{east:0,north:3}[base])*Math.PI/2;
    if(name.endsWith('_stairs')&&p.shape?.endsWith('left'))angle-=Math.PI/2;
    if(name.endsWith('_door')&&p.open==='true')angle+=(p.hinge==='right'?-1:1)*Math.PI/2;}
  const rotation=new THREE.Matrix4().makeRotationY(-angle);
  if(p.facing==='up'||p.facing==='down')rotation.multiply(new THREE.Matrix4().makeRotationX(p.facing==='up'?Math.PI/2:-Math.PI/2));
  if(p.axis==='x')rotation.multiply(new THREE.Matrix4().makeRotationZ(-Math.PI/2));
  if(p.axis==='z')rotation.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
  const flip=p.half==='top'&&name.endsWith('_stairs');
  const faces=[];
  for(const e of elements)for(const [d,texture,explicitUv,uvRotation,tint,cull] of e.s){
    const points=faceCorners[d].map(c=>new THREE.Vector3(...c.map((v,a)=>(v?e.t[a]:e.f[a])/16)));
    for(const point of points){
      if(e.r){const o=new THREE.Vector3(...e.r.origin.map(x=>x/16)),axis=new THREE.Vector3(...['x','y','z'].map(k=>Number(k===e.r.axis)));point.sub(o);if(e.r.rescale){const scale=1/Math.cos(e.r.angle*Math.PI/180);['x','y','z'].forEach(k=>{if(k!==e.r.axis)point[k]*=scale;});}point.applyAxisAngle(axis,e.r.angle*Math.PI/180).add(o);}
      if(flip)point.y=1-point.y;point.subScalar(.5).applyMatrix4(rotation).addScalar(.5);
    }
    // Use transformed normals for both face lighting and neighbor culling.
    const normal=new THREE.Vector3(...directions[d]);if(flip)normal.y*=-1;normal.transformDirection(rotation);
    if(e.r)normal.applyAxisAngle(new THREE.Vector3(...['x','y','z'].map(k=>Number(k===e.r.axis))),e.r.angle*Math.PI/180);
    const neighborVector=cull?new THREE.Vector3(...directions[cull]):null;if(neighborVector&&flip)neighborVector.y*=-1;
    const neighbor=neighborVector?neighborVector.transformDirection(rotation).toArray().map(Math.round):null;
    const uv=explicitUv||defaultUv(d,e.f,e.t);
    faces.push({points:points.flatMap(p=>p.toArray()),normal:normal.toArray(),neighbor,texture,uv,uvRotation,tint});
  }
  const full=coarse||elements.length===1&&elements[0].f.every(x=>x===0)&&elements[0].t.every(x=>x===16)&&!elements[0].r&&!/glass|leaves|ice|water|lava/.test(name);
  return {faces,full,approx};
}
function defaultUv(d,f,t){if(d==='up'||d==='down')return [f[0],f[2],t[0],t[2]];if(d==='east'||d==='west')return [f[2],16-t[1],t[2],16-f[1]];return [f[0],16-t[1],t[0],16-f[1]];}
function reduceRegions(regions){return regions.map(r=>{const dims=r.dims.map(x=>Math.ceil(x/2)),cells=new Uint32Array(dims.reduce((a,b)=>a*b,1));for(let y=0;y<r.dims[1];y++)for(let z=0;z<r.dims[2];z++)for(let x=0;x<r.dims[0];x++){const value=r.cells[(y*r.dims[2]+z)*r.dims[0]+x];if(value){const q=(Math.floor(y/2)*dims[2]+Math.floor(z/2))*dims[0]+Math.floor(x/2);if(!cells[q])cells[q]=value;}}return {...r,dims,cells,step:r.step*2};});}
export class SchematicViewer {
  constructor(host,status){this.host=host;this.status=status;this.generation=0;}
  clear(){this.generation++;this.controls?.dispose();this.resize?.disconnect();this.geometry?.dispose();this.material?.dispose();this.texture?.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.host.replaceChildren();delete this.host.dataset.ready;delete this.host.dataset.faces;this.renderer=null;this.camera=null;}
  async show(preview){
    this.clear();const generation=this.generation,alive=()=>this.generation===generation;
    if(!preview?.regions?.length){this.status('Для 3D-предпросмотра загрузите файл схемы в этой вкладке.');return;}
    let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{this.status('3D недоступно: включите аппаратное ускорение в браузере. Список материалов работает.');return;}
    this.renderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x12151b,0);this.host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Трёхмерная постройка: перетаскивайте для вращения, колесо для масштаба');renderer.domElement.setAttribute('role','img');
    this.status('Строю объёмную модель…');await pause();
    let regions=preview.regions,simplified=preview.simplified,faceCount=0,models;
    const visible=(r,pal,x,y,z,f)=>{if(!f.neighbor)return true;const [dx,dy,dz]=f.neighbor,nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=r.dims[0]||ny>=r.dims[1]||nz>=r.dims[2])return true;const v=r.cells[(ny*r.dims[2]+nz)*r.dims[0]+nx];return !v||!pal[v-1].full;};
    for(;;){
      models=regions.map(r=>r.palette.map(s=>modelFor(s,r.step>1)));faceCount=0;
      for(let ri=0;ri<regions.length&&faceCount<=200000;ri++){const r=regions[ri],pal=models[ri];for(let i=0;i<r.cells.length&&faceCount<=200000;i++){const v=r.cells[i];if(!v)continue;const x=i%r.dims[0],z=Math.floor(i/r.dims[0])%r.dims[2],y=Math.floor(i/(r.dims[0]*r.dims[2]));for(const f of pal[v-1].faces)if(visible(r,pal,x,y,z,f))faceCount++;}}
      if(faceCount<=200000)break;regions=reduceRegions(regions);simplified=true;await pause();if(!alive())return;
    }
    if(!faceCount){this.status('В схеме нет видимых блоков.');return;}
    const usedModels=models.flatMap((p,i)=>[...new Set(regions[i].cells)].filter(Boolean).map(v=>p[v-1]));
    const textures=[...new Set(usedModels.flatMap(m=>m.faces.map(f=>f.texture)))],tile=32,columns=2**Math.ceil(Math.log2(Math.ceil(Math.sqrt(textures.length+1)))),size=columns*tile;
    const atlas=document.createElement('canvas');atlas.width=size;atlas.height=size;const ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const slots=new Map(textures.map((t,i)=>[t,{x:(i%columns)*tile,y:Math.floor(i/columns)*tile}]));let failed=0,loaded=0,next=0;
    for(const [t,{x,y}] of slots){let hash=0;for(const c of t)hash=(hash*31+c.charCodeAt(0))|0;ctx.fillStyle='hsl('+Math.abs(hash%360)+' 22% 48%)';ctx.fillRect(x,y,tile,tile);ctx.strokeStyle='#ffffff22';ctx.strokeRect(x+.5,y+.5,tile-1,tile-1);}
    await Promise.all(Array.from({length:8},async()=>{for(;;){const i=next++;if(i>=textures.length||!alive())return;const t=textures[i],slot=slots.get(t);await new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(ok){ctx.clearRect(slot.x,slot.y,tile,tile);ctx.drawImage(img,0,0,img.width,Math.min(img.width,img.height),slot.x,slot.y,tile,tile);}else failed++;loaded++;if(alive())this.status('Загрузка текстур: '+loaded+' / '+textures.length);resolve();};const timer=setTimeout(()=>finish(false),12000);img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=VIEWER_TEXTURE_BASE+t+'.png';});}}));
    if(!alive())return;
    const position=new Float32Array(faceCount*12),normal=new Float32Array(faceCount*12),uv=new Float32Array(faceCount*8),color=new Float32Array(faceCount*12),index=new Uint32Array(faceCount*6);
    let face=0,approx=false;const bounds=new THREE.Box3();
    for(let ri=0;ri<regions.length;ri++){const r=regions[ri],pal=models[ri];for(let i=0;i<r.cells.length;i++){
      if(i%32768===0){await pause();if(!alive())return;}
      const v=r.cells[i];if(!v)continue;const model=pal[v-1];approx||=model.approx;const x=i%r.dims[0],z=Math.floor(i/r.dims[0])%r.dims[2],y=Math.floor(i/(r.dims[0]*r.dims[2]));
      for(const f of model.faces){if(!visible(r,pal,x,y,z,f))continue;const slot=slots.get(f.texture),[u0,v0,u1,v1]=f.uv,uvPoints=[[u0,v1],[u1,v1],[u1,v0],[u0,v0]],shift=f.uvRotation/90;
        for(let k=0;k<4;k++){const coords=[x,y,z].map((c,a)=>r.origin[a]+(c+f.points[k*3+a])*r.step);position.set(coords,face*12+k*3);bounds.expandByPoint(new THREE.Vector3(...coords));normal.set(f.normal,face*12+k*3);const [u,v]=uvPoints[(k+shift)%4];uv.set([(slot.x+.25+u/16*(tile-.5))/size,1-(slot.y+.25+v/16*(tile-.5))/size],face*8+k*2);color.set(f.tint>=0?[.49,.73,.31]:[1,1,1],face*12+k*3);}
        index.set([face*4,face*4+1,face*4+2,face*4,face*4+2,face*4+3],face*6);face++;
      }
    }}
    const geometry=this.geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setIndex(new THREE.BufferAttribute(index,1));
    const center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);
    const texture=this.texture=new THREE.CanvasTexture(atlas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
    const material=this.material=new THREE.MeshLambertMaterial({map:texture,vertexColors:true,alphaTest:.1,side:THREE.DoubleSide});
    const scene=this.scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));scene.add(new THREE.AmbientLight(0xffffff,2));const sun=new THREE.DirectionalLight(0xfff5e3,3);sun.position.set(-5,10,7);scene.add(sun);
    const radius=Math.max(1,extent.length()/2);this.radius=radius;const camera=this.camera=new THREE.OrthographicCamera(-radius,radius,radius,-radius,.01,radius*30);camera.position.set(radius*2,radius*1.6,radius*2);camera.lookAt(0,0,0);
    const controls=this.controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=true;controls.minZoom=.2;controls.maxZoom=15;controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>renderer.render(scene,camera));controls.saveState();
    const resize=()=>{if(!alive())return;const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);const aspect=width/height;camera.left=-radius*aspect;camera.right=radius*aspect;camera.top=radius;camera.bottom=-radius;camera.updateProjectionMatrix();renderer.render(scene,camera);};this.resize=new ResizeObserver(resize);this.resize.observe(this.host);resize();
    this.status((simplified?'Большая схема: детализация уменьшена. ':'')+(failed?failed+' текстур недоступно — показаны цветом. ':'')+(approx?'Некоторые соединения и особые блоки показаны приблизительно. ':'')+'Перетащите для вращения · колесо для масштаба · правая кнопка для перемещения.');
    this.host.dataset.faces=String(faceCount);this.host.dataset.ready='true';
  }
  reset(){this.controls?.reset();}
  turn(direction){if(!this.camera)return;const p=this.camera.position.clone().sub(this.controls.target);p.applyAxisAngle(new THREE.Vector3(0,1,0),direction*Math.PI/8);this.camera.position.copy(this.controls.target).add(p);this.controls.update();}
  zoom(factor){if(!this.camera)return;this.camera.zoom=Math.max(.2,Math.min(15,this.camera.zoom*factor));this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
}
