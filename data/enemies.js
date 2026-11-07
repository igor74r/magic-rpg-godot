export const ENEMIES = {
  goblin: { name: 'Гоблин', emoji: '👺', hp: 40, attack: 10, defense: 2, exp: 25, gold: 15, drops: [] },

  skeleton: { name: 'Скелет', emoji: '💀', hp: 60, attack: 15, defense: 5, exp: 40, gold: 25, drops: ['mana-potion'] },

  'dark-knight': {
    name: 'Тёмный рыцарь', emoji: '🛡️',
    hp: 120, attack: 25, defense: 10, exp: 100, gold: 80,
    drops: ['health-potion', 'iron-sword']
  },

  'shadow-mage': {
    name: 'Теневой маг', emoji: '🌑',
    hp: 90, attack: 30, defense: 5, exp: 120, gold: 100,
    drops: ['mana-potion', 'apprentice-staff'], boss: true,
    special: { type: 'snipe', every: 3, mult: 1.8, name: 'Тёмная стрела', effect: 'burn' },
    phases: [{ atHp: 0.5, atkMult: 1.4, msg: 'Теневой маг впадает в ярость!', specialEvery: 2 }]
  },

  wolf: {
    name: 'Волк', emoji: '🐺',
    hp: 55, attack: 12, defense: 3, exp: 35, gold: 20,
    drops: ['health-potion'],
    special: { type: 'double', every: 3, name: 'Двойной укус', effect: 'bleed' }
  },

  'skeleton-archer': {
    name: 'Скелет-лучник', emoji: '🏹',
    hp: 70, attack: 18, defense: 4, exp: 55, gold: 35,
    drops: ['mana-potion', 'leather-armor'],
    special: { type: 'snipe', every: 3, mult: 2, name: 'Прицельный выстрел', effect: 'poison' }
  },

  ghost: {
    name: 'Призрак', emoji: '👻',
    hp: 65, attack: 15, defense: 2, exp: 50, gold: 40,
    drops: ['mana-potion', 'apprentice-staff'],
    special: { type: 'drain', every: 3, name: 'Иссушение', effect: 'poison' }
  },

  wraith: {
    name: 'Тень', emoji: '🌫️',
    hp: 80, attack: 20, defense: 3, exp: 70, gold: 55,
    drops: ['mana-potion', 'strong-mana-potion'],
    special: { type: 'drain', every: 3, name: 'Похищение жизни', effect: 'poison' }
  },

  'grave-king': {
    name: 'Король курганов', emoji: '☠️',
    hp: 180, attack: 32, defense: 12, exp: 200, gold: 180,
    drops: ['steel-sword', 'strong-health-potion'], boss: true,
    special: { type: 'snipe', every: 3, mult: 2, name: 'Проклятие кургана', effect: 'bleed' },
    phases: [{ atHp: 0.3, atkMult: 1.5, msg: 'Король курганов взывает к тьме!', specialEvery: 2 }]
  },

  'fire-elemental': {
    name: 'Огненный элементаль', emoji: '🔥',
    hp: 75, attack: 22, defense: 4, exp: 75, gold: 60,
    drops: ['mana-potion', 'ember-core', 'rune-ember'],
    special: { type: 'snipe', every: 3, mult: 1.7, name: 'Огненный шквал', effect: 'burn' }
  },

  'magma-golem': {
    name: 'Магмовый голем', emoji: '🗿',
    hp: 130, attack: 20, defense: 15, exp: 90, gold: 70,
    drops: ['strong-health-potion', 'ember-core'],
    special: { type: 'double', every: 3, name: 'Раскалённый удар', effect: 'burn' }
  },

  'flame-lord': {
    name: 'Пепельный Вестник', emoji: '🐉',
    hp: 220, attack: 38, defense: 10, exp: 250, gold: 220,
    drops: ['mithril-armor', 'strong-mana-potion', 'cinder-visor', 'rune-ember'], boss: true,
    special: { type: 'snipe', every: 2, mult: 2.2, name: 'Адское пламя', effect: 'burn', element: 'fire' },
    phases: [
      { atHp: 0.5, atkMult: 1.4, msg: 'Пепельный Вестник раскрывает крылья пепельного пламени!', specialEvery: 1 },
      { atHp: 0.25, atkMult: 1.65, msg: 'Пепельный Вестник сжигает остатки сил и переходит в неистовую фазу!', specialEvery: 1 }
    ]
  },

  'frost-wolf': {
    name: 'Морозный волк', emoji: '🐕‍🦺',
    hp: 85, attack: 20, defense: 5, exp: 90, gold: 70,
    drops: ['health-potion', 'frost-essence', 'rune-frost'],
    special: { type: 'double', every: 3, name: 'Ледяной укус', effect: 'bleed' }
  },

  'ice-elemental': {
    name: 'Ледяной элементаль', emoji: '🧊',
    hp: 100, attack: 24, defense: 6, exp: 100, gold: 80,
    drops: ['mana-potion'],
    special: { type: 'snipe', every: 3, mult: 1.8, name: 'Ледяной шип', effect: 'bleed' }
  },

  'ice-queen': {
    name: 'Ледяная Хватка', emoji: '🐉',
    hp: 260, attack: 42, defense: 14, exp: 320, gold: 280,
    drops: ['ice-staff', 'frost-armor', 'glacier-greaves', 'pendant-last-oath'], boss: true,
    special: { type: 'snipe', every: 3, mult: 2.2, name: 'Ледяная стрела', effect: 'slow', element: 'ice' },
    phases: [
      { atHp: 0.5, atkMult: 1.4, msg: 'Ледяная Хватка сковывает арену вечным льдом!', specialEvery: 2 },
      { atHp: 0.25, atkMult: 1.6, msg: 'Ледяная Хватка раскалывает лёд и обрушивает последнюю бурю!', specialEvery: 1 }
    ]
  },

  'sand-worm': {
    name: 'Песчаный червь', emoji: '🐛',
    hp: 95, attack: 22, defense: 8, exp: 95, gold: 75,
    drops: ['strong-health-potion', 'windstep-boots'],
    special: { type: 'double', every: 3, name: 'Двойной захват', effect: 'poison' }
  },

  'dust-wraith': {
    name: 'Песчаный призрак', emoji: '🌪️',
    hp: 75, attack: 24, defense: 3, exp: 100, gold: 85,
    drops: ['mana-potion', 'strong-mana-potion'],
    special: { type: 'drain', every: 3, name: 'Поглощение песка', effect: 'poison' }
  },

  'sand-king': {
    name: 'Король пустыни', emoji: '🤴',
    hp: 280, attack: 40, defense: 12, exp: 350, gold: 300,
    drops: ['desert-blade', 'crystal-amulet'], boss: true,
    special: { type: 'snipe', every: 3, mult: 2, name: 'Проклятие песков', effect: 'poison' },
    phases: [{ atHp: 0.3, atkMult: 1.5, msg: 'Король пустыни взывает к буре!', specialEvery: 1 }]
  },

  'flying-tome': {
    name: 'Летающая книга', emoji: '📖',
    hp: 70, attack: 18, defense: 3, exp: 85, gold: 70,
    drops: ['mana-potion', 'strong-mana-potion'],
    special: { type: 'snipe', every: 3, mult: 1.6, name: 'Бумажный вихрь', effect: 'bleed' }
  },

  'book-guardian': {
    name: 'Книжный страж', emoji: '📕',
    hp: 130, attack: 24, defense: 10, exp: 130, gold: 100,
    drops: ['strong-mana-potion'],
    special: { type: 'double', every: 3, name: 'Тяжёлый переплёт', effect: 'stun' }
  },

  archmage: {
    name: 'Архимаг', emoji: '🧙‍♂️',
    hp: 160, attack: 30, defense: 8, exp: 180, gold: 150,
    drops: ['archmage-staff', 'scroll-lightning', 'amulet-first-light'], boss: true,
    special: { type: 'snipe', every: 3, mult: 2, name: 'Тайное знание', effect: 'burn' },
    phases: [{ atHp: 0.5, atkMult: 1.4, msg: 'Архимаг раскрывает гримуар!', specialEvery: 2 }]
  },

  dragonling: {
    name: 'Дракончик', emoji: '🦎',
    hp: 100, attack: 26, defense: 6, exp: 130, gold: 110,
    drops: ['health-potion', 'strong-health-potion', 'void-dust', 'rune-void'],
    special: { type: 'double', every: 3, name: 'Двойной укус', effect: 'burn' }
  },

  'fire-drake': {
    name: 'Огнедышащий дракон', emoji: '🐲',
    hp: 180, attack: 34, defense: 10, exp: 220, gold: 180,
    drops: ['strong-health-potion', 'scroll-shield'],
    special: { type: 'snipe', every: 3, mult: 2, name: 'Огненное дыхание', effect: 'burn' },
    phases: [{ atHp: 0.4, atkMult: 1.5, msg: 'Дракон впадает в ярость!', specialEvery: 2 }]
  },

  'dragon-guardian': {
    name: 'Дракон-страж', emoji: '🐉',
    hp: 220, attack: 32, defense: 15, exp: 250, gold: 200,
    drops: ['dragon-scale-armor', 'strong-mana-potion'],
    special: { type: 'double', every: 3, name: 'Двойной удар хвостом', effect: 'stun' }
  },

  'ancient-dragon': {
    name: 'Кровавая Корона', emoji: '🐉',
    hp: 450, attack: 52, defense: 16, exp: 600, gold: 600,
    drops: ['dragon-blade', 'dragon-scale-armor', 'scroll-poison-cloud'], boss: true,
    special: { type: 'drain', every: 2, name: 'Кровавый пир', effect: 'bleed', element: 'blood' },
    phases: [
      { atHp: 0.5, atkMult: 1.4, msg: 'Кровавая Корона раскрывает крылья!', specialEvery: 2 },
      { atHp: 0.25, atkMult: 1.6, msg: 'Кровавая Корона обрушивает ярость на героя!', specialEvery: 1 }
    ]
  },

  // ---------- НОВЫЕ ВРАГИ АКТА I: ЛЕС ----------
  'thorn-stalker': {
    name: 'Шипастый ловчий', emoji: '🌿',
    hp: 68, attack: 16, defense: 5, exp: 58, gold: 38,
    drops: ['health-potion', 'root-fiber', 'rune-root'],
    special: { type: 'double', every: 3, name: 'Рваные шипы', effect: 'bleed' }
  },

  'spore-shaman': {
    name: 'Грибной шаман', emoji: '🍄',
    hp: 78, attack: 20, defense: 4, exp: 68, gold: 46,
    drops: ['mana-potion', 'herb-moon', 'root-fiber'],
    special: { type: 'snipe', every: 3, mult: 1.6, name: 'Ядовитые споры', effect: 'poison' }
  },

  'moss-troll': {
    name: 'Моховой тролль', emoji: '🪨',
    hp: 155, attack: 25, defense: 12, exp: 135, gold: 105,
    drops: ['strong-health-potion'],
    special: { type: 'double', every: 3, name: 'Удар корнями', effect: 'stun' }
  },

  'elder-treant': {
    name: 'Древний энт', emoji: '🌳',
    hp: 330, attack: 39, defense: 17, exp: 480, gold: 360,
    drops: ['mithril-armor', 'strong-health-potion', 'rootbound-hood', 'rune-root'], boss: true,
    special: { type: 'double', every: 3, name: 'Гнев корней', effect: 'stun' },
    phases: [
      { atHp: 0.6, atkMult: 1.25, msg: 'Древний энт пробуждает корни!', specialEvery: 2 },
      { atHp: 0.25, atkMult: 1.55, msg: 'Сердце рощи наполняется скверной!', specialEvery: 1 }
    ]
  },

  // ---------- НОВЫЕ ВРАГИ АКТА II: НЕКРОПОЛЬ ----------
  'grave-scout': {
    name: 'Костяной дозорный', emoji: '💀',
    hp: 82, attack: 21, defense: 6, exp: 72, gold: 52,
    drops: ['mana-potion', 'grave-salt'],
    special: { type: 'snipe', every: 3, mult: 1.7, name: 'Костяная стрела', effect: 'bleed' }
  },

  'crypt-hound': {
    name: 'Гончая склепа', emoji: '🐺',
    hp: 105, attack: 25, defense: 7, exp: 92, gold: 68,
    drops: ['health-potion', 'grave-salt', 'rune-tide'],
    special: { type: 'double', every: 3, name: 'Проклятый укус', effect: 'poison' }
  },

  'bone-colossus': {
    name: 'Костяной колосс', emoji: '☠️',
    hp: 300, attack: 37, defense: 19, exp: 330, gold: 260,
    drops: ['steel-sword', 'mithril-armor', 'gravebinder-gloves', 'rune-tide'], boss: true,
    special: { type: 'double', every: 3, name: 'Обвал костей', effect: 'stun' },
    phases: [{ atHp: 0.4, atkMult: 1.45, msg: 'Колосс собирает кости павших!', specialEvery: 2 }]
  },

  'bone-tyrant': {
    name: 'Костяной тиран', emoji: '👑',
    hp: 390, attack: 43, defense: 18, exp: 520, gold: 420,
    drops: ['dragon-scale-armor', 'archmage-staff', 'ring-quiet-tide', 'grave-salt'], boss: true,
    special: { type: 'drain', every: 3, name: 'Поглощение душ', effect: 'bleed' },
    phases: [{ atHp: 0.5, atkMult: 1.4, msg: 'Костяной тиран поднимает павших!', specialEvery: 1 }]
  },

  // ---------- НОВЫЕ ВРАГИ АКТА III: ОБСИДИАН ----------
  'ash-harpy': {
    name: 'Пепельная гарпия', emoji: '🦅',
    hp: 112, attack: 28, defense: 6, exp: 112, gold: 92,
    drops: ['mana-potion'],
    special: { type: 'snipe', every: 3, mult: 1.8, name: 'Падающий клинок', effect: 'burn' }
  },

  'obsidian-guard': {
    name: 'Обсидиановый страж', emoji: '🗿',
    hp: 170, attack: 29, defense: 18, exp: 148, gold: 118,
    drops: ['mithril-armor'],
    special: { type: 'double', every: 3, name: 'Лавовый молот', effect: 'burn' }
  },

  // ---------- НОВЫЕ ВРАГИ АКТА IV: ЛЁД ----------
  'rime-witch': {
    name: 'Ведьма инея', emoji: '🧊',
    hp: 118, attack: 29, defense: 7, exp: 125, gold: 105,
    drops: ['strong-mana-potion'],
    special: { type: 'snipe', every: 3, mult: 1.9, name: 'Ледяное проклятие', effect: 'stun' }
  },

  'frost-giant': {
    name: 'Ледяной великан', emoji: '❄️',
    hp: 235, attack: 38, defense: 19, exp: 220, gold: 180,
    drops: ['frost-armor', 'strong-health-potion'],
    special: { type: 'double', every: 3, name: 'Дрожь ледника', effect: 'stun' }
  },

  // ---------- НОВЫЙ ВРАГ АКТА V: БЕЗДНА ----------
  'void-harbinger': {
    name: 'Глашатай Бездны', emoji: '🕳️',
    hp: 340, attack: 43, defense: 15, exp: 420, gold: 340,
    drops: ['crystal-amulet', 'strong-mana-potion', 'ring-wolf-eye', 'rune-void'], boss: true,
    special: { type: 'drain', every: 3, name: 'Пожирание света', effect: 'burn' },
    phases: [
      { atHp: 0.55, atkMult: 1.3, msg: 'Глашатай раскрывает разлом!', specialEvery: 2 },
      { atHp: 0.25, atkMult: 1.55, msg: 'Бездна поглощает оболочку глашатая!', specialEvery: 1 }
    ]
  },

  'rootbound-sentinel': {
    name: 'Страж корневой печати', emoji: '🪵',
    hp: 118, attack: 22, defense: 13, exp: 105, gold: 78,
    drops: ['root-fiber', 'rune-root'],
    lore: 'Древний защитник святилища. Его кора хранит приказы первого ордена.',
    tactics: 'Медленный, но стойкий противник; опасен оглушающими ударами корней.',
    special: { type: 'double', every: 3, name: 'Корневой захват', effect: 'stun' }
  },

  'drowned-scribe': {
    name: 'Утопленный писец', emoji: '📜',
    hp: 145, attack: 27, defense: 8, exp: 138, gold: 102,
    drops: ['grave-salt', 'rune-tide'],
    lore: 'Писец некрополя, который продолжает переписывать имена даже после смерти.',
    tactics: 'Проклинает героя и истощает его силы; не позволяйте затянуть бой.',
    special: { type: 'drain', every: 3, name: 'Чернила забвения', effect: 'poison' }
  },

  'ashbound-renegade': {
    name: 'Пепельный отступник', emoji: '⚔️',
    hp: 188, attack: 32, defense: 12, exp: 165, gold: 132,
    drops: ['ember-core', 'rune-ember'],
    lore: 'Бывший кузнец пяти орденов, связавший себя с огнём после предательства.',
    tactics: 'Чередует быстрые атаки и огненный выпад; держите запас лечения.',
    special: { type: 'snipe', every: 3, mult: 1.9, name: 'Клеймо раскола', effect: 'burn' }
  },

  'mirror-revenant': {
    name: 'Зеркальный мститель', emoji: '🪞',
    hp: 205, attack: 34, defense: 14, exp: 190, gold: 150,
    drops: ['frost-essence', 'rune-frost'],
    lore: 'Отражение хранителя, оставшееся в ледяном зале после принесения последней клятвы.',
    tactics: 'Наказывает за затяжные сражения ледяными проклятиями.',
    special: { type: 'snipe', every: 3, mult: 2, name: 'Осколок отражения', effect: 'stun' }
  },

  'riftstalker': {
    name: 'Охотник разлома', emoji: '🕷️',
    hp: 295, attack: 40, defense: 13, exp: 320, gold: 250,
    drops: ['void-dust', 'rune-void'],
    lore: 'Существо, собранное из воспоминаний тех, кто однажды шагнул за край мира.',
    tactics: 'Быстро сокращает дистанцию и высасывает жизненную силу.',
    special: { type: 'drain', every: 2, name: 'Касание пустоты', effect: 'bleed' }
  },
  // ---------- СЮЖЕТНЫЕ МИНИ-БОССЫ АКТОВ I–V ----------
  'root-court-executioner': {
    name: 'Палач корневого суда', emoji: '🌲',
    hp: 235, attack: 31, defense: 14, exp: 220, gold: 165,
    drops: ['root-court-seal', 'root-fiber', 'rune-root', 'strong-health-potion'], boss: true,
    lore: 'Судья древнего лесного закона, который решил, что память должна принадлежать только корням.',
    special: { type: 'double', every: 3, name: 'Приговор корней', effect: 'stun' },
    phases: [{ atHp: 0.45, atkMult: 1.35, msg: 'Палач пробуждает корневые кандалы!', specialEvery: 2 }]
  },

  'drowned-queen': {
    name: 'Утопленная плакальщица', emoji: '👑',
    hp: 325, attack: 40, defense: 16, exp: 340, gold: 275,
    drops: ['drowned-lament', 'grave-salt', 'rune-tide', 'strong-mana-potion'], boss: true,
    lore: 'Последняя хранительница затонувшего квартала, чьи песни удерживают мёртвых у своих имён.',
    special: { type: 'drain', every: 3, name: 'Плач глубин', effect: 'poison' },
    phases: [{ atHp: 0.45, atkMult: 1.4, msg: 'Плакальщица поднимает затонувшие воды!', specialEvery: 2 }]
  },

  'oath-forge-warden': {
    name: 'Страж расплавленной клятвы', emoji: '🔥',
    hp: 190, attack: 34, defense: 13, exp: 210, gold: 175,
    drops: ['oathforge-heart', 'ember-core', 'rune-ember', 'strong-health-potion'], boss: true,
    lore: 'Автомат кузницы, созданный проверить каждого, кто приблизится к сердцевине печати.',
    special: { type: 'snipe', every: 3, mult: 2, name: 'Клеймо кузницы', effect: 'burn' },
    phases: [{ atHp: 0.4, atkMult: 1.4, msg: 'Страж раскаляет древние руны!', specialEvery: 2 }]
  },

  'mirror-icekeeper': {
    name: 'Хранитель ледяного зеркала', emoji: '🪞',
    hp: 220, attack: 39, defense: 17, exp: 260, gold: 215,
    drops: ['mirror-shard', 'frost-essence', 'rune-frost', 'strong-mana-potion'], boss: true,
    lore: 'Страж последней клятвы, отражающий страхи тех, кто ищет проход к ледяному трону.',
    special: { type: 'snipe', every: 3, mult: 2.1, name: 'Зеркальный разлом', effect: 'stun' },
    phases: [{ atHp: 0.4, atkMult: 1.4, msg: 'Ледяное зеркало раскалывается на отражения!', specialEvery: 2 }]
  },

  'echo-devourer': {
    name: 'Пожиратель эха', emoji: '🕳️',
    hp: 355, attack: 47, defense: 16, exp: 390, gold: 315,
    drops: ['echo-core', 'void-dust', 'rune-void', 'crystal-amulet'], boss: true,
    lore: 'Существо, которое питается последними словами погибших у границы мира.',
    special: { type: 'drain', every: 2, name: 'Беззвучное поглощение', effect: 'burn' },
    phases: [
      { atHp: 0.55, atkMult: 1.3, msg: 'Пожиратель собирает забытые голоса!', specialEvery: 2 },
      { atHp: 0.25, atkMult: 1.5, msg: 'Эхо исчезает, оставляя лишь голод!', specialEvery: 1 }
    ]
  },

};