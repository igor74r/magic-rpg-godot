import { state } from '../systems/state.js';
import { getPassiveTree } from '../data/passives.js';
import {
  canAllocatePassive,
  getPassiveNodeStatus,
  allocatePassive,
  resetPassives
} from '../systems/talents.js';
import { toast } from './screens.js';
import { renderHeader } from './header.js';

let treePan = { x: -150, y: -170 };
let treeZoom = 1;
let treeDrag = null;

function drawPassiveLines(connections) {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('passive-lines-canvas');
  const world = document.getElementById('passive-tree-world');
  if (!canvas || !world || typeof canvas.getContext !== 'function') return;

  const width = world.clientWidth || 1200;
  const height = world.clientHeight || 900;
  const pixelRatio = typeof window !== 'undefined'
    ? Math.min(window.devicePixelRatio || 1, 2)
    : 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  for (const edge of connections) {
    ctx.beginPath();
    ctx.moveTo(Math.round(width * edge.x1 / 100), Math.round(height * edge.y1 / 100));
    ctx.lineTo(Math.round(width * edge.x2 / 100), Math.round(height * edge.y2 / 100));
    ctx.strokeStyle = edge.active ? '#d7b85d' : '#6c5b3b';
    ctx.lineWidth = edge.active ? 3 : 2;
    ctx.lineCap = 'square';
    ctx.stroke();
  }
}

function applyPassiveTreeTransform() {
  const world = document.getElementById('passive-tree-world');
  if (world) world.style.transform = `translate(${treePan.x}px, ${treePan.y}px) scale(${treeZoom})`;
}

export function passiveTreeZoom(delta) {
  treeZoom = Math.max(0.65, Math.min(1.6, Number((treeZoom + delta).toFixed(2))));
  applyPassiveTreeTransform();
  const status = document.getElementById('passive-tree-zoom-status');
  if (status) status.textContent = `Масштаб ${Math.round(treeZoom * 100)}%`;
}

export function passiveTreeResetView() {
  treePan = { x: -150, y: -170 };
  treeZoom = 1;
  applyPassiveTreeTransform();
  const status = document.getElementById('passive-tree-zoom-status');
  if (status) status.textContent = 'Масштаб 100% · положение сброшено';
}

export function passiveTreeKeyDown(e) {
  const viewport = e.currentTarget;
  const nodes = [...viewport.querySelectorAll('.passive-node')];
  const current = e.target.closest('.passive-node');

  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    passiveTreeZoom(0.1);
    return;
  }
  if (e.key === '-') {
    e.preventDefault();
    passiveTreeZoom(-0.1);
    return;
  }
  if (e.key === '0') {
    e.preventDefault();
    passiveTreeResetView();
    return;
  }
  if (e.key === 'Home') {
    e.preventDefault();
    (viewport.querySelector('.passive-node.start') || nodes[0])?.focus();
    return;
  }
  if (e.key === 'End') {
    e.preventDefault();
    nodes.at(-1)?.focus();
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

  e.preventDefault();
  if (!current) {
    (viewport.querySelector('.passive-node.start') || nodes[0])?.focus();
    return;
  }

  const currentX = Number(current.dataset.x) * 12;
  const currentY = Number(current.dataset.y) * 9;
  const directions = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0]
  };
  const [dx, dy] = directions[e.key];
  let best = null;
  let bestScore = Infinity;

  for (const node of nodes) {
    if (node === current) continue;
    const vx = Number(node.dataset.x) * 12 - currentX;
    const vy = Number(node.dataset.y) * 9 - currentY;
    const forward = vx * dx + vy * dy;
    if (forward <= 0) continue;
    const lateral = Math.abs(vx * dy - vy * dx);
    const score = forward + lateral * 1.8;
    if (score < bestScore) {
      best = node;
      bestScore = score;
    }
  }
  best?.focus();
}

export function passiveTreePointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('.passive-node')) return;
  const viewport = e.currentTarget;
  treeDrag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    panX: treePan.x,
    panY: treePan.y,
    moved: false
  };
  viewport.setPointerCapture?.(e.pointerId);
  viewport.classList.add('dragging');
  e.preventDefault();
}

export function passiveTreePointerMove(e) {
  if (!treeDrag || treeDrag.pointerId !== e.pointerId) return;
  const dx = e.clientX - treeDrag.startX;
  const dy = e.clientY - treeDrag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 3) treeDrag.moved = true;
  treePan = { x: treeDrag.panX + dx, y: treeDrag.panY + dy };
  applyPassiveTreeTransform();
  e.preventDefault();
}

export function passiveTreePointerUp(e) {
  if (!treeDrag || (e.pointerId !== undefined && treeDrag.pointerId !== e.pointerId)) return;
  const viewport = e.currentTarget;
  try {
    if (viewport.hasPointerCapture?.(treeDrag.pointerId)) {
      viewport.releasePointerCapture(treeDrag.pointerId);
    }
  } catch {}
  treeDrag = null;
  viewport.classList.remove('dragging');
}

export function renderPassives() {
  const player = state.game.player;

  if (!Array.isArray(player.passives)) {
    player.passives = ['start'];
  }

  const tree = getPassiveTree(player.class);
  const nodes = tree.nodes;
  const allocated = player.passives;
  const points = player.passivePoints || 0;

  const lines = [];

  for (const node of Object.values(nodes)) {
    for (const parentId of node.conn) {
      const parent = nodes[parentId];
      if (!parent) continue;

      const active =
        allocated.includes(node.id) &&
        allocated.includes(parentId);

      lines.push({
        x1: parent.x,
        y1: parent.y,
        x2: node.x,
        y2: node.y,
        active
      });
    }
  }

  let html = `
    <div class="passive-heading">
      <h3>
        Древо мастерства:
        ${
          player.class === 'warrior'
            ? 'Путь воина'
            : player.class === 'mage'
              ? 'Путь мага'
              : 'Путь следопыта'
        }
      </h3>

      <p style="color:#b7a989;font-size:13px;">
        ${points} свободных очков · ${allocated.length - 1} узлов изучено · уровень ${player.level || 1}
      </p>
      <div class="passive-actions">
        <span>Сброс древа возвращает все вложенные очки. Стоимость: 500 золота.</span>
        <button type="button" class="secondary-btn"
          onclick="GameAPI.resetPassives()"
          ${allocated.length <= 1 || (player.gold || 0) < 500 ? 'disabled' : ''}>
          Сбросить древо · 500 💰
        </button>
      </div>

      <p style="color:#8f8065;font-size:12px;">
        Открывайте соединённые узлы. Ключевые пассивки дают мощный бонус, но имеют цену.
      </p>
    </div>

    <div class="passive-tree-controls" role="group" aria-label="Управление масштабом древа">
      <button type="button" class="secondary-btn" aria-label="Уменьшить масштаб" title="Уменьшить масштаб (−)" onclick="GameAPI.passiveTreeZoom(-0.1)">−</button>
      <button type="button" class="secondary-btn" aria-label="Увеличить масштаб" title="Увеличить масштаб (+)" onclick="GameAPI.passiveTreeZoom(0.1)">+</button>
      <button type="button" class="secondary-btn" aria-label="Сбросить положение и масштаб" title="Сбросить вид (0)" onclick="GameAPI.passiveTreeResetView()">Сброс вида</button>
      <span id="passive-tree-zoom-status" aria-live="polite">Масштаб 100%</span>
      <span class="passive-tree-key-help">Перетаскивание · ← ↑ → ↓ узлы · Home — старт · +/− масштаб · 0 сброс</span>
    </div>
    <div class="passive-tree-viewport" tabindex="0" role="group" aria-label="Древо пассивных навыков. Стрелками перемещайтесь между узлами, Home — к старту, плюс и минус — масштаб."
      onkeydown="GameAPI.passiveTreeKeyDown(event)"
      onpointerdown="GameAPI.passiveTreePointerDown(event)"
      onpointermove="GameAPI.passiveTreePointerMove(event)"
      onpointerup="GameAPI.passiveTreePointerUp(event)"
      onpointercancel="GameAPI.passiveTreePointerUp(event)">
      <div class="passive-tree-expanded" id="passive-tree-world"
        style="transform:translate(${treePan.x}px,${treePan.y}px) scale(${treeZoom})">
      <canvas class="passive-lines" id="passive-lines-canvas" width="1200" height="900" aria-hidden="true"></canvas>
  `;

  for (const node of Object.values(nodes)) {
    const isAllocated = allocated.includes(node.id);
    const available = canAllocatePassive(player, node.id);

    const classes = [
      node.type,
      isAllocated ? 'allocated' : '',
      available ? 'available' : ''
    ].filter(Boolean).join(' ');

    const label = node.id === 'start'
      ? 'Старт'
      : node.name;

    html += `
      <button
        type="button"
        class="passive-node ${classes}"
        style="left:${node.x}%;top:${node.y}%"
        data-x="${node.x}" data-y="${node.y}"
        ${available ? `onclick="GameAPI.allocatePassive('${node.id}')"` : ''}
        aria-disabled="${!available}"
        aria-label="${node.name}. ${node.desc}. ${getPassiveNodeStatus(player, node.id)}"
        title="${node.name}: ${node.desc} — ${getPassiveNodeStatus(player, node.id)}"
      >
        <span class="node-icon">${node.icon}</span>
        <span class="node-name">${label}</span>
      </button>
    `;
  }

  html += '</div></div>';

  html += `
    <div class="passive-legend">
      <span>● Малый узел</span>
      <span>◆ Усиленный узел</span>
      <span>✦ Ключевая пассивка</span>
      <span>Зелёный — доступен · Золотой — изучен</span>
    </div>
  `;

  html += `
    <div class="passive-details">
      <h4>Ближайшие узлы</h4>
      <div class="passive-detail-grid">
  `;

  const nextNodes = Object.values(nodes).filter(node =>
    node.id !== 'start' &&
    (
      allocated.includes(node.id) ||
      canAllocatePassive(player, node.id)
    )
  );

  for (const node of nextNodes) {
    const taken = allocated.includes(node.id);
    const nodeAvailable = canAllocatePassive(player, node.id);

    html += `
      <article class="passive-detail talent-card ${taken ? 'taken' : nodeAvailable ? 'ready' : 'locked'}" data-talent-card="${node.id}">
        <div class="talent-card-heading">
          <span class="talent-card-icon">${node.icon}</span>
          <div>
            <b>${node.name}</b>
            <small>${node.branch || 'Центр'}</small>
          </div>
          <span class="talent-card-state">${taken ? 'Изучено' : nodeAvailable ? 'Доступно' : 'Закрыто'}</span>
        </div>
        <p>${node.desc}</p>
      </article>
    `;
  }

  html += '</div></div>';

  if (typeof requestAnimationFrame === 'function') {
    const connectionData = lines.map(edge => ({ ...edge }));
    requestAnimationFrame(() => drawPassiveLines(connectionData));
  }

  return html;
}

export function allocatePassiveUI(nodeId) {
  const player = state.game?.player;
  if (!player) return;

  if (!allocatePassive(player, nodeId)) {
    toast(
      (player.passivePoints || 0) <= 0
        ? 'Нет очков пассивных навыков'
        : 'Сначала откройте соседний узел'
    );
    return;
  }

  renderHeader();

  const content = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));

  if (content) {
    content.innerHTML = renderPassives();
  }
}
export function resetPassivesUI() {
  const player = state.game?.player;
  if (!player) return;

  if (!window.confirm('Сбросить все пассивные навыки за 500 золота? Все вложенные очки будут возвращены.')) {
    return;
  }

  const result = resetPassives(player);
  if (!result.ok) {
    toast(result.msg || 'Не удалось сбросить древо');
    return;
  }

  renderHeader();
  const content = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
  if (content) content.innerHTML = renderPassives();
}
