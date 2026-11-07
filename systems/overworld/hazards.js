const LAVA_REGIONS = new Set(['volcano', 'dragon', 'obsidian-fields']);
const POISON_REGIONS = new Set(['swamp', 'briar-hollow']);
const TRAP_WATER_REGIONS = new Set(['ruins', 'sunken-necropolis']);

/** Returns the environmental hazard applied by the tile under the player. */
export function getTileDanger(tileType, locationId) {
  if (!Number.isInteger(tileType) || !locationId) return null;

  if (LAVA_REGIONS.has(locationId) && tileType === 3) {
    return { type: 'lava', dmg: 1, every: 90, color: '#ff4010', name: '🔥 Лава' };
  }

  if (POISON_REGIONS.has(locationId) && tileType === 3) {
    return { type: 'poison', dmg: 1, every: 180, color: '#60a060', name: '☠️ Болото' };
  }

  if (TRAP_WATER_REGIONS.has(locationId) && tileType === 3) {
    return { type: 'spike', dmg: 2, every: 0, color: '#a06060', name: '⚠️ Подводные шипы' };
  }

  return null;
}
