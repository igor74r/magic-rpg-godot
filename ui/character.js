import { state } from '../systems/state.js';
import { CLASSES } from '../data/classes.js';
import { createCharacter } from '../systems/character.js';
import { toast, escapeHtml } from './screens.js';


const PLAYABLE_CLASSES = ['warrior', 'mage', 'archer'];

const CLASS_PORTRAITS = {
  warrior: 'assets/characters/classes/warrior.png',
  mage: 'assets/characters/classes/mage.png',
  archer: 'assets/characters/classes/archer.png'
};


export function renderClassSelection() {
  setCharacterStage('selection');
  const root = document.getElementById('classes-grid');

  if (!root) return;

  if (root.dataset.classSelectionBound !== 'true') {
    root.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest('[data-class-id]');
      if (card && root.contains(card)) selectClass(card.dataset.classId);
    });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest('[data-class-id]');
      if (!card || !root.contains(card)) return;
      event.preventDefault();
      const classId = card.dataset.classId;
      selectClass(classId);
      root.querySelector(`[data-class-id="${classId}"]`)?.focus();
    });
    root.dataset.classSelectionBound = 'true';
  }

  root.innerHTML = Object.entries(CLASSES)
    .filter(([id]) => PLAYABLE_CLASSES.includes(id))
    .map(([id, cls]) => {
      const combat = cls.combat || {};
      const resource = cls.resourceName || 'Ресурс';

      return `
        <div
          class="class-card ${state.selectedClass === id ? 'selected' : ''}"
          data-class-id="${id}"
          role="button"
          tabindex="0"
          aria-pressed="${state.selectedClass === id}"
        >
          <div class="class-model-frame">
            <img
              class="class-portrait"
              src="${CLASS_PORTRAITS[id]}"
              alt="${escapeHtml(`Портрет класса: ${cls.name}`)}"
              width="100"
              height="112"
              loading="eager"
              decoding="async"
              draggable="false"
            >
          </div>

          <h3>${cls.name}</h3>

          <div class="class-role">
            ${cls.role || ''}
          </div>

          <p class="class-description">
            ${cls.desc}
          </p>

          <div class="class-base-stats">
            <b>❤️ ${cls.baseStats.maxHp} HP</b>
            <b>🔷 ${cls.baseStats.maxMp} ${resource}</b>

            <span>СИЛ ${cls.baseStats.str}</span>
            <span>ИНТ ${cls.baseStats.int}</span>
            <span>МДР ${cls.baseStats.wis}</span>
            <span>ТЕЛ ${cls.baseStats.con}</span>
            <span>ЛОВ ${cls.baseStats.dex || 0}</span>

            <span>
              💨 Уклон ${Math.round((combat.dodgeChance || 0) * 100)}%
            </span>

            <span>
              🛡️ Блок ${Math.round((combat.blockChance || 0) * 100)}%
            </span>

            <span>
              🎯 Крит ${Math.round((combat.critChance || 0) * 100)}%
            </span>
          </div>
        </div>
      `;
    })
    .join('');

  const nextButton = document.getElementById('class-review-next');
  if (nextButton) nextButton.disabled = !PLAYABLE_CLASSES.includes(state.selectedClass);
}

export function selectClass(id) {
  if (!PLAYABLE_CLASSES.includes(id)) return;

  state.selectedClass = id;
  renderClassSelection();
  setCharacterStage('selection');
}

let reviewName = 'Герой';

function setCharacterStage(stage) {
  const selection = document.getElementById('class-selection-stage');
  const review = document.getElementById('class-review-stage');
  if (selection) selection.style.display = stage === 'selection' ? '' : 'none';
  if (review) review.style.display = stage === 'review' ? '' : 'none';
  document.querySelectorAll('[data-character-step]').forEach(step => {
    const active = step.dataset.characterStep === stage;
    if (active) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
    step.classList.toggle('completed', stage === 'review' && step.dataset.characterStep === 'selection');
  });
}

export function reviewClassSelection() {
  if (!PLAYABLE_CLASSES.includes(state.selectedClass)) {
    return toast('Сначала выберите класс');
  }

  const input = document.getElementById('char-name');
  reviewName = (input?.value || '').trim().slice(0, 24) || 'Герой';
  const cls = CLASSES[state.selectedClass];
  const combat = cls.combat || {};
  const resource = cls.resourceName || 'Ресурс';
  const stats = cls.baseStats || {};
  const root = document.getElementById('class-review-content');
  if (!root) return;

  root.innerHTML = `
    <article class="class-review-card">
      <div class="class-review-art">
        <div class="class-review-glow" aria-hidden="true"></div>
        <img
          class="class-review-portrait"
          src="${CLASS_PORTRAITS[state.selectedClass]}"
          alt="${escapeHtml(`Портрет выбранного класса: ${cls.name}`)}"
          width="180"
          height="210"
          loading="eager"
          decoding="async"
          draggable="false"
        >
        <span class="class-review-level">УРОВЕНЬ 1 · НАЧАЛО ПУТИ</span>
      </div>
      <div class="class-review-details">
        <span class="class-review-kicker">ВАШЕ РЕШЕНИЕ</span>
        <h2>${escapeHtml(reviewName)}</h2>
        <h3>${cls.emoji || '✦'} ${cls.name}</h3>
        <p class="class-review-role">${cls.role || ''}</p>
        <p class="class-review-description">${cls.desc || ''}</p>
        <div class="class-review-stat-grid">
          <div><span>❤️ Здоровье</span><b>${stats.maxHp || 0}</b></div>
          <div><span>🔷 ${resource}</span><b>${stats.maxMp || 0}</b></div>
          <div><span>⚔️ Сила</span><b>${stats.str || 0}</b></div>
          <div><span>✨ Интеллект</span><b>${stats.int || 0}</b></div>
          <div><span>🧠 Мудрость</span><b>${stats.wis || 0}</b></div>
          <div><span>🛡️ Телосложение</span><b>${stats.con || 0}</b></div>
          <div><span>🏹 Ловкость</span><b>${stats.dex || 0}</b></div>
          <div><span>🎯 Критический удар</span><b>${Math.round((combat.critChance || 0) * 100)}%</b></div>
        </div>
      </div>
    </article>
  `;

  setCharacterStage('review');
}

export function cancelClassReview() {
  setCharacterStage('selection');
  document.getElementById('char-name')?.focus();
}

export function confirmClassSelection() {
  if (!PLAYABLE_CLASSES.includes(state.selectedClass)) {
    return toast('Выберите класс');
  }

  if (!createCharacter(reviewName, state.selectedClass)) {
    return toast('Не удалось создать героя. Попробуйте снова.');
  }
}