"""Small real 3D fixture; independent NBT encoder from the parser fixtures."""
from pathlib import Path
import gzip
root=Path(__file__).parent
namespace={'__file__':str(root/'make_fixtures.py')}
exec((root/'make_fixtures.py').read_text('utf-8').split('random.seed(42)')[0],namespace)
region,schematic=namespace['region'],namespace['schematic']
sx,sy,sz=21,24,19
ids=['minecraft:air','minecraft:stone_bricks','minecraft:polished_andesite','minecraft:dark_oak_planks','minecraft:cherry_planks','minecraft:glass','minecraft:deepslate_tiles','minecraft:grass_block','minecraft:oak_log','minecraft:stone_brick_slab']
cells=[0]*(sx*sy*sz)
def put(x,y,z,v):cells[(y*sz+z)*sx+x]=v
for z in range(sz):
 for x in range(sx):put(x,0,z,7)
for y in range(1,20):
 for z in range(3,16):
  for x in range(3,18):
   edge=x in (3,17) or z in (3,15)
   if y in (1,6,12,18):put(x,y,z,1)
   elif edge:
    material=3
    if x in (3,17) and z in (3,15):material=2
    elif y%6 in (2,3,4) and ((z in (3,15) and x%4 in (1,2)) or (x in (3,17) and z%4 in (1,2))):material=5
    elif y%6==5:material=4
    put(x,y,z,material)
for y in (6,12,18):
 for z in range(2,17):
  for x in range(2,19):
   if x in (2,18) or z in (2,16):put(x,y,z,9)
for y in range(19,24):
 inset=y-19
 for z in range(2+inset,17-inset):
  for x in range(2,19):put(x,y,z,6 if y==23 or z in (2+inset,16-inset) else 0)
for y in range(2,5):
 for x in (9,10,11):put(x,y,3,0)
for x in (2,18):
 for z in (2,16):
  for y in range(1,6):put(x,y,z,8)
r=region(ids,cells,(sx,sy,sz));raw=schematic({'Театральный дом':r}).replace(namespace['string']('Тестовая схема'),namespace['string']('Театральный дом'))
# Keep fixture data deterministic, including the gzip timestamp.
(root/'building-demo.litematic').write_bytes(gzip.compress(raw,mtime=0))
data={'Version':(3,3),'DataVersion':(3,4189),'Metadata':(10,{'Name':(8,'Театральный дом')}),'Width':(2,sx),'Height':(2,sy),'Length':(2,sz),'Blocks':(10,{'Palette':(10,{name:(3,i) for i,name in enumerate(ids)}),'Data':(7,cells)})}
raw=bytes([10])+namespace['string']('')+namespace['payload'](10,{'Schematic':(10,data)})
(root/'building-demo.schem').write_bytes(gzip.compress(raw,mtime=0))
print('3D fixture:',sum(v!=0 for v in cells),'blocks')
