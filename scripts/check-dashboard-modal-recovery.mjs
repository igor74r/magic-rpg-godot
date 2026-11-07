import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/header.js', import.meta.url), 'utf8');
const closeStart = source.indexOf('function closeDashboardModal(');
const closeEnd = source.indexOf('\n}\n', closeStart);
assert.notEqual(closeStart, -1, 'dashboard modal close handler must exist');
const closeBody = source.slice(closeStart, closeEnd);
assert.match(closeBody, /dashboardModal\s*\|\|\s*document\.getElementById\(['"]dashboard-tab-modal['"]\)/,
  'close must find a DOM overlay even when its JS reference is lost');
assert.match(closeBody, /querySelectorAll\(['"]#dashboard-tab-modal['"]\)/,
  'close must remove every stale/duplicate dashboard overlay');
assert.match(closeBody, /gameScreen\.inert\s*=\s*false/,
  'close must always release the dashboard inert lock');
assert.match(closeBody, /document\.body\.classList\.remove\(['"]dashboard-modal-open['"]\)/,
  'close must remove the modal body state');

const openStart = source.indexOf('function openDashboardModal(tab)');
const openEnd = source.indexOf('\n}\n', openStart);
const openBody = source.slice(openStart, openEnd);
assert.match(openBody, /querySelectorAll\(['"]#dashboard-tab-modal['"]\)/,
  'opening a section must clean up orphaned modal DOM');
assert.match(openBody, /gameScreen\.inert\s*=\s*false/,
  'opening a fresh section must recover an orphaned inert dashboard');

console.log('check-dashboard-modal-recovery: PASS (orphan overlay removal and inert-state recovery)');
