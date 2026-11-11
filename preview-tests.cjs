const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={Uint8Array,Uint32Array,DataView,TextDecoder,Blob,DecompressionStream};vm.createContext(context);vm.runInContext(fs.readFileSync('core.js','utf8')+';globalThis.core=litematicaCore();',context);
(async()=>{
 const parse=async path=>{const b=fs.readFileSync(path);return context.core.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
 const root={Version:6,Regions:{negative:{Size:{x:-2,y:2,z:2},Position:{x:10,y:-5,z:20},BlockStatePalette:[{Name:'minecraft:air'},{Name:'minecraft:oak_log',Properties:{axis:'x'}}],BlockStates:{kind:'longArray',length:1,view:new DataView(new ArrayBuffer(8))}}}};
 root.Regions.negative.BlockStates.view.setBigUint64(0,1n|(1n<<14n));
 const model=context.core.count(root),r=model.preview.regions[0];assert.deepEqual([...r.origin],[9,-5,20]);assert.deepEqual([...r.dims],[2,2,2]);assert.deepEqual([...r.cells],[2,0,0,0,0,0,0,2]);assert.equal(r.palette[1],'minecraft:oak_log[axis=x]');assert.equal(model.rows[0].count,2);
 const large={Version:6,Regions:{line:{Size:{x:1000000,y:1,z:1},Position:{x:0,y:0,z:0},BlockStatePalette:[{Name:'minecraft:stone'}],BlockStates:{kind:'longArray',length:31250,view:new DataView(new ArrayBuffer(250000))}}}};
 const lod=context.core.count(large);assert.equal(lod.rows[0].count,1000000);assert.equal(lod.preview.simplified,true);assert.equal(lod.preview.regions[0].cells.length,500000);
 for(const file of ['fixtures/multi.litematic','fixtures/sponge1.schem','fixtures/sponge2.schem','fixtures/sponge3.schem','building-demo.litematic','building-demo.schem']){
  const m=await parse(file);const counts=new Map();for(const reg of m.preview.regions)for(const v of reg.cells)if(v){const id=reg.palette[v-1].split('[')[0];counts.set(id,(counts.get(id)||0)+1);}
  assert.deepEqual(Object.fromEntries(counts),Object.fromEntries(m.rows.map(r=>[r.id,r.count])),file);
 }
 console.log('PASS 3D spatial data: XYZ ordering, negative origins, block states, Sponge sparse palettes, all occupied cells, bounded LOD with exact material totals.');
})().catch(e=>{console.error(e);process.exit(1)});
