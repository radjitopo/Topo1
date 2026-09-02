import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { compactSource, extractTopLevelDeclaration } from './source-helpers.mjs';

const root = new URL('../', import.meta.url);

test('Google Maps profiles are limited to Libre and Desvio in the vegan Floripa ranking', async () => {
  const app = await readFile(new URL('app.js', root), 'utf8');
  const profiles = extractTopLevelDeclaration(app, 'googlePlaceProfiles');
  const normalizeLabel = extractTopLevelDeclaration(app, 'normalizedGooglePlaceOptionLabel');
  const findProfile = extractTopLevelDeclaration(app, 'googlePlaceProfileForOption');
  assert.ok(
    profiles && normalizeLabel && findProfile,
    'the profile allowlist must remain testable',
  );

  const context = vm.createContext({});
  vm.runInContext(
    `${profiles}\n${normalizeLabel}\n${findProfile}\n` +
      `globalThis.profileKeys = Object.keys(googlePlaceProfiles).sort();\n` +
      `globalThis.libre = googlePlaceProfileForOption({ id: 'restaurantes-veganos-floripa' }, { label: 'Libre Cozinha' })?.id;\n` +
      `globalThis.desvio = googlePlaceProfileForOption({ id: 'restaurantes-veganos-floripa' }, { label: 'Desvio' })?.id;\n` +
      `globalThis.libreRating = googlePlaceProfiles.libre.rating;\n` +
      `globalThis.libreReviews = googlePlaceProfiles.libre.reviewCount;\n` +
      `globalThis.desvioRating = googlePlaceProfiles.desvio.rating;\n` +
      `globalThis.desvioReviews = googlePlaceProfiles.desvio.reviewCount;\n` +
      `globalThis.otherOption = googlePlaceProfileForOption({ id: 'restaurantes-veganos-floripa' }, { label: 'Girassol Veg' });\n` +
      `globalThis.otherRanking = googlePlaceProfileForOption({ id: 'bares-floripa' }, { label: 'Desvio' });`,
    context,
  );

  assert.deepEqual([...context.profileKeys], ['desvio', 'libre']);
  assert.equal(context.libre, 'libre');
  assert.equal(context.desvio, 'desvio');
  assert.equal(context.libreRating, '4,9');
  assert.equal(context.libreReviews, 128);
  assert.equal(context.desvioRating, '4,7');
  assert.equal(context.desvioReviews, 588);
  assert.equal(context.otherOption, null);
  assert.equal(context.otherRanking, null);
});

test('clicking either allowed name opens the live official Google Maps panel', async () => {
  const [app, editorial, template] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('editorial-clean.css', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  const compactApp = compactSource(app);
  const optionName = extractTopLevelDeclaration(app, 'rankingVoteOptionNameHTML');
  const openProfile = extractTopLevelDeclaration(app, 'openGooglePlaceProfile');
  const bindProfiles = extractTopLevelDeclaration(app, 'bindGooglePlaceProfiles');

  assert.match(optionName, /data-google-place/);
  assert.match(optionName, /Nota no Google Maps/);
  assert.match(openProfile, /googlePlaceFrame/);
  assert.match(openProfile, /googlePlaceRatingCard/);
  assert.match(openProfile, /profile\.rating/);
  assert.match(openProfile, /profile\.reviewCount/);
  assert.match(openProfile, /profile\.ratingCheckedAt/);
  assert.match(openProfile, /loading="lazy"/);
  assert.match(openProfile, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.match(openProfile, /ABRIR NO GOOGLE MAPS/);
  assert.match(bindProfiles, /openGooglePlaceProfile/);
  assert.match(compactApp, /functionbindVotes\(\)[\s\S]*bindGooglePlaceProfiles\(\)/);
  assert.match(editorial, /\.googlePlaceTrigger/);
  assert.match(editorial, /\.googlePlaceModalCard/);
  assert.match(editorial, /\.googlePlaceRatingCard/);
  assert.match(editorial, /height: clamp\(180px, 28dvh, 220px\)/);
  assert.match(template, /editorial-clean\.css[^"\n]*google-place-profiles/);
  assert.match(template, /app\.js[^"\n]*google-place-profiles/);
});
