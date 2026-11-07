import { state } from '../state.js';
import { ENEMIES } from '../../data/enemies.js';
import { playSound } from '../audio.js';
import { TILE } from './map.js';
import { advanceWorldEvents, getVisibleWorldEventsForRegion } from '../world-events.js';
import { syncWorldEventMarkers } from './world-event-markers.js';
import { saveGame } from '../save.js';
import { emit } from '../events.js';
import { canOccupyPlayerPosition, canOccupyActorPosition, isActorPositionClear, PLAYER_COLLISION_RADIUS, NPC_COLLISION_RADIUS, ENEMY_COLLISION_RADIUS } from './collisions.js';
import { openChest } from './spawn.js';
import { recordRegionEnemyRespawned } from '../region-state.js';
import { enterCombat } from './combat.js';
import { updateParticles } from './particles.js';
import { getMovementDelta, resolveSweptMovement, getCameraPosition } from './movement.js';
import { getEnemyGroupBehaviors, getEnemySteering, getEnemyEngagementRange } from './enemy-ai.js';

const VIEW_W = 800, VIEW_H = 500;

function canOccupy(ow, x, y, radius = PLAYER_COLLISION_RADIUS) {
  return canOccupyPlayerPosition(
    ow.map, ow.cols, ow.rows, x, y, radius,
    ow.sourceLocationId || ow.locationId
  ) && isActorPositionClear(x, y, radius, [...ow.npcs, ...ow.enemies], ow.player);
}

function canOccupyActor(ow, actor, x, y, radius, others) {
  return canOccupyActorPosition(
    ow.map, ow.cols, ow.rows, x, y, radius,
    ow.sourceLocationId || ow.locationId, others, actor
  );
}

function moveActor(ow, actor, dx, dy, radius, others) {
  if (!dx && !dy) return false;
  const result = resolveSweptMovement(actor.x, actor.y, dx, dy,
    (x, y) => canOccupyActor(ow, actor, x, y, radius, others), 3);
  actor.x = result.x;
  actor.y = result.y;
  return result.moved;
}
const AGGRO_RANGE = 200, LEASH_RANGE = 340;

export function initCamera(playerPos, cols, rows) {
  const mapW = cols * TILE, mapH = rows * TILE;
  let cx = playerPos.x - VIEW_W / 2, cy = playerPos.y - VIEW_H / 2;
  cx = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : Math.max(0, Math.min(mapW - VIEW_W, cx));
  cy = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : Math.max(0, Math.min(mapH - VIEW_H, cy));
  return { x: cx, y: cy };
}

export function tryMovePlayer(dx, dy, deltaFrames = 1) {
  const ow = state.overworld;
  if (!ow || !ow.active || ow.combat || ow.defeated) return;
  const step = getMovementDelta(dx, dy, deltaFrames);
  if (step.x === 0 && step.y === 0) return;
  const p = ow.player, r = PLAYER_COLLISION_RADIUS;
  // Sweep the full requested vector, then slide along whichever side of a
  // corner offers the best progress without preferring horizontal movement.
  const result = resolveSweptMovement(
    p.x, p.y, step.x, step.y,
    (x, y) => canOccupy(ow, x, y, r)
  );
  p.x = result.x;
  p.y = result.y;
  const moved = result.moved;
  p.x = Math.max(TILE / 2, Math.min(ow.cols * TILE - TILE / 2, p.x));
  p.y = Math.max(TILE / 2, Math.min(ow.rows * TILE - TILE / 2, p.y));
  if (moved) {
    const now = performance.now();
    if (ow.lastStepSoundAt === undefined || now - ow.lastStepSoundAt >= 175) {
      playSound('step');
      ow.lastStepSoundAt = now;
    }
  }
}

export function updateOverworld(dt) {
  const ow = state.overworld;
  if (!ow || !ow.active) return;
  updateCamera(dt);
  if (ow.shake && ow.shake.t > 0) { ow.shake.t -= dt * 0.0167; if (ow.shake.t <= 0) { ow.shake.t = 0; ow.shake.mag = 0; } }
  updateParticles(dt);
  ow.floatingNumbers = ow.floatingNumbers.filter(fn => { fn.life -= dt * 0.02; fn.y -= dt * 0.6; return fn.life > 0; });

  const now = performance.now();
  for (let enemyIndex = 0; enemyIndex < ow.enemies.length; enemyIndex++) {
    const e = ow.enemies[enemyIndex];
    if (e.dead && e.respawnAt && now >= e.respawnAt) {
      e.dead = false; e.hp = e.maxHp; e.x = e.homeX; e.y = e.homeY; e.state = 'idle'; e.respawnAt = 0; e.effects = []; e.phase = 0; e.tacticalSpecialPending = false;
      if (state.game?.world && (ow.sourceLocationId || ow.locationId) && e.persistentId) recordRegionEnemyRespawned(state.game.world, ow.sourceLocationId || ow.locationId, e.persistentId);
    }
  }

  if (ow.combat || ow.defeated) return;

  const regionId = ow.sourceLocationId || ow.locationId;
  if (state.game && regionId) {
    let previousGame = null;
    try { previousGame = JSON.stringify(state.game); } catch {}
    const eventUpdate = advanceWorldEvents(state.game, dt, regionId);
    if (eventUpdate.changed) {
      if (!saveGame() && previousGame) {
        try { state.game = JSON.parse(previousGame); } catch {}
      } else {
        for (const event of eventUpdate.started) {
          emit('log', { channel: 'game', msg: 'Новое мировое событие: ' + event.name, cls: 'success' });
        }
        for (const event of eventUpdate.finished) {
          emit('log', {
            channel: 'game',
            msg: (event.status === 'failed' ? 'Событие провалено: ' : 'Событие завершилось: ') + event.name,
            cls: event.status === 'failed' ? 'warning' : 'success'
          });
        }
      }
    }
    const visibleEvents = getVisibleWorldEventsForRegion(state.game, regionId);
    syncWorldEventMarkers(
      ow,
      visibleEvents.filter(event => event.status === 'active'),
      visibleEvents.filter(event => event.status === 'completed')
    );
  }

  const groupBehaviors = getEnemyGroupBehaviors(ow.enemies, ow.player, { aggroRange: AGGRO_RANGE, leashRange: LEASH_RANGE });

  // AI NPC
  for (const npc of ow.npcs) {
    const distToPlayer = Math.hypot(npc.x - ow.player.x, npc.y - ow.player.y);
    
    // Если игрок близко, NPC останавливается
    if (distToPlayer < npc.interactionRadius + 20) {
      npc.state = 'idle';
      continue;
    }

    // Иначе гуляет вокруг дома
    npc.wanderTimer -= dt * 0.02;
    if (npc.wanderTimer <= 0) {
      npc.wanderTimer = 2 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      npc.wanderDx = Math.cos(a);
      npc.wanderDy = Math.sin(a);
    }
    const dHome = Math.hypot(npc.x - npc.homeX, npc.y - npc.homeY);
    const wanderRadius = Number.isFinite(npc.wanderRadius) ? npc.wanderRadius : 80;
    if (dHome > wanderRadius) {
      npc.wanderDx = (npc.homeX - npc.x) / (dHome || 1);
      npc.wanderDy = (npc.homeY - npc.y) / (dHome || 1);
    }
    const spd = (npc.wanderSpeed || 0.5) * dt;
    const others = [...ow.npcs, ...ow.enemies, ow.player];
    if (!moveActor(ow, npc, npc.wanderDx * spd, npc.wanderDy * spd, npc.collisionRadius || NPC_COLLISION_RADIUS, others)) {
      npc.wanderDx = -npc.wanderDx;
      npc.wanderDy = -npc.wanderDy;
    }
  }

  for (let enemyIndex = 0; enemyIndex < ow.enemies.length; enemyIndex++) {
    const e = ow.enemies[enemyIndex];
    if (e.dead) continue;
    const distanceToPlayer = Math.hypot(e.x - ow.player.x, e.y - ow.player.y);
    // Preserve contact-triggered combat even if a test, spawn correction, or
    // knockback places the enemy outside its normal home leash.
    const engagementRange = getEnemyEngagementRange(ENEMIES[e.enemyId]?.special?.type);
    if (distanceToPlayer < engagementRange) {
      enterCombat(e);
      return;
    }
    const behavior = groupBehaviors[enemyIndex];
    e.state = behavior.state;

    const others = [...ow.enemies, ...ow.npcs, ow.player];
    const radius = e.collisionRadius || ENEMY_COLLISION_RADIUS;
    if (behavior.state === 'chase' || behavior.state === 'return') {
      const spd = (behavior.state === 'chase' ? 2.2 : 1.8) * dt;
      const steering = getEnemySteering(e.x, e.y, behavior.targetX, behavior.targetY,
        (x, y) => canOccupyActor(ow, e, x, y, radius, others));
      if (!steering.blocked) moveActor(ow, e, steering.x * spd, steering.y * spd, radius, others);
    } else {
      e.wanderTimer -= dt * 0.02;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        e.wanderDx = Math.cos(a); e.wanderDy = Math.sin(a);
      }
      const dHome = Math.hypot(e.x - e.homeX, e.y - e.homeY);
      if (dHome > 100) {
        e.wanderDx = (e.homeX - e.x) / (dHome || 1);
        e.wanderDy = (e.homeY - e.y) / (dHome || 1);
      }
      const spd = 0.9 * dt;
      if (!moveActor(ow, e, e.wanderDx * spd, e.wanderDy * spd, radius, others)) {
        e.wanderDx = -e.wanderDx;
        e.wanderDy = -e.wanderDy;
      }
    }
  }

  for (const c of ow.chests) {
    if (c.opened) continue;
    if (Math.hypot(c.x - ow.player.x, c.y - ow.player.y) < 40) openChest(c);
  }
}

function updateCamera(dt = 1) {
  const ow = state.overworld;
  const mapW = ow.cols * ow.tile, mapH = ow.rows * ow.tile;
  let targetX, targetY;
  if (mapW <= VIEW_W) targetX = (mapW - VIEW_W) / 2;
  else targetX = Math.max(0, Math.min(mapW - VIEW_W, ow.player.x - VIEW_W / 2));
  if (mapH <= VIEW_H) targetY = (mapH - VIEW_H) / 2;
  else targetY = Math.max(0, Math.min(mapH - VIEW_H, ow.player.y - VIEW_H / 2));
  ow.camera.x = getCameraPosition(ow.camera.x, targetX, dt);
  ow.camera.y = getCameraPosition(ow.camera.y, targetY, dt);
}