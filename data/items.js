export const ITEMS = {
  'mana-potion': {
    name: 'Зелье маны', icon: '🔵',
    desc: 'Восстанавливает 50 маны.',
    price: 8, type: 'consumable',
    use: p => { p.mp = Math.min(p.maxMp, p.mp + 50); }
  },

  'health-potion': {
    name: 'Зелье здоровья', icon: '🔴',
    desc: 'Восстанавливает 80 здоровья.',
    price: 10, type: 'consumable',
    use: p => { p.hp = Math.min(p.maxHp, p.hp + 80); }
  },

  'strong-health-potion': {
    name: 'Большое зелье здоровья', icon: '💗',
    desc: 'Восстанавливает 200 здоровья.',
    price: 22, type: 'consumable',
    use: p => { p.hp = Math.min(p.maxHp, p.hp + 200); }
  },

  'strong-mana-potion': {
    name: 'Большое зелье маны', icon: '💙',
    desc: 'Восстанавливает 120 маны.',
    price: 20, type: 'consumable',
    use: p => { p.mp = Math.min(p.maxMp, p.mp + 120); }
  },

  antidote: {
    name: 'Антидот', icon: '🧪',
    desc: 'Снимает отравление, ожог и кровотечение. Только в бою.',
    price: 12, type: 'consumable', combatOnly: true, effect: 'antidote',
    use: () => {}
  },

  'strength-elixir': {
    name: 'Эликсир силы', icon: '💪',
    desc: '+5 к атаке на 3 хода. Только в бою.',
    price: 22, type: 'consumable', combatOnly: true, effect: 'strength',
    use: () => {}
  },

  'mana-elixir': {
    name: 'Эликсир маны', icon: '💧',
    desc: 'Мана не тратится 2 хода. Только в бою.',
    price: 24, type: 'consumable', combatOnly: true, effect: 'manaShield',
    use: () => {}
  },

  'iron-sword': {
    name: 'Железный меч', icon: '🗡️',
    desc: '+8 к атаке.',
    price: 45, type: 'weapon',
    bonus: { attack: 8 }
  },

  'steel-sword': {
    name: 'Стальной меч', icon: '⚔️',
    desc: '+14 к атаке.',
    price: 95, type: 'weapon',
    bonus: { attack: 14 }
  },

  'apprentice-staff': {
    name: 'Посох ученика', icon: '🪄',
    desc: '+5 к магии.',
    price: 48, type: 'weapon',
    bonus: { magic: 5 }
  },

  'hunter-bow': {
    name: 'Лук следопыта', icon: '🏹',
    desc: '+9 к атаке, +2 к ловкости и +3% к критическому шансу.',
    price: 58, type: 'weapon',
    bonus: { attack: 9, dex: 2, critChance: 0.03, armorPen: 1 }
  },

  'leather-armor': {
    name: 'Кожаная броня', icon: '🥋',
    desc: '+5 к защите.',
    price: 40, type: 'chest',
    bonus: { defense: 5, dodgeChance: 0.02 }
  },

  'mithril-armor': {
    name: 'Мифриловая броня', icon: '🛡️',
    desc: '+12 к защите.',
    price: 105, type: 'chest',
    bonus: { defense: 12, blockChance: 0.04, blockPower: 0.05 }
  },

  'tower-shield': {
    name: 'Башенный щит', icon: '🛡️',
    desc: '+8 к защите, +12% к шансу блока и +15% к силе блока.',
    price: 85, type: 'shield',
    bonus: { defense: 8, blockChance: 0.12, blockPower: 0.15 }
  },

  'ranger-cloak': {
    name: 'Плащ следопыта', icon: '🧥',
    desc: '+4 к защите, +4 к ловкости и +6% к уклонению.',
    price: 75, type: 'cloak',
    bonus: { defense: 4, dex: 4, dodgeChance: 0.06 }
  },

  'ice-staff': {
    name: 'Ледяной посох', icon: '❄️',
    desc: '+10 к магии. Дыхание зимы.',
    price: 130, type: 'weapon',
    bonus: { magic: 10 }
  },

  'frost-armor': {
    name: 'Морозная броня', icon: '🧥',
    desc: '+14 к защите. Покрыта инеем.',
    price: 120, type: 'chest',
    bonus: { defense: 14, blockPower: 0.04 }
  },

  'desert-blade': {
    name: 'Клинок пустыни', icon: '🌵',
    desc: '+18 к атаке. Закалён в песках.',
    price: 160, type: 'weapon',
    bonus: { attack: 18, armorPen: 2 }
  },

  'crystal-amulet': {
    name: 'Амулет кристалла', icon: '🔮',
    desc: '+8 к магии и +5 к защите. Древняя реликвия.',
    price: 150, type: 'amulet',
    bonus: { magic: 8, defense: 5 }
  },

  'archmage-staff': {
    name: 'Посох архимага', icon: '🌟',
    desc: '+15 к магии. Шепчет забытые истины.',
    price: 190, type: 'weapon',
    bonus: { magic: 15, critChance: 0.04 }
  },

  'dragon-scale-armor': {
    name: 'Драконья броня', icon: '🐲',
    desc: '+20 к защите. Не боится пламени.',
    price: 220, type: 'chest',
    bonus: { defense: 20, blockPower: 0.08 }
  },

  'dragon-blade': {
    name: 'Драконий клинок', icon: '⚡',
    desc: '+25 к атаке. Легендарное оружие.',
    price: 260, type: 'weapon',
    bonus: { attack: 25, armorPen: 4 }
  },

  'scroll-lightning': {
    name: 'Свиток: Молния', icon: '📜',
    desc: 'Изучить заклинание «Молния» (45 урона).',
    price: 75, type: 'scroll', spellId: 'lightning',
    use: p => {
      if (!p.spells.includes('lightning')) p.spells.push('lightning');
    }
  },

  'scroll-poison-cloud': {
    name: 'Свиток: Ядовитый туман', icon: '📜',
    desc: 'Изучить заклинание «Ядовитый туман» (урон + яд).',
    price: 70, type: 'scroll', spellId: 'poison-cloud',
    use: p => {
      if (!p.spells.includes('poison-cloud')) p.spells.push('poison-cloud');
    }
  },

  'scroll-shield': {
    name: 'Свиток: Щит', icon: '📜',
    desc: 'Изучить заклинание «Щит» (+50% защиты на 2 хода).',
    price: 55, type: 'scroll', spellId: 'shield',
    use: p => {
      if (!p.spells.includes('shield')) p.spells.push('shield');
    }
  },

  'herb-life': {
    name: 'Корень жизни', icon: '🌿',
    desc: 'Трава для алхимии. Основа целебных зелий.',
    price: 2, type: 'material'
  },

  'herb-moon': {
    name: 'Лунная трава', icon: '🌙',
    desc: 'Серебристая трава, светится в темноте.',
    price: 3, type: 'material'
  },

  'old-archive-seal': {
    name: 'Печать старого архива', icon: '🔖',
    desc: 'Старая архивная метка из прежних времён. Не является осколком Кристалла Разлома.',
    type: 'quest', price: 0
  },

'greater-health-potion': {
    name: 'Эликсир возрождения', icon: '🧪',
    desc: 'Восстанавливает 360 здоровья.',
    price: 35, type: 'consumable',
    use: p => { p.hp = Math.min(p.maxHp, p.hp + 360); }
  },

  'greater-mana-potion': {
    name: 'Сгусток маны', icon: '🔷',
    desc: 'Восстанавливает 220 маны.',
    price: 30, type: 'consumable',
    use: p => { p.mp = Math.min(p.maxMp, p.mp + 220); }
  },

  'moonsteel-spear': {
    name: 'Лунно-стальное копьё', icon: '🔱',
    desc: '+21 к атаке. Лёгкое оружие дозорных ледяных перевалов.',
    price: 170, type: 'weapon', bonus: { attack: 21 }
  },
  'rune-sword': {
    name: 'Меч семи печатей', icon: '🗡️',
    desc: '+27 к атаке. Руны удерживают в клинке эхо древней клятвы.',
    price: 230, type: 'weapon', bonus: { attack: 27 }
  },
  'astral-staff': {
    name: 'Астральный посох', icon: '🌌',
    desc: '+25 к магии. Сердцевина собрана из осколков звёздного стекла.',
    price: 220, type: 'weapon', bonus: { magic: 25 }
  },
  'warden-plate': {
    name: 'Латы Стеклянного Щита', icon: '🛡️',
    desc: '+24 к защите. Тяжёлая броня древнего ордена.',
    price: 210, type: 'chest', bonus: { defense: 24 }
  },
  'void-robe': {
    name: 'Мантия тихой пустоты', icon: '🥋',
    desc: '+16 к защите и +7 к магии. Ткань не отражает свет.',
    price: 195, type: 'chest', bonus: { defense: 16, magic: 7 }
  },

  'scroll-frost-nova': {
    name: 'Свиток: Ледяная nova', icon: '📜',
    desc: 'Изучить заклинание «Ледяная nova».',
    price: 90, type: 'scroll', spellId: 'frost-nova',
    use: p => { if (!p.spells.includes('frost-nova')) p.spells.push('frost-nova'); }
  },
  'scroll-shadow-lance': {
    name: 'Свиток: Копьё тени', icon: '📜',
    desc: 'Изучить заклинание «Копьё тени».',
    price: 110, type: 'scroll', spellId: 'shadow-lance',
    use: p => { if (!p.spells.includes('shadow-lance')) p.spells.push('shadow-lance'); }
  },
  'scroll-arcane-surge': {
    name: 'Свиток: Арканный импульс', icon: '📜',
    desc: 'Изучить заклинание «Арканный импульс».',
    price: 100, type: 'scroll', spellId: 'arcane-surge',
    use: p => { if (!p.spells.includes('arcane-surge')) p.spells.push('arcane-surge'); }
  },
  'scroll-radiant-aegis': {
    name: 'Свиток: Эгида рассвета', icon: '📜',
    desc: 'Изучить заклинание «Эгида рассвета».',
    price: 85, type: 'scroll', spellId: 'radiant-aegis',
    use: p => { if (!p.spells.includes('radiant-aegis')) p.spells.push('radiant-aegis'); }
  },
  'scroll-renewal': {
    name: 'Свиток: Возобновление', icon: '📜',
    desc: 'Изучить заклинание «Возобновление».',
    price: 95, type: 'scroll', spellId: 'renewal',
    use: p => { if (!p.spells.includes('renewal')) p.spells.push('renewal'); }
  },

'rootbound-hood': {
    name: 'Капюшон живого корня', icon: '🌿',
    desc: '+4 к защите, +1 к ловкости и +2% к уклонению. В гнезде можно закрепить руну.',
    price: 48, type: 'head', sockets: 1,
    bonus: { defense: 4, dex: 1, dodgeChance: 0.02 }
  },
  'cinder-visor': {
    name: 'Визор пепельного дозора', icon: '🔥',
    desc: '+6 к защите и +2% к критическому шансу.',
    price: 70, type: 'head', sockets: 1,
    bonus: { defense: 6, critChance: 0.02 }
  },
  'duelist-grips': {
    name: 'Перчатки точного удара', icon: '🥊',
    desc: '+3 к атаке и +3% к критическому шансу.',
    price: 55, type: 'gloves', sockets: 1,
    bonus: { attack: 3, critChance: 0.03 }
  },
  'gravebinder-gloves': {
    name: 'Перчатки хранителя праха', icon: '🧤',
    desc: '+4 к магии и +2% к силе блока.',
    price: 58, type: 'gloves', sockets: 1,
    bonus: { magic: 4, blockPower: 0.02 }
  },
  'windstep-boots': {
    name: 'Сапоги быстрого следа', icon: '👢',
    desc: '+3 к защите, +3 к ловкости и +5% к уклонению.',
    price: 65, type: 'boots', sockets: 1,
    bonus: { defense: 3, dex: 3, dodgeChance: 0.05 }
  },
  'glacier-greaves': {
    name: 'Поножи ледяной стражи', icon: '🥾',
    desc: '+7 к защите и +3% к шансу блока.',
    price: 72, type: 'legs', sockets: 1,
    bonus: { defense: 7, blockChance: 0.03 }
  },
  'amulet-first-light': {
    name: 'Амулет первого света', icon: '☀️',
    desc: '+4 к магии и +2% к критическому шансу.',
    price: 80, type: 'amulet', sockets: 1,
    bonus: { magic: 4, critChance: 0.02 }
  },
  'pendant-last-oath': {
    name: 'Подвеска последней клятвы', icon: '🔶',
    desc: '+5 к защите и +4% к шансу блока.',
    price: 85, type: 'amulet', sockets: 1,
    bonus: { defense: 5, blockChance: 0.04 }
  },
  'ring-wolf-eye': {
    name: 'Кольцо волчьего глаза', icon: '💍',
    desc: '+2 к атаке и +4% к критическому шансу.',
    price: 60, type: 'ring', sockets: 1,
    bonus: { attack: 2, critChance: 0.04 }
  },
  'ring-quiet-tide': {
    name: 'Кольцо тихого прилива', icon: '🌊',
    desc: '+3 к магии и +2% к уклонению.',
    price: 65, type: 'ring', sockets: 1,
    bonus: { magic: 3, dodgeChance: 0.02 }
  },

  'rune-root': {
    name: 'Руна корня', icon: 'ᛉ',
    desc: 'Руна для свободного гнезда: +2 к защите и +1% к уклонению.',
    price: 20, type: 'rune', runeBonus: { defense: 2, dodgeChance: 0.01 }
  },
  'rune-ember': {
    name: 'Руна угля', icon: 'ᚱ',
    desc: 'Руна для свободного гнезда: +3 к атаке и +1% к критическому шансу.',
    price: 25, type: 'rune', runeBonus: { attack: 3, critChance: 0.01 }
  },
  'rune-tide': {
    name: 'Руна прилива', icon: 'ᛟ',
    desc: 'Руна для свободного гнезда: +3 к магии и +2% к силе блока.',
    price: 25, type: 'rune', runeBonus: { magic: 3, blockPower: 0.02 }
  },
  'rune-frost': {
    name: 'Руна инея', icon: 'ᚠ',
    desc: 'Руна для свободного гнезда: +3 к защите и +2% к шансу блока.',
    price: 28, type: 'rune', runeBonus: { defense: 3, blockChance: 0.02 }
  },
  'rune-void': {
    name: 'Руна безмолвия', icon: 'ᛞ',
    desc: 'Руна для свободного гнезда: +3 к магии, +1 к пробитию брони и +1% к криту.',
    price: 35, type: 'rune', runeBonus: { magic: 3, armorPen: 1, critChance: 0.01 }
  },

  'root-fiber': {
    name: 'Волокно живого корня', icon: '🌱',
    desc: 'Плотное волокно из Глухой чащи. Используется в ремесле.',
    price: 3, type: 'material'
  },
  'grave-salt': {
    name: 'Соль последней памяти', icon: '🧂',
    desc: 'Кристаллизованная соль из затонувшего архива.',
    price: 4, type: 'material'
  },
  'ember-core': {
    name: 'Сердечник магмы', icon: '🔸',
    desc: 'Остывшее ядро обсидианового голема.',
    price: 5, type: 'material'
  },
  'frost-essence': {
    name: 'Эссенция вечного инея', icon: '❄️',
    desc: 'Ледяная эссенция, не тающая даже в кузнице.',
    price: 6, type: 'material'
  },
  'void-dust': {
    name: 'Пыль разлома', icon: '🌀',
    desc: 'След Бездны, оставшийся после закрытия малой трещины.',
    price: 8, type: 'material'
  },
  'restorative-potion': {
    name: 'Восстанавливающее зелье', icon: '🧴',
    desc: 'Восстанавливает 140 здоровья и 60 маны.',
    price: 28, type: 'consumable',
    use: p => {
      p.hp = Math.min(p.maxHp, p.hp + 140);
      p.mp = Math.min(p.maxMp, p.mp + 60);
    }
  },

'briar-shoulders': {
    name: 'Наплечье живой чащи', icon: '🌳',
    desc: '+5 к защите и +2% к уклонению. Лёгкие пластины из корневого дерева.',
    price: 50, type: 'shoulders', sockets: 1,
    bonus: { defense: 5, dodgeChance: 0.02 }
  },
  'obsidian-mantle': {
    name: 'Мантия чёрного стекла', icon: '🧥',
    desc: '+7 к защите и +3 к магии. На ткани проступают знаки пяти орденов.',
    price: 95, type: 'cloak', sockets: 1,
    bonus: { defense: 7, magic: 3 }
  },
  'oath-bracers': {
    name: 'Наручи последней клятвы', icon: '🔗',
    desc: '+4 к защите, +2 к атаке и +2% к силе блока.',
    price: 75, type: 'gloves', sockets: 1,
    bonus: { defense: 4, attack: 2, blockPower: 0.02 }
  },
  'seal-five-orders': {
    name: 'Печать пяти орденов', icon: '🔰',
    desc: 'Реликвия пяти хранителей. +5 к магии, +4 к защите и +2% к критическому шансу.',
    price: 140, type: 'amulet', sockets: 1,
    bonus: { magic: 5, defense: 4, critChance: 0.02 }
  },
  'shard-flame': {
    name: 'Осколок Пламени', icon: '🔥',
    desc: 'Сюжетный осколок Пепельного Вестника. Нельзя продать или использовать в ремесле.',
    price: 0, type: 'quest', storyShard: true
  },
  'shard-ice': {
    name: 'Осколок Льда', icon: '❄️',
    desc: 'Сюжетный осколок Ледяной Хватки. Нельзя продать или использовать в ремесле.',
    price: 0, type: 'quest', storyShard: true
  },
  'shard-blood': {
    name: 'Осколок Крови', icon: '🩸',
    desc: 'Сюжетный осколок Кровавой Короны. Нельзя продать или использовать в ремесле.',
    price: 0, type: 'quest', storyShard: true
  },
  // ---------- УНИКАЛЬНЫЕ ТРОФЕИ СЮЖЕТНЫХ МИНИ-БОССОВ ----------
  'root-court-seal': { name: 'Печать корневого суда', icon: '🌿', desc: 'Трофей Палача корневого суда. Основа для реликвии живой чащи.', price: 24, type: 'material' },
  'drowned-lament': { name: 'Слеза утопленной плакальщицы', icon: '💧', desc: 'Трофей плакальщицы. Внутри слышна песнь затонувшего некрополя.', price: 38, type: 'material' },
  'oathforge-heart': { name: 'Сердце расплавленной клятвы', icon: '🔥', desc: 'Трофей стража кузницы. Ещё хранит жар древних рун.', price: 52, type: 'material' },
  'mirror-shard': { name: 'Осколок ледяного зеркала', icon: '🪞', desc: 'Трофей хранителя. Отражает не лицо, а боевые намерения.', price: 68, type: 'material' },
  'echo-core': { name: 'Ядро пожирателя эха', icon: '🔮', desc: 'Трофей Пожирателя эха. Удерживает силу исчезающих голосов.', price: 90, type: 'material' },

  // ---------- УНИКАЛЬНОЕ СНАРЯЖЕНИЕ ИЗ ТРОФЕЕВ ----------
  'briar-court-mantle': { name: 'Мантия корневого суда', icon: '🍃', desc: '+8 к защите и +3% к уклонению. Создана из печати древнего лесного закона.', price: 105, type: 'shoulders', sockets: 1, bonus: { defense: 8, dodgeChance: 0.03 } },
  'mourner-signet': { name: 'Перстень плакальщицы', icon: '💧', desc: '+6 к магии и +3 к защите. Хранит тихую песнь глубин.', price: 145, type: 'ring', sockets: 1, bonus: { magic: 6, defense: 3 } },
  'oathfire-cleaver': { name: 'Секатор расплавленной клятвы', icon: '🔥', desc: '+17 к атаке и +2 к пробиванию брони. Закалён сердцем древней кузницы.', price: 190, type: 'weapon', sockets: 1, bonus: { attack: 17, armorPen: 2 } },
  'mirrorweave-cloak': { name: 'Плащ зеркального инея', icon: '🪞', desc: '+13 к защите и +4 к ловкости. Ткань отражает ледяные проклятия.', price: 220, type: 'cloak', sockets: 1, bonus: { defense: 13, dex: 4 } },
  'echo-prism-amulet': { name: 'Амулет эха', icon: '🔮', desc: '+11 к магии, +7 к защите и +3% к критическому шансу. Сила безмолвной Бездны.', price: 280, type: 'amulet', sockets: 1, bonus: { magic: 11, defense: 7, critChance: 0.03 } },

};

// Six equipment tiers. Weights are relative rolls and sum to 100.
export const RARITIES = {
  common:    { name: 'Обычный',     tier: 1, color: '#9a9a9a', multiplier: 1,    weight: 60, statRange: [1, 5],     mods: 0, price: 10 },
  uncommon:  { name: 'Необычный',   tier: 2, color: '#55b96b', multiplier: 1.25, weight: 25, statRange: [6, 15],    mods: 1, price: 25 },
  rare:      { name: 'Редкий',      tier: 3, color: '#4a9eff', multiplier: 1.5,  weight: 10, statRange: [16, 30],   mods: 2, price: 60 },
  epic:      { name: 'Эпический',   tier: 4, color: '#b060ff', multiplier: 2.2,  weight: 4,  statRange: [31, 55],   mods: 3, price: 150 },
  legendary: { name: 'Легендарный', tier: 5, color: '#ffa500', multiplier: 3.5,  weight: 0.9,statRange: [56, 90],   mods: 4, price: 400 },
  mythic:    { name: 'Мифический',  tier: 6, color: '#e34d5b', multiplier: 4.5,  weight: 0.1,statRange: [91, 150],  mods: 5, price: 1000, bossOnly: true },
};

export const ITEM_AFFIXES = [
  { id: 'keen', name: 'Острокованный', types: ['weapon'], bonus: { attack: 2, armorPen: 1 } },
  { id: 'arcane', name: 'Чародейский', types: ['weapon'], bonus: { magic: 2, critChance: 0.01 } },
  { id: 'piercing', name: 'Пробивающий', types: ['weapon'], bonus: { armorPen: 2 } },
  { id: 'precise', name: 'Меткий', types: ['weapon', 'ring', 'amulet'], bonus: { critChance: 0.02, dex: 1 } },
  { id: 'balanced', name: 'Сбалансированный', types: ['weapon'], bonus: { attack: 1, dex: 2 } },
  { id: 'warded', name: 'Защищённый', types: ['head', 'shoulders', 'chest', 'cloak', 'gloves', 'legs', 'boots', 'shield', 'amulet'], bonus: { defense: 2, blockPower: 0.02 } },
  { id: 'swift', name: 'Стремительный', types: ['head', 'shoulders', 'chest', 'cloak', 'gloves', 'legs', 'boots', 'shield', 'ring', 'amulet'], bonus: { dex: 2, dodgeChance: 0.02 } },
  { id: 'fortified', name: 'Укреплённый', types: ['head', 'shoulders', 'chest', 'cloak', 'gloves', 'legs', 'boots', 'shield', 'amulet'], bonus: { defense: 3, blockChance: 0.01 } },
  { id: 'vigilant', name: 'Бдительный', types: ['head', 'shoulders', 'chest', 'cloak', 'gloves', 'legs', 'boots', 'shield', 'ring', 'amulet'], bonus: { critChance: 0.01, blockChance: 0.01 } },
  { id: 'resolute', name: 'Непоколебимый', types: ['head', 'shoulders', 'chest', 'cloak', 'gloves', 'legs', 'boots', 'shield', 'ring', 'amulet'], bonus: { defense: 1, blockPower: 0.04 } },
  { id: 'focused', name: 'Сосредоточенный', types: ['weapon', 'ring', 'amulet'], bonus: { magic: 1, critChance: 0.01 } }
];

export function rollItemAffixes(item, rarity, random = Math.random) {
  const count = RARITIES[rarity]?.mods || 0;
  if (!item || count === 0) return [];

  const pool = ITEM_AFFIXES.filter(affix => affix.types.includes(item.type));
  const selected = [];
  while (selected.length < count && selected.length < pool.length) {
    const sample = typeof random === 'function' ? random() : Math.random();
    const normalized = Number.isFinite(sample)
      ? Math.max(0, Math.min(1 - Number.EPSILON, sample))
      : Math.random();
    const index = Math.floor(normalized * pool.length);
    const candidate = pool[index];
    const affix = selected.some(entry => entry.id === candidate.id)
      ? pool.find(entry => !selected.some(chosen => chosen.id === entry.id))
      : candidate;
    if (affix) selected.push(affix);
  }

  const rarityScale = { common: 1, uncommon: 1, rare: 1.1, epic: 1.25, legendary: 1.5, mythic: 1.8 }[rarity] || 1;
  return selected.map(affix => ({
    id: affix.id,
    name: affix.name,
    bonus: Object.fromEntries(Object.entries(affix.bonus).map(([key, value]) => [
      key,
      typeof value === 'number' && ['dodgeChance', 'blockChance', 'blockPower', 'critChance'].includes(key)
        ? Number((value * rarityScale).toFixed(3))
        : Math.round(value * rarityScale)
    ]))
  }));
}

export function getRarityWeights(options = {}) {
  const entries = Object.entries(RARITIES).filter(([key, rarity]) =>
    key !== 'mythic' || options.allowMythic === true || rarity.bossOnly !== true
  );
  const player = options.player || null;
  const cleared = Array.isArray(player?.riftClearedLocations)
    ? new Set(player.riftClearedLocations).size
    : 0;
  const riftTierBonus = options.isRift
    ? Math.min(0.30, cleared * 0.10)
    : 0;
  return Object.fromEntries(entries.map(([key, rarity]) => [
    key,
    rarity.weight * (rarity.tier >= 4 ? 1 + riftTierBonus : 1)
  ]));
}

export function rollRarity(random = Math.random, options = {}) {
  const weights = Object.entries(getRarityWeights(options));
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const sample = typeof random === 'function' ? random() : Math.random();
  const normalized = Number.isFinite(sample)
    ? Math.max(0, Math.min(1 - Number.EPSILON, sample))
    : Math.random();
  let roll = normalized * total;

  for (const [key, weight] of weights) {
    roll -= weight;
    if (roll < 0) return key;
  }

  return 'common';
}
