// Material families use exact IDs / anchored prefixes, never a substring such as "stone".
const MATERIAL_GROUPS=(()=>{
  const groups=[];
  const add=(key,label,test)=>groups.push({key,label,test});
  for(const [key,label] of Object.entries({oak:'Дуб',dark_oak:'Тёмный дуб',pale_oak:'Бледный дуб',spruce:'Ель',birch:'Берёза',jungle:'Тропическое дерево',acacia:'Акация',mangrove:'Мангровое дерево',cherry:'Вишня',bamboo:'Бамбук',crimson:'Багровое дерево',warped:'Искажённое дерево'})){
    const pattern=new RegExp('^(?:stripped_)?'+key+'_');add(key,label,n=>pattern.test(n)||n===key);
  }
  const stone=/^(?:stone|smooth_stone|cobblestone|mossy_cobblestone|stone_brick|mossy_stone_brick)(?:s|_slab|_stairs|_wall|_button|_pressure_plate)?$/;
  const stoneSpecial=new Set(['chiseled_stone_bricks','cracked_stone_bricks','infested_stone','infested_cobblestone','infested_stone_bricks','infested_mossy_stone_bricks','infested_cracked_stone_bricks','infested_chiseled_stone_bricks']);
  add('stone','Камень',n=>stone.test(n)||stoneSpecial.has(n));
  for(const [key,label] of Object.entries({andesite:'Андезит',granite:'Гранит',diorite:'Диорит'})){
    const pattern=new RegExp('^(?:polished_)?'+key+'(?:_slab|_stairs|_wall)?$');add(key,label,n=>pattern.test(n));
  }
  for(const [key,label,pattern] of [
    ['deepslate','Глубинный сланец',/^(?:(?:cobbled|polished|chiseled|reinforced|infested)_)?deepslate(?:_(?:brick|tile)s?(?:_slab|_stairs|_wall)?|_slab|_stairs|_wall)?$|^cracked_deepslate_(?:bricks|tiles)$/],
    ['tuff','Туф',/^(?:(?:polished|chiseled)_)?tuff(?:_bricks?|_brick_slab|_brick_stairs|_brick_wall|_slab|_stairs|_wall)?$|^chiseled_tuff_bricks$/],
    ['blackstone','Чернит',/^(?:(?:polished|gilded|chiseled_polished|cracked_polished)_)?blackstone(?:_bricks?|_brick_slab|_brick_stairs|_brick_wall|_slab|_stairs|_wall|_button|_pressure_plate)?$/],
    ['red_sandstone','Красный песчаник',/^(?:(?:cut|smooth|chiseled)_)?red_sandstone(?:_slab|_stairs|_wall)?$/],
    ['sandstone','Песчаник',/^(?:(?:cut|smooth|chiseled)_)?sandstone(?:_slab|_stairs|_wall)?$/],
    ['quartz','Кварц',/^(?:(?:smooth|chiseled)_)?quartz_(?:block|bricks|pillar|slab|stairs)$/],
    ['prismarine','Призмарин',/^(?:dark_)?prismarine(?:_bricks|_slab|_stairs|_wall|_brick_slab|_brick_stairs)?$|^sea_lantern$/],
    ['nether_bricks','Незерские кирпичи',/^(?:(?:red|cracked|chiseled)_)?nether_bricks?$|^(?:red_)?nether_brick_(?:slab|stairs|wall|fence)$/],
    ['bricks','Кирпич',/^bricks$|^brick_(?:slab|stairs|wall)$/],
    ['mud','Грязь и саман',/^mud$|^packed_mud$|^mud_bricks$|^mud_brick_(?:slab|stairs|wall)$/],
    ['end_stone','Эндерняк',/^end_stone(?:_bricks|_brick_slab|_brick_stairs|_brick_wall)?$/],
    ['purpur','Пурпур',/^purpur_(?:block|pillar|slab|stairs)$/],
    ['basalt','Базальт',/^(?:polished_|smooth_)?basalt$/],
    ['glass','Стекло',/^(?:(?:white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_stained_|tinted_)?glass(?:_pane)?$/],
    ['concrete_powder','Сухой бетон',/^[a-z_]+_concrete_powder$/],
    ['concrete','Бетон',/^[a-z_]+_concrete$/],
    ['wool','Шерсть',/^[a-z_]+_(?:wool|carpet)$/],
    ['terracotta','Терракота',/^(?:[a-z_]+_)?terracotta$/],
    ['copper','Медь',/^(?:waxed_)?(?:(?:exposed|weathered|oxidized)_)?(?:cut_copper(?:_slab|_stairs)?|chiseled_copper|copper(?:_block|_grate|_bulb|_door|_trapdoor|_bars|_chain|_lantern)?)$/],
  ])add(key,label,n=>pattern.test(n));
  for(const [key,label] of Object.entries({calcite:'Кальцит',obsidian:'Обсидиан',snow:'Снег',ice:'Лёд',dirt:'Земля'})){
    const ids={calcite:['calcite'],obsidian:['obsidian','crying_obsidian'],snow:['snow','snow_block','powder_snow'],ice:['ice','packed_ice','blue_ice','frosted_ice'],dirt:['dirt','coarse_dirt','rooted_dirt','grass_block','podzol','mycelium','farmland','dirt_path']};
    add(key,label,n=>ids[key].includes(n));
  }
  add('other','Прочее',()=>true);return groups;
})();
function materialGroup(id){
  if(!id.startsWith('minecraft:'))return MATERIAL_GROUPS.at(-1);
  const name=id.slice(10);return MATERIAL_GROUPS.find(g=>g.test(name));
}
function compareMaterialGroups(a,b){return (a.key==='other')-(b.key==='other')||a.label.localeCompare(b.label,'ru');}
