export const CAMPAIGN_BRANCHES = Object.freeze(['intro', 'ash', 'ice', 'blood']);

export function getCampaignBranchForMission(missionId) {
  const match = /^a([1-5])-m\d+$/.exec(String(missionId || ''));
  if (!match) return null;
  const act = Number(match[1]);
  if (act <= 2) return 'intro';
  if (act === 3) return 'ash';
  if (act === 4) return 'ice';
  return 'blood';
}

export function ensureCampaignBranchState(player) {
  if (!player || typeof player !== 'object') return null;
  if (!player.activeCampaignByBranch || typeof player.activeCampaignByBranch !== 'object' || Array.isArray(player.activeCampaignByBranch)) {
    player.activeCampaignByBranch = Object.fromEntries(CAMPAIGN_BRANCHES.map(branch => [branch, null]));
  }
  for (const branch of CAMPAIGN_BRANCHES) {
    const missionId = player.activeCampaignByBranch[branch];
    if (missionId && getCampaignBranchForMission(missionId) !== branch) {
      player.activeCampaignByBranch[branch] = null;
    }
  }

  const legacyActive = typeof player.activeCampaignMission === 'string'
    ? player.activeCampaignMission
    : null;
  const legacyBranch = getCampaignBranchForMission(legacyActive);
  if (legacyBranch && !player.activeCampaignByBranch[legacyBranch]) {
    player.activeCampaignByBranch[legacyBranch] = legacyActive;
  }
  return player.activeCampaignByBranch;
}

export function setActiveCampaignMissionForBranch(player, branch, missionId = null) {
  if (!CAMPAIGN_BRANCHES.includes(branch)) return false;
  const active = ensureCampaignBranchState(player);
  if (missionId && getCampaignBranchForMission(missionId) !== branch) return false;
  active[branch] = missionId;

  if (missionId) {
    player.activeCampaignMission = missionId;
  } else if (getCampaignBranchForMission(player.activeCampaignMission) === branch) {
    player.activeCampaignMission = CAMPAIGN_BRANCHES
      .map(candidate => active[candidate])
      .find(candidate => typeof candidate === 'string') || null;
  }
  return true;
}
