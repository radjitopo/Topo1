export const inactiveTopoRankingIds = Object.freeze([
  'bandas-ilha-da-magia',
  'bandas-rock-ilha-da-magia',
  'bairros-floripa',
  'hoteis-floripa',
  'praias',
]);

const inactiveTopoRankingIdSet = new Set(inactiveTopoRankingIds);

export function isInactiveTopoRanking(id) {
  return inactiveTopoRankingIdSet.has(String(id || ''));
}
