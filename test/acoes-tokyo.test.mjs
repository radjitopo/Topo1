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
      /ticker:\s*['"]([A-Z0-9]+)['"],\s*symbol:\s*['"]([A-Z0-9]+(?:\.(?:T|SA|DE|MC|PA|L))?)['"]/g,
    ),
  ].map((match) => ({ ticker: match[1], symbol: match[2] }));
}

function pageTickers(constantName) {
  return [...arrayBlock(pageSource, constantName).matchAll(/\{ticker:"([A-Z0-9]+)",name:/g)].map(
    (match) => match[1],
  );
}

function assertMarket(constantName, suffix = '') {
  const apiItems = apiStocks(constantName);
  const uiTickers = pageTickers(constantName);

  assert.equal(apiItems.length, 30);
  assert.equal(uiTickers.length, 30);
  assert.equal(new Set(uiTickers).size, 30);
  assert.deepEqual(
    apiItems.map((stock) => stock.ticker),
    uiTickers,
  );
  apiItems.forEach((stock) =>
    assert.equal(stock.symbol, suffix ? `${stock.ticker}.${suffix}` : stock.ticker),
  );
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

test('Paris board and API expose the same 30 unique stocks', () => {
  assertMarket('PARIS_STOCKS', 'PA');
});

test('London board and API expose the same 30 unique stocks', () => {
  assertMarket('LONDON_STOCKS', 'L');
});

test('New York board and API expose the same 30 unique stocks', () => {
  assertMarket('NEW_YORK_STOCKS');
});

test('API selects the requested market and returns all 30 quotes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlText = String(url);
    const quote = urlText.includes('.SA')
      ? { price: 42.5, currency: 'BRL' }
      : urlText.includes('.DE') || urlText.includes('.MC') || urlText.includes('.PA')
        ? { price: 125.75, currency: 'EUR' }
        : urlText.includes('.L')
          ? { price: 12504, currency: 'GBp' }
          : { price: 4200, currency: 'JPY' };
    return {
      ok: true,
      async json() {
        return {
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: quote.price,
                  currency: quote.currency,
                  marketState: 'CLOSED',
                  regularMarketTime: 1790298000,
                },
                indicators: { quote: [{ close: [quote.price] }] },
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

    const paris = responseRecorder();
    await quoteHandler({ query: { market: 'paris' } }, paris.response);
    assert.equal(paris.result.status, 200);
    assert.equal(paris.result.body.marketKey, 'paris');
    assert.equal(paris.result.body.currency, 'EUR');
    assert.equal(paris.result.body.okCount, 30);
    assert.equal(paris.result.body.quotes[0].ticker, 'AIR');

    const london = responseRecorder();
    await quoteHandler({ query: { market: 'london' } }, london.response);
    assert.equal(london.result.status, 200);
    assert.equal(london.result.body.marketKey, 'london');
    assert.equal(london.result.body.currency, 'GBP');
    assert.equal(london.result.body.okCount, 30);
    assert.equal(london.result.body.quotes[0].ticker, 'AZN');
    assert.equal(london.result.body.quotes[0].price, 125.04);

    const newYork = responseRecorder();
    await quoteHandler({ query: { market: 'newyork' } }, newYork.response);
    assert.equal(newYork.result.status, 200);
    assert.equal(newYork.result.body.marketKey, 'newyork');
    assert.equal(newYork.result.body.currency, 'USD');
    assert.equal(newYork.result.body.okCount, 30);
    assert.equal(newYork.result.body.quotes[0].ticker, 'AAPL');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('market tabs have dedicated pages and API routes', () => {
  assert.match(pageSource, /data-market="tokyo">Tóquio<\/button>/);
  assert.match(pageSource, /data-market="bovespa">Bovespa<\/button>/);
  assert.match(pageSource, /data-market="frankfurt">Frankfurt<\/button>/);
  assert.match(pageSource, /data-market="madrid">Madrid<\/button>/);
  assert.match(pageSource, /data-market="paris">Paris<\/button>/);
  assert.match(pageSource, /data-market="london">Londres<\/button>/);
  assert.match(pageSource, /data-market="newyork">Nova York<\/button>/);
  assert.ok(
    vercel.routes.some(
      (route) =>
        route.src === '/acoes-bovespa-api' && route.dest === '/acoes-nz-api.js?market=bovespa',
    ),
  );
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/?'));
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-bovespa/([^/]+)/?'));
  for (const [market, routeSlug] of [
    ['frankfurt', 'frankfurt'],
    ['madrid', 'madrid'],
    ['paris', 'paris'],
    ['london', 'londres'],
    ['newyork', 'nova-york'],
  ]) {
    assert.ok(
      vercel.routes.some(
        (route) =>
          route.src === `/acoes-${routeSlug}-api` &&
          route.dest === `/acoes-nz-api.js?market=${market}`,
      ),
    );
    assert.ok(vercel.routes.some((route) => route.src === `/acoes-${routeSlug}/?`));
    assert.ok(vercel.routes.some((route) => route.src === `/acoes-${routeSlug}/([^/]+)/?`));
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
