const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
vm.runInThisContext(fs.readFileSync('core.js','utf8'));const core=litematicaCore();
async function load(name){const b=fs.readFileSync('fixtures/'+name+'.schem');return core.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
(async()=>{
 for(const version of [1,2,3]){const events=[],b=fs.readFileSync('fixtures/sponge'+version+'.schem');const r=await core.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),p=>events.push(p));
  assert.equal(r.format,'Sponge');assert.equal(r.version,version);assert.equal(r.totalVolume,240);assert.equal(r.air,80);
  assert.deepEqual(Object.fromEntries(r.rows.map(r=>[r.id,r.count])),{'minecraft:stone':80,'minecraft:oak_log':80});
  assert(events.some(p=>p.stage==='count'&&p.done===240));
 }
 const unsigned=await load('sponge_unsigned');assert.equal(unsigned.totalVolume,32768);assert.deepEqual(unsigned.rows,[{id:'minecraft:stone',count:1}]);
 for(const name of ['truncated','overflow','unknown','extra'])await assert.rejects(()=>load('sponge_'+name));
 console.log('PASS Sponge v1/v2/v3, nested root, multi-byte/sparse VarInts, merged states, unsigned sizes, progress and malformed data.');
})().catch(e=>{console.error(e);process.exit(1)});
