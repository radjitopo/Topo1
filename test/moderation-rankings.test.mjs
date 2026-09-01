import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const [api, app, css, index] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../editorial-clean.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

const moderationRankings = extractTopLevelDeclaration(api, 'moderationRankings');
const compactApi = compactSource(api);
const compactApp = compactSource(app);
const compactCss = compactSource(css);

assert.match(moderationRankings, /authentication_required/);
assert.match(moderationRankings, /if \(!isModerator\(moderator\)\)/);
assert.match(moderationRankings, /FROM rankings ranking/);
assert.match(moderationRankings, /LEFT JOIN votes vote/);
assert.match(moderationRankings, /ranking\.baseline_votes/);
assert.match(moderationRankings, /COUNT\(vote\.option_id\)/);
assert.match(moderationRankings, /ranking\.is_active = true/);
assert.match(moderationRankings, /ranking\.is_vip = false/);
assert.match(moderationRankings, /ORDER BY votes DESC/);
assert.match(compactApi, /action==='moderation-rankings'\)returnmoderationRankings\(req,res\)/);

assert.match(app, /Ranking dos rankings/);
assert.match(app, /Mais votados de todos/);
assert.match(app, /A ordem e os totais são atualizados com os votos da comunidade/);
assert.match(compactApp, /queryParams\.get\('aba'\)/);
assert.match(compactApp, /requestedTab==='rankings'\?'rankings'/);
assert.match(compactApp, /activeTab==='rankings'\?'moderation-rankings'/);
assert.match(compactApp, /href="\/moderacao\?aba=rankings"/);

assert.match(compactCss, /\.moderationRankingLeaderboardRow/);
assert.match(compactCss, /\.moderationRankingVotes/);
assert.match(compactCss, /\.moderationRankingCover/);
assert.match(index, /curadoria-ranking-dos-rankings/);

console.log('Moderation rankings test passed: full vote leaderboard is wired.');
