function safeCount(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
function statCount(g, key) {
  return safeCount(g?.player?.stats?.[key]);
}
function totalKills(g) {
  const kills = g?.player?.stats?.kills;
  if (!kills || typeof kills !== 'object' || Array.isArray(kills)) return 0;
  return Object.values(kills).reduce((sum, value) => {
    const count = safeCount(value);
    return Math.min(Number.MAX_SAFE_INTEGER, sum + count);
  }, 0);
}
function killCount(g, enemyId) {
  return safeCount(g?.player?.stats?.kills?.[enemyId]);
}
function playerLevel(g) {
  return safeCount(g?.player?.level, 1) || 1;
}
function riftBest(g) {
  return safeCount(g?.player?.riftBest);
}

export const ACHIEVEMENTS = [
  { id: 'first-blood', icon: '🩸', name: 'Первая кровь',
    desc: 'Убей первого врага', reward: 3, target: 1,
    progress: (g) => totalKills(g),
    check: (g) => totalKills(g) >= 1 },
  { id: 'goblin-slayer', icon: '👺', name: 'Гроза гоблинов',
    desc: 'Убей 10 гоблинов', reward: 8, target: 10,
    progress: (g) => killCount(g, 'goblin'),
    check: (g) => killCount(g, 'goblin') >= 10 },
  { id: 'skeleton-slayer', icon: '💀', name: 'Костолом',
    desc: 'Убей 10 скелетов', reward: 8, target: 10,
    progress: (g) => killCount(g, 'skeleton'),
    check: (g) => killCount(g, 'skeleton') >= 10 },
  { id: 'wolf-hunter', icon: '🐺', name: 'Охотник на волков',
    desc: 'Убей 5 волков', reward: 9, target: 5,
    progress: (g) => killCount(g, 'wolf'),
    check: (g) => killCount(g, 'wolf') >= 5 },
  { id: 'treasure-hunter', icon: '📦', name: 'Кладоискатель',
    desc: 'Открой 10 сундуков', reward: 12, target: 10,
    progress: (g) => statCount(g, 'chestsOpened'),
    check: (g) => (statCount(g, 'chestsOpened')) >= 10 },
  { id: 'rich', icon: '💰', name: 'Богач',
    desc: 'Заработай 1000 золота за всё время', reward: 15, target: 1000,
    progress: (g) => statCount(g, 'goldEarned'),
    check: (g) => (statCount(g, 'goldEarned')) >= 1000 },
  { id: 'level-5', icon: '⬆️', name: 'Опытный боец',
    desc: 'Достигни 5 уровня', reward: 8, target: 5,
    progress: (g) => playerLevel(g),
    check: (g) => (playerLevel(g)) >= 5 },
  { id: 'level-10', icon: '🌟', name: 'Ветеран',
    desc: 'Достигни 10 уровня', reward: 22, target: 10,
    progress: (g) => playerLevel(g),
    check: (g) => (playerLevel(g)) >= 10 },
  { id: 'shard-flame', icon: '🔥', name: 'Осколок Пламени',
    desc: 'Получи осколок после победы над Пепельным Вестником', reward: 15, target: 1,
    progress: (g) => g?.storyShards?.flame === true ? 1 : 0,
    check: (g) => g?.storyShards?.flame === true },
  { id: 'shard-ice', icon: '❄️', name: 'Осколок Льда',
    desc: 'Получи осколок после победы над Ледяной Хваткой', reward: 22, target: 1,
    progress: (g) => g?.storyShards?.ice === true ? 1 : 0,
    check: (g) => g?.storyShards?.ice === true },
  { id: 'shard-blood', icon: '🩸', name: 'Осколок Крови',
    desc: 'Получи осколок после победы над Кровавой Короной', reward: 30, target: 1,
    progress: (g) => g?.storyShards?.blood === true ? 1 : 0,
    check: (g) => g?.storyShards?.blood === true },
  { id: 'elite-slayer', icon: '★', name: 'Охотник на элиту',
    desc: 'Убей 5 элитных врагов', reward: 18, target: 5,
    progress: (g) => statCount(g, 'eliteKills'),
    check: (g) => (statCount(g, 'eliteKills')) >= 5 },
  { id: 'boss-slayer', icon: '☠️', name: 'Убийца боссов',
    desc: 'Убей 2 мини-боссов', reward: 27, target: 2,
    progress: (g) => statCount(g, 'bossKills'),
    check: (g) => (statCount(g, 'bossKills')) >= 2 },
  { id: 'daily-devotee', icon: '🎁', name: 'Каждый день',
    desc: 'Открой 3 ежедневных сундука', reward: 22, target: 3,
    progress: (g) => statCount(g, 'dailyChestsOpened'),
    check: (g) => (statCount(g, 'dailyChestsOpened')) >= 3 },
  { id: 'completionist', icon: '🏆', name: 'Завершение',
    desc: 'Собери все три осколка Кристалла Разлома', reward: 75, target: 1,
    progress: (g) => (g?.storyShards?.flame === true && g?.storyShards?.ice === true && g?.storyShards?.blood === true) ? 1 : 0,
    check: (g) => (g?.storyShards?.flame === true && g?.storyShards?.ice === true && g?.storyShards?.blood === true) },
  { id: 'rift-10', icon: '🌀', name: 'Покоритель Разлома',
    desc: 'Достигни 10 этажа Разлома', reward: 30, target: 10,
    progress: (g) => riftBest(g),
    check: (g) => (riftBest(g)) >= 10 },
  { id: 'rift-25', icon: '🌀', name: 'Хозяин Разлома',
    desc: 'Достигни 25 этажа Разлома', reward: 60, target: 25,
    progress: (g) => riftBest(g),
    check: (g) => (riftBest(g)) >= 25 },
  { id: 'rift-50', icon: '🌀', name: 'Легенда Разлома',
    desc: 'Достигни 50 этажа Разлома', reward: 150, target: 50,
    progress: (g) => riftBest(g),
    check: (g) => (riftBest(g)) >= 50 },
  { id: 'dragon-slayer', icon: '🐲', name: 'Убийца драконов',
    desc: 'Победи Кровавую Корону', reward: 150, target: 1,
    progress: (g) => killCount(g, 'ancient-dragon'),
    check: (g) => killCount(g, 'ancient-dragon') >= 1 }
];
