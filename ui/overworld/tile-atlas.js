const TILE_SIZE = 96;
const BIOME_ROW = Object.freeze({
  village: 0, forest: 1, ruins: 2, shadow: 3,
  swamp: 4, graveyard: 3, volcano: 5, dragon: 5,
  ice: 6, 'ice-peaks': 6, desert: 7, wasteland: 7, 'dragon-lair': 5, library: 2,
  'briar-hollow': 1, 'sunken-necropolis': 2, 'obsidian-fields': 5,
  'frost-citadel': 6, 'void-crater': 3
});


// Cached crisp grass accents make Aurora's lawn feel hand-authored without
// per-frame random noise or thousands of Canvas fill calls.
const auroraGrassDetailCache = new Map();
function auroraGrassSeed(tileX, tileY) {
  let value = Math.imul(tileX + 43, 374761393) ^ Math.imul(tileY + 71, 668265263);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}
function drawAuroraGrassDetails(ctx, x, y, size, tileX, tileY) {
  const seed = auroraGrassSeed(tileX, tileY);
  const key = seed & 255;
  let detail = auroraGrassDetailCache.get(key);
  if (!detail && typeof document !== 'undefined') {
    detail = document.createElement('canvas');
    detail.width = 48; detail.height = 48;
    const g = detail.getContext('2d');
    g.imageSmoothingEnabled = false;
    const colors = ['#71864a', '#849653', '#425c35', '#a2a55d', '#d5bd70', '#c4d07b'];
    let n = (seed ^ 0x9e3779b9) >>> 0;
    const count = 2 + (n % 2);
    for (let i = 0; i < count; i++) {
      n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0;
      const px = 2 + n % 44;
      n = Math.imul(n ^ (n >>> 13), 3266489917) >>> 0;
      const py = 2 + n % 44;
      g.fillStyle = colors[(n >>> 5) % colors.length];
      // Short paired blades form recognizable tufts at the 48px world scale.
      g.fillRect(px, py, 2, 1);
      if ((n & 3) === 0) g.fillRect(px + 1, py - 1, 1, 1);
      if ((n & 7) === 2) g.fillRect(px + 2, py, 1, 1);
      // A few tiny flower pixels create a lived-in meadow without emoji or blur; keep them sparse and clustered.
      if ((n & 15) === 3) {
        g.fillStyle = (n & 32) ? '#e8d9a0' : '#d9a9b8';
        g.fillRect(px, py + 1, 1, 1);
        g.fillStyle = '#e8d9a0';
        g.fillRect(px + 1, py, 1, 1);
      }
      // Occasional darker soil fleck adds subtle ground depth.
      if ((n & 31) === 11) {
        g.fillStyle = '#526b3f';
        g.fillRect(px - 1, py + 1, 1, 1);
      }
    }
    auroraGrassDetailCache.set(key, detail);
  }
  if (!detail) return;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  const previousAlpha = ctx.globalAlpha;
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.14;
    ctx.drawImage(detail, x, y, size, size);
  } finally {
    ctx.globalAlpha = previousAlpha;
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

let auroraGroundImage = null;
let auroraGroundRequested = false;
let auroraGroundReady = false;
let auroraGroundFailed = false;

function requestAuroraGroundAtlas() {
  if (auroraGroundRequested || typeof Image === 'undefined') return;
  auroraGroundRequested = true;
  try {
    auroraGroundImage = new Image();
    auroraGroundImage.onload = () => { auroraGroundReady = true; };
    auroraGroundImage.onerror = () => { auroraGroundFailed = true; auroraGroundImage = null; };
    auroraGroundImage.src = new URL('../../assets/aurora/ground-atlas.png', import.meta.url).href;
  } catch (error) {
    auroraGroundFailed = true;
    auroraGroundImage = null;
  }
}

/** Draws authored Aurora grass (0) or cobblestone path (1) pixel tiles. */
export const auroraPathDetailCache = new Map();

function drawAuroraPathDetails(ctx, x, y, size, tileX, tileY) {
  const seed = auroraGrassSeed(tileX + 97, tileY - 53);
  const key = seed & 127;
  let detail = auroraPathDetailCache.get(key);
  if (!detail && typeof document !== 'undefined') {
    detail = document.createElement('canvas');
    detail.width = 48; detail.height = 48;
    const g = detail.getContext('2d');
    g.imageSmoothingEnabled = false;
    let n = (seed ^ 0x85ebca6b) >>> 0;
    const colors = ['#6b6654', '#8a806a', '#a3977c', '#5b594a', '#77735f'];
    const count = 12 + (n % 9);
    for (let i = 0; i < count; i++) {
      n = Math.imul(n ^ (n >>> 16), 2246822519) >>> 0;
      const px = 2 + n % 44;
      n = Math.imul(n ^ (n >>> 13), 3266489917) >>> 0;
      const py = 2 + n % 44;
      g.fillStyle = colors[(n >>> 4) % colors.length];
      // Small worn stone highlights remain flat and crisp after scaling.
      g.fillRect(px, py, 2 + (n & 1), 1);
      if ((n & 7) === 3) g.fillRect(px + 1, py - 1, 1, 1);
      // Moss follows cracks at a low density, preserving a readable path.
      if ((n & 15) === 7) {
        g.fillStyle = '#9ba06a';
        g.fillRect(px, py + 2, 2, 1);
      }
      if ((n & 31) === 13) {
        g.fillStyle = '#514d40';
        g.fillRect(px + 2, py + 1, 1, 1);
      }
    }
    auroraPathDetailCache.set(key, detail);
  }
  if (!detail) return;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  const previousAlpha = ctx.globalAlpha;
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.38;
    ctx.drawImage(detail, x, y, size, size);
  } finally {
    ctx.globalAlpha = previousAlpha;
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

export function drawAuroraGroundTile(ctx, type, x, y, size, tileX = 0, tileY = 0) {
  if ((type !== 0 && type !== 1) || auroraGroundFailed) return false;
  if (!auroraGroundRequested) requestAuroraGroundAtlas();
  if (!auroraGroundReady || !auroraGroundImage) return false;
  // Four authored variants per terrain type break up visible repetition.
  let seed = Math.imul(tileX + 17, 374761393) ^ Math.imul(tileY + 31, 668265263);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  const variant = (seed ^ (seed >>> 16)) >>> 0 & 3;
  const sourceColumn = type * 4 + variant;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  const previousAlpha = ctx.globalAlpha;
  try {
    // Keep transparent pixels in the authored path edges on grass instead
    // of exposing the dark scene clear color as repeated horizontal bands.
    ctx.fillStyle = '#526b3f';
    ctx.fillRect(x, y, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = type === 0 ? 0.26 : 1;
    ctx.drawImage(auroraGroundImage, sourceColumn * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, size, size);
    ctx.globalAlpha = previousAlpha;
    if (type === 0) drawAuroraGrassDetails(ctx, x, y, size, tileX, tileY);
    else drawAuroraPathDetails(ctx, x, y, size, tileX, tileY);
    return true;
  } catch (error) {
    auroraGroundFailed = true;
    return false;
  } finally {
    ctx.globalAlpha = previousAlpha;
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}


/**
 * Softens the grass-to-cobblestone boundary with crisp, stepped pixel edges.
 * This is a visual-only overlay: the logical map and collision grid stay intact.
 */
export function drawAuroraGroundTransitions(ctx, type, x, y, size, tileX, tileY, map) {
  if (type !== 1 || !Array.isArray(map) || !auroraGroundReady || !auroraGroundImage) return false;
  const edges = [
    { dx: 0, dy: -1, points: (d) => [[0, 0], [size, 0], [size, d(3)], [size * 0.72, d(2)], [size * 0.48, d(4)], [size * 0.22, d(1)], [0, d(3)]] },
    { dx: 0, dy: 1, points: (d) => [[0, size], [size, size], [size, size - d(3)], [size * 0.72, size - d(2)], [size * 0.48, size - d(4)], [size * 0.22, size - d(1)], [0, size - d(3)]] },
    { dx: -1, dy: 0, points: (d) => [[0, 0], [d(3), 0], [d(2), size * 0.25], [d(4), size * 0.5], [d(1), size * 0.75], [d(3), size], [0, size]] },
    { dx: 1, dy: 0, points: (d) => [[size, 0], [size - d(3), 0], [size - d(2), size * 0.25], [size - d(4), size * 0.5], [size - d(1), size * 0.75], [size - d(3), size], [size, size]] }
  ];
  const corners = [
    { dx: -1, dy: -1, sides: [[-1, 0], [0, -1]], points: (d) => [[0, 0], [d(3), 0], [d(2), d(1)], [d(1), d(2)], [0, d(3)]] },
    { dx: 1, dy: -1, sides: [[1, 0], [0, -1]], points: (d) => [[size, 0], [size - d(3), 0], [size - d(2), d(1)], [size - d(1), d(2)], [size, d(3)]] },
    { dx: -1, dy: 1, sides: [[-1, 0], [0, 1]], points: (d) => [[0, size], [d(3), size], [d(2), size - d(1)], [d(1), size - d(2)], [0, size - d(3)]] },
    { dx: 1, dy: 1, sides: [[1, 0], [0, 1]], points: (d) => [[size, size], [size - d(3), size], [size - d(2), size - d(1)], [size - d(1), size - d(2)], [size, size - d(3)]] }
  ];
  const step = Math.max(2, Math.round(size / 12));
  const previousSmoothing = ctx.imageSmoothingEnabled;
  let drawn = false;
  let seed = Math.imul(tileX + 17, 374761393) ^ Math.imul(tileY + 31, 668265263);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  const variant = (seed ^ (seed >>> 16)) >>> 0 & 3;
  const paintPatch = (points) => {
    ctx.save();
    try {
      ctx.beginPath();
      ctx.moveTo(x + points[0][0], y + points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i][0], y + points[i][1]);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(auroraGroundImage, variant * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x, y, size, size);
      drawn = true;
    } finally {
      ctx.restore();
    }
  };
  const depthFor = (index, segment) => {
    let value = Math.imul(tileX + 19 + index * 7, 374761393) ^ Math.imul(tileY + 23 + segment * 11, 668265263);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return (2 + ((value >>> 0) % 3)) * step;
  };
  try {
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (map[tileY + edge.dy]?.[tileX + edge.dx] === 0) paintPatch(edge.points((part) => depthFor(i, part)));
    }
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i];
      if (map[tileY + corner.dy]?.[tileX + corner.dx] !== 0) continue;
      if (corner.sides.some(([dx, dy]) => map[tileY + dy]?.[tileX + dx] === 0)) continue;
      paintPatch(corner.points((part) => depthFor(i + 4, part)));
    }
    return drawn;
  } catch (error) {
    return false;
  } finally {
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

let atlasImage = null;
let atlasRequested = false;
let atlasReady = false;
let atlasFailed = false;

function requestAtlas() {
  if (atlasRequested || typeof Image === 'undefined') return;
  atlasRequested = true;
  try {
    atlasImage = new Image();
    atlasImage.onload = () => { atlasReady = true; };
    atlasImage.onerror = () => { atlasFailed = true; atlasImage = null; };
    atlasImage.src = new URL('../../assets/tiles/terrain/atlas.png', import.meta.url).href;
  } catch (error) {
    atlasFailed = true;
    atlasImage = null;
  }
}

/** Draws a 96px source tile downsampled to the game's 48px world grid. */
export function drawAtlasTile(ctx, type, x, y, size, themeName) {
  if (!Number.isInteger(type) || type < 0 || type > 4) return false;
  const row = BIOME_ROW[themeName];
  if (!Number.isInteger(row) || atlasFailed) return false;
  if (!atlasRequested) requestAtlas();
  if (!atlasReady || !atlasImage) return false;
  try {
    // Smoothing is configured once by the renderer for the whole terrain pass.
    // Avoid save/restore and state changes for every single tile.
    ctx.drawImage(atlasImage, type * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, x, y, size, size);
    return true;
  } catch (error) {
    atlasFailed = true;
    return false;
  }
}

let propsImage = null;
let propsRequested = false;
let propsReady = false;
let propsFailed = false;

function requestPropsAtlas() {
  if (propsRequested || typeof Image === 'undefined') return;
  propsRequested = true;
  try {
    propsImage = new Image();
    propsImage.onload = () => { propsReady = true; };
    propsImage.onerror = () => { propsFailed = true; propsImage = null; };
    propsImage.src = new URL('../../assets/tiles/props/atlas.png', import.meta.url).href;
  } catch (error) {
    propsFailed = true;
    propsImage = null;
  }
}

/** Draws one of the 32 environment props (8 columns Г— 4 rows). */
export function drawAtlasProp(ctx, index, x, y, width = 48, height = 48) {
  if (!Number.isInteger(index) || index < 0 || index >= 32 || propsFailed) return false;
  if (!propsRequested) requestPropsAtlas();
  if (!propsReady || !propsImage) return false;
  const col = index % 8;
  const row = Math.floor(index / 8);
  const previousSmoothing = ctx.imageSmoothingEnabled;
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(propsImage, col * 96, row * 96, 96, 96, x, y, width, height);
    return true;
  } catch (error) {
    propsFailed = true;
    return false;
  } finally {
    // Keep a failed atlas draw from leaking Canvas state into later layers.
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

