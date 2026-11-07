import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const characterConnector = readFileSync(new URL('./connect-character-details.mjs', import.meta.url), 'utf8');
assert.ok(characterConnector.includes('if (source.includes(call)) return;'),
  'character detail connector must be idempotent and avoid duplicate render layers');

const manifest = JSON.parse(readFileSync(new URL('../assets/tiles/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.tileSize, 96);
assert.equal(manifest.terrain.displaySize, 48);
assert.deepEqual(manifest.terrain.columns, ['grass', 'path', 'biome-object', 'liquid', 'rock']);
assert.equal(manifest.terrain.rows.length, 8);
for (const [biome, row] of Object.entries(manifest.biomeRows)) {
  assert.ok(Number.isInteger(row) && row >= 0 && row < manifest.terrain.rows.length, `invalid tile row for ${biome}`);
}

for (const asset of [
  'assets/tiles/terrain/atlas.png',
  'assets/aurora/ground-atlas.png',
  'assets/aurora/village-props-atlas.png','assets/aurora/nature-atlas.png','assets/aurora/world-portal.png',
  'assets/tiles/dungeons/atlas.png',
  'assets/tiles/props/atlas.png',
  'assets/branding/mana-crystal.png',
  'audio/prologue.mp3',
  'css/2d-art-direction.css'
]) assert.ok(existsSync(new URL(`../${asset}`, import.meta.url)), `missing asset: ${asset}`);

const groundPng = readFileSync(new URL('../assets/aurora/ground-atlas.png', import.meta.url));
assert.equal(groundPng.readUInt32BE(16), 768, 'Aurora ground atlas must contain four variants for each of two terrain types');
assert.equal(groundPng.readUInt32BE(20), 96, 'Aurora ground atlas must be 96px high');
// Validate the complete PNG stream, not only its header. A truncated atlas can
// pass dimension checks, silently fail Image.onload, and expose the fallback
// terrain's tile-row seams in every Aurora screenshot.
const groundChunks = [];
let groundCursor = 8;
let groundHasEnd = false;
while (groundCursor + 12 <= groundPng.length) {
  const chunkLength = groundPng.readUInt32BE(groundCursor);
  const chunkType = groundPng.toString('ascii', groundCursor + 4, groundCursor + 8);
  const chunkEnd = groundCursor + 12 + chunkLength;
  assert.ok(chunkEnd <= groundPng.length, `Aurora ground PNG has truncated ${chunkType} chunk`);
  if (chunkType === 'IDAT') groundChunks.push(groundPng.subarray(groundCursor + 8, groundCursor + 8 + chunkLength));
  groundCursor = chunkEnd;
  if (chunkType === 'IEND') { groundHasEnd = true; break; }
}
assert.ok(groundHasEnd && groundCursor === groundPng.length, 'Aurora ground PNG must end with a valid IEND chunk');
const groundPixels = inflateSync(Buffer.concat(groundChunks));
assert.equal(groundPixels.length, (768 * 3 + 1) * 96, 'Aurora ground PNG must contain complete decompressed pixel rows');
assert.equal(manifest.auroraGround?.columns, 8, 'Aurora ground atlas must define eight variants');
assert.deepEqual(manifest.auroraGround?.types, ['grass', 'path']);
const propsPng = readFileSync(new URL('../assets/aurora/village-props-atlas.png', import.meta.url));
assert.equal(propsPng.readUInt32BE(16), 1024, 'Aurora village prop atlas must contain sixteen 64px frames');
assert.equal(propsPng.readUInt32BE(20), 64, 'Aurora village prop atlas must be 64px high');
const naturePng = readFileSync(new URL('../assets/aurora/nature-atlas.png', import.meta.url));
assert.equal(naturePng.readUInt32BE(16), 512, 'Aurora nature atlas must contain eight 64px frames');
assert.equal(naturePng.readUInt32BE(20), 80, 'Aurora nature atlas must preserve 64×80 source frames');
assert.equal(naturePng[25], 6, 'Aurora nature atlas must preserve transparent RGBA pixels');
assert.equal(manifest.auroraNature?.columns, 8, 'Aurora nature atlas must define eight authored styles');
assert.deepEqual(manifest.auroraNature?.styles, ['oak','pine','bush','rock','stump','hedge','fence','flowerbed']);
const portalPng = readFileSync(new URL('../assets/aurora/world-portal.png', import.meta.url));
assert.equal(portalPng.readUInt32BE(16), 64, 'Aurora world portal sprite must be 64px wide');
assert.equal(portalPng.readUInt32BE(20), 64, 'Aurora world portal sprite must be 64px high');
assert.equal(manifest.auroraWorldPortal?.columns, 1, 'Aurora world portal must use its dedicated authored sprite');
const pngAssets = ['assets/aurora/ground-atlas.png','assets/aurora/village-props-atlas.png','assets/aurora/nature-atlas.png','assets/aurora/world-portal.png','assets/tiles/terrain/atlas.png','assets/tiles/dungeons/atlas.png','assets/tiles/props/atlas.png','assets/branding/mana-crystal.png'];
function crc32Png(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function assertPngIntegrity(asset) {
  const png = readFileSync(new URL(`../${asset}`, import.meta.url));
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `${asset} must have a PNG signature`);
  let cursor = 8;
  const compressed = [];
  let ended = false;
  while (cursor + 12 <= png.length) {
    const length = png.readUInt32BE(cursor);
    const type = png.toString('ascii', cursor + 4, cursor + 8);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    assert.ok(chunkEnd <= png.length, `${asset} contains a truncated ${type} chunk`);
    const checksum = png.readUInt32BE(dataEnd);
    assert.equal(crc32Png(png.subarray(cursor + 4, dataEnd)), checksum, `${asset} has invalid ${type} checksum`);
    if (type === 'IDAT') compressed.push(png.subarray(dataStart, dataEnd));
    cursor = chunkEnd;
    if (type === 'IEND') { ended = true; break; }
  }
  assert.ok(ended && cursor === png.length, `${asset} must end with a complete IEND chunk`);
  assert.ok(inflateSync(Buffer.concat(compressed)).length > 0, `${asset} must contain decodable image data`);
}
for (const asset of pngAssets) assertPngIntegrity(asset);

const villageArt = readFileSync(new URL('../ui/overworld/aurora-art.js', import.meta.url), 'utf8');
assert.ok(villageArt.includes('drawAuroraBuilding(ctx,x,y,style'), 'Aurora buildings must use the rebuilt pixel-art renderer');
assert.ok(villageArt.includes('imageSmoothingEnabled=false'), 'Aurora pixel art must use nearest-neighbour scaling');
assert.ok(villageArt.includes('  } finally {\n    ctx.restore();'), 'Aurora building draws must restore Canvas state after failures');
assert.ok(!/create(?:Linear|Radial)Gradient|\.svg/i.test(villageArt), 'Aurora pixel art must not use gradients or vector assets');
assert.ok(villageArt.includes('drawHall') && villageArt.includes('drawForge') && villageArt.includes('drawHealer') && villageArt.includes('drawAlchemy') && villageArt.includes('drawMarket') && villageArt.includes('drawTavern'), 'each village service building must have a distinct authored design');
const locationsSource = readFileSync(new URL('../data/locations.js', import.meta.url), 'utf8');
const locationPropStyles = [...locationsSource.matchAll(/propStyle:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
const villageSprites = readFileSync(new URL('../ui/overworld/sprites.js', import.meta.url), 'utf8');
assert.ok(villageSprites.includes('const VILLAGE_PROP_FRAMES = new Map(['), 'village props must use the authored PNG atlas');
assert.ok(villageSprites.includes('const AURORA_NATURE_FRAMES = new Map(['), 'Aurora nature must use the authored PNG atlas');
assert.ok(villageSprites.includes("oak: [120, 150], pine: [108, 144], bush: [90, 72], rock: [78, 66]"), 'Aurora trees and low nature props must use species-specific world dimensions');
assert.ok(villageSprites.includes("stump: [72, 66], hedge: [96, 72], fence: [108, 54], flowerbed: [84, 48]"), 'Aurora garden pieces must remain low and proportionate to their silhouettes');
assert.ok(villageSprites.includes("new URL('../../assets/aurora/nature-atlas.png', import.meta.url)"), 'Aurora nature atlas must load from its manifest asset path');
assert.ok(villageSprites.includes('getAuroraNatureFrameBounds(atlas, frame)') && villageSprites.includes('pixels[(py * 64 + px) * 4 + 3] === 0'), 'Aurora nature atlas must crop transparent frame margins to the visible sprite bounds');
assert.ok(villageSprites.includes('ctx.drawImage(atlas,frame*64+crop.x,crop.y,crop.width,crop.height'), 'Aurora nature atlas must render the cropped visible sprite with nearest-neighbour sampling');
const npcDetails = villageSprites.slice(villageSprites.indexOf('function drawNpcDetails('));
assert.ok(npcDetails.includes('integer pixel clusters only') && npcDetails.includes("id === 'blacksmith'") && npcDetails.includes("id === 'bard'"), 'Aurora NPCs must use role-specific pixel-art details');
const npcData = readFileSync(new URL('../data/npcs.js', import.meta.url), 'utf8');
for (const id of ['blacksmith','healer','alchemist','merchant','elder','bard','guard','herald','kids']) {
  assert.ok(npcDetails.includes(`id === '${id}'`), `Aurora NPC ${id} must have role-specific pixel-art details`);
}
for (const id of ['well','questBoard','cat']) {
  assert.ok(villageSprites.includes(`if (id === '${id}')`), `Aurora NPC prop ${id} must have a dedicated pixel-art renderer`);
  assert.ok(npcData.includes(`${id}: {`), `NPC data must keep the ${id} visual role registered`);
}
assert.ok(villageSprites.includes('Stepped rectangular footprint: crisp pixel-art shadow') && !villageSprites.includes('ctx.ellipse('), 'overworld character shadows must use crisp stepped pixel blocks, not antialiased ellipses');
assert.ok(!/ctx\.(?:beginPath|arc|stroke|strokeRect)\s*\(/.test(npcDetails), 'Aurora NPC role details must avoid antialiased vector strokes');
assert.ok(villageSprites.includes('frame * 64, 0, 64, 64'), 'village props must sample the 64px atlas frames');
assert.ok(villageSprites.includes('ctx.imageSmoothingEnabled = false'), 'village prop atlas must render with crisp nearest-neighbour pixels');
assert.ok(villageSprites.includes('  } finally {\n    ctx.restore();'), 'village prop draws must restore Canvas state after failures');
assert.ok(!villageSprites.includes('function drawVillagePropRaw'), 'legacy procedural village prop rasterizer must be removed');
assert.ok(villageSprites.includes("['planter', 5]"), 'Aurora planters must resolve to their authored pixel atlas frame');
assert.ok(villageSprites.includes('getAuroraWorldPortalAtlas'), 'Aurora world portal must load its dedicated authored sprite');
assert.ok(villageSprites.includes("style === 'world-portal'"), 'world portal must not reuse the rift ward frame');
const mappedPropStyles = [...villageSprites.matchAll(/\['([^']+)',\s*\d+\]/g)].map(match => match[1]);
for (const style of new Set(locationPropStyles)) {
  if (style === 'world-portal') {
    assert.ok(villageSprites.includes("style === 'world-portal'"), 'Aurora world portal must resolve through its dedicated sprite');
    assert.ok(!mappedPropStyles.includes(style), 'world portal must not alias a village prop atlas frame');
  } else {
    assert.ok(mappedPropStyles.includes(style), 'Aurora propStyle ' + style + ' must resolve to an authored sprite');
  }
}
assert.ok(!readFileSync(new URL('../ui/overworld/sprites.js', import.meta.url), 'utf8').includes('SVG architecture'), 'Aurora sprite renderer must not depend on vector architecture');
for (const asset of pngAssets) assert.ok(existsSync(new URL(`../${asset}`, import.meta.url)), `missing PNG: ${asset}`);

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
assert.ok(html.includes('id="prologue-art"'), 'cinematic prologue must provide its illustrated Canvas');
assert.ok(html.includes('id="prologue-narration"'), 'cinematic prologue must provide a narration layer');
assert.ok(main.includes('Кристалл Разлома'), 'prologue must retain the central crystal lore');
assert.ok(main.includes('Зарплата — опыт'), 'prologue narrator must retain its darkly comic voice');
assert.ok(main.includes('Ты ведь понимаешь, что я вижу тебя?'), 'prologue must directly address the player beyond the screen');
assert.ok((main.match(/chapter: 'Глава /g) || []).length >= 7, 'prologue must contain at least seven story chapters');
assert.ok(main.includes('drawPrologueIllustration') && main.includes('imageSmoothingEnabled = false'));
assert.ok(html.includes('css/2d-art-direction.css'));

const renderer = readFileSync(new URL('../ui/overworld/render.js', import.meta.url), 'utf8');
const depth = readFileSync(new URL('../ui/overworld/depth-order.js', import.meta.url), 'utf8');
assert.ok(renderer.includes("graphicsQuality === 'high' && ow.locationId !== 'village') drawBloom(ctx)"),
  'Aurora must not apply soft bloom to crisp pixel art');
assert.ok(renderer.includes("!allowAmbientFog || ow.locationId === 'village' ? 0"),
  'Aurora must bypass radial fog lighting');
assert.ok(renderer.includes("if (ow.locationId !== 'village') {\n    const gradient = ctx.createRadialGradient"),
  'Aurora must bypass the radial vignette');
assert.ok(renderer.includes("ctx.fillRect(lx - radius, ly - 8, radius * 2, 16)"),
  'Aurora lanterns must use flat stepped light pools');
assert.ok(renderer.includes('getEventPropIndex'));
assert.ok(renderer.includes('drawAtlasProp(ctx, eventPropIndex'));
const atlasRenderer = readFileSync(new URL('../ui/overworld/tile-atlas.js', import.meta.url), 'utf8');
assert.ok(atlasRenderer.includes('const TILE_SIZE = 96'));
assert.ok(atlasRenderer.includes('ctx.imageSmoothingEnabled = false'));
assert.ok(atlasRenderer.includes('drawAuroraGroundTile'));
assert.ok(atlasRenderer.includes('drawAuroraGroundTransitions'), 'Aurora cobblestone edges must blend into adjacent grass with pixel-stepped overlays');
assert.ok(atlasRenderer.includes("ctx.fillStyle = '#526b3f';\n    ctx.fillRect(x, y, size, size);"), 'Aurora ground tiles must paint an opaque grass base beneath transparent atlas pixels');
assert.ok(atlasRenderer.includes('const corners = ['), 'diagonal grass neighbours must soften isolated Aurora path corners');
assert.ok(atlasRenderer.includes('corner.sides.some'), 'diagonal overlays must not duplicate cardinal grass transitions');
assert.ok(atlasRenderer.includes('const paintPatch = (points)'), 'each pixel transition patch must restore canvas state safely');
assert.ok(renderer.includes('drawAuroraGroundTransitions(ctx, type'), 'village renderer must pass logical neighbours into the visual ground transition pass');
assert.ok(atlasRenderer.includes('sourceColumn = type * 4 + variant'), 'Aurora ground must select deterministic authored terrain variants');
assert.ok(atlasRenderer.includes('drawAuroraGrassDetails(ctx, x, y, size, tileX, tileY)'), 'Aurora grass must render deterministic cached pixel accents');
assert.ok(atlasRenderer.includes('const count = 2 + (n % 2);') && atlasRenderer.includes('ctx.globalAlpha = 0.14;'), 'Aurora grass accents must remain extremely sparse and low-contrast');
assert.ok(atlasRenderer.includes('ctx.globalAlpha = type === 0 ? 0.26 : 1;') && atlasRenderer.includes('ctx.globalAlpha = previousAlpha;'), 'Aurora grass atlas must remain subordinate to the flat base and restore Canvas alpha');
assert.ok(atlasRenderer.includes('auroraGrassDetailCache'), 'Aurora grass details must be cached to avoid per-frame asset allocation');
assert.ok(atlasRenderer.includes('const key = seed & 255'), 'Aurora ground must retain enough distinct cached grass detail patterns');
assert.ok(atlasRenderer.includes('A few tiny flower pixels'), 'Aurora grass may include tiny flat-color flowers, without blur or gradients');
assert.ok(atlasRenderer.includes('auroraPathDetailCache'), 'Aurora cobblestone path must use cached crisp detail textures');
assert.ok(atlasRenderer.includes('drawAuroraPathDetails(ctx, x, y, size, tileX, tileY)'), 'Aurora path tiles must receive visual stone variation');
assert.ok(renderer.includes('drawAuroraGroundTile(ctx, type'), 'Aurora village must use its dedicated authored ground atlas');
assert.ok(renderer.includes("(type === 0 || type === 1) && themeName !== 'village'"), 'Aurora fallback terrain must not draw repeated dark tile-edge scanlines');
assert.ok(renderer.indexOf('const questEnemyId') < renderer.indexOf('const depthItems'), 'quest target must be resolved before the depth loop reads it');
assert.ok(depth.includes("kind: 'chest'"), 'treasure chests must participate in common depth sorting');
assert.ok(renderer.includes("entry.kind === 'chest'"), 'treasure chests must render in the common depth pass');
const styles = readFileSync(new URL('../css/rpg-overhaul.css', import.meta.url), 'utf8');
assert.ok(styles.includes('#mobile-dpad .dpad-btn'));
assert.ok(styles.includes('prefers-reduced-motion'));

console.log('16-bit Aurora pixel-art architecture, terrain atlas and responsive UI checks passed');
