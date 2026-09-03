import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [api, app, css] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../editorial-clean.css', import.meta.url), 'utf8'),
]);
const compactApi = compactSource(api);
const compactApp = compactSource(app);
const compactCss = compactSource(css);
const profileApi = compactApi.slice(
  compactApi.indexOf('asyncfunctionprofile(req,res)'),
  compactApi.indexOf('asyncfunctionleaderboard(req,res)'),
);
const leaderboardApi = compactApi.slice(
  compactApi.indexOf('asyncfunctionleaderboard(req,res)'),
  compactApi.indexOf('asyncfunctioncreateNameReport'),
);
const scorecard = compactApp.slice(
  compactApp.indexOf('functionpersonalScorecardHTML'),
  compactApp.indexOf('functionpersonalActivityHTML'),
);

assert.match(
  compactApi,
  /constPARTICIPATION_SCORE=Object\.freeze\(\{directVote:1,duelDecision:1,?\}\)/,
);
assert.match(profileApi, /duel_activityAS\(/);
assert.match(profileApi, /round\.skipped=false/);
assert.match(profileApi, /ASpoints/);
assert.match(profileApi, /SELECTcreated_atASoccurred_atFROMranking_duel_rounds/);
assert.match(
  compactApi.slice(
    compactApi.indexOf('asyncfunctiondoubleVoteState'),
    compactApi.indexOf('asyncfunctionupsertNotification'),
  ),
  /FROMranking_duel_roundsWHEREuser_id=\$1ANDskipped=false/,
);
assert.match(leaderboardApi, /WITHdirect_statsAS\(/);
assert.match(leaderboardApi, /duel_statsAS\(/);
assert.match(leaderboardApi, /scored\.pointsDESC/);
assert.match(leaderboardApi, /points:Number\(row\.points\|\|0\)/);

for (const label of ['Pontuação', 'Votos', 'Rankings', 'Sequência', 'Posição']) {
  assert.match(scorecard, new RegExp(label));
}
assert.match(scorecard, /cadavotolivreouescolhaválidanoduelosoma1ponto/i);
assert.match(
  compactApp,
  /personalAreaHeaderHTML\('activity'\).*personalScorecardHTML\(profileData\).*vipActivityLead/,
  'the scorecard must be the first content block in Meu Topo',
);
assert.match(compactApp, /scorecardPosition\.textContent=`\$\{fmt\(current\.position\)\}º`/);

assert.match(compactCss, /\.profileScorecard\{/);
assert.match(compactCss, /\.profileScorecard\.profileMetrics\{/);
assert.match(
  compactCss,
  /@media\(max-width:700px\)[\s\S]*\.profileScorecard\.profileMetrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
);
assert.match(compactCss, /\.profileScoreMetricPrimary\{[^}]*grid-column:1\/-1/);

console.log('Meu Topo scorecard test passed: score, activity, streak, and position are first.');
