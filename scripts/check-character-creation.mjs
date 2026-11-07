import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const character = readFileSync(new URL('../ui/character.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/2d-art-direction.css', import.meta.url), 'utf8');
const experienceCss = readFileSync(new URL('../css/experience-refresh.css', import.meta.url), 'utf8');

assert.deepEqual(
  [...character.matchAll(/const PLAYABLE_CLASSES = \[([^\]]+)\]/g)].flatMap(match =>
    match[1].match(/'([^']+)'/g) || []
  ).map(value => value.slice(1, -1)),
  ['warrior', 'mage', 'archer'],
  'new-game selection must offer exactly Warrior, Mage and Archer'
);
assert.match(html, /css\/experience-refresh\.css/, 'unified experience layer must load after the dashboard');
assert.match(html, /class="menu-content-grid"/, 'main menu must use the refreshed story and save layout');
assert.match(html, /GameAPI\.startNewGame\(\)/, 'main menu primary action must start the first available save slot');
assert.match(html, /aria-labelledby="slots-heading-title"/, 'save slots must have an accessible section heading');
assert.match(html, /data-character-step="selection"/, 'character flow must expose its selection step');
assert.match(html, /data-character-step="review"/, 'character flow must expose its confirmation step');
assert.match(html, /id="class-selection-stage"/, 'selection stage must exist');
assert.match(html, /id="class-review-stage"/, 'review stage must exist');
assert.match(html, /id="class-review-content"/, 'review stage needs a dynamic hero summary');
assert.match(html, /id="char-name"[^>]*maxlength="24"/, 'hero name must be bounded');
assert.match(html, /onclick="GameAPI\.reviewClassSelection\(\)"/, 'selection must lead to review');
assert.match(html, /onclick="GameAPI\.confirmClassSelection\(\)"/, 'review must explicitly confirm creation');
assert.match(html, /onclick="GameAPI\.cancelClassReview\(\)"/, 'review must allow returning to selection');

const review = character.match(/export function reviewClassSelection\(\) \{([\s\S]*?)\n\}\n\nexport function cancelClassReview/);
assert.ok(review, 'review function must be present');
assert.doesNotMatch(review[1], /createCharacter\(/, 'reviewing a hero must not mutate or save a game');
const confirm = character.match(/export function confirmClassSelection\(\) \{([\s\S]*?)\n\}/);
assert.ok(confirm && /createCharacter\(reviewName, state\.selectedClass\)/.test(confirm[1]),
  'character creation must happen only after confirmation');
assert.match(main, /reviewClassSelection, cancelClassReview, confirmClassSelection/,
  'review and cancel functions must be imported into main');
assert.match(main, /selectClass, reviewClassSelection, cancelClassReview, confirmClassSelection,/,
  'GameAPI must expose selection, review, cancel and confirm actions');
assert.match(css, /@media \(max-width: 800px\)/, 'hero cards and review must adapt to mobile');
assert.match(css, /class-review-card/, 'confirmation must have a styled summary');
assert.match(experienceCss, /#screen-prologue \.center-flex/, 'prologue must receive the unified cinematic shell');
assert.match(experienceCss, /#screen-main \.menu-content-grid/, 'main menu must have a responsive two-panel layout');
assert.match(experienceCss, /#screen-char \.character-stepper/, 'character flow must show its progress stepper');
assert.match(experienceCss, /@media \(max-width: 700px\)/, 'all entry screens must adapt to mobile');
assert.match(main, /showHeroArrivalTransition\(\)/, 'creating a hero must trigger the arrival transition');
assert.match(main, /hero-arrival-transition/, 'arrival transition must use a dedicated overlay');
assert.match(css, /heroArrivalFade/, 'arrival transition must fade out');
assert.match(css, /pointer-events: none/, 'arrival transition must not block controls');

console.log('Character creation selection/review/confirm contract: OK');
