import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const VISUAL_DIR = join(ROOT, 'test-artifacts', 'visual-review');
mkdirSync(VISUAL_DIR, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitFor(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) { await response.arrayBuffer(); return response; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for ' + url);
}
function connectCDP(url, errors) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const id = ++seq;
        return new Promise((res, rej) => {
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      async evaluate(expression) {
        const response = await this.send('Runtime.evaluate', {
          expression, returnByValue: true, awaitPromise: true
        });
        if (response.exceptionDetails) {
          throw new Error(response.exceptionDetails.text || 'Browser evaluation failed');
        }
        return response.result?.value;
      },
      close() { ws.close(); }
    }));
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) entry.rej(new Error(message.error.message));
        else entry.res(message.result || {});
      }
      if (message.method === 'Runtime.exceptionThrown') {
        errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'uncaught browser exception');
      }
      if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') {
        errors.push(message.params.entry.text);
      }
    });
    ws.addEventListener('error', reject);
  });
}

const httpPort = await freePort();
const debugPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'shards-rift-chrome-'));
const server = spawn('python', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=' + debugPort, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', 'about:blank'
], { stdio: 'ignore' });
let cdp;
try {
  await waitFor('http://127.0.0.1:' + httpPort);
  await waitFor('http://127.0.0.1:' + debugPort + '/json/version');
  const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
  const pageTarget = targets.find(target => target.type === 'page');
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'Chrome page target was not created');
  const pageErrors = [];
  cdp = await connectCDP(pageTarget.webSocketDebuggerUrl, pageErrors);
  const capture = async name => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(VISUAL_DIR, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "localStorage.removeItem('magic-rpg-prologue-seen'); ['magic-rpg-save-1','magic-rpg-save-2','magic-rpg-save-3'].forEach(key => localStorage.removeItem(key));"
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 740 }
  ]) {
    pageErrors.length = 0;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600
    });
    if (viewport.name === 'desktop') {
      await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + httpPort + '/?viewport=desktop' });
      await new Promise(resolve => setTimeout(resolve, 350));
      for (let i = 0; i < 50; i++) {
        if (await cdp.evaluate("document.readyState === 'complete' && !!window.GameAPI")) break;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      assert.equal(await cdp.evaluate("document.querySelector('#screen-prologue.active') !== null"), true, 'desktop: prologue did not open for first launch');
      const prologueCheck = await cdp.evaluate("(() => { const b=document.getElementById('prologue-voice-btn'); const r=b?.getBoundingClientRect(); return {text:document.getElementById('screen-prologue')?.innerText||'', voice:b?.textContent||'', voiceVisible:!!r && r.top >= 0 && r.bottom <= innerHeight + 1}; })()");
      assert.ok(prologueCheck.text.includes('Разлом') && prologueCheck.voice.includes('Прослушать легенду') && prologueCheck.voiceVisible, 'desktop: prologue voice control missing or outside first screen');
      await capture('00-prologue-desktop');
      await cdp.evaluate('GameAPI.skipPrologue()');
    } else {
      await cdp.evaluate("GameAPI.showScreen('screen-main'); GameAPI.updateMainMenu()");
    }
    assert.equal(await cdp.evaluate("document.querySelector('#screen-main.active') !== null"), true, viewport.name + ': main menu did not open');
    if (viewport.name === 'desktop') await capture('01-main-menu-desktop');
    await cdp.evaluate('GameAPI.openSettings()');
    assert.equal(await cdp.evaluate("document.querySelector('#screen-settings.active') !== null"), true, viewport.name + ': settings did not open');
    if (viewport.name === 'desktop') await capture('02-settings-desktop');

    for (const tab of ['sound', 'game', 'graphics', 'accessibility', 'data']) {
      await cdp.evaluate("document.querySelector('[data-tab=" + JSON.stringify(tab) + "]').click()");
      const metrics = await cdp.evaluate(`(() => {
        const root = document.getElementById('screen-settings');
        const content = document.getElementById('settings-content');
        return { viewport: innerWidth, document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth, root: root.scrollWidth, rootClient: root.clientWidth,
          content: content.scrollWidth, contentClient: content.clientWidth };
      })()`);
      assert.ok(metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1 &&
        metrics.root <= metrics.rootClient + 1 && metrics.content <= metrics.contentClient + 1,
        viewport.name + '/' + tab + ': horizontal overflow ' + JSON.stringify(metrics));
    }

    await cdp.evaluate(`(() => {
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
      document.querySelector('[data-tab="game"]').click();
      set('set-difficulty', 'hard'); set('set-autosave', 'off'); set('set-autosave-interval', '60');
      GameAPI.applySettings();
      document.querySelector('[data-tab="accessibility"]').click();
      set('set-reduced-motion', 'on'); set('set-screen-shake', 'off');
      GameAPI.applySettings();
    })()`);
    const settings = await cdp.evaluate("JSON.parse(localStorage.getItem('magic-rpg-settings'))");
    assert.equal(settings.difficulty, 'hard');
    assert.equal(settings.autoSave, false);
    assert.equal(settings.autoSaveInterval, 60);
    assert.equal(settings.reducedMotion, true);
    assert.equal(settings.screenShake, false);

    await cdp.evaluate('GameAPI.backFromSettings(); GameAPI.newGameSlot(1)');
    const classScreen = await cdp.evaluate("document.getElementById('classes-grid')?.innerHTML || ''");
    const classCount = await cdp.evaluate("document.querySelectorAll('#classes-grid .class-card').length");
    assert.equal(classCount, 3, viewport.name + ': class selection must show exactly three classes');
    assert.ok(['Воин','Маг','Лучник'].every(name => classScreen.includes(name)) && !/Жрец|Priest/i.test(classScreen), viewport.name + ': invalid class list');
    if (viewport.name === 'desktop') await capture('02-class-selection-desktop');
    await cdp.evaluate("GameAPI.selectClass('mage'); GameAPI.selectClass('archer'); GameAPI.selectClass('warrior'); document.getElementById('char-name').value = 'Browser Test'; GameAPI.confirmClassSelection()");
    for (let i = 0; i < 40; i++) {
      if (await cdp.evaluate("document.querySelector('#screen-game.active') !== null")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await cdp.evaluate("document.querySelector('#screen-game.active') !== null"), true, viewport.name + ': character creation failed');
    if (viewport.name === 'desktop') {
      const worldState = await cdp.evaluate("(() => ({canvas:!!document.getElementById('overworld-canvas'), canvasSize:[document.getElementById('overworld-canvas')?.width||0,document.getElementById('overworld-canvas')?.height||0], visible:!!document.getElementById('overworld-canvas')?.getBoundingClientRect().width, location:document.getElementById('tab-content')?.innerText?.slice(0,240)||''}))()");
      assert.ok(worldState.canvas && worldState.canvasSize[0] > 0 && worldState.canvasSize[1] > 0, 'desktop: overworld canvas missing after new game');
      await capture('03-gameplay-desktop');
      await cdp.evaluate("GameAPI.switchTab('locations')");
      const mapLabels = await cdp.evaluate("(() => { const labels=[...document.querySelectorAll('.world-map .wnode-name')].filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect()); let overlaps=0; for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++) if(labels[i].left<labels[j].right && labels[i].right>labels[j].left && labels[i].top<labels[j].bottom && labels[i].bottom>labels[j].top) overlaps++; return {visible:labels.length,overlaps}; })()");
      assert.ok(mapLabels.visible <= 2 && mapLabels.overlaps === 0, 'desktop: world-map labels overlap ' + JSON.stringify(mapLabels));
      await capture('04-world-map-desktop');
      await cdp.evaluate('GameAPI.enterOverworld()');
      await new Promise(resolve => setTimeout(resolve, 350));
      const overworldView = await cdp.evaluate("(() => { const c=document.getElementById('overworld-canvas'); const r=c?.getBoundingClientRect(); return {active:document.querySelector('#screen-overworld.active')!==null, canvas:!!c, width:c?.width||0, height:c?.height||0, visible:!!r&&r.width>0&&r.height>0, title:document.querySelector('#screen-overworld h2')?.textContent||''}; })()");
      assert.ok(overworldView.active && overworldView.canvas && overworldView.width >= 320 && overworldView.height >= 240 && overworldView.visible, 'desktop: playable 2D overworld scene did not render ' + JSON.stringify(overworldView));
      await capture('05-overworld-scene-desktop');
      await cdp.evaluate("GameAPI.interactNpc('blacksmith')");
      const interiorButton = await cdp.evaluate("document.getElementById('npc-dialog-content')?.innerHTML.includes('Войти внутрь')");
      assert.equal(interiorButton, true, 'desktop: forge entrance button missing');
      await cdp.evaluate("GameAPI.enterVillageInterior('forge')");
      const interiorView = await cdp.evaluate("(() => { const m=document.getElementById('npc-dialog-modal'); const r=m?.getBoundingClientRect(); return {display:m?getComputedStyle(m).display:'missing', visible:!!r&&r.width>0&&r.height>0, title:document.getElementById('npc-dialog-content')?.innerText||'', scene:!!document.querySelector('.village-room-art.room-forge')}; })()");
      assert.ok(interiorView.scene && interiorView.title.includes('Кузница Борина') && interiorView.display === 'flex' && interiorView.visible, 'desktop: forge interior scene did not render ' + JSON.stringify(interiorView));
      await new Promise(resolve => setTimeout(resolve, 160));
      await capture('11-village-forge-interior-desktop');
      await cdp.evaluate('GameAPI.exitVillageInterior(); GameAPI.closeNpcAndResume()');
      await new Promise(resolve => setTimeout(resolve, 180));
      await cdp.evaluate('GameAPI.exitOverworld()');
      await new Promise(resolve => setTimeout(resolve, 120));
      assert.equal(await cdp.evaluate("document.querySelector('#screen-game.active') !== null"), true, 'desktop: leaving safe village overworld did not return to dashboard');
      const storyBiomes = ['briar-hollow','sunken-necropolis','obsidian-fields','frost-citadel','void-crater'];
      for (let index = 0; index < storyBiomes.length; index++) {
        const location = storyBiomes[index];
        await cdp.evaluate('GameAPI.mapTravel(' + JSON.stringify(location) + ')');
        await cdp.evaluate('GameAPI.enterOverworld()');
        await new Promise(resolve => setTimeout(resolve, 180));
        const biome = await cdp.evaluate("(() => { const c=document.getElementById('overworld-canvas'); const r=c?.getBoundingClientRect(); return {active:document.querySelector('#screen-overworld.active')!==null, width:c?.width||0, height:c?.height||0, visible:!!r&&r.width>0&&r.height>0}; })()");
        assert.ok(biome.active && biome.width >= 320 && biome.height >= 240 && biome.visible, 'desktop: 2D biome failed to render: ' + location + ' ' + JSON.stringify(biome));
        await capture('10-biome-' + String(index + 1).padStart(2,'0'));
        await cdp.evaluate('GameAPI.exitOverworld()');
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      await cdp.evaluate("GameAPI.mapTravel('village')");
    } else {
      await cdp.evaluate('GameAPI.enterOverworld()');
      await new Promise(resolve => setTimeout(resolve, 250));
      const mobileWorld = await cdp.evaluate("(() => { const c=document.getElementById('overworld-canvas'); const r=c?.getBoundingClientRect(); return {active:document.querySelector('#screen-overworld.active')!==null, width:c?.width||0, height:c?.height||0, visible:!!r&&r.width>0&&r.height>0}; })()");
      assert.ok(mobileWorld.active && mobileWorld.width >= 320 && mobileWorld.height >= 240 && mobileWorld.visible, viewport.name + ': mobile overworld canvas missing ' + JSON.stringify(mobileWorld));
      await cdp.evaluate("GameAPI.interactNpc('blacksmith'); GameAPI.enterVillageInterior('forge')");
      const mobileInterior = await cdp.evaluate("(() => { const c=document.getElementById('npc-dialog-content'); const m=document.querySelector('.npc-modal-content'); return {scene:!!document.querySelector('.village-room-art.room-forge'), width:document.documentElement.scrollWidth, viewport:innerWidth, content:c?.scrollWidth||0, client:c?.clientWidth||0, modal:m?.getBoundingClientRect().width||0, children:[...(c?.children||[])].map(e=>({class:e.className,scroll:e.scrollWidth,client:e.clientWidth,rect:e.getBoundingClientRect().width})), room:document.querySelector('.village-room-art')?.getBoundingClientRect().width||0}; })()");
      assert.ok(mobileInterior.scene && mobileInterior.width <= mobileInterior.viewport + 1 && mobileInterior.modal <= mobileInterior.viewport && await cdp.evaluate("getComputedStyle(document.getElementById('npc-dialog-content')).overflowX === 'hidden'"), viewport.name + ': forge interior overflows mobile viewport ' + JSON.stringify(mobileInterior));
      await cdp.evaluate('GameAPI.exitVillageInterior(); GameAPI.closeNpcAndResume()');
      await new Promise(resolve => setTimeout(resolve, 180));
      await cdp.evaluate('GameAPI.exitOverworld()');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await cdp.evaluate("document.querySelector('#screen-game.active') !== null"), true, viewport.name + ': mobile safe village exit failed');
    }
    await cdp.evaluate("GameAPI.switchTab('inventory')");
    const inventory = await cdp.evaluate("document.getElementById('tab-content').innerHTML");
    assert.ok(inventory.includes('rpg-inventory-layout') && (inventory.match(/class="gear-slot /g) || []).length === 12 &&
      (inventory.match(/class="inv-slot/g) || []).length === 30, viewport.name + ': inventory layout missing slots');
    if (viewport.name !== 'small-mobile') await capture('03-inventory-' + viewport.name);
    await cdp.evaluate('GameAPI.openSaleUI()');
    const sale = await cdp.evaluate("document.getElementById('inventory-sale-overlay')?.innerHTML || ''");
    assert.ok(sale.includes('Продажа предметов') && sale.includes('Продать выбранное'), viewport.name + ': sale dialog did not render');
    const saleMetrics = await cdp.evaluate("(() => { const e=document.querySelector('.sale-dialog'); const r=e?.getBoundingClientRect(); const list=document.querySelector('.sale-item-list'); const item=list?.firstElementChild; const ir=item?.getBoundingClientRect(); return {width:r?.width||0, right:r?.right||0, viewport:innerWidth, listWidth:list?.clientWidth||0, listScrollWidth:list?.scrollWidth||0, itemWidth:ir?.width||0, itemScroll:item?.scrollWidth||0, itemBox:getComputedStyle(item).boxSizing, itemMin:getComputedStyle(item).minWidth, listDisplay:getComputedStyle(list).gridTemplateColumns}; })()");
    assert.ok(saleMetrics.width > 0 && saleMetrics.right <= saleMetrics.viewport + 1 && saleMetrics.itemWidth <= saleMetrics.listWidth + 1 && await cdp.evaluate("getComputedStyle(document.querySelector('.sale-item-list')).overflowX === 'hidden'"), viewport.name + ': sale dialog/list overflows ' + JSON.stringify(saleMetrics));
    if (viewport.name === 'desktop') await capture('04-sale-desktop');
    await cdp.evaluate('GameAPI.cancelSale(); GameAPI.openShop()');
    const shop = await cdp.evaluate("document.getElementById('tab-content').innerHTML");
    assert.ok(shop.includes('Дешёвое') && shop.includes('Материалы крафта') && shop.includes('Редкое'), viewport.name + ': shop presets missing');
    if (viewport.name === 'desktop') await capture('05-shop-desktop');
    await cdp.evaluate('GameAPI.openBlacksmith()');
    const blacksmith = await cdp.evaluate("document.getElementById('tab-content').innerHTML");
    assert.ok(blacksmith.includes('Экипировка'), viewport.name + ': blacksmith equipment panel did not render');
    if (viewport.name === 'desktop') await capture('06-blacksmith-desktop');

    await cdp.evaluate("GameAPI.switchTab('talents')");
    const passiveMetrics = await cdp.evaluate("(() => ({nodes:document.querySelectorAll('#passive-tree-world .passive-node').length, viewport:!!document.querySelector('.passive-tree-viewport'), world:!!document.getElementById('passive-tree-world')}))()");
    assert.equal(passiveMetrics.nodes, 31, viewport.name + ': passive tree must render 31 nodes');
    assert.ok(passiveMetrics.viewport && passiveMetrics.world, viewport.name + ': draggable passive tree viewport missing');
    const panResult = await cdp.evaluate(`(() => {
      const viewport=document.querySelector('.passive-tree-viewport'); const world=document.getElementById('passive-tree-world');
      viewport.setPointerCapture=()=>{}; viewport.releasePointerCapture=()=>{};
      const before=world.style.transform; const base={bubbles:true,pointerId:77,pointerType:'mouse',isPrimary:true,button:0};
      viewport.dispatchEvent(new PointerEvent('pointerdown',{...base,clientX:40,clientY:40}));
      viewport.dispatchEvent(new PointerEvent('pointermove',{...base,clientX:100,clientY:85}));
      viewport.dispatchEvent(new PointerEvent('pointerup',{...base,clientX:100,clientY:85}));
      return {before,after:world.style.transform};
    })()`);
    assert.notEqual(panResult.after, panResult.before, viewport.name + ': passive tree drag did not pan the field');
    if (viewport.name === 'desktop') await capture('07-passive-tree-desktop');

    await cdp.evaluate('GameAPI.enterTower()');
    const towerMetrics = await cdp.evaluate("(() => ({floors:document.querySelectorAll('#tower-map-overlay div[style*=\\\"padding:12px 8px\\\"]').length, guardians:(document.getElementById('tower-map-overlay')?.innerText.match(/СТРАЖ/g)||[]).length}))()");
    assert.equal(towerMetrics.floors, 40, viewport.name + ': Tower must render 40 floors');
    assert.equal(towerMetrics.guardians, 8, viewport.name + ': Tower must render eight guardian floors');
    if (viewport.name === 'desktop') await capture('08-tower-desktop');
    await cdp.evaluate("document.querySelector('[data-tower-close]')?.click(); GameAPI.enterRift()");
    assert.equal(await cdp.evaluate("!!document.getElementById('rift-map-overlay')"), false, viewport.name + ': Rift opened before the three dragons');

    await cdp.evaluate(`(() => {
      const key='magic-rpg-save-1'; const save=JSON.parse(localStorage.getItem(key));
      save.storyDragons={'ash-herald':true,'ice-grasp':true,'blood-crown':true};
      save.storyShards={flame:true,ice:true,blood:true}; save.riftEnding=null;
      save.player.level=50; save.player.victoryAchieved=true; save.player.riftClearedLocations=['rift-01'];
      save.player.stats={kills:{wolf:5},deaths:1,goldEarned:0,chestsOpened:0};
      localStorage.setItem(key,JSON.stringify(save)); GameAPI.loadSlot(1);
    })()`);
    await cdp.evaluate('GameAPI.enterRift()');
    const riftMetrics = await cdp.evaluate("(() => ({areas:document.querySelectorAll('#rift-map-overlay [data-rift-id]').length, disabled:document.querySelectorAll('#rift-map-overlay [data-rift-id]:disabled').length, shards:document.getElementById('rift-map-overlay')?.innerText.includes('3/3'), stable:document.getElementById('rift-map-overlay')?.innerText.includes('Стабилизирован')}))()");
    assert.equal(riftMetrics.areas, 30, viewport.name + ': Rift map must show 30 areas');
    assert.equal(riftMetrics.disabled, 0, viewport.name + ': level 50 should unlock all Rift areas');
    assert.ok(riftMetrics.shards && riftMetrics.stable, viewport.name + ': Rift crystal status incorrect');
    if (viewport.name === 'desktop') await capture('09-rift-map-desktop');
    await cdp.evaluate("document.querySelector('[data-rift-close]')?.click(); GameAPI.showScreen('screen-victory'); GameAPI.chooseRiftEnding('closed')");
    const closedStatus = await cdp.evaluate("document.getElementById('ending-choice-status')?.textContent || ''");
    assert.ok(closedStatus.includes('навсегда'), viewport.name + ': closed ending status missing');
    await cdp.evaluate('GameAPI.enterRift()');
    assert.equal(await cdp.evaluate("!!document.getElementById('rift-map-overlay')"), false, viewport.name + ': permanently sealed Rift should remain closed');
    await cdp.evaluate("GameAPI.chooseRiftEnding('open'); GameAPI.enterRift()");
    assert.equal(await cdp.evaluate("document.querySelectorAll('#rift-map-overlay [data-rift-id]').length"), 30, viewport.name + ': open ending should restore Rift access');
    await cdp.evaluate("document.querySelector('[data-rift-close]')?.click()");
    await cdp.evaluate("GameAPI.showScreen('screen-game'); GameAPI.travelTo('forest'); GameAPI.enterOverworld()");
    await new Promise(resolve => setTimeout(resolve, 450));
    const worldMetrics = await cdp.evaluate("(() => { const c=document.getElementById('overworld-canvas'); const r=c?.getBoundingClientRect(); return {active:document.querySelector('#screen-overworld.active')!==null, width:r?.width||0, height:r?.height||0, title:document.getElementById('overworld-title')?.textContent||''}; })()");
    assert.ok(worldMetrics.active && worldMetrics.width > 0 && worldMetrics.height > 0 && worldMetrics.title.length > 0, viewport.name + ': 2D overworld scene did not render ' + JSON.stringify(worldMetrics));
    if (viewport.name === 'desktop') {
      await new Promise(resolve => setTimeout(resolve, 2600));
      await capture('10-forest-gameplay-desktop');
    }
    await cdp.evaluate('GameAPI.exitOverworld()');
    assert.equal(await cdp.evaluate("document.querySelector('#screen-game.active') !== null"), true, viewport.name + ': exiting overworld did not return to dashboard');
    assert.deepEqual(pageErrors, [], viewport.name + ': browser exceptions: ' + pageErrors.join('; '));
    console.log('PASS ' + viewport.name + ' (' + viewport.width + 'x' + viewport.height + '): classes, settings, inventory, sale, shop, forge, talent drag, Tower 40, Rift 30, endings, 2D overworld, no overflow/errors');
  }
  console.log('Browser smoke checks passed (3 viewports, native Chrome DevTools Protocol).');
} finally {
  if (cdp) cdp.close();
  chrome.kill();
  server.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
