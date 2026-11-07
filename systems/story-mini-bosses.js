// Optional story mini-bosses appear only once the hero reaches their act-level threshold.
// This protects early access to a shared act region (e.g. Briar Hollow, visited in Act I's first mission).
export const STORY_MINI_BOSSES = Object.freeze([
  Object.freeze({ id: 'root-court-executioner', act: 1, location: 'briar-hollow', level: 8 }),
  Object.freeze({ id: 'drowned-queen', act: 2, location: 'sunken-necropolis', level: 18 }),
  Object.freeze({ id: 'oath-forge-warden', act: 3, location: 'obsidian-fields', level: 28 }),
  Object.freeze({ id: 'mirror-icekeeper', act: 4, location: 'frost-citadel', level: 38 }),
  Object.freeze({ id: 'echo-devourer', act: 5, location: 'void-crater', level: 48 })
]);

export const STORY_MINI_BOSS_LEVELS = Object.freeze(
  Object.fromEntries(STORY_MINI_BOSSES.map(({ id, level }) => [id, level]))
);
