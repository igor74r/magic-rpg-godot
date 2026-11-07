export const CLASSES = {
  warrior: {
    name: 'Воин',
    emoji: '⚔️',
    role: 'Тяжёлый боец · броня · блок · ярость',
    desc: 'Закованный в броню фронтовик. Принимает удар на щит, ломает защиту врагов и превращает полученный урон в ярость.',
    resourceName: 'Ярость',

    baseStats: {
      maxHp: 170,
      maxMp: 100,
      str: 18,
      int: 4,
      wis: 7,
      con: 16,
      dex: 6
    },

    combat: {
      dodgeChance: 0.04,
      blockChance: 0.16,
      blockPower: 0.66,
      critChance: 0.08,
      armorPen: 2
    },

    startingSpells: [],

    startingItems: [
      'iron-sword',
      'tower-shield',
      'health-potion'
    ],

    abilities: [
      {
        id: 'charge',
        name: 'Сокрушительный рывок',
        icon: '⚡',
        cooldown: 2,
        cost: 20,
        desc: 'Следующая атака наносит двойной урон.'
      },
      {
        id: 'war-cry',
        name: 'Боевой клич',
        icon: '📢',
        cooldown: 4,
        cost: 20,
        desc: '+30% к атаке на 2 хода.'
      },
      {
        id: 'bloodthirst',
        name: 'Кровожадность',
        icon: '🩸',
        cooldown: 5,
        cost: 30,
        desc: 'Возвращает 50% нанесённого урона в здоровье на 2 хода.'
      },
      {
        id: 'shield-bash',
        name: 'Щитовой удар',
        icon: '🛡️',
        cooldown: 3,
        cost: 25,
        desc: 'Удар щитом: наносит урон и оглушает врага на 1 ход.'
      }
    ]
  },

  mage: {
    name: 'Маг',
    emoji: '🧙',
    role: 'Стихии · контроль · магический щит',
    desc: 'Хрупкий повелитель стихий. Сдерживает противников льдом, разрушает их огнём и поглощает часть ударов магическим барьером.',
    resourceName: 'Мана',

    baseStats: {
      maxHp: 105,
      maxMp: 180,
      str: 4,
      int: 20,
      wis: 14,
      con: 7,
      dex: 8
    },

    combat: {
      dodgeChance: 0.10,
      blockChance: 0.03,
      blockPower: 0.40,
      critChance: 0.12,
      armorPen: 1
    },

    startingSpells: ['fireball', 'ice-bolt'],

    startingItems: [
      'apprentice-staff',
      'mana-potion',
      'health-potion'
    ],

    abilities: [
      {
        id: 'mana-shield',
        name: 'Барьер маны',
        icon: '🛡️',
        cooldown: 3,
        cost: 20,
        desc: '+50% защиты на 2 хода.'
      },
      {
        id: 'teleport',
        name: 'Скачок сквозь эфир',
        icon: '💨',
        cooldown: 4,
        cost: 25,
        desc: 'Позволяет избежать следующего действия противника.'
      },
      {
        id: 'meteor',
        name: 'Метеор',
        icon: '☄️',
        cooldown: 5,
        cost: 45,
        desc: 'Мощный огненный удар и ожог.'
      },
      {
        id: 'frost-nova',
        name: 'Ледяная нова',
        icon: '❄️',
        cooldown: 4,
        cost: 32,
        desc: 'Ледяной взрыв: урон и оглушение врага на 1 ход.'
      }
    ]
  },

  archer: {
    name: 'Лучник',
    emoji: '🏹',
    role: 'Ловкость · критические удары · яд',
    desc: 'Мобильный охотник. Наращивает концентрацию выстрелами, избегает ударов и пробивает слабые места противников.',
    resourceName: 'Концентрация',

    baseStats: {
      maxHp: 125,
      maxMp: 100,
      str: 12,
      int: 7,
      wis: 9,
      con: 10,
      dex: 18
    },

    combat: {
      dodgeChance: 0.20,
      blockChance: 0.06,
      blockPower: 0.42,
      critChance: 0.18,
      armorPen: 3
    },

    startingSpells: ['poison-arrow'],

    startingItems: [
      'hunter-bow',
      'leather-armor',
      'health-potion'
    ],

    abilities: [
      {
        id: 'aimed-shot',
        name: 'Меткий выстрел',
        icon: '🎯',
        cooldown: 2,
        cost: 20,
        desc: 'Сильная атака с гарантированным критическим ударом.'
      },
      {
        id: 'evasion',
        name: 'Уклонение',
        icon: '💨',
        cooldown: 3,
        cost: 15,
        desc: 'Полностью избежать следующей атаки.'
      },
      {
        id: 'toxic-blade',
        name: 'Ядовитый наконечник',
        icon: '☠️',
        cooldown: 3,
        cost: 20,
        desc: 'Наносит урон и отравляет цель.'
      },
      {
        id: 'piercing-shot',
        name: 'Пробивающий выстрел',
        icon: '🏹',
        cooldown: 3,
        cost: 28,
        desc: 'Точный выстрел с повышенным пробитием брони.'
      }
    ]
  },

  // Скрытый совместимый класс для старых сохранений версии 0.14.
  // Он не показывается при создании нового персонажа.
  priest: {
    name: 'Жрец',
    emoji: '✨',
    role: 'Наследие старых сохранений',
    desc: 'Класс из прежней версии игры. Сохранён для совместимости старых персонажей.',
    resourceName: 'Мана',

    baseStats: {
      maxHp: 115,
      maxMp: 160,
      str: 6,
      int: 15,
      wis: 18,
      con: 10,
      dex: 7
    },

    combat: {
      dodgeChance: 0.08,
      blockChance: 0.05,
      blockPower: 0.45,
      critChance: 0.08,
      armorPen: 0
    },

    startingSpells: ['heal', 'holy-light'],
    startingItems: [],

    abilities: [
      {
        id: 'prayer',
        name: 'Молитва',
        icon: '🙏',
        cooldown: 3,
        cost: 25,
        desc: 'Восстанавливает здоровье и снимает отрицательные эффекты.'
      },
      {
        id: 'sanctify',
        name: 'Освящение',
        icon: '☀️',
        cooldown: 3,
        cost: 20,
        desc: 'Наносит урон светом и накладывает ожог.'
      },
      {
        id: 'resurrection',
        name: 'Воскрешение',
        icon: '✨',
        cooldown: 0,
        cost: 0,
        passive: true,
        desc: 'Один раз за бой возвращает героя к жизни.'
      }
    ]
  }
};