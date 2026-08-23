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
assert.match(app, /requestedWeight=sameDirection\?\(mineWeight===2\?1:2\):1/);

assert.match(css, /\.profileLeaderboardRow\.current/);
assert.match(css, /\.profileLeaderboardPosition\.top1/);

console.log('Profile gamification test passed: double votes and user leaderboard are wired.');
