import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PARTICIPATION_SCORE, normalizeShareToken } from '../participation-score.js';
import { compactSource } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('the approved five-part score has stable values', () => {
  assert.deepEqual(PARTICIPATION_SCORE, {
    directVote: 1,
    completedDuel: 10,
    rankingParticipation: 5,
    activeDay: 10,
    qualifiedShare: 20,
    qualifiedSharesPerDay: 3,
  });
  assert.equal(normalizeShareToken('abcdefghijklmnopqrstuvwx'), 'abcdefghijklmnopqrstuvwx');
  assert.equal(normalizeShareToken('short'), '');
});

test('score events are durable, unique and backfilled from real participation', async () => {
  const migration = await readFile(
    new URL('migrations/20260903_participation_score.sql', root),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_score_events/);
  assert.match(migration, /UNIQUE \(user_id, event_type, event_key\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ranking_share_referrals/);
  assert.match(migration, /history\.option_id::text/);
  assert.match(migration, /session\.completed = true/);
  assert.match(migration, /America\/Sao_Paulo/);
  assert.match(migration, /ranking\.is_vip = false/);
  for (const [eventType, points] of [
    ['direct_vote', 1],
    ['ranking_participation', 5],
    ['completed_duel', 10],
    ['active_day', 10],
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'[\\s\\S]{0,180}\\n\\s*${points},`));
  }
});

test('votes, duels and qualified shares all feed the score safely', async () => {
  const [api, app, duelApi, scoring, packageJson] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('duel-bottom-api.js', root), 'utf8'),
    readFile(new URL('participation-score.js', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8'),
  ]);
  const compactApi = compactSource(api);
  const compactApp = compactSource(app);
  const compactDuelApi = compactSource(duelApi);
  const compactScoring = compactSource(scoring);

  assert.match(compactApi, /action==='ranking-share'\)returncreateRankingShare/);
  assert.match(compactApi, /SUM\(event\.points\).*ASpoints/);
  assert.match(compactApi, /scoreParticipationQueries\(sql,/);
  assert.match(compactApp, /\/api\?action=ranking-share/);
  assert.match(compactApp, /referral_token:incomingShareReferralToken\(/);
  assert.match(compactApp, /data-whatsapp-share/);
  assert.match(app, /1ª participação no ranking: 5/);
  assert.match(compactDuelApi, /scoreParticipationQueries\(sql,/);
  assert.match(compactDuelApi, /qualifyRankingShare\(sql,/);
  assert.match(compactScoring, /event_type='qualified_share'/);
  assert.match(compactScoring, /converted_atISNULL/);
  assert.match(compactScoring, /ranking\.is_vip=false/);
  assert.match(packageJson, /db:participation-score/);
});
