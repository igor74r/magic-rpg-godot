import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../ui/overworld/sprites.js', import.meta.url);
let source = readFileSync(path, 'utf8');
let changed = false;

function connect(anchor, call, label) {
  if (source.includes(call)) return;
  if (!source.includes(anchor)) throw new Error(`${label} render anchor not found`);
  source = source.replace(anchor, `${anchor}\n${call}`);
  changed = true;
}

connect(
  '  blit(ctx, sprite(HUMANOID, colors, 3), x, y, bob);',
  '  drawHeroDetails(ctx, x, y, playerClass, bob);',
  'Hero'
);
connect(
  '  blit(\n    ctx,\n    sprite(art.mask, art.pal, scale),\n    x,\n    y,\n    bob\n  );',
  '  drawEnemyDetails(ctx, enemy, x, y, bob, scale);',
  'Enemy'
);
connect(
  '  blit(\n    ctx,\n    sprite(HUMANOID, colors, small ? 2 : 2.5),\n    x,\n    y,\n    bob\n  );',
  '  drawNpcDetails(ctx, id, x, y, bob);',
  'NPC'
);

if (changed) {
  writeFileSync(path, source, 'utf8');
  console.log('Hero, enemy and NPC detail layers connected.');
} else {
  console.log('Hero, enemy and NPC detail layers are already connected; no changes made.');
}
