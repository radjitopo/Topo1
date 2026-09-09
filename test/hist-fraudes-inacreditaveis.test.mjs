import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const definition = JSON.parse(
  await readFile(new URL('data/hist-fraudes-inacreditaveis.json', root), 'utf8'),
);

test('fraud ranking is broad, Brazilian-led and duplicate-free', () => {
  assert.equal(definition.rankingId, 'hist-fraudes-inacreditaveis');
  assert.equal(definition.question, 'Qual é a farsa ou o golpe mais inacreditável?');
  assert.equal(definition.options.length, 14);
  assert.equal(new Set(definition.options).size, 14);
  assert.equal(definition.previousOptions.length, 14);
  assert.equal(new Set(definition.previousOptions).size, 14);
  assert.ok(definition.options.every((label) => label.length >= 2 && label.length <= 80));

  for (const expected of [
    'Grávida de Taubaté',
    'Golpe do bilhete premiado',
    'Golpe do falso sequestro',
    'WhatsApp',
    'Urubu do Pix',
    'Avestruz Master',
    'TelexFree',
  ]) {
    assert.ok(
      definition.options.some((label) => label.includes(expected)),
      `missing familiar option: ${expected}`,
    );
  }

  for (const removed of ['Enron', 'Wirecard', 'South Sea Bubble', 'WorldCom', 'OneCoin']) {
    assert.ok(!definition.options.some((label) => label.includes(removed)));
  }
});

test('refresh is idempotent and resets obsolete duel data only when content changes', async () => {
  const script = await readFile(
    new URL('scripts/apply-hist-fraudes-inacreditaveis.mjs', root),
    'utf8',
  );

  assert.match(script, /hist_fraudes_refresh_needed/);
  assert.match(script, /hist_fraudes_previous/);
  assert.match(script, /mudou desde a revisão/);
  assert.match(script, /DELETE FROM ranking_duel_rounds/);
  assert.match(script, /DELETE FROM ranking_duel_sessions/);
  assert.match(script, /DELETE FROM ranking_options/);
  assert.match(script, /content_updated_at = now\(\)/);
  assert.match(script, /EXCEPT/);
});
