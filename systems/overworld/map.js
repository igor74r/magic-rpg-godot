import { getTileDanger } from './hazards.js';

export const TILE = 48;

export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createWorldRandom(worldSeed, locationId = '') {
  const input = `${Number.isSafeInteger(worldSeed) ? worldSeed >>> 0 : 1}:${String(locationId)}`;
  let seed = 2166136261;
  for (let index = 0; index < input.length; index++) {
    seed = Math.imul(seed ^ input.charCodeAt(index), 16777619);
  }
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 0;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }

  return Math.abs(h);
}

export function generateVillageMap(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  const stampRoad = (x, y, width = 2) => {
    const radius = Math.max(0, Math.floor((width - 1) / 2));
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        // A softened diamond keeps the path edge stepped, not square and rigid.
        if (Math.abs(ox) + Math.abs(oy) > radius + (width % 2 ? 0 : 1)) continue;
        if (grid[y + oy]?.[x + ox] !== undefined) grid[y + oy][x + ox] = 1;
      }
    }
    if (grid[y]?.[x] !== undefined) grid[y][x] = 1;
  };

  // Walk a sequence of waypoints with a deterministic, 4-connected raster line.
  // Alternating the axis on diagonal sections creates a natural stepped curve.
  const road = (points, width = 2) => {
    for (let segment = 0; segment < points.length - 1; segment++) {
      let [x, y] = points[segment];
      const [tx, ty] = points[segment + 1];
      let ix = 0, iy = 0;
      const dx = Math.abs(tx - x), dy = Math.abs(ty - y);
      const sx = Math.sign(tx - x), sy = Math.sign(ty - y);
      let error = dx - dy;
      let toggle = segment % 2 === 0;
      for (let step = 0; step < cols + rows + 8; step++) {
        stampRoad(x, y, width);
        if (x === tx && y === ty) break;
        const twice = error * 2;
        const canX = twice > -dy && x !== tx;
        const canY = twice < dx && y !== ty;
        if (canX && canY) {
          if (toggle) { x += sx; error -= dy; }
          else { y += sy; error += dx; }
          toggle = !toggle;
        } else if (canX) { x += sx; error -= dy; }
        else if (canY) { y += sy; error += dx; }
        else break;
      }
    }
  };

  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  // Build streets from authored curved waypoints below. Avoid the former
  // full-width cross: it made the settlement read as a rigid grid and cut
  // through gardens and courtyards.

  // Southern arrival lane bends into the village square instead of forming
  // a rigid cross. The central tile remains the stable arrival/navigation hub.
  road([[cx, rows - 1], [cx, rows - 6], [cx - 1, rows - 9], [cx, cy + 4], [cx, cy]], 3);
  road([[cx, cy], [cx - 1, cy - 3], [cx, cy - 6], [cx, 4]], 2);

  // West craft quarter and east market quarter: each has a curved main walk
  // plus a short yard spur leading to its service buildings.
  road([[cx, cy], [cx - 4, cy - 1], [cx - 8, cy], [7, cy - 1], [7, 9]], 2);
  road([[7, 9], [6, 11], [7, 14], [8, 17], [7, 21]], 2);
  road([[cx, cy], [cx + 4, cy + 1], [cx + 8, cy], [cols - 7, cy + 1], [cols - 7, 9]], 2);
  road([[cols - 7, 9], [cols - 6, 12], [cols - 7, 16], [cols - 7, 21]], 2);

  // Residential and tavern paths form small courtyards, not long straight alleys.
  road([[cx - 1, cy + 3], [cx - 4, cy + 5], [cx - 6, rows - 5], [13, rows - 4]], 2);
  road([[cx + 1, cy + 3], [cx + 4, cy + 5], [cx + 6, rows - 5], [25, rows - 4]], 2);
  road([[13, rows - 4], [15, rows - 5], [17, rows - 4], [cx, rows - 5]], 2);

  // Короткие ответвления связывают дворы с главными улицами: они не проходят
  // сквозь здания и заканчиваются у свободных подходов к ремесленным зонам.
  road([[cx - 7, cy], [cx - 9, cy - 2], [cx - 10, cy - 4], [11, cy - 5]], 2);
  road([[cx + 7, cy], [cx + 9, cy - 2], [cx + 10, cy - 4], [cols - 11, cy - 5]], 2);
  road([[cx - 2, cy + 5], [cx - 4, cy + 7], [cx - 5, rows - 7], [10, rows - 7]], 2);
  road([[cx + 2, cy + 5], [cx + 4, cy + 7], [cx + 5, rows - 7], [cols - 10, rows - 7]], 2);

  // Небольшие расширения у площади и развилок создают ощущение мощёных
  // карманов, а не одинаковых коридоров. Все они остаются проходимыми.
  for (const [px, py, radius] of [
    [cx, cy, 2], [cx - 7, cy, 1], [cx + 7, cy, 1],
    [13, rows - 4, 1], [cols - 13, rows - 4, 1]
  ]) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (Math.abs(ox) + Math.abs(oy) > radius + 1) continue;
        if (grid[py + oy]?.[px + ox] !== undefined) grid[py + oy][px + ox] = 1;
      }
    }
  }

  // Small irregular garden beds. Road tiles and protected interaction cells
  // are never overwritten, so every NPC, doorway, service and portal stays usable.
  const protectedCells = [
    [19, 15], ...Array.from({ length: 0 }, () => [0, 0])
  ];
  const protect = (x, y) => protectedCells.push([x, y]);
  for (const [x, y] of [
    [17,19],[20,19],[22,6],[4,9],[33,10],[5,20],[33,21],
    [16,14],[19,13],[22,13],[15,10],[17,10],[20,10],[7,10],[31,10],
    [7,21],[31,21],[24,6],[19,25],[12,16],[13,13],[27,13],[15,8],[15,18],
    [12,9],[27,9],[12,20],[27,20],[10,14],[29,14],[10,18],[29,18],
    [29,22],[9,9],[9,11],[10,11],[29,21],[9,21],
    [25,4],[7,8],[31,8],[7,20],[31,20],[13,25],[25,25],[13,4],
    [16,6],[17,8],[22,8],[23,10]
  ]) protect(x, y);
  const isProtected = (x, y) => protectedCells.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1);
  const gardens = [
    { x: 1, y: 1, rows: [[1,3],[0,4],[0,3],[1,2]] },
    { x: cols - 5, y: 1, rows: [[1,3],[0,4],[0,3],[1,2]] },
    { x: 1, y: rows - 5, rows: [[1,2],[0,3],[0,4],[1,3]] },
    { x: cols - 5, y: rows - 5, rows: [[1,3],[0,4],[0,3],[1,2]] },
    { x: 10, y: 2, rows: [[1,2],[0,3],[1,2]] },
    { x: cols - 13, y: 2, rows: [[1,2],[0,3],[1,2]] },
    { x: 2, y: 12, rows: [[1,2],[0,3],[1,2]] },
    { x: cols - 5, y: 13, rows: [[1,2],[0,3],[1,2]] },
    // Four narrow planted strips soften the edges of the craft and residential
    // quarters. They only claim untouched grass; streets and approach cells win.
    { x: 5, y: 2, rows: [[1,3],[0,4],[1,3]] },
    { x: cols - 10, y: 2, rows: [[1,3],[0,4],[1,3]] },
    { x: 5, y: rows - 6, rows: [[1,3],[0,4],[1,3]] },
    { x: cols - 10, y: rows - 6, rows: [[1,3],[0,4],[1,3]] }
  ];
  for (const patch of gardens) {
    patch.rows.forEach(([left, right], row) => {
      for (let x = patch.x + left; x <= patch.x + right; x++) {
        const y = patch.y + row;
        if (grid[y]?.[x] === 0 && !isProtected(x, y)) grid[y][x] = 4;
      }
    });
  }

  return grid;
}

export function generateMap(locationId, cols, rows, random = null) {
  if (locationId === 'village') {
    return generateVillageMap(cols, rows);
  }

  const rng = typeof random === 'function' ? random : seededRandom(hashString(locationId));
  const grid = [];

  for (let y = 0; y < rows; y++) {
    grid[y] = [];

    for (let x = 0; x < cols; x++) {
      grid[y][x] = 0;
    }
  }

  // Каменные образования и препятствия.
  for (let i = 0; i < 3; i++) {
    const cx = Math.floor(rng() * cols);
    const cy = Math.floor(rng() * rows);
    const radius = 2 + Math.floor(rng() * 3);

    for (
      let y = Math.max(0, cy - radius);
      y < Math.min(rows, cy + radius);
      y++
    ) {
      for (
        let x = Math.max(0, cx - radius);
        x < Math.min(cols, cx + radius);
        x++
      ) {
        if (Math.hypot(x - cx, y - cy) <= radius && rng() > 0.2) {
          grid[y][x] = 3;
        }
      }
    }
  }

  // Камни, руины и плотные участки.
  for (let i = 0; i < 8; i++) {
    const cx = Math.floor(rng() * cols);
    const cy = Math.floor(rng() * rows);
    const radius = 1 + Math.floor(rng() * 2);

    for (
      let y = Math.max(0, cy - radius);
      y < Math.min(rows, cy + radius);
      y++
    ) {
      for (
        let x = Math.max(0, cx - radius);
        x < Math.min(cols, cx + radius);
        x++
      ) {
        if (Math.hypot(x - cx, y - cy) <= radius && rng() > 0.3) {
          grid[y][x] = 2;
        }
      }
    }
  }

  // Декоративные препятствия.
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(rng() * cols);
    const y = Math.floor(rng() * rows);

    if (grid[y][x] === 0) {
      grid[y][x] = 4;
    }
  }

  // Центральные дороги и безопасная зона появления героя.
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  for (let x = 0; x < cols; x++) {
    grid[cy][x] = 1;
  }

  for (let y = 0; y < rows; y++) {
    grid[y][cx] = 1;
  }

  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (y >= 0 && y < rows && x >= 0 && x < cols) {
        grid[y][x] = 1;
      }
    }
  }

  return grid;
}

export function isBlocked(map, x, y, locationId = null) {
  if (!Array.isArray(map) || !map.length || !Array.isArray(map[0]) || x < 0 || x >= map[0].length || y < 0 || y >= map.length) {
    return true;
  }

  const tile = map[y][x];
  if (tile === 2 || tile === 4) return true;

  // Tile 3 is normally a stone formation. It becomes walkable only in regions
  // where the same surface is defined as a liquid or environmental hazard.
  return tile === 3 && !getTileDanger(tile, locationId);
}

export function isWalkable(map, cols, rows, px, py, locationId = null) {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);

  if (x < 0 || x >= cols || y < 0 || y >= rows) {
    return false;
  }

  return !isBlocked(map, x, y, locationId);
}

export function findFreeCell(
  map,
  cols,
  rows,
  avoidList = [],
  minDistFromPlayer = 0,
  playerPos = null,
  locationId = null,
  random = Math.random
) {
  const isCandidate = (x, y) => {
    if (isBlocked(map, x, y, locationId)) return false;

    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;

    if (
      playerPos &&
      Math.hypot(px - playerPos.x, py - playerPos.y) < minDistFromPlayer
    ) {
      return false;
    }

    for (const obj of avoidList) {
      if (!obj || obj.dead || obj.opened) continue;
      if (Math.hypot(px - obj.x, py - obj.y) < 80) return false;
    }

    return true;
  };

  // Fast random placement keeps the map feeling varied.
  for (let attempt = 0; attempt < 300; attempt++) {
    const x = Math.floor(random() * cols);
    const y = Math.floor(random() * rows);
    if (isCandidate(x, y)) return { x, y };
  }

  // A bounded full scan prevents random clustering from hiding valid cells.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isCandidate(x, y)) return { x, y };
    }
  }

  return null;
}
