// Static region graph. It contains no mutable save data.
export const WORLD_CONNECTIONS = Object.freeze({
  village: Object.freeze(['forest', 'briar-hollow', 'ruins']),
  forest: Object.freeze(['village', 'shadow', 'swamp', 'briar-hollow']),
  'briar-hollow': Object.freeze(['village', 'forest', 'swamp']),
  ruins: Object.freeze(['village', 'shadow', 'graveyard', 'library']),
  shadow: Object.freeze(['forest', 'ruins', 'library']),
  swamp: Object.freeze(['forest', 'briar-hollow', 'graveyard', 'sunken-necropolis']),
  graveyard: Object.freeze(['ruins', 'swamp', 'sunken-necropolis', 'wasteland']),
  library: Object.freeze(['ruins', 'shadow', 'sunken-necropolis', 'ice-peaks']),
  'sunken-necropolis': Object.freeze(['swamp', 'graveyard', 'library', 'void-crater']),
  wasteland: Object.freeze(['graveyard', 'volcano', 'obsidian-fields']),
  volcano: Object.freeze(['wasteland', 'obsidian-fields']),
  'obsidian-fields': Object.freeze(['wasteland', 'volcano', 'dragon-lair', 'void-crater']),
  'ice-peaks': Object.freeze(['library', 'frost-citadel']),
  'frost-citadel': Object.freeze(['ice-peaks', 'dragon-lair', 'void-crater']),
  'dragon-lair': Object.freeze(['obsidian-fields', 'frost-citadel', 'void-crater']),
  'void-crater': Object.freeze(['sunken-necropolis', 'obsidian-fields', 'frost-citadel', 'dragon-lair'])
});

export const WORLD_REGION_IDS = Object.freeze(Object.keys(WORLD_CONNECTIONS));
export const STARTING_REGIONS = Object.freeze(['village']);
export const STARTING_ROUTES = Object.freeze([
  ['village', 'forest'],
  ['village', 'briar-hollow'],
  ['village', 'ruins']
]);

export function getWorldRouteKey(fromId, toId) {
  return [String(fromId), String(toId)].sort().join('::');
}

export function isWorldRoute(fromId, toId) {
  return Boolean(
    WORLD_CONNECTIONS[fromId]?.includes(toId) &&
    WORLD_CONNECTIONS[toId]?.includes(fromId)
  );
}
