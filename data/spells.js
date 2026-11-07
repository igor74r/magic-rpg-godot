export const SPELLS = {
  "fireball":     { name: "Огненный шар",   icon: "🔥", cost: 15, desc: "25 урона огнём и ожог на 2 хода.", damage: 25, element: "fire", effect: "burn" },
  "ice-bolt":     { name: "Ледяная стрела", icon: "❄️", cost: 12, desc: "25 урона льдом и замедление на 2 хода.", damage: 25, element: "ice", effect: "slow" },
  "heal":         { name: "Исцеление",      icon: "💚", cost: 20, desc: "Восстанавливает 60 здоровья.", heal: 60 },
  "holy-light":   { name: "Святой свет",    icon: "☀️", cost: 18, desc: "Наносит 25 урона светом.", damage: 25 },
  "lightning":    { name: "Молния",         icon: "⚡", cost: 25, desc: "45 урона молнией; +20% против замедленных целей.", damage: 45, element: "lightning" },
  "poison-cloud": { name: "Ядовитый туман", icon: "☠️", cost: 20, desc: "15 урона + отравление.", damage: 15, effect: "poison" },
  "poison-arrow": { name: "Ядовитая стрела", icon: "🏹", cost: 10, desc: "Наносит урон и травит.", damage: 15, effect: "poison" },
  "shield":       { name: "Щит",            icon: "🛡️", cost: 15, desc: "+50% защиты на 2 хода.", selfEffect: "defBuff" },
  "sacrifice":    { name: "Жертва",         icon: "🩸", cost: 0, desc: "Тратит 20% HP, но восстанавливает 50 MP.", selfDamagePct: 0.2, restoreMp: 50 },
  "arcane-surge": { name: "Арканный импульс", icon: "✨", cost: 30, desc: "Наносит 55 чистого магического урона.", damage: 55 },
  "frost-nova":   { name: "Ледяная nova", icon: "❄️", cost: 26, desc: "34 урона льдом, оглушение и замедление.", damage: 34, element: "ice", effect: "stun" },
  "radiant-aegis": { name: "Эгида рассвета", icon: "🌟", cost: 24, desc: "Укрепляет защиту на 2 хода.", selfEffect: "defBuff" },
  "shadow-lance": { name: "Копьё тени", icon: "🗡️", cost: 36, desc: "Наносит 68 урона и вызывает кровотечение.", damage: 68, effect: "bleed" },
  "renewal":      { name: "Возобновление", icon: "🌿", cost: 32, desc: "Восстанавливает 95 здоровья.", heal: 95 }
};