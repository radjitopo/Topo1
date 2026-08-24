import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [api, app, css] = await Promise.all([
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8')
]);

assert.match(api, /async function leaderboard\(req, res\)/);
assert.match(api, /action === 'leaderboard'/);
assert.match(api, /show_avatar_on_leaderboard/);
assert.match(api, /DENSE_RANK\(\) OVER/);

assert.match(app, /\/api\?action=leaderboard/);
assert.match(app, /Ranking da comunidade/);
assert.match(app, /profileLeaderboardRow/);
assert.match(app, /const doubleVoteThresholds=\[20,75,200\]/);
assert.match(app, /function doubleVoteActionHTML\(o,direction\)/, 'an available double vote must use its own control');
assert.match(app, /direction=mine===clicked\?0:clicked/, 'touching a selected arrow again must remove the vote');
assert.match(app, /function toggleDoubleVote\(button\)/, 'double votes must be activated separately from normal arrows');
assert.doesNotMatch(app, /showDoubleVoteLocked|showDoubleVoteLimit|showDoubleVoteAccount/, 'double-vote interactions must not interrupt voting with messages');
assert.doesNotMatch(app, /Voto duplo ativado|Voltou ao voto simples/, 'double-vote changes must stay silent');
assert.match(app, /use o pequeno botão 2× ao lado da seta/, 'the one-time help must explain the separate 2× control');

assert.match(css, /\.profileLeaderboardRow\.current/);
assert.match(css, /\.profileLeaderboardPosition\.top1/);
assert.match(css, /\.doubleVoteAction\{/, 'the compact 2× control must be styled');

console.log('Profile gamification test passed: silent double votes and user leaderboard are wired.');
