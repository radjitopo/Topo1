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

assert.match(profileApi, /duel_activityAS\(/);
assert.match(profileApi, /round\.skipped=false/);
assert.match(profileApi, /FROMuser_score_eventsevent/);
assert.match(profileApi, /SUM\(event\.points\)/);
assert.match(profileApi, /event\.event_type='active_day'/);
assert.match(
  compactApi.slice(
    compactApi.indexOf('asyncfunctiondoubleVoteState'),
    compactApi.indexOf('asyncfunctionupsertNotification'),
  ),
  /FROMranking_duel_roundsWHEREuser_id=\$1ANDskipped=false/,
);
assert.match(leaderboardApi, /WITHdirect_statsAS\(/);
assert.match(leaderboardApi, /duel_statsAS\(/);
assert.match(leaderboardApi, /score_statsAS\(/);
assert.match(leaderboardApi, /scored\.pointsDESC/);
assert.match(leaderboardApi, /points:Number\(row\.points\|\|0\)/);

for (const label of ['Pontuação', 'Votos', 'Rankings', 'Sequência', 'Posição']) {
  assert.match(scorecard, new RegExp(label));
}
assert.doesNotMatch(scorecard, /Seuplacar/i, 'the redundant scorecard heading must stay removed');
assert.doesNotMatch(scorecard, /SuaforçanoTOPO/, 'the repeated large heading must stay removed');
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
  /@media\(max-width:700px\)[\s\S]*\.profileScorecard\.profileMetrics\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
);
assert.match(compactCss, /\.profileScoreMetricPrimary\{[^}]*grid-column:1\/-1/);
assert.match(
  compactCss,
  /\.profileScoreMetricPrimary\{[^}]*min-height:58px;[^}]*display:grid/,
  'the mobile score highlight must be a short horizontal strip',
);
assert.match(
  compactCss,
  /\.profileScoreMetricPrimarystrong\{[^}]*font-size:44px/,
  'the total score must remain the visual focus',
);
assert.match(compactCss, /--clean-gold:#f4c430/);
assert.match(
  compactCss,
  /\.profileScoreMetricPrimarystrong\{[^}]*color:var\(--clean-gold\)/,
  'the total score must use the gold accent',
);
assert.match(
  compactCss,
  /\.profileScorePosition\{box-shadow:inset0-3px0var\(--clean-coral\)/,
  'the position must use a full-width red line along the bottom of its cell',
);
assert.doesNotMatch(compactCss, /\.profileScorePositionstrong\{[^}]*border-bottom/);

console.log('Meu Topo scorecard test passed: total points lead a dense five-metric block.');
