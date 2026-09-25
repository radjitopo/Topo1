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
      /ticker:\s*['"]([A-Z0-9]+)['"],\s*symbol:\s*['"]([A-Z0-9]+\.(?:T|SA|DE|MC))['"]/g,
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

test('Frankfurt board and API expose the same 30 unique stocks', () => {
  assertMarket('FRANKFURT_STOCKS', 'DE');
});

test('Madrid board and API expose the same 30 unique stocks', () => {
  assertMarket('MADRID_STOCKS', 'MC');
});

test('API selects the requested market and returns all 30 quotes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlText = String(url);
    const isBovespa = urlText.includes('.SA');
    const isEuro = urlText.includes('.DE') || urlText.includes('.MC');
    const price = isBovespa ? 42.5 : isEuro ? 125.75 : 4200;
    return {
      ok: true,
      async json() {
        return {
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: price,
                  currency: isBovespa ? 'BRL' : isEuro ? 'EUR' : 'JPY',
                  marketState: 'CLOSED',
                  regularMarketTime: 1790298000,
                },
                indicators: { quote: [{ close: [price] }] },
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

    const frankfurt = responseRecorder();
    await quoteHandler({ query: { market: 'frankfurt' } }, frankfurt.response);
    assert.equal(frankfurt.result.status, 200);
    assert.equal(frankfurt.result.body.marketKey, 'frankfurt');
    assert.equal(frankfurt.result.body.currency, 'EUR');
    assert.equal(frankfurt.result.body.okCount, 30);
    assert.equal(frankfurt.result.body.quotes[0].ticker, 'SAP');

    const madrid = responseRecorder();
    await quoteHandler({ query: { market: 'madrid' } }, madrid.response);
    assert.equal(madrid.result.status, 200);
    assert.equal(madrid.result.body.marketKey, 'madrid');
    assert.equal(madrid.result.body.currency, 'EUR');
    assert.equal(madrid.result.body.okCount, 30);
    assert.equal(madrid.result.body.quotes[0].ticker, 'SAN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('market tabs have dedicated pages and API routes', () => {
  assert.match(pageSource, /data-market="tokyo">Tóquio<\/button>/);
  assert.match(pageSource, /data-market="bovespa">Bovespa<\/button>/);
  assert.match(pageSource, /data-market="frankfurt">Frankfurt<\/button>/);
  assert.match(pageSource, /data-market="madrid">Madrid<\/button>/);
  assert.ok(
    vercel.routes.some(
      (route) =>
        route.src === '/acoes-bovespa-api' && route.dest === '/acoes-nz-api.js?market=bovespa',
    ),
  );
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/?'));
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/([^/]+)/?'));
  for (const market of ['frankfurt', 'madrid']) {
    assert.ok(
      vercel.routes.some(
        (route) =>
          route.src === `/acoes-${market}-api` &&
          route.dest === `/acoes-nz-api.js?market=${market}`,
      ),
    );
    assert.ok(vercel.routes.some((route) => route.src === `/acoes-${market}/?`));
    assert.ok(vercel.routes.some((route) => route.src === `/acoes-${market}/([^/]+)/?`));
  }
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
