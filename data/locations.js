export const LOCATIONS = {
  village: {
    name: 'Деревня Аврора',
    emoji: '🏘️',
    desc: 'Тихая средневековая деревня с извилистыми улочками, ремесленными дворами, уютной таверной и живой центральной площадью.',
    enemies: [],
    safe: true,
    shop: true,
    theme: 'village',
    mapCols: 38,
    mapRows: 28,
    npcs: [
      { id: 'cat', emoji: '🐈', name: 'Кошка', x: 17, y: 19 },
      { id: 'kids', emoji: '👦', name: 'Дети', x: 20, y: 19 },
      { id: 'villager-1', emoji: '🧑', name: 'Житель Авроры', x: 22, y: 6, ambient: true, wanderRadius: 44 },
      { id: 'villager-2', emoji: '🧑‍🌾', name: 'Садовник', x: 4, y: 9, ambient: true, wanderRadius: 44 },
      { id: 'villager-3', emoji: '🧕', name: 'Торговка', x: 33, y: 10, ambient: true, wanderRadius: 42 },
      { id: 'villager-4', emoji: '🧑‍🌾', name: 'Помощник кузнеца', x: 5, y: 20, ambient: true, wanderRadius: 44 },
      { id: 'villager-5', emoji: '🧔', name: 'Плотник', x: 33, y: 21, ambient: true, wanderRadius: 40 }
    ],
    statics: [
      { id: 'well', name: 'Колодец площади', x: 16, y: 14, propStyle: 'fountain', decorative: true },
      { id: 'world-portal', name: 'Врата миров', x: 19, y: 13, propStyle: 'world-portal', interactionRadius: 78, decorative: false },
      { id: 'tower-portal', name: 'Врата Башни', x: 22, y: 13, propStyle: 'tower-gate', interactionRadius: 78, decorative: false },
      { id: 'questBoard', emoji: '📋', name: 'Доска объявлений', x: 15, y: 10 },
      { id: 'herald', emoji: '📢', name: 'Глашатай', x: 17, y: 10 },
      { id: 'bard', emoji: '🎵', name: 'Бард', x: 20, y: 10 },
      { id: 'blacksmith', emoji: '⚒️', name: 'Кузнец Борин', x: 7, y: 10 },
      { id: 'healer', emoji: '💚', name: 'Лекарь Мирра', x: 31, y: 10 },
      { id: 'alchemist', emoji: '⚗️', name: 'Алхимик Кир', x: 7, y: 21 },
      { id: 'merchant', emoji: '🛒', name: 'Торговец', x: 31, y: 21 },
      { id: 'elder', emoji: '👴', name: 'Старейшина Эдвин', x: 24, y: 6 },
      { id: 'guard', emoji: '🛡️', name: 'Страж южных ворот', x: 19, y: 25 },
      { id: 'memorial', name: 'Памятный камень', x: 12, y: 16, propStyle: 'memorial', decorative: true },
      { id: 'lantern-west', name: 'Уличный фонарь', x: 13, y: 13, propStyle: 'lantern', decorative: true },
      { id: 'lantern-east', name: 'Уличный фонарь', x: 27, y: 13, propStyle: 'lantern', decorative: true },
      { id: 'bench-north', name: 'Скамья у колодца', x: 15, y: 8, propStyle: 'bench', decorative: true },
      { id: 'bench-south', name: 'Скамья площади', x: 15, y: 18, propStyle: 'bench', decorative: true },
      { id: 'planter-nw', name: 'Цветочная клумба', x: 12, y: 9, propStyle: 'planter', decorative: true },
      { id: 'planter-ne', name: 'Цветочная клумба', x: 27, y: 9, propStyle: 'planter', decorative: true },
      { id: 'planter-sw', name: 'Цветочная клумба', x: 12, y: 20, propStyle: 'planter', decorative: true },
      { id: 'planter-se', name: 'Цветочная клумба', x: 27, y: 20, propStyle: 'planter', decorative: true },
      { id: 'banner-west', name: 'Знамя Авроры', x: 10, y: 14, propStyle: 'banner', decorative: true },
      { id: 'banner-east', name: 'Знамя Авроры', x: 29, y: 14, propStyle: 'banner', decorative: true },
      { id: 'brazier-west', name: 'Жаровня площади', x: 10, y: 18, propStyle: 'brazier', decorative: true },
      { id: 'brazier-east', name: 'Жаровня площади', x: 29, y: 18, propStyle: 'brazier', decorative: true },
      { id: 'notice-stall', name: 'Рыночный прилавок', x: 29, y: 22, propStyle: 'stall', decorative: true },
      { id: 'forge-anvil', name: 'Наковальня кузницы', x: 9, y: 9, propStyle: 'anvil', decorative: true },
      { id: 'forge-woodpile', name: 'Запас дров', x: 9, y: 11, propStyle: 'woodpile', decorative: true },
      { id: 'ore-cart', name: 'Тележка с рудой', x: 10, y: 11, propStyle: 'cart', decorative: true },
      { id: 'market-barrels', name: 'Бочки с товаром', x: 29, y: 21, propStyle: 'barrels', decorative: true },
      { id: 'herb-rack', name: 'Сушёные травы', x: 9, y: 21, propStyle: 'herb-rack', decorative: true },
      { id: 'hall-building', name: 'Дом старейшины', x: 25, y: 3, buildingStyle: 'hall', decorative: true },
      { id: 'forge-building', name: 'Кузница Авроры', x: 7, y: 7, buildingStyle: 'forge', decorative: true },
      { id: 'healer-building', name: 'Лечебный дом', x: 31, y: 7, buildingStyle: 'healer', decorative: true },
      { id: 'alchemy-building', name: 'Алхимическая мастерская', x: 7, y: 19, buildingStyle: 'alchemy', decorative: true },
      { id: 'market-building', name: 'Рыночный дом', x: 31, y: 19, buildingStyle: 'market', decorative: true },
      { id: 'tavern-building', name: 'Таверна «Тихий угол»', x: 13, y: 24, buildingStyle: 'tavern', decorative: true },
      { id: 'home-nw', name: 'Дом у северной дороги', x: 13, y: 3, buildingStyle: 'home', decorative: true },
      { id: 'home-se', name: 'Дом у южной дороги', x: 25, y: 24, buildingStyle: 'home', decorative: true },
      // Pixel-art nature frames form a soft green village boundary without blocking routes.
      { id: 'aurora-oak-nw', name: 'Старый дуб', x: 3, y: 3, natureStyle: 'oak', decorative: true },
      { id: 'aurora-pine-ne', name: 'Сосна у дороги', x: 34, y: 3, natureStyle: 'pine', decorative: true },
      { id: 'aurora-pine-sw', name: 'Сосна у южных ворот', x: 3, y: 25, natureStyle: 'pine', decorative: true },
      { id: 'aurora-oak-se', name: 'Дуб у окраины', x: 34, y: 25, natureStyle: 'oak', decorative: true },
      { id: 'aurora-bush-west', name: 'Куст у тропы', x: 3, y: 15, natureStyle: 'bush', decorative: true },
      { id: 'aurora-bush-east', name: 'Цветущий куст', x: 34, y: 16, natureStyle: 'bush', decorative: true },
      { id: 'aurora-rock-north', name: 'Мшистый валун', x: 5, y: 5, natureStyle: 'rock', decorative: true },
      { id: 'aurora-rock-east', name: 'Камни у ограды', x: 35, y: 21, natureStyle: 'rock', decorative: true },
      { id: 'aurora-stump', name: 'Старый пень', x: 5, y: 23, natureStyle: 'stump', decorative: true },
      // Низкие ограды и посадки обозначают частные дворики, не перекрывая проходы.
      { id: 'aurora-hedge-west', name: 'Живая изгородь', x: 4, y: 12, natureStyle: 'hedge', decorative: true },
      { id: 'aurora-hedge-east', name: 'Живая изгородь', x: 34, y: 12, natureStyle: 'hedge', decorative: true },
      { id: 'aurora-fence-southwest', name: 'Ограда сада', x: 8, y: 26, natureStyle: 'fence', decorative: true },
      { id: 'aurora-fence-southeast', name: 'Ограда двора', x: 29, y: 26, natureStyle: 'fence', decorative: true },
      { id: 'aurora-flowerbed-healer', name: 'Лекарственный цветник', x: 33, y: 9, natureStyle: 'flowerbed', decorative: true },
      { id: 'aurora-flowerbed-alchemy', name: 'Травяной сад', x: 5, y: 20, natureStyle: 'flowerbed', decorative: true },
      // A compact ornamental pocket links the northern homes with the craft yard.
      { id: 'aurora-north-garden-west', name: 'Цветник северного двора', x: 16, y: 6, natureStyle: 'flowerbed', decorative: true },
      { id: 'aurora-north-garden-bush', name: 'Куст северного двора', x: 17, y: 8, natureStyle: 'bush', decorative: true },
      { id: 'aurora-north-garden-east', name: 'Цветник у восточной тропы', x: 22, y: 8, natureStyle: 'flowerbed', decorative: true },
      { id: 'aurora-north-garden-hedge', name: 'Низкая изгородь северного двора', x: 23, y: 10, natureStyle: 'hedge', decorative: true },
    ]
  },

  forest: {
    name: 'Тёмный лес',
    emoji: '🌲',
    desc: 'Древний лес, кишащий гоблинами. Под корнями сохранились следы первой печати.',
    theme: 'forest',
    enemies: ['goblin', 'goblin', 'skeleton', 'thorn-stalker'],
  },

  ruins: {
    name: 'Руины павшего храма',
    emoji: '🏛️',
    desc: 'Древние руины, где обитает нежить и сохранились записи первых хранителей.',
    theme: 'ruins',
    enemies: ['skeleton', 'skeleton', 'dark-knight', 'grave-scout'],
  },

  shadow: {
    name: 'Пещера теней',
    emoji: '🕳️',
    desc: 'Здесь царит вечная тьма. Теневой маг охраняет древний знак на границе мира.',
    theme: 'shadow',
    enemies: ['dark-knight', 'shadow-mage'],
  },

  swamp: {
    name: 'Кровавая топь',
    emoji: '🩸',
    desc: 'Гиблые топи на краю мира.',
    enemies: ['wolf', 'skeleton-archer', 'ghost', 'spore-shaman'],
    theme: 'swamp',
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  graveyard: {
    name: 'Проклятое кладбище',
    emoji: '🪦',
    desc: 'Забытые могилы, над которыми висит туман.',
    enemies: ['skeleton', 'skeleton-archer', 'ghost', 'wraith', 'grave-scout', 'crypt-hound', 'grave-king'],
    theme: 'graveyard',
    chestsCount: 4,
    mapCols: 42,
    mapRows: 32
  },

  volcano: {
    name: 'Огненный разлом',
    emoji: '🌋',
    desc: 'Раскалённые скалы и реки лавы.',
    enemies: ['fire-elemental', 'magma-golem', 'ash-harpy', 'obsidian-guard', 'flame-lord'],
    theme: 'volcano',
    chestsCount: 4,
    mapCols: 42,
    mapRows: 32
  },

  'ice-peaks': {
    name: 'Ледяные пики',
    emoji: '❄️',
    desc: 'Вечная мерзлота и метель.',
    enemies: ['frost-wolf', 'ice-elemental', 'rime-witch', 'frost-giant', 'ice-queen'],
    theme: 'ice',
    chestsCount: 4,
    mapCols: 42,
    mapRows: 32
  },

  wasteland: {
    name: 'Пустошь',
    emoji: '🏜️',
    desc: 'Выжженная земля под палящим солнцем.',
    enemies: ['sand-worm', 'dust-wraith', 'sand-worm', 'sand-king'],
    theme: 'desert',
    chestsCount: 4,
    mapCols: 42,
    mapRows: 32
  },

  library: {
    name: 'Забытая библиотека',
    emoji: '📚',
    desc: 'Древние фолианты хранят забытые знания.',
    enemies: ['flying-tome', 'book-guardian', 'archmage'],
    theme: 'library',
    chestsCount: 5,
    mapCols: 42,
    mapRows: 32
  },

  'dragon-lair': {
    name: 'Логово дракона',
    emoji: '🐉',
    desc: 'Финальное испытание. Древний дракон охраняет сокровища.',
    enemies: ['dragonling', 'fire-drake', 'dragon-guardian', 'ancient-dragon'],
    theme: 'dragon',
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  // ---------- ПЯТЬ НОВЫХ РЕГИОНОВ КАМПАНИИ ----------
  'briar-hollow': {
    name: 'Глухая чаща',
    emoji: '🌳',
    desc: 'Запутанные корни, грибные круги и святилище, в котором проснулся Древний энт.',
    theme: 'briar-hollow',
    enemies: ['thorn-stalker', 'spore-shaman', 'moss-troll', 'rootbound-sentinel', 'goblin', 'elder-treant', 'root-court-executioner'],
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  'sunken-necropolis': {
    name: 'Затонувший некрополь',
    emoji: '⚰️',
    desc: 'Подземный город мёртвых. Затопленные крипты ведут к трону Костяного тирана.',
    theme: 'sunken-necropolis',
    enemies: ['grave-scout', 'crypt-hound', 'drowned-scribe', 'bone-colossus', 'grave-king', 'bone-tyrant', 'drowned-queen'],
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  'obsidian-fields': {
    name: 'Обсидиановые поля',
    emoji: '🌋',
    desc: 'Застывшие лавовые реки, чёрные башни и гарпии, кружащие над жерлом.',
    theme: 'obsidian-fields',
    enemies: ['fire-elemental', 'ash-harpy', 'ashbound-renegade', 'obsidian-guard', 'magma-golem', 'flame-lord', 'oath-forge-warden'],
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  'frost-citadel': {
    name: 'Крепость вечного льда',
    emoji: '🏔️',
    desc: 'Старая цитадель погребена в леднике. В её залах не тает даже пламя.',
    theme: 'frost-citadel',
    enemies: ['frost-wolf', 'rime-witch', 'mirror-revenant', 'ice-elemental', 'frost-giant', 'ice-queen', 'mirror-icekeeper'],
    chestsCount: 5,
    mapCols: 44,
    mapRows: 34
  },

  'void-crater': {
    name: 'Кратер Бездны',
    emoji: '🌀',
    desc: 'Разлом между мирами. Пространство искажено, а древние драконы стерегут сердце тьмы.',
    theme: 'void-crater',
    enemies: ['dragonling', 'fire-drake', 'dragon-guardian', 'riftstalker', 'void-harbinger', 'ancient-dragon', 'echo-devourer'],
    chestsCount: 6,
    mapCols: 46,
    mapRows: 36
  },

  rift: {
    name: 'Разлом',
    emoji: '🌀',
    desc: 'Рана между мирами. Три осколка стабилизируют её края, но за гранью ещё остаётся неизвестное.',
    theme: 'void-crater',
    safe: true,
    enemies: []
  }
};