import struct,gzip,json,random
from pathlib import Path
root=Path(__file__).parent
out=root/'fixtures';out.mkdir(exist_ok=True)
def string(s):
 b=s.encode();return struct.pack('>H',len(b))+b
def payload(t,v):
 if t==2:return struct.pack('>h',v)
 if t==3:return struct.pack('>i',v)
 if t==7:return struct.pack('>i',len(v))+bytes(v)
 if t==8:return string(v)
 if t==10:return b''.join(bytes([t])+string(k)+payload(t,v) for k,(t,v) in v.items())+b'\0'
 if t==9:
  sub,values=v;return bytes([sub])+struct.pack('>i',len(values))+b''.join(payload(sub,x) for x in values)
 if t==12:return struct.pack('>i',len(v))+b''.join(struct.pack('>Q',x) for x in v)
 raise ValueError(t)
def region(ids,entries,size=None,pos=(0,0,0)):
 bits=max(2,(len(ids)-1).bit_length());packed=sum(v<<(i*bits) for i,v in enumerate(entries));words=[(packed>>(64*i))&((1<<64)-1) for i in range((len(entries)*bits+63)//64)]
 return {'Size':(10,{k:(3,v) for k,v in zip('xyz',size or (len(entries),1,1))}),'Position':(10,{k:(3,v) for k,v in zip('xyz',pos)}),'BlockStatePalette':(9,(10,[{'Name':(8,x)} for x in ids])),'BlockStates':(12,words)}
def schematic(regions,version=6):return bytes([10])+string('')+payload(10,{'Version':(3,version),'MinecraftDataVersion':(3,4189),'Metadata':(10,{'Name':(8,'Тестовая схема')}),'Regions':(10,{k:(10,v) for k,v in regions.items()})})
random.seed(42);expected={}
for bits in [2,3,4,5,6,7,8,9,10,12,16]:
 n=(1<<(bits-1))+1;ids=['minecraft:air']+['minecraft:test_'+str(i) for i in range(1,n)];entries=[random.randrange(n) for _ in range(137)];entries[:min(len(entries),n)]=list(range(min(len(entries),n)))
 name='bits'+str(bits);raw=schematic({'negative':region(ids,entries,(-137,1,1))});(out/(name+'.litematic')).write_bytes(gzip.compress(raw))
 expected[name]={ids[i]:entries.count(i) for i in set(entries) if i}
ids=['minecraft:air','minecraft:stone','minecraft:oak_log','minecraft:cave_air','minecraft:void_air']
multi=schematic({'a':region(ids,[0,1,1,2,3,4],pos=(0,0,0)),'b':region(ids,[2,2,1,0,0,0],pos=(20,0,0))});(out/'multi.litematic').write_bytes(gzip.compress(multi));expected['multi']={'minecraft:stone':3,'minecraft:oak_log':3}
(out/'plain.litematic').write_bytes(multi);expected['plain']=expected['multi'];(out/'bad.litematic').write_bytes(gzip.compress(multi[:-10]))
(out/'future.litematic').write_bytes(gzip.compress(schematic({'a':region(ids,[1,2])},8)))
(out/'expected.json').write_text(json.dumps(expected))
demo=schematic({'Дом':region(['minecraft:air','minecraft:oak_planks','minecraft:stone_bricks','minecraft:oak_log','minecraft:glass_pane','minecraft:lantern'],[0]*10+[1]*300+[2]*120+[3]*64+[4]*32+[5]*8)})
(root/'demo.litematic').write_bytes(gzip.compress(demo));print('Fixtures generated')

def varint(n):
 out=bytearray()
 while True:
  b=n&127;n>>=7;out.append(b|(128 if n else 0))
  if not n:return bytes(out)
def sponge(version,entries,palette,width=None,nested=False,raw_data=None):
 blockdata=b''.join(varint(i) for i in entries) if raw_data is None else raw_data
 blocks={'Palette':(10,{k:(3,v) for k,v in palette.items()}),'Data':(7,blockdata)}
 data={'Version':(3,version),'DataVersion':(3,4189),'Metadata':(10,{'Name':(8,'Sponge пример')}),'Width':(2,width or len(entries)),'Height':(2,1),'Length':(2,1)}
 if version==3:data['Blocks']=(10,blocks)
 else:data.update({'Palette':blocks['Palette'],'BlockData':blocks['Data'],'PaletteMax':(3,max(palette.values())+1)})
 return bytes([10])+string('')+payload(10,{'Schematic':(10,data)} if nested else data)
palette={'minecraft:air':0,'minecraft:stone':128,'minecraft:oak_log[axis=x]':50000,'minecraft:oak_log[axis=y]':900,'cave_air':2}
for version in [1,2,3]:
 entries=[0,128,50000,128,900,2]*40
 (out/('sponge'+str(version)+'.schem')).write_bytes(gzip.compress(sponge(version,entries,palette,nested=version==3)))
(out/'sponge_unsigned.schem').write_bytes(gzip.compress(sponge(3,[0]*32767+[128],palette,width=-32768,nested=True)))
for name,data in {'truncated':b'\x80','overflow':b'\xff\xff\xff\xff\xff','unknown':varint(3),'extra':b'\0\0'}.items():
 (out/('sponge_'+name+'.schem')).write_bytes(gzip.compress(sponge(2,[0],palette,raw_data=data)))
(root/'demo.schem').write_bytes(gzip.compress(sponge(3,[0]*10+[1]*300+[2]*120+[3]*64+[4]*32+[5]*8,{'minecraft:air':0,'minecraft:oak_planks':1,'minecraft:stone_bricks':2,'minecraft:oak_log':3,'minecraft:glass_pane':4,'minecraft:lantern':5},nested=True)))
