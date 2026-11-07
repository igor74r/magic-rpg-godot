// Deterministic overworld enemy steering and leash behavior.
const ANGLE_OFFSETS = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, Math.PI];

export function getEnemyBehavior(enemy, player, options = {}) {
  const aggroRange = Number.isFinite(options.aggroRange) ? options.aggroRange : 200;
  const leashRange = Number.isFinite(options.leashRange) ? options.leashRange : 340;
  const disengageRange = Number.isFinite(options.disengageRange) ? options.disengageRange : aggroRange * 1.35;
  const homeDistance = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
  const playerDistance = Math.hypot(enemy.x - player.x, enemy.y - player.y);

  if (homeDistance > leashRange || (enemy.state === 'chase' && playerDistance > disengageRange)) {
    return { state: 'return', targetX: enemy.homeX, targetY: enemy.homeY, playerDistance, homeDistance };
  }
  if (enemy.state === 'return') {
    if (homeDistance > 18) return { state: 'return', targetX: enemy.homeX, targetY: enemy.homeY, playerDistance, homeDistance };
    if (playerDistance < aggroRange) return { state: 'chase', targetX: player.x, targetY: player.y, playerDistance, homeDistance };
    return { state: 'idle', targetX: enemy.homeX, targetY: enemy.homeY, playerDistance, homeDistance };
  }
  if (playerDistance < aggroRange && homeDistance <= leashRange) {
    return { state: 'chase', targetX: player.x, targetY: player.y, playerDistance, homeDistance };
  }
  if (homeDistance > 100) {
    return { state: 'return', targetX: enemy.homeX, targetY: enemy.homeY, playerDistance, homeDistance };
  }
  return { state: 'idle', targetX: enemy.homeX, targetY: enemy.homeY, playerDistance, homeDistance };
}

// Pick a reachable direction that makes the greatest forward progress.
// The direct vector wins ties; angled alternatives let enemies route around
// corners without teleporting or ignoring swept collision.
export function getEnemySteering(x, y, targetX, targetY, canMove) {
  const dx = targetX - x, dy = targetY - y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.001) return { x: 0, y: 0, blocked: false };
  const ux = dx / distance, uy = dy / distance;
  let best = null, bestScore = -Infinity;
  for (const angle of ANGLE_OFFSETS) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const vx = ux * cos - uy * sin;
    const vy = ux * sin + uy * cos;
    // Probe several short distances so a direction cannot be selected
    // through a thin wall merely because its endpoint is clear.
    let clear = true;
    for (const probe of [4, 8, 12]) {
      if (!canMove(x + vx * probe, y + vy * probe)) { clear = false; break; }
    }
    if (!clear) continue;
    const score = vx * ux + vy * uy;
    if (score > bestScore) { bestScore = score; best = { x: vx, y: vy, blocked: false }; }
  }
  return best || { x: 0, y: 0, blocked: true };
}


// Nearby enemies share an alarm: a visible attacker can call its nearby
// pack into the fight, but each member still obeys its own home leash.
export function getEnemyGroupBehaviors(enemies, player, options = {}) {
  const aggroRange = Number.isFinite(options.aggroRange) ? options.aggroRange : 200;
  const leashRange = Number.isFinite(options.leashRange) ? options.leashRange : 340;
  const groupRadius = Number.isFinite(options.groupRadius) ? options.groupRadius : 150;
  const assistRange = Number.isFinite(options.assistRange) ? options.assistRange : aggroRange + 80;
  const results = enemies.map(enemy => enemy.dead
    ? { state: 'idle', targetX: enemy.homeX, targetY: enemy.homeY, dead: true }
    : getEnemyBehavior(enemy, player, { aggroRange, leashRange }));
  const visited = new Set();

  for (let seed = 0; seed < enemies.length; seed++) {
    if (visited.has(seed) || enemies[seed].dead) continue;
    const cluster = [];
    const queue = [seed];
    visited.add(seed);
    while (queue.length) {
      const index = queue.shift();
      cluster.push(index);
      const actor = enemies[index];
      for (let other = 0; other < enemies.length; other++) {
        if (visited.has(other) || enemies[other].dead) continue;
        if (Math.hypot(actor.x - enemies[other].x, actor.y - enemies[other].y) <= groupRadius) {
          visited.add(other);
          queue.push(other);
        }
      }
    }
    const alerted = cluster.some(index => results[index].state === 'chase');
    if (!alerted) continue;
    for (const index of cluster) {
      const enemy = enemies[index];
      const homeDistance = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
      const playerDistance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (homeDistance > leashRange || playerDistance > assistRange) continue;
      if (results[index].state === 'idle') {
        results[index] = {
          ...results[index],
          state: 'chase',
          targetX: player.x,
          targetY: player.y,
          assisted: true
        };
      }
    }
  }
  return results;
}


// Combat roles are derived from existing enemy specials, so the roster and
// encounter balance stay intact while each archetype makes distinct choices.
export function getEnemyCombatRole(specialType) {
  if (specialType === 'snipe') return 'marksman';
  if (specialType === 'double') return 'bruiser';
  if (specialType === 'drain') return 'leech';
  return 'skirmisher';
}

// Telegraph special attacks one turn ahead. This gives the player a readable
// response window and lets blocking meaningfully influence bruiser decisions.
export function getEnemyCombatDecision({
  specialType,
  specialEvery,
  turnCount = 0,
  playerHpRatio = 1,
  enemyHpRatio = 1,
  blocking = false,
  pendingSpecial = false,
  isBoss = false
} = {}) {
  const role = getEnemyCombatRole(specialType);
  if (!specialType || !Number.isFinite(specialEvery) || specialEvery < 1) {
    return { role, action: 'attack', reason: 'basic' };
  }
  if (pendingSpecial) return { role, action: 'special', reason: 'telegraphed' };

  // Treat malformed combat telemetry as neutral instead of accidentally
  // triggering a tactical special from NaN, Infinity, or out-of-range ratios.
  const safeRatio = value => Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 1;
  const safeTurnCount = Number.isFinite(turnCount) ? Math.max(0, Math.floor(turnCount)) : 0;
  const safePlayerHpRatio = safeRatio(playerHpRatio);
  const safeEnemyHpRatio = safeRatio(enemyHpRatio);
  const scheduled = Math.max(1, Math.floor(specialEvery));
  const cadenceDue = safeTurnCount > 0 && safeTurnCount % scheduled === 0;
  const bossEnrage = isBoss && safeEnemyHpRatio <= 0.25;
  const bossPunishBlock = isBoss && blocking;
  const survivalOpening = safeEnemyHpRatio <= 0.30 && role !== 'leech';
  const tacticalOpening =
    (role === 'marksman' && safePlayerHpRatio <= 0.45) ||
    (role === 'leech' && safeEnemyHpRatio <= 0.50) ||
    (role === 'bruiser' && blocking) || survivalOpening || bossEnrage || bossPunishBlock;
  if (cadenceDue || tacticalOpening) {
    return {
      role,
      action: 'telegraph',
      reason: bossEnrage ? 'enrage' : bossPunishBlock ? 'punish-block' : survivalOpening ? 'survival' : tacticalOpening ? 'opening' : 'cadence'
    };
  }
  return { role, action: 'attack', reason: 'basic' };
}


// Engagement distance follows the enemy's existing combat archetype. Ranged
// enemies initiate their turn-based encounter before touching the player.
export function getEnemyEngagementRange(specialType) {
  if (specialType === 'snipe') return 118;
  if (specialType === 'drain') return 76;
  if (specialType === 'double') return 48;
  return 44;
}


// A stun interrupts a charged special instead of letting it fire after recovery.
export function interruptEnemyTelegraph(enemy) {
  if (!enemy || !enemy.tacticalSpecialPending) return false;
  enemy.tacticalSpecialPending = false;
  return true;
}
