import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const lines = source.split('\n');
const selected = lines.filter((line) =>
  line.startsWith('const NEW_BADGE_EPOCH=') ||
  line.startsWith('const NEW_FIRST_SHOW_EPOCH=') ||
  line.startsWith('function isNewRanking(') ||
  line.startsWith('function isFirstShowCandidate(') ||
  line.startsWith('function myVoteCount(') ||
  line.startsWith('function priorityBucket(') ||
  line.startsWith('function smartShuffle(') ||
  line.startsWith('function categoryPriorityRankings(')
);

assert.equal(selected.length, 8, 'priority functions must remain testable');

const context = vm.createContext({
  Date,
  Math,
  viewer: { rankingLimit: 20 }
});
vm.runInContext(
  `${selected.join('\n')}\nglobalThis.smartShuffleForTest=smartShuffle;globalThis.priorityBucketForTest=priorityBucket;globalThis.isFirstShowCandidateForTest=isFirstShowCandidate;globalThis.categoryPriorityRankingsForTest=categoryPriorityRankings;`,
  context
);

const option = (mine = 0) => ({ mine });
const newRanking = (id) => ({
  id,
  createdAt: '2026-08-21T12:00:00.000Z',
  opts: Array.from({ length: 20 }, () => option())
});
const oldRanking = (id, voted = 0) => ({
  id,
  createdAt: '2026-08-20T00:14:27.691Z',
  opts: Array.from({ length: 20 }, (_, index) => option(index < voted ? 1 : 0))
});

const input = [
  oldRanking('complete', 20),
  newRanking('new'),
  oldRanking('partial', 3),
  oldRanking('unvoted', 0)
];
const result = context.smartShuffleForTest(input);

assert.equal(context.priorityBucketForTest(newRanking('new')), 0);
assert.equal(context.priorityBucketForTest(oldRanking('unvoted')), 0);
assert.equal(context.priorityBucketForTest(oldRanking('partial', 3)), 1);
assert.equal(context.priorityBucketForTest(oldRanking('complete', 20)), 2);
assert.equal(context.isFirstShowCandidateForTest(newRanking('new')), true);
assert.equal(context.isFirstShowCandidateForTest(oldRanking('old')), false);
assert.deepEqual(new Set(result.slice(0, 2).map((ranking) => ranking.id)), new Set(['new', 'unvoted']));
assert.equal(result[2].id, 'partial');
assert.equal(result[3].id, 'complete');

const recommended = context.categoryPriorityRankingsForTest([
  { ...oldRanking('popular-voted', 1), votes: 500, todayVotes: 20 },
  { ...oldRanking('relevant-unvoted'), votes: 80, todayVotes: 4 },
  { ...newRanking('new-unvoted'), votes: 0, todayVotes: 0 },
  { ...oldRanking('quiet-unvoted'), votes: 3, todayVotes: 0 }
]);
assert.equal(
  recommended.map((ranking) => ranking.id).join(','),
  'new-unvoted,relevant-unvoted,quiet-unvoted,popular-voted'
);
console.log('Priority test passed: new and unvoted rankings share the same random pool.');
