export const NPCS = {
  blacksmith: {
    id: 'blacksmith', name: 'Кузнец Борин', emoji: '⚒️',
    greetings: ['Клинок тупой? Принеси, наточу.', 'Быстро и недёшево.', 'Эх, раньше сталь была лучше...'],
    maxLevel: 3,
    upgrades: [{ cost: 30, forgeBonus: 2, statPercent: 0.05 }, { cost: 75, forgeBonus: 4, statPercent: 0.05 }, { cost: 140, forgeBonus: 7, statPercent: 0.05 }],
    recipes: [

      // Relics forged from guaranteed mini-boss trophies (one per act).
      { id: 'r-briar-court-mantle', result: 'briar-court-mantle', qty: 1, rarity: 'uncommon', requiredAct: 1, craftTier: 2, ingredients: [{ id: 'root-court-seal', qty: 1 }, { id: 'root-fiber', qty: 2 }] },
      { id: 'r-mourner-signet', result: 'mourner-signet', qty: 1, rarity: 'rare', requiredAct: 2, craftTier: 3, ingredients: [{ id: 'drowned-lament', qty: 1 }, { id: 'grave-salt', qty: 2 }] },
      { id: 'r-oathfire-cleaver', result: 'oathfire-cleaver', qty: 1, rarity: 'rare', requiredAct: 3, craftTier: 3, ingredients: [{ id: 'oathforge-heart', qty: 1 }, { id: 'ember-core', qty: 2 }] },
      { id: 'r-mirrorweave-cloak', result: 'mirrorweave-cloak', qty: 1, rarity: 'epic', requiredAct: 4, craftTier: 4, ingredients: [{ id: 'mirror-shard', qty: 1 }, { id: 'frost-essence', qty: 2 }] },
      { id: 'r-echo-prism-amulet', result: 'echo-prism-amulet', qty: 1, rarity: 'epic', requiredAct: 5, craftTier: 4, ingredients: [{ id: 'echo-core', qty: 1 }, { id: 'void-dust', qty: 3 }] },
      { id: 'r5-dragon-blade', result: 'dragon-blade', qty: 1, rarity: 'legendary', craftTier: 5, station: 'final-forge', ingredients: [{ id: 'ember-core', qty: 3 }, { id: 'void-dust', qty: 2 }, { id: 'grave-salt', qty: 1 }] },
      { id: 'r5-dragon-plate', result: 'dragon-scale-armor', qty: 1, rarity: 'legendary', craftTier: 5, station: 'final-forge', ingredients: [{ id: 'ember-core', qty: 2 }, { id: 'frost-essence', qty: 2 }, { id: 'root-fiber', qty: 2 }] },
      { id: 'r5-astral-staff', result: 'astral-staff', qty: 1, rarity: 'legendary', craftTier: 5, station: 'final-forge', ingredients: [{ id: 'void-dust', qty: 3 }, { id: 'frost-essence', qty: 2 }, { id: 'ember-core', qty: 1 }] }
    ]
  },
  healer: {
    id: 'healer', name: 'Лекарь Мирра', emoji: '💚',
    greetings: ['Раны глубоки, но свет сильнее.', 'Полное исцеление — 8 золота.', 'Не умирай, странник.'],
    cost: 8
  },
  alchemist: {
    id: 'alchemist', name: 'Алхимик Сайрус', emoji: '⚗️',
    greetings: ['Травы собираешь? Неси, сварю.', 'Осторожно, не взболтай!', 'Лунная трава светится в темноте...'],
    recipes: [
      { id: 'r-hp',  result: 'health-potion', qty: 1, ingredients: [{ id: 'herb-life', qty: 3 }] },
      { id: 'r-mp',  result: 'mana-potion', qty: 1, ingredients: [{ id: 'herb-moon', qty: 3 }] },
      { id: 'r-shp', result: 'strong-health-potion', qty: 1, ingredients: [{ id: 'herb-life', qty: 5 }] },
      { id: 'r-smp', result: 'strong-mana-potion', qty: 1, ingredients: [{ id: 'herb-moon', qty: 5 }] },
      { id: 'r-rune-root', result: 'rune-root', qty: 1, ingredients: [{ id: 'root-fiber', qty: 3 }, { id: 'herb-life', qty: 1 }] },
      { id: 'r-rune-ember', result: 'rune-ember', qty: 1, ingredients: [{ id: 'ember-core', qty: 2 }, { id: 'grave-salt', qty: 1 }] },
      { id: 'r-rune-tide', result: 'rune-tide', qty: 1, ingredients: [{ id: 'frost-essence', qty: 2 }, { id: 'herb-moon', qty: 1 }] },
      { id: 'r-rune-frost', result: 'rune-frost', qty: 1, ingredients: [{ id: 'frost-essence', qty: 3 }] },
      { id: 'r-rune-void', result: 'rune-void', qty: 1, ingredients: [{ id: 'void-dust', qty: 3 }, { id: 'ember-core', qty: 1 }] }
    ]
  },
  merchant: {
    id: 'merchant', name: 'Странствующий торговец', emoji: '🛒',
    greetings: ['Товар редкий, цена честная!', 'Смотри, не проходи мимо!', 'Золотишко водится?'],
    rareStock: ['moonsteel-spear', 'rune-sword', 'astral-staff', 'warden-plate', 'void-robe', 'scroll-frost-nova', 'scroll-shadow-lance', 'scroll-arcane-surge'],
    stock: [
      "health-potion", "mana-potion", "strong-health-potion", "strong-mana-potion", "antidote",
      "strength-elixir", "mana-elixir", "scroll-lightning", "scroll-shield", "restorative-potion",
      "iron-sword", "apprentice-staff", "leather-armor",
      "rootbound-hood", "cinder-visor", "briar-shoulders", "duelist-grips", "gravebinder-gloves", "oath-bracers",
      "windstep-boots", "glacier-greaves", "tower-shield", "ranger-cloak", "obsidian-mantle", "amulet-first-light", "pendant-last-oath",
      "ring-wolf-eye", "ring-quiet-tide",
      "rune-root", "rune-ember", "rune-tide", "rune-frost", "rune-void"
    ]
  },
  elder: {
    id: 'elder', name: 'Старейшина Эдвин', emoji: '👴',
    greetings: ['Осколки ждут тебя, странник.', 'Прими моё благословение.', 'Тьма отступит перед светом.'],
    buffId: 'elderBlessing'
  },
  well: {
    id: 'well', name: 'Древний колодец', emoji: '⛲',
    greetings: ['Вода чиста и прохладна.', 'Она восстановит твои силы.']
  },
  bard: {
    id: 'bard', name: 'Бард Лютик', emoji: '🎵',
    greetings: ['Спою тебе о героях!', 'Скидка для смельчаков!', 'Монетку — и песня твоя!'],
    cost: 15
  },
  guard: {
    id: 'guard', name: 'Стражник', emoji: '🛡️',
    greetings: ['В лесу гоблины, будь осторожен.', 'В руинах нежить.', 'Пещера теней — гиблое место.'],
  },
  cat: {
    id: 'cat', name: 'Кошка', emoji: '🐈',
    greetings: ['Мяу.', 'Муррр.', '...']
  },
  kids: {
    id: 'kids', name: 'Дети', emoji: '👦',
    greetings: ['Смотрите, герой!', 'А ты правда убил дракона?', 'Дай монетку!']
  },
  herald: {
    id: 'herald', name: 'Глашатай', emoji: '📢',
    greetings: ['Внемлите новостям!', 'Элитный гоблин в лесу!', 'Слухи о сокровищах в Разломе...']
  },
  questBoard: {
    id: 'questBoard', name: 'Доска объявлений', emoji: '📋',
    greetings: ['Здесь висят задания.']
  }
};

export const FORGE_BONUS = [0, 2, 4, 7];