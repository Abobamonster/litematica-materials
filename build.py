from pathlib import Path
import urllib.request,json,concurrent.futures,zipfile,hashlib,base64
root=Path(__file__).parent
cache=root/'asset-cache';cache.mkdir(exist_ok=True)
def get(url,key):
 p=cache/key
 if not p.exists():
  p.write_bytes(urllib.request.urlopen(url,timeout=45).read())
 return json.loads(p.read_text('utf-8'))
base='https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/'
# Pin the upstream revision for reproducible, stable texture URLs.
commit='6c571b0825ee27b81f01127c2bd0d4ba2c89abb9'
(cache/'revision.txt').write_text(commit)
def load(which):return get(base+commit+'/data/1.21.4/'+which+'.json',which+'.json')
with concurrent.futures.ThreadPoolExecutor(3) as pool:
 f1=pool.submit(load,'blocks_textures');f2=pool.submit(load,'items_textures');f3=pool.submit(get,'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/lang/ru_ru.json','ru_ru.json')
 blocks,items,lang=f1.result(),f2.result(),f3.result()
images={}
for r in blocks+items:
 tex=(r.get('texture') or '').replace('minecraft:','').replace('block/','blocks/').replace('item/','items/')
 if tex.startswith(('blocks/','items/')) and all(c.isalnum() or c in '_/-' for c in tex):images[r['name']]=base+commit+'/data/1.21.4/'+tex+'.png'
for name,tex in {'grass_block':'grass_block_side','podzol':'podzol_side','mycelium':'mycelium_side','farmland':'farmland','dirt_path':'dirt_path_top'}.items():images[name]=base+commit+'/data/1.21.4/blocks/'+tex+'.png'
renders=json.loads((root/'render-icons.json').read_text('utf-8'))
images.update(renders['images'])
for name,target in {'wall_torch':'torch','redstone_wall_torch':'redstone_torch','soul_wall_torch':'soul_torch','tripwire':'string','redstone_wire':'redstone','attached_melon_stem':'melon_seeds','attached_pumpkin_stem':'pumpkin_seeds','melon_stem':'melon_seeds','pumpkin_stem':'pumpkin_seeds'}.items():
 if target in renders['images']:images[name]=renders['images'][target]
for name in list(images):
 target=name.replace('_wall_hanging_sign','_hanging_sign').replace('_wall_sign','_sign').replace('_wall_banner','_banner').replace('_wall_head','_head').replace('_wall_skull','_skull')
 if target!=name and target in renders['images']:images[name]=renders['images'][target]
names={k.removeprefix('block.minecraft.'):v for k,v in lang.items() if k.startswith('block.minecraft.')}
assets='const ASSETS='+json.dumps({'images':images,'names':names},ensure_ascii=False,separators=(',',':'))+';'
theme_layers=['style.css','selection.css','opera.css','design-themes.css','tokens.css','product-clean.css']
styles='\n'.join((root/'theme'/name).read_text('utf-8') for name in theme_layers)+'\n'+(root/'dist/style.css').read_text('utf-8')
art='data:image/png;base64,'+base64.b64encode((root/'theme/racing-transparent.png').read_bytes()).decode()
bridge_client=(root/'export-client.js').read_text('utf-8')+'\n'+(root/'bridge-client.js').read_text('utf-8')
bridge=(root/'bridge-shell.html').read_text('utf-8').replace('/*BRIDGE_CLIENT*/',bridge_client).replace('/*BRIDGE_THEME*/','\n'.join((root/'theme'/name).read_text('utf-8') for name in theme_layers)).replace('/*BRIDGE_ART*/',art)
code=(root/'Code.gs').read_text('utf-8').split('// BEGIN GENERATED GOOGLE BRIDGE')[0].rstrip()
(root/'Code.gs').write_text(code+'\n\n// BEGIN GENERATED GOOGLE BRIDGE — edit bridge-shell.html and bridge-client.js, then build.py\nvar MATERIAL_BRIDGE_HTML='+json.dumps(bridge,ensure_ascii=False)+';\n// END GENERATED GOOGLE BRIDGE\n','utf-8')
html=(root/'shell.html').read_text('utf-8').replace('/*STYLE*/',styles).replace('/*ART*/',art).replace('/*CORE*/',(root/'core.js').read_text('utf-8')).replace('/*ASSETS*/',assets).replace('/*MODELS*/','const BLOCK_MODELS='+(root/'viewer-models.json').read_text('utf-8')+';const VIEWER_TEXTURE_BASE='+json.dumps(base+commit+'/data/1.21.4/')+';').replace('/*VIEWER*/',(root/'viewer.bundle.js').read_text('utf-8').replace('</script','<\\/script')).replace('/*DEMO*/','const DEMO_SCHEMATIC='+json.dumps(base64.b64encode((root/'building-demo.litematic').read_bytes()).decode())+';').replace('/*APP*/',(root/'theme-motion.js').read_text('utf-8')+'\n'+(root/'groups.js').read_text('utf-8')+'\n'+(root/'export-client.js').read_text('utf-8')+'\n'+(root/'app.js').read_text('utf-8'))
(root/'dist/index.html').write_text(html,encoding='utf-8')
(root/'Index.html').write_text(html,encoding='utf-8')
(root/'dist/assets.json').write_text(json.dumps({'images':images,'names':names},ensure_ascii=False),encoding='utf-8')
if (root/'ИНСТРУКЦИЯ.md').exists():
 with zipfile.ZipFile(root/'dist/litematica-kit.zip','w',zipfile.ZIP_DEFLATED) as z:
  for filename in ['Index.html','Code.gs','DEVELOPMENT.md','README.md','ИНСТРУКЦИЯ.md','ИСТОЧНИКИ.txt','appsscript.json','demo.litematic','demo.schem','building-demo.litematic','building-demo.schem']:
   z.write(root/filename,filename)
  for filename in ['package.json','theme-motion.js','lock-tests.cjs','bridge-client.js','bridge-shell.html','bridge-tests.cjs','viewer.js','viewer.bundle.js','viewer-models.json','preview-tests.cjs','make_building_demo.py','core.js','app.js','groups.js','groups-tests.cjs','export-client.js','shell.html','build.py','render-icons.json','tests.cjs','export-tests.cjs','progress-tests.cjs','schem-tests.cjs','make_fixtures.py']:
   z.write(root/filename,'source/'+filename)
  for filename in ['Code.gs','README.md','DEVELOPMENT.md','ИСТОЧНИКИ.txt','appsscript.json','ИНСТРУКЦИЯ.md','demo.litematic','demo.schem','building-demo.litematic','building-demo.schem']:
   z.write(root/filename,'source/'+filename)
  for filename in ['OrbitControls.js','THREE-LICENSE.txt']:z.write(root/'vendor'/filename,'source/vendor/'+filename)
  for file in sorted((root/'theme').glob('*')):
   if file.is_file():z.write(file,'source/theme/'+file.name)
  for file in sorted((root/'docs/screenshots').glob('*')):
   if file.is_file():
    z.write(file,'docs/screenshots/'+file.name)
    z.write(file,'source/docs/screenshots/'+file.name)
  z.write(root/'scripts/build-viewer.mjs','source/scripts/build-viewer.mjs')
  z.write(root/'dist/style.css','source/dist/style.css')
print(json.dumps({'html_bytes':len(html.encode()),'texture_revision':commit,'image_count':len(images),'names':len(names)}))
