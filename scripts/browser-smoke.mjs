import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  stdio: 'ignore'
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(baseUrl);
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Static game server did not start');
}

async function clickCanvasPoint(page, xRatio, yRatio) {
  const canvas = page.locator('#overworld-canvas');
  const bounds = await canvas.boundingBox();
  assert.ok(bounds, 'overworld canvas must be visible before portal click');
  await page.mouse.click(bounds.x + bounds.width * xRatio, bounds.y + bounds.height * yRatio);
}

async function checkViewport(page, label) {
  const metrics = await page.evaluate(() => {
    const settings = document.getElementById('screen-settings');
    const content = document.getElementById('settings-content');
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      settingsWidth: settings?.getBoundingClientRect().width ?? 0,
      settingsScrollWidth: settings?.scrollWidth ?? 0,
      contentWidth: content?.getBoundingClientRect().width ?? 0,
      contentScrollWidth: content?.scrollWidth ?? 0
    };
  });
  assert.ok(metrics.documentWidth <= metrics.viewport + 1, `${label}: document overflows horizontally: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.bodyWidth <= metrics.viewport + 1, `${label}: body overflows horizontally: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.settingsScrollWidth <= metrics.settingsWidth + 1, `${label}: settings screen overflows: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.contentScrollWidth <= metrics.contentWidth + 1, `${label}: settings content overflows: ${JSON.stringify(metrics)}`);
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 740 }
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.name !== 'desktop',
      hasTouch: viewport.name !== 'desktop'
    });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('magic-rpg-prologue-seen', '1'));
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    assert.equal(await page.locator('#screen-main.active').count(), 1, `${viewport.name}: main menu did not open`);
    assert.equal(await page.locator('.menu-story-panel').isVisible(), true, `${viewport.name}: main menu story panel must be visible`);
    assert.equal(await page.locator('.menu-primary-action').isVisible(), true, `${viewport.name}: primary new-adventure action must be visible`);
    assert.equal(await page.locator('#screen-main .slot-card').count(), 3, `${viewport.name}: all three save slots must remain visible`);
    const menuLayout = await page.evaluate(() => {
      const root = document.querySelector('#screen-main .main-menu');
      const heading = document.querySelector('#screen-main .slots-heading h2');
      const count = document.querySelector('#screen-main .slots-heading span');
      const slots = document.querySelector('#screen-main .slots-grid');
      const a = heading?.getBoundingClientRect();
      const b = count?.getBoundingClientRect();
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        rootWidth: root?.getBoundingClientRect().width ?? 0,
        headingWidth: heading?.scrollWidth ?? 0,
        headingClientWidth: heading?.clientWidth ?? 0,
        headingRight: a?.right ?? 0,
        countLeft: b?.left ?? 0,
        slotsWidth: slots?.getBoundingClientRect().width ?? 0,
        slotWidth: slots?.firstElementChild?.getBoundingClientRect().width ?? 0
      };
    });
    assert.ok(menuLayout.documentWidth <= menuLayout.viewport + 1,
      `${viewport.name}: main menu must not overflow horizontally: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.headingWidth <= menuLayout.headingClientWidth + 1,
      `${viewport.name}: save heading must not wrap or clip: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.headingRight <= menuLayout.countLeft + 1,
      `${viewport.name}: save heading and slot count must not overlap: ${JSON.stringify(menuLayout)}`);
    assert.ok(menuLayout.slotWidth > 0 && menuLayout.slotsWidth > 0,
      `${viewport.name}: save slots must have measurable layout`);
    await page.getByRole('button', { name: /Настройки/ }).click();
    assert.equal(await page.locator('#screen-settings.active').count(), 1, `${viewport.name}: settings screen did not open`);

    await page.locator('[data-tab="sound"]').click({ force: true });
    await page.locator('#set-music-volume').waitFor();
    assert.equal(await page.getByLabel('🎵 Музыка').count(), 1, `${viewport.name}: music slider must have an accessible label`);
    assert.equal(await page.getByLabel('🔊 Эффекты').count(), 1, `${viewport.name}: effects slider must have an accessible label`);
    await checkViewport(page, `${viewport.name}/sound`);

    await page.locator('[data-tab="game"]').click({ force: true });
    await page.locator('#set-difficulty').waitFor();
    await page.locator('#set-difficulty').selectOption('hard');
    await page.locator('#set-autosave').selectOption('off');
    await page.locator('#set-autosave-interval').selectOption('60');
    await checkViewport(page, `${viewport.name}/game`);

    await page.locator('[data-tab="accessibility"]').click({ force: true });
    await page.locator('#set-reduced-motion').waitFor();
    await page.locator('#set-reduced-motion').selectOption('on');
    await page.locator('#set-screen-shake').selectOption('off');
    await checkViewport(page, `${viewport.name}/accessibility`);

    await page.locator('[data-tab="data"]').click({ force: true });
    await page.getByRole('button', { name: /Экспортировать сейв/ }).waitFor();
    await checkViewport(page, `${viewport.name}/data`);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('magic-rpg-settings')));
    assert.equal(stored.difficulty, 'hard', `${viewport.name}: difficulty was not saved`);
    assert.equal(stored.autoSave, false, `${viewport.name}: autosave toggle was not saved`);
    assert.equal(stored.autoSaveInterval, 60, `${viewport.name}: autosave interval was not saved`);
    assert.equal(stored.reducedMotion, true, `${viewport.name}: reduced motion was not saved`);
    assert.equal(stored.screenShake, false, `${viewport.name}: screen shake was not saved`);

    await page.locator('#screen-settings .settings-back-btn').click();
    await page.getByRole('button', { name: /Достижения/ }).click();
    await page.locator('#screen-achievements-menu.active').waitFor();
    await page.locator('#menu-achievements-content .achievement-list').waitFor();
    await page.locator('#screen-achievements-menu .settings-back-btn').click();
    await page.getByRole('button', { name: /Как играть/ }).click();
    await page.locator('#screen-help.active').waitFor();
    await page.getByRole('heading', { name: /Как играть/ }).waitFor();
    await page.locator('#screen-help .settings-back-btn').click();
    await page.locator('#screen-main.active').waitFor();
    await page.locator('.menu-primary-action').click();
    assert.equal(await page.locator('#screen-char.active').count(), 1, `${viewport.name}: primary action must open character creation`);
    assert.equal(await page.locator('[data-character-step="selection"]').getAttribute('aria-current'), 'step',
      `${viewport.name}: selection step must be active`);
    const warriorCard = page.locator('.class-card[data-class-id="warrior"]');
    await warriorCard.focus();
    await warriorCard.press('Space');
    assert.equal(await page.locator('.class-card[data-class-id="warrior"]').getAttribute('aria-pressed'), 'true',
      `${viewport.name}: keyboard class selection must update its pressed state`);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-class-id')), 'warrior',
      `${viewport.name}: keyboard class selection must preserve focus`);
    await page.locator('#char-name').fill('UI audit');
    await page.getByRole('button', { name: /Проверить героя/ }).click();
    await page.locator('#class-review-stage').waitFor();
    assert.equal(await page.locator('[data-character-step="review"]').getAttribute('aria-current'), 'step',
      `${viewport.name}: review step must become active`);
    assert.match(await page.locator('#class-review-content').innerText(), /UI audit/,
      `${viewport.name}: review screen must show the entered hero name`);
    assert.equal(await page.evaluate(() => localStorage.getItem('magic-rpg-save-2')), null,
      `${viewport.name}: reviewing must not create the save before final confirmation`);
    await page.getByRole('button', { name: /Создать героя и начать/ }).click();
    await page.locator('#screen-game.active').waitFor();
    await page.locator('#screen-game.overworld-active').waitFor();
    assert.equal(await page.locator('#game-tab-quests').getAttribute('aria-selected'), 'true',
      `${viewport.name}: the default quests tab must be selected on first game render`);
    assert.equal(await page.locator('#game-tab-quests').evaluate(el => el.tabIndex), 0,
      `${viewport.name}: the default tab must be keyboard reachable on first game render`);
    assert.equal(await page.locator('#tab-content').getAttribute('aria-labelledby'), 'game-tab-quests',
      `${viewport.name}: the legacy tab panel must be labelled by the selected default tab`);
    assert.equal(await page.locator('#screen-game').evaluate(el => el.classList.contains('map-focused')), false,
      `${viewport.name}: a newly created hero must enter the village scene, not the full-screen world map`);
    assert.equal(await page.locator('#game-tab-locations').isVisible(), false,
      `${viewport.name}: the redundant world-map sidebar entry must remain hidden`);
    await page.locator('#overworld-canvas').waitFor({ state: 'visible' });
    const dpadVisible = await page.locator('#mobile-dpad').isVisible();
    assert.equal(dpadVisible, viewport.name !== 'desktop',
      `${viewport.name}: on-screen movement pad must be hidden on desktop and available only on touch devices`);
    assert.equal(await page.locator('#dashboard-tab-modal').count(), 0,
      `${viewport.name}: dashboard section must not open automatically during gameplay`);
    assert.equal(await page.locator('#screen-game .dashboard-sidebar').isVisible(), true,
      `${viewport.name}: village scene must keep the left navigation visible`);
    assert.equal(await page.locator('#screen-game .dashboard-log').isVisible(), true,
      `${viewport.name}: village scene must keep the right journal visible`);
    assert.equal(await page.locator('#game-header').isVisible(), false,
      `${viewport.name}: duplicate centered hero header must stay removed`);
    assert.equal(await page.locator('#overworld-title').isVisible(), true,
      `${viewport.name}: location title must be visible above the world scene`);
    assert.equal(await page.locator('.overworld-toolbar').count(), 1,
      `${viewport.name}: opening screen must have exactly one location toolbar`);
    assert.equal(await page.locator('.overworld-toolbar .overworld-exit').count(), 0,
      `${viewport.name}: the in-world screen must not show the exit action that returns to the old portal map`);
    const toolbar = await page.locator('.overworld-toolbar').evaluate(node => {
      const title = node.querySelector('#overworld-title').getBoundingClientRect();
      return { titleRight: title.right, toolbarRight: node.getBoundingClientRect().right };
    });
    assert.ok(toolbar.titleRight <= toolbar.toolbarRight + 1,
      `${viewport.name}: location title must remain inside its toolbar: ${JSON.stringify(toolbar)}`);
    assert.equal(await page.locator('#overworld-canvas').isVisible(), true,
      `${viewport.name}: the overworld scene must remain visible below its title`);

    await page.evaluate(() => window.GameAPI.openWorldPortalMenu());
    await page.locator('#aurora-world-portal').waitFor();
    assert.equal(await page.locator('#aurora-world-portal .portal-map-stage').isVisible(), true,
      `${viewport.name}: world portal must show the interactive atlas`);
    assert.ok(await page.locator('#aurora-world-portal [data-portal-node]').count() > 0,
      `${viewport.name}: atlas must expose clickable destination points`);
    await page.locator('#aurora-world-portal [data-portal-node]').first().click();
    assert.equal(await page.locator('#aurora-world-portal #portal-destination h2').isVisible(), true,
      `${viewport.name}: selecting a map point must show destination details`);
    assert.equal(await page.locator('#aurora-world-portal [data-portal-travel]').count(), 1,
      `${viewport.name}: selected destination must expose exactly one travel action`);
    await page.locator('#aurora-world-portal [data-world-close]').click();
    for (const tab of ['hero', 'inventory', 'spells', 'quests', 'achievements', 'statistics', 'talents', 'bestiary', 'chronicles']) {
      const tabButton = page.locator(`#game-tab-${tab}`);
      await page.evaluate(tab => window.GameAPI.switchTab(tab), tab);
      assert.equal(await tabButton.getAttribute('aria-selected'), 'true', `${viewport.name}: ${tab} tab must become selected`);
      const dashboardModal = page.locator('#dashboard-tab-modal');
      await dashboardModal.waitFor({state:'visible', timeout:5000}).catch(async () => {
        throw new Error(`${viewport.name}/${tab}: GameAPI.switchTab did not mount the modal overlay`);
      });
      assert.equal(await dashboardModal.getAttribute('data-dashboard-tab'), tab,
        `${viewport.name}: sidebar section must render in the modal overlay`);
      if (tab === 'quests') {
        const progress = page.locator('.campaign-progress[role="progressbar"]').first();
        await progress.waitFor();
        assert.ok(Number(await progress.getAttribute('aria-valuemax')) > 0,
          `${viewport.name}: campaign progress must expose a positive maximum`);
        const current = Number(await progress.getAttribute('aria-valuenow'));
        assert.ok(Number.isFinite(current) && current >= 0,
          `${viewport.name}: campaign progress must expose a valid current value`);
      }

      if (tab === 'inventory') {
        const bagFilter = page.locator('[data-inv-filter="bag"]');
        assert.equal(await bagFilter.getAttribute('aria-pressed'), 'true',
          `${viewport.name}: active inventory filter must expose its selected state`);
        await bagFilter.focus();
        await bagFilter.press('Enter');
        const saleOpener = page.locator('#dashboard-tab-modal [data-inv-action="open-sale"]');
        await saleOpener.focus();
        // The sticky paperdoll can overlap this control in narrow layouts; trigger its real DOM click handler.
        await page.evaluate(() => window.GameAPI.openSaleUI());
        const saleDialog = page.locator('#inventory-sale-overlay [role="dialog"][aria-labelledby="inventory-sale-title"]');
        await saleDialog.waitFor({ state: 'visible' });
        assert.equal(await saleDialog.getAttribute('aria-labelledby'), 'inventory-sale-title', `${viewport.name}: sale dialog must reference its title`);
        assert.equal(await page.getByRole('heading', { name: 'Продажа предметов' }).count(), 1, `${viewport.name}: sale dialog title must be exposed to assistive technology`);
        assert.equal(await saleDialog.getAttribute('aria-modal'), 'true',
          `${viewport.name}: sale window must be announced as modal`);
        await saleDialog.press('Escape');
        await saleDialog.waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-inv-action')), 'open-sale',
          `${viewport.name}: closing sale dialog must restore focus to its opener`);
      }
      const dashboard = await page.evaluate(() => {
        const layout = document.querySelector('.dashboard-layout');
        const main = document.querySelector('.dashboard-main');
        const content = document.querySelector('.dashboard-content');
        return {
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          layoutWidth: layout?.getBoundingClientRect().width ?? 0,
          layoutScrollWidth: layout?.scrollWidth ?? 0,
          mainWidth: main?.getBoundingClientRect().width ?? 0,
          mainScrollWidth: main?.scrollWidth ?? 0,
          contentWidth: content?.getBoundingClientRect().width ?? 0,
          contentScrollWidth: content?.scrollWidth ?? 0
        };
      });
      assert.ok(dashboard.documentWidth <= dashboard.viewport + 1, `${viewport.name}/${tab}: document overflow: ${JSON.stringify(dashboard)}`);
      assert.ok(dashboard.layoutScrollWidth <= dashboard.layoutWidth + 1, `${viewport.name}/${tab}: dashboard overflow: ${JSON.stringify(dashboard)}`);
      assert.ok(dashboard.mainScrollWidth <= dashboard.mainWidth + 1, `${viewport.name}/${tab}: main panel overflow: ${JSON.stringify(dashboard)}`);
      assert.ok(dashboard.contentScrollWidth <= dashboard.contentWidth + 1, `${viewport.name}/${tab}: content overflow: ${JSON.stringify(dashboard)}`);
      await dashboardModal.locator('[data-dashboard-modal-close]').click();
      await dashboardModal.waitFor({ state: 'detached' });
      assert.equal(await page.locator('#screen-game').evaluate(el=>el.inert),false,
        `${viewport.name}/${tab}: gameplay must be interactive after modal close`);
    }

    await page.locator('#game-tab-hero').click();
    const heroPanel = page.locator('.hero-overview');
    await heroPanel.waitFor();
    assert.match(await heroPanel.innerText(), /UI audit/, `${viewport.name}: hero dossier must show the active character`);
    const heroProgress = await page.locator('.hero-overview-left [role="progressbar"]').evaluateAll(nodes =>
      nodes.map(node => ({
        label: node.getAttribute('aria-label'),
        min: Number(node.getAttribute('aria-valuemin')),
        max: Number(node.getAttribute('aria-valuemax')),
        value: Number(node.getAttribute('aria-valuenow'))
      }))
    );
    assert.equal(heroProgress.length, 3, `${viewport.name}: hero must expose health, resource and XP progress`);
    for (const progress of heroProgress) {
      assert.ok(progress.label, `${viewport.name}: hero progress bar must have an accessible label`);
      assert.equal(progress.min, 0, `${viewport.name}: hero progress minimum must be zero`);
      assert.equal(progress.max, 100, `${viewport.name}: hero progress maximum must be 100`);
      assert.ok(Number.isFinite(progress.value) && progress.value >= 0 && progress.value <= 100,
        `${viewport.name}: hero progress value must be bounded: ${JSON.stringify(progress)}`);
    }
    const heroColumns = await page.locator('.hero-overview-columns').evaluate(node => {
      const left = node.querySelector('.hero-overview-left')?.getBoundingClientRect();
      const right = node.querySelector('.hero-overview-right')?.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { left: left && { x: left.x, y: left.y, width: left.width, height: left.height },
        right: right && { x: right.x, y: right.y, width: right.width, height: right.height },
        columns: style.gridTemplateColumns, gap: style.columnGap };
    });
    assert.ok(heroColumns.left?.width > 0 && heroColumns.right?.width > 0,
      `${viewport.name}: hero must render both resource and detailed-stat panels: ${JSON.stringify(heroColumns)}`);
    assert.ok(heroColumns.right.y >= heroColumns.left.y + heroColumns.left.height - 2,
      `${viewport.name}: hero resources must sit above the detailed attributes section: ${JSON.stringify(heroColumns)}`);
    assert.equal(await page.locator('.hero-overview-left .hero-vital').count(), 3,
      `${viewport.name}: hero resource row must contain health, class resource and experience`);
    await page.locator('#dashboard-tab-modal [data-dashboard-modal-close]').click();
    await page.locator('#dashboard-tab-modal').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#dashboard-context').count(), 1, `${viewport.name}: persistent quest context must render`);
    const questProgress = page.locator('#dashboard-context [role="progressbar"]');
    if (await questProgress.count()) {
      const values = await questProgress.evaluate(node => ({
        label: node.getAttribute('aria-label'),
        min: Number(node.getAttribute('aria-valuemin')),
        max: Number(node.getAttribute('aria-valuemax')),
        current: Number(node.getAttribute('aria-valuenow')),
        text: node.getAttribute('aria-valuetext')
      }));
      assert.ok(values.label && values.text, `${viewport.name}: campaign progress must be announced accessibly`);
      assert.equal(values.min, 0, `${viewport.name}: campaign progress must start at zero`);
      assert.ok(values.max > 0 && values.current >= 0 && values.current <= values.max,
        `${viewport.name}: campaign progress must be bounded: ${JSON.stringify(values)}`);
    }
    assert.equal(await page.locator('[data-log-filter]').count(), 4, `${viewport.name}: event journal must expose four filters`);
    await page.evaluate(() => {
      const log = document.getElementById('game-log');
      for (const [id, message] of [
        ['combat', 'Игрок нанёс урон врагу'],
        ['loot', 'Получен предмет: меч'],
        ['story', 'Задание сюжета завершено']
      ]) {
        const line = document.createElement('div');
        line.dataset.dashboardSmoke = id;
        line.textContent = message;
        log.appendChild(line);
      }
    });
    await page.locator('[data-log-filter="combat"]').click();
    assert.equal(await page.locator('[data-log-filter="combat"]').getAttribute('aria-pressed'), 'true',
      `${viewport.name}: selected event filter must expose its state`);
    assert.equal(await page.locator('[data-dashboard-smoke="combat"]').isVisible(), true,
      `${viewport.name}: combat filter must show combat events`);
    assert.equal(await page.locator('[data-dashboard-smoke="loot"]').isVisible(), false,
      `${viewport.name}: combat filter must hide loot events`);
    await page.locator('[data-log-filter="loot"]').click();
    assert.equal(await page.locator('[data-dashboard-smoke="loot"]').isVisible(), true,
      `${viewport.name}: loot filter must show loot events`);
    await page.locator('[data-log-filter="story"]').click();
    assert.equal(await page.locator('[data-dashboard-smoke="story"]').isVisible(), true,
      `${viewport.name}: story filter must show story events`);
    await page.locator('#game-log-search').fill('проверка');
    await page.locator('#game-log-search').fill('');
    await page.locator('[data-log-filter="all"]').click();
    await page.locator('[data-dashboard-smoke]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
    const dashboardNav = await page.locator('.dashboard-sidebar').boundingBox();
    assert.ok(dashboardNav && dashboardNav.height > 0, `${viewport.name}: primary dashboard navigation must remain visible`);
    const navSearch = page.locator('#dashboard-nav-search');
    await navSearch.fill('талант');
    assert.equal(await page.locator('#game-tab-talents').isVisible(), true,
      `${viewport.name}: navigation search must keep matching sections visible`);
    assert.equal(await page.locator('#game-tab-inventory').isVisible(), false,
      `${viewport.name}: navigation search must hide unrelated sections`);
    await navSearch.fill('');
    assert.equal(await page.locator('#game-tab-inventory').isVisible(), true,
      `${viewport.name}: clearing navigation search must restore all sections`);
    assert.equal(await page.locator('.dashboard-tablist [role="tab"]').count(), 10,
      `${viewport.name}: all ten dashboard sections must be present`);
    assert.equal(await page.locator('#dashboard-context').isVisible(), true,
      `${viewport.name}: live quest context must remain visible`);
    const missionAnnouncements = page.locator('#dashboard-context .dashboard-context-mission');
    assert.equal(await missionAnnouncements.getAttribute('role'), 'status',
      `${viewport.name}: changing mission context must expose a status region`);
    assert.equal(await missionAnnouncements.getAttribute('aria-live'), 'polite',
      `${viewport.name}: mission updates must be announced without interrupting screen readers`);
    assert.equal(await missionAnnouncements.getAttribute('aria-atomic'), 'true',
      `${viewport.name}: mission context should be announced as a complete update`);
    await page.locator('#game-tab-hero').click();
    const heroModal = page.locator('#dashboard-tab-modal');
    await heroModal.waitFor({ state: 'visible' });
    await heroModal.locator('.hero-overview').waitFor({ state: 'visible' });
    assert.equal(await heroModal.getAttribute('aria-modal'), 'true',
      `${viewport.name}: sidebar sections must open as an accessible modal overlay`);
    await page.keyboard.press('Escape');
    await heroModal.waitFor({ state: 'detached' });
    await page.locator('#game-tab-hero').click();
    await heroModal.waitFor({ state: 'visible' });
    await heroModal.locator('[data-dashboard-modal-close]').click();
    await heroModal.waitFor({ state: 'detached' });
    await page.evaluate(() => window.GameAPI.openWorldPortalMenu());
    await page.locator('#aurora-world-portal').waitFor();
    await page.locator('#aurora-world-portal [data-world-close]').click();
    await page.locator('#overworld-title').click();
    await page.keyboard.press('/');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'dashboard-nav-search',
      `${viewport.name}: slash shortcut must focus navigation search`);
    await page.keyboard.press('Escape');
    assert.equal(await navSearch.inputValue(), '',
      `${viewport.name}: Escape must clear navigation search`);

    // Exercise the portal interaction contract and destination navigation.
    await page.evaluate(() => window.GameAPI.enterOverworld());
    await page.locator('#screen-game.overworld-active').waitFor();
    await page.locator('#overworld-canvas').waitFor({ state: 'visible' });
    let worldDialog = page.locator('#aurora-world-portal [role="dialog"][aria-labelledby="aurora-world-portal-title"]');
    await page.evaluate(() => window.GameAPI.interactNpc('world-portal'));
    await worldDialog.waitFor({ state: 'visible' });
    assert.equal(await worldDialog.getAttribute('aria-modal'), 'true',
      `${viewport.name}: world portal must open an accessible modal`);

    // Open-world routes are driven by the connected region graph, not campaign level.
    let forestNode = worldDialog.locator('[data-portal-node="forest"]');
    await forestNode.click();
    assert.equal((await forestNode.getAttribute('class')).includes('is-available'), true,
      viewport.name + ': forest must be available as a direct neighbor of Aurora');
    assert.match(await worldDialog.locator('.portal-destination-status').innerText(), /новый регион/i,
      viewport.name + ': atlas must explain that this is an unexplored region');
    assert.equal(await worldDialog.locator('[data-portal-travel]').isDisabled(), false,
      viewport.name + ': connected neighboring regions must be travelable without a campaign-level gate');
    await worldDialog.locator('[data-portal-travel]').click();
    await worldDialog.waitFor({ state: 'detached' });
    await page.locator('#screen-game.overworld-active').waitFor();

    const discoveredForest = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      return save?.world?.discoveredRegions?.includes('forest') === true;
    });
    assert.equal(discoveredForest, true, viewport.name + ': entering forest must persist its discovery');

    // A region waystone returns only along a route that has actually been opened.
    await page.evaluate(() => window.GameAPI.interactNpc('world-waystone'));
    worldDialog = page.locator('#aurora-world-portal [role="dialog"][aria-labelledby="aurora-world-portal-title"]');
    await worldDialog.waitFor({ state: 'visible' });
    await worldDialog.locator('[data-portal-node="village"]').click();
    assert.equal(await worldDialog.locator('[data-portal-travel]').isDisabled(), false,
      viewport.name + ': the discovered route back to Aurora must remain available');
    await worldDialog.locator('[data-portal-travel]').click();
    await worldDialog.waitFor({ state: 'detached' });
    await page.locator('#screen-game.overworld-active').waitFor();
    // Timed world events appear on the region map and can be explicitly accepted.
    await page.evaluate(() => window.GameAPI.openWorldPortalMenu());
    worldDialog = page.locator('#aurora-world-portal [role="dialog"][aria-labelledby="aurora-world-portal-title"]');
    await worldDialog.waitFor({ state: 'visible' });
    await worldDialog.locator('[data-portal-node="forest"]').click();
    await worldDialog.locator('[data-portal-travel]').click();
    await worldDialog.waitFor({ state: 'detached' });
    await page.locator('#screen-game.overworld-active').waitFor();

    await page.reload();
    const regionVisitCount = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      save.world.clockMinutes = save.world.events.nextSpawnAt;
      const visits = save.world.regionVisits.forest;
      localStorage.setItem('magic-rpg-save-1', JSON.stringify(save));
      window.GameAPI.loadSlot(1);
      return visits;
    });
    await page.locator('#screen-game.overworld-active').waitFor();
    await page.waitForFunction(() => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      return save?.world?.events?.active?.some(event => event.regionId === 'forest') === true;
    }, null, { timeout: 12000 });
    const visitsAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('magic-rpg-save-1')).world.regionVisits.forest);
    assert.equal(visitsAfterReload, regionVisitCount, viewport.name + ': reloading the current region must not increment its visit seed');
    const eventId = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      return save.world.events.active.find(event => event.regionId === 'forest').id;
    });
    await page.evaluate(id => window.GameAPI.interactNpc('event-world-' + id), eventId);
    await page.waitForFunction(id => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      return save?.world?.events?.active?.find(event => event.id === id)?.accepted === true;
    }, eventId, { timeout: 5000 });

    await page.evaluate(() => window.GameAPI.interactNpc('world-waystone'));
    worldDialog = page.locator('#aurora-world-portal [role="dialog"][aria-labelledby="aurora-world-portal-title"]');
    await worldDialog.waitFor({ state: 'visible' });
    await worldDialog.locator('[data-portal-node="village"]').click();
    await worldDialog.locator('[data-portal-travel]').click();
    await worldDialog.waitFor({ state: 'detached' });
    await page.locator('#screen-game.overworld-active').waitFor();
    // The world journal exposes faction standing and persistent event progress.
    const activeEventName = await page.evaluate(id => {
      const save = JSON.parse(localStorage.getItem('magic-rpg-save-1'));
      return save.world.events.active.find(event => event.id === id).name;
    }, eventId);
    await page.evaluate(() => window.GameAPI.switchTab('world'));
    const worldStatusModal = page.locator('#dashboard-tab-modal');
    await worldStatusModal.waitFor({ state: 'visible' });
    const worldStatusText = await worldStatusModal.innerText();
    assert.match(worldStatusText, /Мир и фракции/);
    assert.match(worldStatusText, /Стражи Хаба/);
    assert.ok(worldStatusText.includes(activeEventName), viewport.name + ': active regional event must appear in the world journal');
    assert.match(worldStatusText, /Изменения репутации/);
    await worldStatusModal.locator('[data-dashboard-modal-close]').click();
    await worldStatusModal.waitFor({ state: 'detached' });
    // The separate amber gate must launch the existing 40-floor Tower menu.
    await page.evaluate(() => window.GameAPI.interactNpc('tower-portal'));
    await page.locator('#tower-map-overlay').waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: /Башня · 40 этажей/ }).waitFor();
    await page.locator('[data-tower-close]').click();
    await page.locator('#tower-map-overlay').waitFor({ state: 'detached' });

    // Reproduce the user's exact flow: save to the menu, then press Continue.
    // No manual enterOverworld call is allowed after loadSlot.
    await page.evaluate(() => {
      if (!window.GameAPI.saveAndMenu()) throw new Error('Save-to-menu action failed');
    });
    await page.locator('#screen-main.active').waitFor();
    await page.locator('.slot-play').first().click();
    await page.locator('#screen-game.overworld-active').waitFor();
    await page.locator('#overworld-canvas').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#screen-game .dashboard-layout').isVisible(), true,
      `${viewport.name}: Continue must restore the dashboard, not an empty screen`);
    assert.equal(await page.locator('#overworld-title').isVisible(), true,
      `${viewport.name}: Continue must restore the saved world scene`);

    assert.deepEqual(pageErrors, [], `${viewport.name}: uncaught browser errors: ${pageErrors.join('; ')}`);
    console.log(`PASS ${viewport.name} (${viewport.width}x${viewport.height}): settings labels, game creation, 10 dashboard tabs, responsive widths, no page errors`);
    await page.close();
  }
  console.log('Browser smoke checks passed (3 viewport sizes)');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
