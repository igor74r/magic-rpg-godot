import { CHRONICLES } from '../data/chronicles.js';

export function renderChronicles() {
  const chapters = CHRONICLES.chapters.map((chapter, index) => `
    <article class="chronicle-chapter">
      <div class="chronicle-chapter-kicker">ГЛАВА ${chapter.id} · ${chapter.period}</div>
      <h3>${chapter.title}</h3>
      <p class="chronicle-summary">${chapter.summary}</p>
      <div class="chronicle-entry-grid">
        ${chapter.entries.map(entry => `
          <section class="chronicle-entry">
            <h4>${entry.title}</h4>
            <p>${entry.text}</p>
          </section>`).join('')}
      </div>
    </article>`).join('');

  const factions = CHRONICLES.factions.map(f => `
    <article class="chronicle-faction">
      <div class="chronicle-faction-symbol">${f.symbol}</div>
      <h4>${f.name}</h4><small>${f.tone}</small><p>${f.text}</p>
    </article>`).join('');

  const sideStories = CHRONICLES.sideStories.map(s => `
    <article class="chronicle-side-story">
      <span>${s.place}</span><h4>${s.title}</h4><p>${s.hook}</p>
    </article>`).join('');

  return `
    <section class="chronicles-page">
      <header class="chronicles-hero">
        <div class="chronicles-emblem">✦</div>
        <div><div class="chronicles-eyebrow">АРХИВ АВРОРЫ</div><h2>${CHRONICLES.title}</h2><p>${CHRONICLES.subtitle}</p></div>
      </header>
      <p class="chronicles-note">Эти записи дополняют основную историю. Они не меняют вступительный пролог и открывают более древнюю сторону мира.</p>
      ${chapters}
      <h3 class="chronicles-section-title">Знамёна старого мира</h3>
      <div class="chronicle-faction-grid">${factions}</div>
      <h3 class="chronicles-section-title">Нити побочных историй</h3>
      <div class="chronicle-side-grid">${sideStories}</div>
    </section>`;
}
