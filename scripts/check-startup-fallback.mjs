import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
assert.match(main, /function readLocalStorage\(key\)/,
  'main bootstrap must guard storage reads');
assert.match(main, /function writeLocalStorage\(key, value\)/,
  'prologue dismissal must guard storage writes');
assert.match(main, /function removeLocalStorage\(key\)/,
  'prologue reset must guard storage removal');
assert.match(main, /const prologueSeen = readLocalStorage\(/,
  'startup must use the guarded prologue read');
assert.match(main, /\[1, 2, 3\]\.some\(slot => !!readLocalStorage\(/,
  'startup must use guarded reads for all save slots');
assert.equal([...main.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(/g)].length, 3,
  'raw localStorage calls must remain confined to the three guarded wrappers');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(match, 'index.html must contain an early inline startup guard');

// Parse the actual browser bootstrap as JavaScript, catching syntax regressions.
new Script(match[1], { filename: 'index.html:inline-startup-guard' });

const guard = match[1];
assert.match(guard, /showStartupFallback/,
  'startup guard must render a visible fallback panel');
assert.match(guard, /Не удалось запустить игру/,
  'fallback title must be understandable and localized');
assert.match(guard, /Ваши сохранения не затронуты/,
  'fallback must reassure players about saved data');
assert.match(guard, /Обновить игру/,
  'fallback must offer a reload action');
assert.match(guard, /Скопировать ошибку/,
  'fallback must offer copying diagnostic details');
assert.match(guard, /__GAME_DIAGNOSTICS_EARLY__/,
  'startup errors must remain available for runtime diagnostics');
assert.match(guard, /window\.addEventListener\(['"]error['"]/,
  'guard must intercept startup errors');
assert.match(guard, /window\.addEventListener\(['"]unhandledrejection['"]/,
  'guard must intercept rejected startup promises');
assert.match(guard, /tag === 'script'/,
  'failed script/module resources must trigger the fallback');
assert.match(html, /main\.js\?v=20261105-cinematic-prologue-1/,
  'entry module URL must be cache-busted after the latest visual asset update');
assert.match(html, /css\/2d-art-direction\.css\?v=20261104-aurora-flat-grass-7/,
  'Aurora art-direction stylesheet URL must be cache-busted after the latest visual asset update');

console.log('Startup fallback contract and inline syntax: OK');
