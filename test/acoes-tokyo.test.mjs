import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apiSource = await readFile(new URL('../acoes-nz-api.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const { default: quoteHandler } = await import('../acoes-nz-api.js');

function arrayBlock(source, constantName) {
  const match = source.match(new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${constantName} was not found`);
  return match[1];
}

function apiStocks(constantName) {
  return [
    ...arrayBlock(apiSource, constantName).matchAll(
      /ticker:\s*['"]([A-Z0-9]+)['"],\s*symbol:\s*['"]([A-Z0-9]+\.(?:T|SA))['"]/g,
    ),
  ].map((match) => ({ ticker: match[1], symbol: match[2] }));
}

function pageTickers(constantName) {
  return [...arrayBlock(pageSource, constantName).matchAll(/\{ticker:"([A-Z0-9]+)",name:/g)].map(
    (match) => match[1],
  );
}

function assertMarket(constantName, suffix) {
  const apiItems = apiStocks(constantName);
  const uiTickers = pageTickers(constantName);

  assert.equal(apiItems.length, 30);
  assert.equal(uiTickers.length, 30);
  assert.equal(new Set(uiTickers).size, 30);
  assert.deepEqual(
    apiItems.map((stock) => stock.ticker),
    uiTickers,
  );
  apiItems.forEach((stock) => assert.equal(stock.symbol, `${stock.ticker}.${suffix}`));
}

function responseRecorder() {
  const result = { headers: {} };
  return {
    result,
    response: {
      setHeader(name, value) {
        result.headers[name] = value;
      },
      status(code) {
        result.status = code;
        return this;
      },
      json(body) {
        result.body = body;
        return this;
      },
    },
  };
}

test('Tokyo board and API expose the same 30 unique stocks', () => {
  assertMarket('TOKYO_STOCKS', 'T');
});

test('Bovespa board and API expose the same 30 unique stocks', () => {
  assertMarket('BOVESPA_STOCKS', 'SA');
});

test('API selects the requested market and returns all 30 quotes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const isBovespa = String(url).includes('.SA');
    return {
      ok: true,
      async json() {
        return {
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: isBovespa ? 42.5 : 4200,
                  currency: isBovespa ? 'BRL' : 'JPY',
                  marketState: 'CLOSED',
                  regularMarketTime: 1790298000,
                },
                indicators: { quote: [{ close: [isBovespa ? 42.5 : 4200] }] },
              },
            ],
          },
        };
      },
    };
  };

  try {
    const bovespa = responseRecorder();
    await quoteHandler({ query: { market: 'bovespa' } }, bovespa.response);
    assert.equal(bovespa.result.status, 200);
    assert.equal(bovespa.result.body.marketKey, 'bovespa');
    assert.equal(bovespa.result.body.currency, 'BRL');
    assert.equal(bovespa.result.body.okCount, 30);
    assert.equal(bovespa.result.body.quotes[0].ticker, 'PETR4');

    const tokyo = responseRecorder();
    await quoteHandler({ query: { market: 'tokyo' } }, tokyo.response);
    assert.equal(tokyo.result.status, 200);
    assert.equal(tokyo.result.body.marketKey, 'tokyo');
    assert.equal(tokyo.result.body.currency, 'JPY');
    assert.equal(tokyo.result.body.okCount, 30);
    assert.equal(tokyo.result.body.quotes[0].ticker, '7203');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('market tabs have dedicated pages and API routes', () => {
  assert.match(pageSource, /data-market="tokyo">Tóquio<\/button>/);
  assert.match(pageSource, /data-market="bovespa">Bovespa<\/button>/);
  assert.ok(
    vercel.routes.some(
      (route) =>
        route.src === '/acoes-bovespa-api' && route.dest === '/acoes-nz-api.js?market=bovespa',
    ),
  );
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/?'));
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/([^/]+)/?'));
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
