import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { extractTopLevelDeclaration } from './source-helpers.mjs';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
class FixedDate extends Date {
  static now() {
    return Date.parse('2026-08-27T12:00:00.000Z');
  }
}
const selected = [
  'NEW_BADGE_EPOCH',
  'NEW_FIRST_SHOW_EPOCH',
  'isNewRanking',
  'isFirstShowCandidate',
  'myVoteCount',
  'priorityBucket',
  'favoriteAffinity',
  'smartShuffle',
  'cityPriorityDelta',
  'sortForExperience',
  'categoryPriorityRankings',
].map((name) => extractTopLevelDeclaration(source, name));

assert.ok(selected.every(Boolean), 'priority functions must remain testable');

const context = vm.createContext({
  Date: FixedDate,
  Math,
  viewer: { rankingLimit: 20 },
  groupOf: (ranking) => ranking.cat || '',
  topoLocal: {
    isLocalRanking: () => false,
    groupForRanking: () => '',
  },
});
vm.runInContext(
  `let selectedCity='';function isLocalExperience(){return false}${selected.join('\n')}\nglobalThis.smartShuffleForTest=smartShuffle;globalThis.priorityBucketForTest=priorityBucket;globalThis.isFirstShowCandidateForTest=isFirstShowCandidate;globalThis.categoryPriorityRankingsForTest=categoryPriorityRankings;`,
  context,
);

const option = (mine = 0) => ({ mine });
const newRanking = (id) => ({
  id,
  createdAt: '2026-08-21T12:00:00.000Z',
  opts: Array.from({ length: 20 }, () => option()),
});
const oldRanking = (id, voted = 0) => ({
  id,
  createdAt: '2026-08-20T00:14:27.691Z',
  opts: Array.from({ length: 20 }, (_, index) => option(index < voted ? 1 : 0)),
});

const input = [
  oldRanking('complete', 20),
  newRanking('new'),
  oldRanking('partial', 3),
  oldRanking('unvoted', 0),
];
const result = context.smartShuffleForTest(input);

assert.equal(context.priorityBucketForTest(newRanking('new')), 0);
assert.equal(context.priorityBucketForTest(oldRanking('unvoted')), 0);
assert.equal(context.priorityBucketForTest(oldRanking('partial', 3)), 1);
assert.equal(context.priorityBucketForTest(oldRanking('complete', 20)), 2);
assert.equal(context.isFirstShowCandidateForTest(newRanking('new')), true);
assert.equal(context.isFirstShowCandidateForTest(oldRanking('old')), false);
assert.deepEqual(
  new Set(result.slice(0, 2).map((ranking) => ranking.id)),
  new Set(['new', 'unvoted']),
);
assert.equal(result[2].id, 'partial');
assert.equal(result[3].id, 'complete');

const recommended = context.categoryPriorityRankingsForTest([
  { ...oldRanking('popular-voted', 1), votes: 500, todayVotes: 20 },
  { ...oldRanking('relevant-unvoted'), votes: 80, todayVotes: 4 },
  { ...newRanking('new-unvoted'), votes: 0, todayVotes: 0 },
  { ...oldRanking('quiet-unvoted'), votes: 3, todayVotes: 0 },
]);
assert.equal(
  recommended.map((ranking) => ranking.id).join(','),
  'relevant-unvoted,quiet-unvoted,new-unvoted,popular-voted',
);
console.log('Priority test passed: unvoted rankings lead in total-vote order.');
