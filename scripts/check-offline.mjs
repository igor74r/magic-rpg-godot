// Offline-only contract: runtime game files must not call network APIs or embed remote URLs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// SVG namespace identifiers are not network endpoints and are required for inline vector assets.
const forbidden = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\.sendBeacon\s*\(|https?:\/\/(?!www\.w3\.org\/2000\/svg\b|www\.w3\.org\/1999\/xlink\b)/i;
const extensions = new Set(['.js', '.html', '.css']);
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'scripts', 'p0_backup_2026-11-01', 'test-artifacts'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && extensions.has(full.slice(full.lastIndexOf('.')))) {
      const source = readFileSync(full, 'utf8');
      const lines = source.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (forbidden.test(line)) violations.push({ file: relative(ROOT, full), line: index + 1, text: line.trim() });
        forbidden.lastIndex = 0;
      });
    }
  }
}
walk(ROOT);
if (violations.length) {
  for (const item of violations) console.log(`FAIL ${item.file}:${item.line}: ${item.text}`);
  process.exit(1);
}
console.log('PASS offline-only runtime contract: no fetch/XHR/WebSocket/EventSource/beacon or remote URLs in game source.');
