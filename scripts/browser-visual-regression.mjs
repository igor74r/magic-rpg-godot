import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const output = 'test-artifacts/visual-regression';
await mkdir(output, { recursive: true });
const server = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
let browser;
async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { const response = await fetch(baseUrl); await response.arrayBuffer(); if (response.ok) return; } catch {}
    await delay(250);
  }
  throw new Error('Visual test server did not start');
}
async function capture(page, name) {
  const target = `${output}/${name}.png`;
  await page.screenshot({ path: target, fullPage: false, animations: 'disabled' });
  const size = (await (await import('node:fs/promises')).stat(target)).size;
  assert.ok(size > 5000, `${name}: screenshot appears empty (${size} bytes)`);
  return target;
}
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  // Render every Aurora building in isolation as a dedicated visual QA sheet.
  // This covers facades that are outside the initial gameplay camera viewport.
  {
    const artPage = await browser.newPage({ viewport: { width: 1440, height: 680 }, deviceScaleFactor: 1 });
    await artPage.goto(baseUrl, { waitUntil:'domcontentloaded' });
    const artCheck = await artPage.evaluate(async () => {
      const { drawAuroraBuilding } = await import('/ui/overworld/aurora-art.js');
      const designs = [
        ['hall','hall'],['forge','forge'],['healer','healer'],['alchemy','alchemy'],
        ['market','market'],['tavern','tavern'],['home-nw','home'],['home-se','home']
      ];
      const canvas = document.createElement('canvas');
      canvas.width = 1360; canvas.height = 640;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#263b32'; ctx.fillRect(0,0,canvas.width,canvas.height);
      designs.forEach(([variant,style],index) => {
        const col = index % 4, row = Math.floor(index / 4);
        const x = col * 340 + 170, y = row * 300 + 280;
        if (!drawAuroraBuilding(ctx,x,y,style,variant)) throw new Error(variant + ': renderer returned false');
        ctx.fillStyle = '#f0dfb8'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center'; ctx.fillText(variant.toUpperCase(),x,y+35);
      });
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let colored = 0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i]!==38 || pixels[i+1]!==59 || pixels[i+2]!==50) colored++;
      if(colored < 50000) throw new Error('Aurora building sheet appears incomplete: '+colored);
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#17251f;display:grid;place-items:center;min-height:100vh';
      document.body.appendChild(canvas);
      return { designs, coloredPixels: colored, width: canvas.width, height: canvas.height };
    });
    assert.equal(artCheck.designs.length,8,'all seven building types and both residential facades must render');
    assert.ok(artCheck.coloredPixels>50000,'building art sheet must contain substantial rendered detail');
    await capture(artPage,'aurora-00-building-art-sheet');
    await artPage.close();
  }

  // Render all eight nature atlas frames through the production sprite dispatcher.
  {
    const naturePage = await browser.newPage({ viewport: { width: 1440, height: 520 }, deviceScaleFactor: 1 });
    await naturePage.goto(baseUrl, { waitUntil:'domcontentloaded' });
    const natureCheck = await naturePage.evaluate(async () => {
      const { drawObject, preloadAuroraNatureAtlas } = await import('/ui/overworld/sprites.js');
      const styles = ['oak','pine','bush','rock','stump','hedge','fence','flowerbed'];
      if (!await preloadAuroraNatureAtlas()) throw new Error('Aurora nature atlas failed to preload');
      const canvas = document.createElement('canvas');
      canvas.width = 1360; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#263b32'; ctx.fillRect(0,0,canvas.width,canvas.height);
      styles.forEach((style,index) => {
        const col = index % 4, row = Math.floor(index / 4);
        const x = col * 340 + 170, y = row * 220 + 155;
        drawObject(ctx, { id: 'nature-' + style, natureStyle: style }, x, y, '#1e2928');
        ctx.fillStyle = '#f0dfb8'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center'; ctx.fillText(style.toUpperCase(),x, y + 54);
      });
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let colored = 0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i]!==38 || pixels[i+1]!==59 || pixels[i+2]!==50) colored++;
      if(colored < 12000) throw new Error('Aurora nature sheet appears incomplete: '+colored);
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#17251f;display:grid;place-items:center;min-height:100vh';
      document.body.appendChild(canvas);
      return { styles, coloredPixels: colored, width: canvas.width, height: canvas.height };
    });
    assert.equal(natureCheck.styles.length,8,'all eight Aurora nature styles must render');
    assert.ok(natureCheck.coloredPixels>12000,'nature art sheet must contain substantial pixel detail');
    await capture(naturePage,'aurora-01-nature-art-sheet');
    await naturePage.close();
  }

  // Render every Aurora resident and special village NPC through the production dispatcher.
  {
    const npcPage = await browser.newPage({ viewport: { width: 1440, height: 720 }, deviceScaleFactor: 1 });
    await npcPage.goto(baseUrl, { waitUntil:'domcontentloaded' });
    const npcCheck = await npcPage.evaluate(async () => {
      const { drawObject } = await import('/ui/overworld/sprites.js');
      const roles = ['blacksmith','healer','alchemist','merchant','elder','well','bard','guard','cat','kids','herald','questBoard'];
      const canvas = document.createElement('canvas');
      canvas.width = 1360; canvas.height = 680;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#263b32'; ctx.fillRect(0,0,canvas.width,canvas.height);
      roles.forEach((id,index) => {
        const col = index % 4, row = Math.floor(index / 4);
        const x = col * 340 + 170, y = row * 220 + 145;
        drawObject(ctx, { id }, x, y, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = '#f0dfb8'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center'; ctx.fillText(id.toUpperCase(),x,y+58);
      });
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let colored = 0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i]!==38 || pixels[i+1]!==59 || pixels[i+2]!==50) colored++;
      if(colored < 9000) throw new Error('Aurora NPC sheet appears incomplete: '+colored);
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#17251f;display:grid;place-items:center;min-height:100vh';
      document.body.appendChild(canvas);
      return { roles, coloredPixels: colored, width: canvas.width, height: canvas.height };
    });
    assert.equal(npcCheck.roles.length,12,'all Aurora residents and special NPCs must render');
    assert.ok(npcCheck.coloredPixels>9000,'NPC art sheet must contain substantial pixel detail');
    await capture(npcPage,'aurora-02-npc-art-sheet');
    await npcPage.close();
  }

  for (const vp of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Capture the first-visit prologue separately from returning-player menu flow.
    const prologuePage = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const prologueErrors = [];
    prologuePage.on('pageerror', e => prologueErrors.push(e.message));
    await prologuePage.goto(baseUrl, { waitUntil:'networkidle' });
    await prologuePage.locator('#screen-prologue.active').waitFor();
    assert.ok(await prologuePage.locator('#screen-prologue .prologue-cinematic').isVisible(),
      `${vp.name}: cinematic prologue shell must be visible`);
    await capture(prologuePage, `${vp.name}-00-prologue`);
    assert.deepEqual(prologueErrors, [], `${vp.name}: prologue runtime errors: ${prologueErrors.join('; ')}`);
    await prologuePage.close();

    await page.addInitScript(() => localStorage.setItem('magic-rpg-prologue-seen','1'));
    await page.goto(baseUrl, { waitUntil:'networkidle' });
    await page.locator('#screen-main.active').waitFor();
    assert.equal(await page.locator('#screen-main .slot-card').count(), 3,
      `${vp.name}: all save slots must render in main menu`);
    assert.ok(await page.locator('.menu-story-panel').isVisible(),
      `${vp.name}: story panel must render in main menu`);
    const saveHeading = await page.locator('#screen-main .slots-heading').evaluate(node => {
      const title = node.querySelector('h2');
      const count = node.querySelector('span');
      const a = title.getBoundingClientRect();
      const b = count.getBoundingClientRect();
      return { titleRight: a.right, countLeft: b.left, titleHeight: a.height,
        titleScroll: title.scrollWidth, titleClient: title.clientWidth,
        lineHeight: parseFloat(getComputedStyle(title).lineHeight) };
    });
    assert.ok(saveHeading.titleRight <= saveHeading.countLeft + 1,
      `${vp.name}: save title and slot count must not overlap: ${JSON.stringify(saveHeading)}`);
    assert.ok(saveHeading.titleHeight <= saveHeading.lineHeight + 2,
      `${vp.name}: save title must stay on one line: ${JSON.stringify(saveHeading)}`);
    assert.ok(saveHeading.titleScroll <= saveHeading.titleClient + 1,
      `${vp.name}: save title must not clip: ${JSON.stringify(saveHeading)}`);
    const menuLayout = await page.locator('#screen-main .slots-area').evaluate(area => {
      const heading = area.querySelector('.slots-heading');
      const title = heading.querySelector('h2').getBoundingClientRect();
      const count = heading.querySelector('span').getBoundingClientRect();
      const grid = area.querySelector('.slots-grid').getBoundingClientRect();
      const firstCard = area.querySelector('.slot-card').getBoundingClientRect();
      return {
        area: area.getBoundingClientRect().toJSON(),
        title: title.toJSON(),
        count: count.toJSON(),
        grid: grid.toJSON(),
        firstCard: firstCard.toJSON(),
        scrollWidth: area.scrollWidth,
        clientWidth: area.clientWidth
      };
    });
    assert.ok(menuLayout.grid.width >= menuLayout.clientWidth * .9,
      `${vp.name}: save cards must use the full panel width: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.firstCard.width >= menuLayout.grid.width - 1,
      `${vp.name}: each save slot must fill its own row: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.title.right < menuLayout.count.left,
      `${vp.name}: save heading and slot count must not overlap: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.scrollWidth <= menuLayout.clientWidth + 1,
      `${vp.name}: save panel must not overflow horizontally: ${JSON.stringify(menuLayout)}`);
    await capture(page, `${vp.name}-00-main-menu`);
    await page.locator('.slot-new').first().click();
    await page.locator('#screen-char.active').waitFor();
    assert.equal(await page.locator('[data-character-step="selection"]').getAttribute('aria-current'),'step',
      `${vp.name}: character selection step must be active`);
    await capture(page, `${vp.name}-00-character-selection`);
    await page.locator('.class-card[data-class-id="mage"]').click();
    await page.locator('#char-name').fill('Visual QA');
    await page.getByRole('button',{name:/Проверить героя/}).click();
    assert.equal(await page.locator('[data-character-step="review"]').getAttribute('aria-current'),'step',
      `${vp.name}: character review step must be active`);
    await capture(page, `${vp.name}-00-character-review`);
    await page.getByRole('button',{name:/Создать героя и начать/}).click();
    await page.locator('#screen-game.active').waitFor();
    await page.locator('#overworld-canvas').waitFor({state:'visible'});
    assert.equal(await page.locator('.dashboard-context-actions button').count(),1,
      `${vp.name}: context block must retain portal shortcut only; obsolete journal shortcut is gone`);
    assert.equal(await page.locator('.dashboard-context-actions button').innerText(), '🌀 Портал миров',
      `${vp.name}: portal shortcut must remain`);
    await capture(page, `${vp.name}-01-gameplay`);
    // Move northwest from the plaza so the real in-world QA frame includes
    // residential and craft courtyards, not only the initial portal viewport.
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(2800);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(350);
    await capture(page, `${vp.name}-01-aurora-courtyards`);
    // A second short approach frames the northern residential frontage and
    // checks that the camera keeps nearby building silhouettes readable.
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1100);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(350);
    await capture(page, `${vp.name}-01-aurora-north-yard`);
    // Village interiors were removed; keep visual regression focused on exterior village navigation.
    assert.equal(await page.locator('#dashboard-context .dashboard-context-actions button').count(),1,
      `${vp.name}: mission guide must expose one primary portal action`);
    if(vp.width>1050) {
      assert.ok(await page.locator('#game-log-search').isVisible(),
        `${vp.name}: desktop event journal search must be visible`);
      assert.equal(await page.locator('[data-log-filter]').count(),4,
        `${vp.name}: event journal must retain all four filters`);
      assert.ok(await page.locator('#dashboard-context .context-progress').count()>0,
        `${vp.name}: current mission progress must be visible`);
    }

    for (const tab of ['hero','inventory','locations']) {
      const trigger=page.locator(`#game-tab-${tab}`);
      if (tab==='locations') {
        await page.evaluate(() => window.GameAPI.openWorldPortalMenu());
        await page.locator('#aurora-world-portal').waitFor({state:'visible'});
        assert.ok(await page.locator('#aurora-world-portal .portal-map-stage').isVisible(),
          `${vp.name}: portal must show the large interactive world map`);
        const destinations=page.locator('#aurora-world-portal [data-portal-node]');
        assert.ok(await destinations.count()>0,`${vp.name}: world atlas must show interactive destination points`);
        assert.ok(await page.locator('#aurora-world-portal #portal-destination h2').isVisible(),
          `${vp.name}: atlas must show selected destination details`);
        assert.equal(await page.locator('#aurora-world-portal [data-portal-travel]').count(),1,
          `${vp.name}: atlas must expose a single travel action`);
        await capture(page, `${vp.name}-04-world-atlas`);
        await page.locator('#aurora-world-portal [data-world-close]').click();
      } else {
        await trigger.click();
        await page.locator('#dashboard-tab-modal').waitFor({state:'visible'});
        const title=await page.locator('#dashboard-tab-modal h2, #dashboard-tab-modal [role="heading"]').first().innerText().catch(()=>tab);
        assert.ok(title.length>0,`${vp.name}/${tab}: modal title must be rendered`);
        const modalScroll=await page.locator('#dashboard-tab-modal .dashboard-tab-dialog-body').evaluate(node=>({
          overflowY:getComputedStyle(node).overflowY,
          clientWidth:node.clientWidth,
          scrollWidth:node.scrollWidth
        }));
        assert.equal(modalScroll.overflowY,'auto',`${vp.name}/${tab}: dialog content must scroll independently`);
        assert.ok(modalScroll.scrollWidth<=modalScroll.clientWidth+1,
          `${vp.name}/${tab}: dialog content must not overflow horizontally: ${JSON.stringify(modalScroll)}`);
        if(tab==='hero') assert.ok(await page.locator('#dashboard-tab-modal .hero-overview').count()>0,`${vp.name}: hero view missing`);
        if(tab==='hero') {
          assert.equal(await page.locator('#dashboard-tab-modal .hero-overview-left .hero-vital').count(),3,
            `${vp.name}: hero profile must show three resource cards`);
          assert.equal(await page.locator('#dashboard-tab-modal .hero-stat-grid .hero-stat').count(),10,
            `${vp.name}: hero profile must retain all ten attributes`);
          assert.equal(await page.locator('#dashboard-tab-modal .hero-progression-grid > div').count(),4,
            `${vp.name}: hero profile must retain four progression indicators`);
        }
        if(tab==='inventory') assert.ok(await page.locator('#dashboard-tab-modal [data-inv-filter]').count()>0,`${vp.name}: inventory controls missing`);
        if(tab==='inventory') {
          assert.ok(await page.locator('#dashboard-tab-modal .rpg-paperdoll .gear-slot').count()>0,
            `${vp.name}: equipment paperdoll must show gear slots`);
          assert.ok(await page.locator('#dashboard-tab-modal .rpg-backpack .inv-search-wrap').count()>0,
            `${vp.name}: backpack must retain item search`);
          const inventoryColumns=await page.locator('#dashboard-tab-modal .rpg-inv-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
          assert.ok(inventoryColumns>=4,`${vp.name}: inventory grid must keep at least four visible columns`);
        }
        await capture(page,`${vp.name}-0${tab==='hero'?2:3}-${tab}`);
        await page.locator('#dashboard-tab-modal [data-dashboard-modal-close]').click();
        await page.locator('#overworld-canvas').waitFor({state:'visible'});
        assert.equal(await page.locator('#dashboard-tab-modal').count(),0,
          `${vp.name}/${tab}: closing tab must remove only the overlay`);
        assert.equal(await page.locator('#screen-overworld').isVisible(),true,
          `${vp.name}/${tab}: playable village scene must remain visible behind tabs`);
        assert.equal(await page.locator('#screen-game').evaluate(el=>el.inert),false,
          `${vp.name}/${tab}: gameplay must be interactive again after closing modal`);
      }
    }
    for (const tab of ['quests','spells','talents']) {
      await page.locator(`#game-tab-${tab}`).click();
      await page.locator('#dashboard-tab-modal').waitFor({state:'visible'});
      if(tab==='quests') assert.ok(await page.locator('#dashboard-tab-modal .campaign-act').count()>0,
        `${vp.name}: quest journal must render campaign acts`);
      if(tab==='spells') assert.ok(await page.locator('#dashboard-tab-modal .ability-item').count()>0,
        `${vp.name}: magic section must render class abilities`);
      if(tab==='talents') {
        assert.ok(await page.locator('#dashboard-tab-modal .passive-tree-viewport').count()>0,
          `${vp.name}: talent section must render the interactive tree`);
        assert.ok(await page.locator('#dashboard-tab-modal .passive-node').count()>0,
          `${vp.name}: talent tree must render its skill nodes`);
      }
      await capture(page,`${vp.name}-06-${tab}`);
      await page.locator('#dashboard-tab-modal [data-dashboard-modal-close]').click();
      await page.locator('#overworld-canvas').waitFor({state:'visible'});
      assert.equal(await page.locator('#screen-game').evaluate(el=>el.inert),false,
        `${vp.name}/${tab}: closing section must restore gameplay interactivity`);
    }
    assert.deepEqual(errors,[], `${vp.name}: browser runtime errors: ${errors.join('; ')}`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
