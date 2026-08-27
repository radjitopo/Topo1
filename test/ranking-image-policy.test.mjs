import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CURATED_COVER_COUNT,
  CURATED_COVER_RULES,
  imageAssetKey,
  rankingImageSearchQueries,
  rejectedRankingCoverIssue,
  resolveRankingCover,
} from '../ranking-image-policy.js';

const root = new URL('../', import.meta.url);

test('the semantic reviews replace all known weak or mismatched covers', () => {
  assert.equal(CURATED_COVER_COUNT, 59);
  const replacements = Object.values(CURATED_COVER_RULES).map((coverRule) => {
    assert.match(coverRule.replacement, /^https:\/\//);
    return imageAssetKey(coverRule.replacement);
  });
  assert.equal(
    new Set(replacements).size,
    replacements.length,
    'replacement photos must be unique',
  );

  const oldPagode =
    'https://images.unsplash.com/photo-1736184766006-377f3e9827a1?auto=format&fit=crop&w=1200&q=82';
  assert.notEqual(resolveRankingCover('bandas-pagode', oldPagode), oldPagode);
  assert.match(rejectedRankingCoverIssue('bandas-pagode', oldPagode), /não representa/);

  const oldFloripaBeach =
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=82';
  assert.match(resolveRankingCover('praias', oldFloripaBeach), /1681157865251-2155d60882c0/);

  const moderatorChoice =
    'https://images.unsplash.com/photo-1500000000000-moderatorchoice?auto=format&fit=crop&w=1200&q=82';
  assert.equal(
    resolveRankingCover('bandas-pagode', moderatorChoice),
    moderatorChoice,
    'a later moderator choice must win over the curated fallback',
  );
});

test('search briefs use the ranking meaning instead of loose title words', () => {
  const pagode = rankingImageSearchQueries({
    id: 'bandas-pagode',
    category: 'Música',
    question: 'Quem é o maior nome do pagode?',
    options: [{ label: 'Raça Negra' }, { label: 'Exaltasamba' }],
  });
  assert.match(pagode[0], /Brazilian pagode samba musicians/i);
  assert.doesNotMatch(pagode[0], /military|marching/i);

  const generic = rankingImageSearchQueries({
    id: 'novo-ranking',
    category: 'Comida',
    question: 'Qual sobremesa merece o topo?',
    options: [{ label: 'Pudim' }, { label: 'Brigadeiro' }],
  });
  assert.match(generic[0], /food photography/);
  assert.match(generic[0], /sobremesa/);
  assert.match(generic[0], /pudim/);
});

test('moderators get a visual, license-safe image chooser', async () => {
  const [api, app, page, audit, index] = await Promise.all([
    readFile(new URL('api.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('page.js', root), 'utf8'),
    readFile(new URL('scripts/audit-ranking-images.mjs', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  const suggestionEndpoint = api.slice(
    api.indexOf('async function rankingImageSuggestions'),
    api.indexOf('async function updateRankingContent'),
  );

  assert.match(suggestionEndpoint, /const user = await sessionUser\(req\)/);
  assert.match(suggestionEndpoint, /if \(!isModerator\(user\)\)/);
  assert.match(suggestionEndpoint, /rankingImageSearchQueries/);
  assert.match(api, /commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(api, /license === 'cc0'/);
  assert.match(api, /license\.includes\('public domain'\)/);
  assert.match(api, /action === 'ranking-image-suggestions'/);
  assert.match(app, /Buscar fotos que combinam/);
  assert.match(app, /data-ranking-image-suggestion/);
  assert.match(app, /action=ranking-image-suggestions/);
  assert.match(page, /resolveRankingCover/);
  assert.match(audit, /rejectedRankingCoverIssue/);
  assert.match(index, /semantic-ranking-covers/);
});
