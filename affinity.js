export function affinityPercent(commonRankings, sameWinners) {
  const common = Math.max(0, Math.floor(Number(commonRankings) || 0));
  if (!common) return null;

  const same = Math.min(common, Math.max(0, Math.floor(Number(sameWinners) || 0)));
  return Math.round((same / common) * 100);
}
