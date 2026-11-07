// Verifies the runtime diagnostics hooks remain wired and exposed for inspection.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /__GAME_DIAGNOSTICS_EARLY__/,
  'head bootstrap must collect errors before main.js loads');
assert.match(html, /__GAME_DIAGNOSTICS_READY__/,
  'early capture must stop after main.js initializes to avoid duplicates');
assert.match(main, /earlyDiagnostics\.forEach/,
  'early startup errors must be transferred to runtime diagnostics');
assert.match(main, /showErrorToast\(`Не удалось загрузить ресурс:/,
  'failed resource loads must also be surfaced to the player');

assert.match(main, /window\.addEventListener\(['"]error['"],[\s\S]*?,\s*true\s*\)/,
  'capture-phase error listener must intercept failed resource loads');
assert.match(main, /recordRuntimeDiagnostic\(['"]resource-load['"]/,
  'resource failures must be recorded');
assert.match(main, /recordRuntimeDiagnostic\(['"]uncaught-error['"]/,
  'uncaught JavaScript errors must be recorded');
assert.match(main, /showErrorToast\(message\)/,
  'uncaught errors and rejected promises must be surfaced to the player');
assert.equal(main.split("window.addEventListener('error'").length - 1, 1,
  'main.js must install only one global error listener');
assert.equal(main.split("window.addEventListener('unhandledrejection'").length - 1, 1,
  'main.js must install only one unhandled-rejection listener');
assert.match(main, /window\.addEventListener\(['"]unhandledrejection['"]/,
  'unhandled promise rejections must be recorded');
assert.match(main, /RUNTIME_DIAGNOSTICS_LIMIT\s*=\s*50/,
  'diagnostics must remain bounded');
assert.match(main, /getRuntimeDiagnostics:\s*\(\)\s*=>/,
  'diagnostics must be readable through GameAPI');
assert.match(main, /clearRuntimeDiagnostics:\s*\(\)\s*=>/,
  'diagnostics must be clearable through GameAPI');

console.log('Runtime diagnostics contract: OK');
