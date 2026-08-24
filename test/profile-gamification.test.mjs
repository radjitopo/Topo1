import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactSource } from './source-helpers.mjs';

const [api, app, css] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);
const compactApp = compactSource(app);
const compactCss = compactSource(css);

assert.match(api, /async function leaderboard\(req, res\)/);
assert.match(api, /action === 'leaderboard'/);
assert.match(api, /show_avatar_on_leaderboard/);
assert.match(api, /DENSE_RANK\(\) OVER/);

assert.match(app, /\/api\?action=leaderboard/);
assert.match(app, /Ranking da comunidade/);
assert.match(app, /profileLeaderboardRow/);
assert.match(compactApp, /constdoubleVoteThresholds=\[20,75,200\]/);
assert.match(
  compactApp,
  /functiondoubleVoteActionHTML\(o,direction\)/,
  'an available double vote must use its own control',
);
assert.match(
  compactApp,
  /direction=mine===clicked\?0:clicked/,
  'touching a selected arrow again must remove the vote',
);
assert.match(
  compactApp,
  /functiontoggleDoubleVote\(button\)/,
  'double votes must be activated separately from normal arrows',
);
assert.doesNotMatch(
  compactApp,
  /showDoubleVoteLocked|showDoubleVoteLimit|showDoubleVoteAccount/,
  'double-vote interactions must not interrupt voting with messages',
);
assert.doesNotMatch(
  compactApp,
  /Voto duplo ativado|Voltou ao voto simples/,
  'double-vote changes must stay silent',
);
assert.match(
  compactApp,
  /useopequenobotão2×aoladodaseta/,
  'the one-time help must explain the separate 2× control',
);

assert.match(compactCss, /\.profileLeaderboardRow\.current/);
assert.match(compactCss, /\.profileLeaderboardPosition\.top1/);
assert.match(compactCss, /\.doubleVoteAction\{/, 'the compact 2× control must be styled');

console.log(
  'Profile gamification test passed: silent double votes and user leaderboard are wired.',
);
