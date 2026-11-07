import assert from 'node:assert/strict';
import { STORY } from '../data/story.js';
import { ENEMIES } from '../data/enemies.js';
import { LOCATIONS } from '../data/locations.js';

assert.equal(STORY.acts.length, 5);
assert.equal(STORY.acts.reduce((sum, act) => sum + act.missions.length, 0), 25);

for (const [index, act] of STORY.acts.entries()) {
  assert.equal(act.number, index + 1);
  assert.ok(act.chapter, `act ${act.number} needs a chapter title`);
  assert.ok(act.recommendedLevel, `act ${act.number} needs a level recommendation`);
  assert.ok(act.chapterGoal && act.keyCharacters && act.revelation, `act ${act.number} needs narrative metadata`);
  assert.ok(act.intro.length > 100 && act.outro.length > 100, `act ${act.number} needs substantial intro/outro`);
  for (const mission of act.missions) {
    assert.ok(mission.briefing && mission.briefing.length > 30, `mission ${mission.id} needs briefing`);
    assert.ok(mission.aftermath && mission.aftermath.length > 30, `mission ${mission.id} needs aftermath`);
    assert.ok(mission.clue && mission.clue.length > 20, `mission ${mission.id} needs a story clue`);
    const location = LOCATIONS[mission.locationId || act.locationId];
    assert.ok(location, `mission ${mission.id} has unknown location`);
    assert.ok(location.enemies.includes(mission.enemyId), `mission ${mission.id} enemy is not in its region`);
    assert.ok(ENEMIES[mission.enemyId], `mission ${mission.id} has unknown enemy`);
  }
}

const newVariants = ['rootbound-sentinel', 'drowned-scribe', 'ashbound-renegade', 'mirror-revenant', 'riftstalker'];
assert.ok(newVariants.every(id => !!ENEMIES[id]));
assert.ok(newVariants.every(id => Object.values(LOCATIONS).some(location => location.enemies.includes(id))));
assert.ok(newVariants.every(id => ENEMIES[id].lore && ENEMIES[id].tactics));
console.log('Five-act narrative depth and enemy roster checks passed');
