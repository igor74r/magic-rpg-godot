const DEPTH_PRIORITY = Object.freeze({ static: 0, chest: 1, event: 2, npc: 3, enemy: 4, player: 5 });

function getFootY(item, kind) {
  // Tall scenery is sorted by its ground contact point, never by its roof.
  const baseY = Number.isFinite(item.depthY) ? item.depthY : item.y;
  return baseY + (Number.isFinite(item.depthOffset) ? item.depthOffset : 0)
    + (kind === 'player' ? 12 : 0);
}

export function buildDepthItems(ow) {
  if (!ow?.player) return [];
  const items = [
    ...(ow.statics || []).map(item => ({ item, kind: 'static' })),
    ...(ow.npcs || []).map(item => ({ item, kind: 'npc' })),
    ...(ow.events || []).map(item => ({ item, kind: 'event' })),
    ...(ow.chests || []).filter(item => !item.opened).map(item => ({ item, kind: 'chest' })),
    ...(ow.enemies || []).filter(item => !item.dead).map(item => ({ item, kind: 'enemy' })),
    { item: ow.player, kind: 'player' }
  ];
  return items.map((entry, order) => ({
    ...entry, footY: getFootY(entry.item, entry.kind), order
  })).sort((a, b) =>
    a.footY - b.footY ||
    DEPTH_PRIORITY[a.kind] - DEPTH_PRIORITY[b.kind] ||
    a.order - b.order
  );
}
