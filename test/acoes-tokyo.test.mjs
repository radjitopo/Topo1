import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apiSource = await readFile(new URL('../acoes-nz-api.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');

function apiTickers() {
  return [...apiSource.matchAll(/ticker:\s*['"](\d{4})['"],\s*symbol:\s*['"](\d{4}\.T)['"]/g)].map(
    (match) => ({ ticker: match[1], symbol: match[2] }),
  );
}

function pageTickers() {
  return [...pageSource.matchAll(/\{ticker:"(\d{4})",name:/g)].map((match) => match[1]);
}

test('Tokyo board and API expose the same 30 unique stocks', () => {
  const apiStocks = apiTickers();
  const uiTickers = pageTickers();

  assert.equal(apiStocks.length, 30);
  assert.equal(uiTickers.length, 30);
  assert.equal(new Set(uiTickers).size, 30);
  assert.deepEqual(
    apiStocks.map((stock) => stock.ticker),
    uiTickers,
  );
  apiStocks.forEach((stock) => assert.equal(stock.symbol, `${stock.ticker}.T`));
});

test('30 sounds fill one ten-second cycle at three sounds per second', () => {
  const soundCount = 30;
  const cycleMs = 10000;
  const soundsPerSecond = 3;
  const spacingMs = 1000 / soundsPerSecond;

  assert.equal(soundCount / soundsPerSecond, cycleMs / 1000);
  assert.ok((soundCount - 1) * spacingMs < cycleMs);
  assert.match(pageSource, /const SOUND_CYCLE_MS = 10000;/);
  assert.match(pageSource, /const SOUNDS_PER_SECOND = 3;/);
  assert.match(pageSource, /index \* SOUND_SPACING_MS/);
  assert.match(pageSource, /setInterval\(scheduleMainSounds,SOUND_CYCLE_MS\)/);
});
