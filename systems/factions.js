export const FACTIONS = Object.freeze({
  'hub-guardians': Object.freeze({ id: 'hub-guardians', name: 'Стражи Хаба' }),
  'rift-cult': Object.freeze({ id: 'rift-cult', name: 'Культисты Разлома' }),
  'free-traders': Object.freeze({ id: 'free-traders', name: 'Вольные торговцы' }),
  'ash-nomads': Object.freeze({ id: 'ash-nomads', name: 'Пепельные кочевники' })
});

export const FACTION_REPUTATION_MIN = -100;
export const FACTION_REPUTATION_MAX = 100;
export const FACTION_LOG_LIMIT = 50;

export function createFactionState() {
  return {
    schemaVersion: 1,
    reputation: Object.fromEntries(Object.keys(FACTIONS).map(id => [id, 0])),
    changeLog: []
  };
}

export function ensureFactionState(game) {
  if (!game || typeof game !== 'object') return null;
  if (!game.factions || typeof game.factions !== 'object' || Array.isArray(game.factions)) {
    game.factions = createFactionState();
    return game.factions;
  }

  const factions = game.factions;
  factions.schemaVersion = 1;
  if (!factions.reputation || typeof factions.reputation !== 'object' || Array.isArray(factions.reputation)) {
    factions.reputation = {};
  }
  for (const id of Object.keys(FACTIONS)) {
    const value = Number(factions.reputation[id]);
    factions.reputation[id] = Number.isFinite(value)
      ? Math.max(FACTION_REPUTATION_MIN, Math.min(FACTION_REPUTATION_MAX, Math.round(value)))
      : 0;
  }
  if (!Array.isArray(factions.changeLog)) factions.changeLog = [];
  if (factions.changeLog.length > FACTION_LOG_LIMIT) factions.changeLog = factions.changeLog.slice(-FACTION_LOG_LIMIT);
  return factions;
}

export function getFactionRank(value) {
  const reputation = Math.max(FACTION_REPUTATION_MIN, Math.min(FACTION_REPUTATION_MAX, Number(value) || 0));
  if (reputation <= -75) return 'hostile';
  if (reputation <= -30) return 'wary';
  if (reputation < 30) return 'neutral';
  if (reputation < 70) return 'friendly';
  if (reputation < 90) return 'honored';
  return 'allied';
}

export function getFactionReputation(game, factionId) {
  if (!FACTIONS[factionId]) return 0;
  return ensureFactionState(game)?.reputation?.[factionId] ?? 0;
}

export function changeFactionReputation(game, factionId, amount, reason = 'unknown', source = 'system') {
  if (!FACTIONS[factionId] || !Number.isFinite(amount) || amount === 0) return null;
  const factions = ensureFactionState(game);
  const previous = factions.reputation[factionId];
  const value = Math.max(
    FACTION_REPUTATION_MIN,
    Math.min(FACTION_REPUTATION_MAX, Math.round(previous + amount))
  );
  const delta = value - previous;
  if (!delta) return { factionId, previous, value, delta: 0, rank: getFactionRank(value) };

  factions.reputation[factionId] = value;
  factions.changeLog.push({
    factionId,
    delta,
    value,
    reason: String(reason).slice(0, 160),
    source: String(source).slice(0, 40)
  });
  if (factions.changeLog.length > FACTION_LOG_LIMIT) {
    factions.changeLog.splice(0, factions.changeLog.length - FACTION_LOG_LIMIT);
  }
  return { factionId, previous, value, delta, rank: getFactionRank(value) };
}

/** Free Traders reward trusted allies with a capped merchant discount. */
export function getFactionTradeDiscount(game) {
  const reputation = getFactionReputation(game, 'free-traders');
  if (reputation >= 90) return 0.15;
  if (reputation >= 70) return 0.10;
  if (reputation >= 30) return 0.05;
  return 0;
}
export function getFactionTradeBenefitLabel(game) {
  const discount = getFactionTradeDiscount(game);
  return discount > 0 ? 'Скидка торговцев: ' + Math.round(discount * 100) + '%' :
    'Скидка торговцев откроется при репутации +30';
}

/** Guardian allies blunt incoming overworld combat damage. */
export function getFactionDamageReduction(game) {
  const reputation = getFactionReputation(game, 'hub-guardians');
  if (reputation >= 90) return 0.15;
  if (reputation >= 70) return 0.10;
  if (reputation >= 30) return 0.05;
  return 0;
}
/** Ash Nomads improve the chance of ordinary enemy loot drops. */
export function getFactionLootBonus(game) {
  const reputation = getFactionReputation(game, 'ash-nomads');
  if (reputation >= 90) return 0.15;
  if (reputation >= 70) return 0.10;
  if (reputation >= 30) return 0.05;
  return 0;
}
/** Rift Cult influence increases gold from its own completed world events. */
export function getFactionEventGoldBonus(game, factionId) {
  if (factionId !== 'rift-cult') return 0;
  const reputation = getFactionReputation(game, factionId);
  if (reputation >= 90) return 0.15;
  if (reputation >= 70) return 0.10;
  if (reputation >= 30) return 0.05;
  return 0;
}
