// scripts/check-gameapi.mjs
// Проверяет контракт между разметкой и фасадом: каждый вызов GameAPI.<method>,
// встречающийся в index.html или в генерируемом UI-модулями HTML, должен быть
// объявлен в объекте window.GameAPI (main.js). Именно так теряются обработчики
// вроде invSlotClick после рефакторингов — молча, без ошибок в консоли.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) out.push(full);
  }
  return out;
}

// Делит строку по разделителю на верхнем уровне вложенности.
function splitTopLevel(str, sep) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += str[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// Вырезает тело объекта window.GameAPI = { ... } с учётом строк и комментариев.
function extractFacadeBody(text) {
  // Find the actual facade assignment, not an earlier delegated reference to GameAPI.
  const assignment = /window\.GameAPI\s*=\s*\{/.exec(text);
  if (!assignment) return null;
  const brace = assignment.index + assignment[0].lastIndexOf('{');

  let depth = 0, quote = null, lineComment = false, blockComment = false, i = brace;
  for (; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  return text.slice(brace + 1, i);
}

function collectFacadeKeys(text) {
  const body = extractFacadeBody(text);
  if (body === null) return null;
  const keys = new Set();
  for (const part of splitTopLevel(body, ',')) {
    const m = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

const facadeProbe = collectFacadeKeys(
  "window.GameAPI?.claimQuest?.('probe');\nwindow.GameAPI = { claimQuest: () => {}, closeNpcAndResume: () => {} };"
);
if (!facadeProbe?.has('claimQuest') || !facadeProbe?.has('closeNpcAndResume')) {
  console.log('check-gameapi: не удалось найти фасад после делегированного обращения');
  process.exit(1);
}

const mainFile = join(ROOT, 'main.js');
if (!existsSync(mainFile)) {
  console.log('check-gameapi: main.js не найден');
  process.exit(1);
}

const facadeKeys = collectFacadeKeys(readFileSync(mainFile, 'utf8'));
if (!facadeKeys || facadeKeys.size === 0) {
  console.log('check-gameapi: не удалось разобрать window.GameAPI в main.js');
  process.exit(1);
}

const files = walk(ROOT).filter((f) => f !== mainFile);
const missing = [];
let references = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const re = /GameAPI\.([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    references++;
    if (!facadeKeys.has(m[1])) {
      missing.push({ file: file.slice(ROOT.length).replace(/\\/g, '/'), line: lineAt(text, m.index), name: m[1] });
    }
  }
}

console.log(`check-gameapi: методов в фасаде — ${facadeKeys.size}, вызовов в разметке — ${references}`);

if (missing.length > 0) {
  for (const item of missing) console.log(`MISSING GameAPI METHOD: ${item.name} (${item.file}:${item.line})`);
  process.exit(1);
}

console.log('check-gameapi: все вызовы GameAPI объявлены в фасаде');
