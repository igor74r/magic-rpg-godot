import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../assets/tiles/manifest.json', import.meta.url), 'utf8'));

function readAtlas(relativePath, expectedWidth, expectedHeight, label) {
  const data = readFileSync(new URL('../assets/tiles/' + relativePath, import.meta.url));
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
    `${label} must be a valid PNG atlas`);
  assert.equal(data.readUInt32BE(16), expectedWidth, `${label} width changed`);
  assert.equal(data.readUInt32BE(20), expectedHeight, `${label} height changed`);
  return data;
}

assert.equal(manifest.tileSize, 96);
assert.deepEqual(manifest.terrain.rows,
  ['village', 'forest', 'ruins', 'shadow', 'swamp', 'volcano', 'ice', 'desert']);
assert.deepEqual(manifest.terrain.columns, ['grass', 'path', 'biome-object', 'liquid', 'rock']);
assert.equal(manifest.terrain.file, 'terrain/atlas.png');
assert.equal(manifest.props.file, 'props/atlas.png');
assert.equal(manifest.dungeons.file, 'dungeons/atlas.png');

readAtlas(manifest.terrain.file, 480, 768, 'terrain atlas');
readAtlas(manifest.props.file, 768, 384, 'props atlas');
readAtlas(manifest.dungeons.file, 480, 192, 'dungeon atlas');

for (const [biome, row] of Object.entries(manifest.biomeRows)) {
  assert.ok(Number.isInteger(row) && row >= 0 && row < manifest.terrain.rows.length,
    `${biome} must map to an existing terrain row`);
}
console.log('World atlas checks passed: local PNG atlases, manifest rows, tile columns and dimensions.');
