const BRANCHES = {
  warrior: [
    {
      id: 'might',
      name: 'Мощь',
      icon: '⚔️',
      nodes: [
        ['Сильная рука', '+3 к силе', 'minor', '💪', { atkFlat: 3 }],
        ['Сокрушитель', '+5 к атаке', 'minor', '🔨', { atkFlat: 5 }],
        ['Пробой брони', '+3 к пробитию брони', 'notable', '⛏️', { armorPen: 3 }],
        ['Берсерк', '+22% урона, но −10% защиты', 'keystone', '💢', { dmgMult: 1.22, defMult: 0.9 }],
        ['Вихрь клинков', '+8% урона', 'minor', '🌀', { dmgMult: 1.08 }],
        ['Разрушитель бастионов', '+4 пробития брони и +10% урона', 'notable', '⛏️', { armorPen: 4, dmgMult: 1.1 }]
      ]
    },
    {
      id: 'bulwark',
      name: 'Оплот',
      icon: '🛡️',
      nodes: [
        ['Крепкая стойка', '+2 к защите', 'minor', '🪨', { defFlat: 2 }],
        ['Стальная кожа', '+4 к защите', 'minor', '⛓️', { defFlat: 4 }],
        ['Щитоносец', '+10% к шансу блока', 'notable', '🛡️', { blockChance: 0.1 }],
        ['Несокрушимый', '+25% к силе блока, −5% уклонения', 'keystone', '🏰', { blockPower: 0.25, dodgeChance: -0.05 }],
        ['Неподвижная стена', '+10% защиты', 'minor', '🧱', { defMult: 1.1 }],
        ['Крепость последнего рубежа', '+15% силы блока и +5% шанса блока', 'notable', '🏯', { blockPower: 0.15, blockChance: 0.05 }]
      ]
    },
    {
      id: 'fury',
      name: 'Ярость',
      icon: '🔥',
      nodes: [
        ['Горячая кровь', '+3% критического шанса', 'minor', '🔥', { critChance: 0.03 }],
        ['Натиск', '+5% урона', 'minor', '⚡', { dmgMult: 1.05 }],
        ['Жестокость', '+0.25 к множителю критического удара', 'notable', '🩸', { critMult: 1.75 }],
        ['Кровавая баня', '+35% критического урона, −8% защиты', 'keystone', '☠️', { critMult: 2.1, defMult: 0.92 }],
        ['Жажда крови', '+4% критического шанса', 'minor', '🩸', { critChance: 0.04 }],
        ['Неистовый натиск', '+10% урона и +3% критического шанса', 'notable', '🔥', { dmgMult: 1.1, critChance: 0.03 }]
      ]
    },
    {
      id: 'endurance',
      name: 'Выносливость',
      icon: '❤️',
      nodes: [
        ['Закалка', '+2 к защите и +1 HP восстановления за ход', 'minor', '❤️', { defFlat: 2, hpRegen: 1 }],
        ['Второе дыхание', '+2 HP восстановления за ход', 'minor', '🌿', { hpRegen: 2 }],
        ['Железный дух', '+12% защиты', 'notable', '🗿', { defMult: 1.12 }],
        ['Последний рубеж', '+5 HP восстановления за ход, −10% урона', 'keystone', '🧱', { hpRegen: 5, dmgMult: 0.9 }],
        ['Живучесть', '+3 к защите и +2 HP восстановления за ход', 'minor', '🌿', { defFlat: 3, hpRegen: 2 }],
        ['Несгибаемая воля', '+8% защиты и +3 HP восстановления за ход', 'notable', '❤️', { defMult: 1.08, hpRegen: 3 }]
      ]
    },
    {
      id: 'tactics',
      name: 'Тактика',
      icon: '🎖️',
      nodes: [
        ['Выверенный удар', '+2 к атаке', 'minor', '🎯', { atkFlat: 2 }],
        ['Опытный боец', '+2% к критическому шансу', 'minor', '⚔️', { critChance: 0.02 }],
        ['Контратака', '+5% к шансу блока', 'notable', '↩️', { blockChance: 0.05, dmgMult: 1.04 }],
        ['Мастер войны', '+10% урона и +10% блока, −5% уклонения', 'keystone', '👑', { dmgMult: 1.1, blockChance: 0.1, dodgeChance: -0.05 }],
        ['Тактический расчёт', '+2 пробития брони и +5% блока', 'minor', '🎖️', { armorPen: 2, blockChance: 0.05 }],
        ['Полководец', '+8% урона и +8% силы блока', 'notable', '🏅', { dmgMult: 1.08, blockPower: 0.08 }]
      ]
    }
  ],

  mage: [
    {
      id: 'fire',
      name: 'Пламя',
      icon: '🔥',
      nodes: [
        ['Искра', '+6% урона заклинаний', 'minor', '✨', { spellMult: 1.06 }],
        ['Жар крови', '+4 к магии', 'minor', '🔥', { magFlat: 4 }],
        ['Поджигатель', '+12% урона заклинаний', 'notable', '☄️', { spellMult: 1.12 }],
        ['Повелитель пламени', '+25% магического урона, −10% защиты', 'keystone', '🌋', { spellMult: 1.25, defMult: 0.9 }],
        ['Раскалённое ядро', '+3 к магии и +6% урона заклинаний', 'minor', '☀️', { magFlat: 3, spellMult: 1.06 }],
        ['Сердце вулкана', '+12% урона заклинаний', 'notable', '🌋', { spellMult: 1.12 }]
      ]
    },
    {
      id: 'frost',
      name: 'Лёд',
      icon: '❄️',
      nodes: [
        ['Холодный разум', '+2 к магии и +1 MP восстановления за ход', 'minor', '❄️', { magFlat: 2, manaRegen: 1 }],
        ['Ледяная броня', '+6% защиты', 'minor', '🧊', { defMult: 1.06 }],
        ['Стылый барьер', '+10% к силе блока', 'notable', '🛡️', { blockPower: 0.1 }],
        ['Вечная зима', '+18% защиты и +10% силы блока, −8% урона заклинаний', 'keystone', '🌨️', { defMult: 1.18, blockPower: 0.1, spellMult: 0.92 }],
        ['Ледяной покров', '+8% защиты', 'minor', '🧊', { defMult: 1.08 }],
        ['Абсолютный ноль', '+4% уклонения и +5% силы блока', 'notable', '❄️', { dodgeChance: 0.04, blockPower: 0.05 }]
      ]
    },
    {
      id: 'arcane',
      name: 'Аркана',
      icon: '🔮',
      nodes: [
        ['Поток маны', '+2 восстановления маны за ход', 'minor', '💧', { manaRegen: 2 }],
        ['Чистый эфир', '+5 к магии', 'minor', '✨', { magFlat: 5 }],
        ['Эрудит', '+10% урона заклинаний и +2 маны за ход', 'notable', '📘', { spellMult: 1.1, manaRegen: 2 }],
        ['Архимаг', '+25% урона заклинаний и +4 маны за ход, −10% защиты', 'keystone', '🧙', { spellMult: 1.25, manaRegen: 4, defMult: 0.9 }],
        ['Эфирный резерв', '+3 восстановления маны за ход', 'minor', '💧', { manaRegen: 3 }],
        ['Безграничный поток', '+10% урона заклинаний и +2 маны за ход', 'notable', '🔮', { spellMult: 1.1, manaRegen: 2 }]
      ]
    },
    {
      id: 'ward',
      name: 'Защита',
      icon: '🛡️',
      nodes: [
        ['Эфирная кожа', '+3 к защите', 'minor', '🪄', { defFlat: 3 }],
        ['Отражение', '+4% уклонения', 'minor', '💨', { dodgeChance: 0.04 }],
        ['Магический щит', '+12% защиты', 'notable', '🔷', { defMult: 1.12 }],
        ['Живая крепость', '+20% защиты, −8% магического урона', 'keystone', '🏛️', { defMult: 1.2, spellMult: 0.92 }],
        ['Защитный контур', '+4 к защите и +3% уклонения', 'minor', '🔷', { defFlat: 4, dodgeChance: 0.03 }],
        ['Непроницаемый эфир', '+10% защиты и +4% блока', 'notable', '🛡️', { defMult: 1.1, blockChance: 0.04 }]
      ]
    },
    {
      id: 'void',
      name: 'Пустота',
      icon: '🌌',
      nodes: [
        ['Тёмная искра', '+3% критического шанса', 'minor', '🌑', { critChance: 0.03 }],
        ['Разрыв ткани', '+2 к пробитию брони', 'minor', '🌀', { armorPen: 2 }],
        ['Искажение', '+0.2 к множителю критического удара', 'notable', '🪐', { critMult: 1.7 }],
        ['Пустотный договор', '+20% магического урона и +6 пробития брони, −10% защиты', 'keystone', '🕳️', { spellMult: 1.2, armorPen: 6, defMult: 0.9 }],
        ['Трещина реальности', '+3 пробития брони и +3% критического шанса', 'minor', '🌀', { armorPen: 3, critChance: 0.03 }],
        ['Пожиратель миров', '+10% урона заклинаний и +0.1 к крит. множителю', 'notable', '🌌', { spellMult: 1.1, critMult: 1.8 }]
      ]
    }
  ],

  archer: [
    {
      id: 'precision',
      name: 'Меткость',
      icon: '🎯',
      nodes: [
        ['Твёрдая рука', '+3% критического шанса', 'minor', '🏹', { critChance: 0.03 }],
        ['Глаз ястреба', '+4 к атаке', 'minor', '🦅', { atkFlat: 4 }],
        ['Слабое место', '+3 к пробитию брони', 'notable', '◎', { armorPen: 3 }],
        ['Смертельный прицел', '+25% урона и +0.3 к крит. множителю, −8% защиты', 'keystone', '🎯', { dmgMult: 1.25, critMult: 1.8, defMult: 0.92 }],
        ['Прицельный выстрел', '+3 пробития брони', 'minor', '◎', { armorPen: 3 }],
        ['Снайпер', '+8% урона и +4% критического шанса', 'notable', '🏹', { dmgMult: 1.08, critChance: 0.04 }]
      ]
    },
    {
      id: 'evasion',
      name: 'Уклонение',
      icon: '💨',
      nodes: [
        ['Лёгкий шаг', '+5% уклонения', 'minor', '👣', { dodgeChance: 0.05 }],
        ['Рефлексы', '+4% уклонения', 'minor', '⚡', { dodgeChance: 0.04 }],
        ['Танец клинков', '+6% уклонения и +3% блока', 'notable', '💫', { dodgeChance: 0.06, blockChance: 0.03 }],
        ['Призрачный охотник', '+12% уклонения, −10% защиты', 'keystone', '👻', { dodgeChance: 0.12, defMult: 0.9 }],
        ['Лёгкая поступь', '+4% уклонения', 'minor', '👣', { dodgeChance: 0.04 }],
        ['Неуловимый', '+5% уклонения и +3% блока', 'notable', '💨', { dodgeChance: 0.05, blockChance: 0.03 }]
      ]
    },
    {
      id: 'poison',
      name: 'Яд',
      icon: '☠️',
      nodes: [
        ['Змеиная кровь', '+2 к атаке', 'minor', '🐍', { atkFlat: 2 }],
        ['Токсин', '+6% урона', 'minor', '☣️', { dmgMult: 1.06 }],
        ['Глубокая рана', '+10% урона и +5% критического шанса', 'notable', '🩸', { dmgMult: 1.1, critChance: 0.05 }],
        ['Повелитель яда', '+20% урона, −5% уклонения', 'keystone', '🦂', { dmgMult: 1.2, dodgeChance: -0.05 }],
        ['Смертельный токсин', '+8% урона', 'minor', '☣️', { dmgMult: 1.08 }],
        ['Веномансер', '+4% критического шанса и +2 пробития брони', 'notable', '🐍', { critChance: 0.04, armorPen: 2 }]
      ]
    },
    {
      id: 'traps',
      name: 'Ловушки',
      icon: '🪤',
      nodes: [
        ['Подготовка', '+2 к ловкости', 'minor', '🪶', { dexFlat: 2 }],
        ['Быстрые руки', 'Перезарядка способностей −1', 'minor', '⏱️', { abilityCdDelta: -1 }],
        ['Капкан', '+8% к шансу блока', 'notable', '🪤', { blockChance: 0.08 }],
        ['Поле охотника', '+12% блока и +8% уклонения, −8% урона', 'keystone', '🌿', { blockChance: 0.12, dodgeChance: 0.08, dmgMult: 0.92 }],
        ['Мастер ловушек', 'Перезарядка способностей −1', 'minor', '🪤', { abilityCdDelta: -1 }],
        ['Территория охоты', '+5% блока и +4% уклонения', 'notable', '🌲', { blockChance: 0.05, dodgeChance: 0.04 }]
      ]
    },
    {
      id: 'hunter',
      name: 'Охотник',
      icon: '🦌',
      nodes: [
        ['Следопыт', '+2 к ловкости и +1 к атаке', 'minor', '🌲', { dexFlat: 2, atkFlat: 1 }],
        ['Хладнокровие', '+0.2 к множителю критического удара', 'minor', '🧊', { critMult: 1.7 }],
        ['Один точный выстрел', '+8% урона и +3% критического шанса', 'notable', '🏹', { dmgMult: 1.08, critChance: 0.03 }],
        ['Идеальный хищник', '+18% крит. шанса и +10% уклонения, −12% защиты', 'keystone', '🐺', { critChance: 0.18, dodgeChance: 0.1, defMult: 0.88 }],
        ['Холодная точность', '+4% критического шанса', 'minor', '🧊', { critChance: 0.04 }],
        ['Вершина пищевой цепи', '+10% урона и +0.1 к крит. множителю', 'notable', '🦌', { dmgMult: 1.1, critMult: 1.8 }]
      ]
    }
  ]
};

function createTree(classId, branches) {
  const nodes = {
    start: {
      id: 'start',
      x: 50,
      y: 50,
      name: 'Начало пути',
      desc: 'Центр вашего мастерства',
      type: 'start',
      icon: '✦',
      conn: [],
      effects: {}
    }
  };

  const angles = [-90, -18, 54, 126, 198];

  branches.forEach((branch, branchIndex) => {
    let previous = 'start';
    const angle = angles[branchIndex] * Math.PI / 180;

    branch.nodes.forEach((entry, index) => {
      const [name, desc, type, icon, effects] = entry;

      const radius = 17 + index * 11;
      const id = `${classId}-${branch.id}-${index + 1}`;

      nodes[id] = {
        id,
        x: Math.max(
          5,
          Math.min(95, 50 + Math.cos(angle) * radius)
        ),
        y: Math.max(
          5,
          Math.min(95, 50 + Math.sin(angle) * radius)
        ),
        name,
        desc,
        type,
        icon,
        conn: [previous],
        branch: branch.name,
        levelReq: [2, 5, 10, 15, 25, 35][index] || 35,
        effects
      };

      previous = id;
    });
  });

  // Поперечные связи между ветками создают несколько путей развития.
  // Средние и поздние узлы соединены отдельно: игрок может менять специализацию,
  // не возвращаясь к стартовому узлу и не теряя вложенные очки.
  branches.forEach((branch, index) => {
    const next = branches[(index + 1) % branches.length];

    for (const tierIndex of [3, 5]) {
      const fromId = `${classId}-${branch.id}-${tierIndex}`;
      const toId = `${classId}-${next.id}-${tierIndex}`;

      if (nodes[fromId] && nodes[toId] && !nodes[fromId].conn.includes(toId)) {
        nodes[fromId].conn.push(toId);
      }
    }
  });

  return { classId, nodes };
}

const TREE_CACHE = new Map();

export function getPassiveTree(classId) {
  const key = BRANCHES[classId] ? classId : 'warrior';

  if (!TREE_CACHE.has(key)) {
    TREE_CACHE.set(key, createTree(key, BRANCHES[key]));
  }

  return TREE_CACHE.get(key);
}
