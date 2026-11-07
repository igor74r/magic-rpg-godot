// scripts/check-imports.mjs
// Проверяет два инварианта ES-модулей проекта:
//   1) все относительные импорты разрешаются в существующие файлы;
//   2) все именованные импорты действительно экспортируются целевым модулем.
// Синтаксис проверяет node --check; здесь проверяется только связность графа.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('p0_backup_')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) out.push(full);
  }
  return out;
}

function fileExists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function extractSpecs(src) {
  const specs = [];
  const re = /from\s+['"](\.[^'"]*)['"]|import\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (spec === '...') continue; // Пропускаем placeholder в комментариях/примерах.
    specs.push(spec);
  }
  return specs;
}

// Делит строку по разделителю на верхнем уровне вложенности (скобки/кавычки).
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

// Имена, которые модуль экспортирует наружу: export function/const/class и export { ... }.
function collectExports(text) {
  const names = new Set();
  let star = false;
  if (/export\s*\*\s*(?:as\s+[\w$]+\s*)?from/.test(text)) star = true;

  for (const m of text.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s+class\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);

  // export const A = 1, B = 2; — разбираем декларации до ';' верхнего уровня
  for (const m of text.matchAll(/export\s+(?:const|let|var)\s+/g)) {
    const start = m.index + m[0].length;
    let i = start, depth = 0, quote = null, end = text.length;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      else if (ch === ';' && depth === 0) { end = i; break; }
    }
    for (const part of splitTopLevel(text.slice(start, end), ',')) {
      const decl = part.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (decl) names.add(decl[1]);
    }
  }

  // export { a, b as c } [from '...'] — экспортируемое имя стоит справа от as
  for (const m of text.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    for (const part of splitTopLevel(m[1], ',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits.length > 1 ? bits[1] : bits[0]).trim();
      if (name && name !== 'default') names.add(name);
    }
  }
  return { names, star };
}

const files = walk(ROOT);
const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const exportCache = new Map();
function exportsOf(file) {
  if (!exportCache.has(file)) exportCache.set(file, collectExports(sources.get(file)));
  return exportCache.get(file);
}

function resolveSpec(fromFile, spec) {
  // Browser cache-busting suffixes (?v=...) and fragments are not part of
  // the filesystem module path; normalize them before checking imports.
  const cleanSpec = spec.split(/[?#]/, 1)[0];
  const base = resolve(dirname(fromFile), cleanSpec);
  const candidates = [base, `${base}`.js, join(base, 'index.js')];
  return candidates.find(fileExists) || null;
}

const unresolved = [];
const missingExports = [];

for (const file of files) {
  const src = sources.get(file);

  for (const spec of extractSpecs(src)) {
    if (!resolveSpec(file, spec)) unresolved.push({ file, spec });
  }

  const importRe = /import\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const clause = m[1];
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // Не анализируем package/builtin imports.
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (!named) continue;
    const target = resolveSpec(file, spec);
    if (!target) continue; // СѓР¶Рµ РїРѕРїР°РґС‘С‚ РІ unresolved

    const ex = exportsOf(target);
    if (ex.star) continue; // export * вЂ” СЃРѕСЃС‚Р°РІ РЅРµРёР·РІРµСЃС‚РµРЅ, РЅРµ РїСЂРѕРІРµСЂСЏРµРј

    for (const part of splitTopLevel(named[1], ',')) {
      const imported = part.trim().split(/\s+as\s+/)[0].trim();
      if (!imported || imported === 'default') continue;
      if (!ex.names.has(imported)) missingExports.push({ file, spec, imported });
    }
  }
}

const rel = (f) => f.slice(ROOT.length).replace(/\\/g, '/');
let failed = false;

console.log(`check-imports: scanned ${files.length} files`);

if (unresolved.length > 0) {
  failed = true;
  for (const u of unresolved) console.log(`UNRESOLVED MODULE: ${rel(u.file)} -> ${u.spec}`);
}

if (missingExports.length > 0) {
  failed = true;
  for (const e of missingExports) console.log(`MISSING EXPORT: ${rel(e.file)} imports {${e.imported}} from ${e.spec}`);
}

if (failed) process.exit(1);
console.log('check-imports: all relative imports and named exports resolved OK');
