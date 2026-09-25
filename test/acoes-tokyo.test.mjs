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
      /ticker:\s*['"]([A-Z0-9]+)['"],\s*symbol:\s*['"]([^'"]+)['"]/g,
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

test('Dow Jones board and API expose the same 30 unique stocks', () => {
  assertMarket('NEW_YORK_STOCKS');
});

test('Australia board and API expose the same 30 unique stocks', () => {
  assertMarket('AUSTRALIA_STOCKS', 'AX');
});

test('Korea board and API expose the same 30 unique stocks', () => {
  assertMarket('KOREA_STOCKS', 'KS');
});

test('China board and API expose the same 30 unique stocks', () => {
  assertMarket('CHINA_STOCKS', 'SS');
});

test('currency board and API expose the same 30 USD-normalized currencies', () => {
  const apiItems = apiStocks('CURRENCY_STOCKS');
  const uiTickers = pageTickers('CURRENCY_STOCKS');
  const block = arrayBlock(apiSource, 'CURRENCY_STOCKS');

  assert.equal(apiItems.length, 30);
  assert.equal(uiTickers.length, 30);
  assert.equal(new Set(uiTickers).size, 30);
  assert.deepEqual(
    apiItems.map((currency) => currency.ticker),
    uiTickers,
  );
  apiItems.forEach((currency) => assert.equal(currency.symbol, `USD${currency.ticker}=X`));
  assert.equal((block.match(/invert: true/g) || []).length, 30);
});

test('API selects the requested market and returns all 30 quotes', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  function quoteForSymbol(symbol) {
    return symbol.includes('=X')
      ? { price: 2, currency: 'USD' }
      : symbol.includes('.SA')
        ? { price: 42.5, currency: 'BRL' }
        : symbol.includes('.DE') || symbol.includes('.MC') || symbol.includes('.PA')
          ? { price: 125.75, currency: 'EUR' }
          : symbol.includes('.L')
            ? { price: 12504, currency: 'GBp' }
            : symbol.includes('.AX')
              ? { price: 85.25, currency: 'AUD' }
              : symbol.includes('.KS')
                ? { price: 125000, currency: 'KRW' }
                : symbol.includes('.SS')
                  ? { price: 62.5, currency: 'CNY' }
                  : { price: 4200, currency: 'JPY' };
  }

  function resultForSymbol(symbol) {
    const quote = quoteForSymbol(symbol);
    return {
      meta: {
        regularMarketPrice: quote.price,
        currency: quote.currency,
        marketState: 'CLOSED',
        regularMarketTime: 1790298000,
      },
      indicators: { quote: [{ close: [quote.price] }] },
    };
  }

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const parsed = new URL(String(url));
    const isBatch = parsed.pathname.includes('/finance/spark');
    const symbols = isBatch
      ? (parsed.searchParams.get('symbols') || '').split(',')
      : [decodeURIComponent(parsed.pathname.split('/').pop())];
    return {
      ok: true,
      async json() {
        if (isBatch) {
          return {
            spark: {
              result: symbols.map((symbol) => ({ symbol, response: [resultForSymbol(symbol)] })),
            },
          };
        }
        return { chart: { result: [resultForSymbol(symbols[0])] } };
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

    const australia = responseRecorder();
    await quoteHandler({ query: { market: 'australia' } }, australia.response);
    assert.equal(australia.result.status, 200);
    assert.equal(australia.result.body.marketKey, 'australia');
    assert.equal(australia.result.body.currency, 'AUD');
    assert.equal(australia.result.body.okCount, 30);
    assert.equal(australia.result.body.quotes[0].ticker, 'CBA');

    const korea = responseRecorder();
    await quoteHandler({ query: { market: 'korea' } }, korea.response);
    assert.equal(korea.result.status, 200);
    assert.equal(korea.result.body.marketKey, 'korea');
    assert.equal(korea.result.body.currency, 'KRW');
    assert.equal(korea.result.body.okCount, 30);
    assert.equal(korea.result.body.quotes[0].ticker, '005930');

    const china = responseRecorder();
    await quoteHandler({ query: { market: 'china' } }, china.response);
    assert.equal(china.result.status, 200);
    assert.equal(china.result.body.marketKey, 'china');
    assert.equal(china.result.body.currency, 'CNY');
    assert.equal(china.result.body.okCount, 30);
    assert.equal(china.result.body.quotes[0].ticker, '600519');

    const currencies = responseRecorder();
    await quoteHandler({ query: { market: 'currencies' } }, currencies.response);
    assert.equal(currencies.result.status, 200);
    assert.equal(currencies.result.body.marketKey, 'currencies');
    assert.equal(currencies.result.body.currency, 'USD');
    assert.equal(currencies.result.body.okCount, 30);
    assert.equal(currencies.result.body.quotes[0].ticker, 'EUR');
    assert.equal(currencies.result.body.quotes[0].price, 0.5);
    assert.equal(fetchCount, 33);
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
  assert.match(pageSource, /data-market="newyork">Dow Jones<\/button>/);
  assert.match(pageSource, /data-market="australia">Austrália<\/button>/);
  assert.match(pageSource, /data-market="korea">Coreia<\/button>/);
  assert.match(pageSource, /data-market="china">China<\/button>/);
  assert.match(pageSource, /data-market="currencies">Moedas<\/button>/);
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
    ['newyork', 'dow-jones'],
    ['australia', 'australia'],
    ['korea', 'coreia'],
    ['china', 'china'],
    ['currencies', 'moedas'],
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
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-nova-york/?'));
  assert.ok(vercel.routes.some((route) => route.src === '/acoes-nova-york/([^/]+)/?'));
});

test('selected markets share one ten-second cycle at three sounds per market per second', () => {
  const cycleMs = 10000;
  for (let marketCount = 1; marketCount <= 11; marketCount += 1) {
    const soundCount = marketCount * 30;
    const soundsPerSecond = marketCount * 3;
    const spacingMs = cycleMs / soundCount;

    assert.equal(soundCount / soundsPerSecond, cycleMs / 1000);
    assert.ok((soundCount - 1) * spacingMs < cycleMs);
  }

  assert.match(pageSource, /const SOUND_CYCLE_MS = 10000;/);
  assert.match(pageSource, /function mixedStocks\(keys\)/);
  assert.match(pageSource, /marketKeys\.forEach\(function\(marketKey\)/);
  assert.match(pageSource, /return stockCount > 0 \? SOUND_CYCLE_MS \/ stockCount : 0;/);
  assert.match(pageSource, /index \* spacingMs/);
  assert.match(pageSource, /setInterval\(scheduleMainSounds,SOUND_CYCLE_MS\)/);
  assert.match(pageSource, /aria-pressed="true" data-market="tokyo"/);
  assert.match(pageSource, /state\.movements\[stockKey\(stock\.marketKey,stock\.ticker\)\]/);
});

test('board offers three persistent sound presets with an audible preview', () => {
  assert.match(pageSource, /data-sound-preset="classic"/);
  assert.match(pageSource, /data-sound-preset="waves"/);
  assert.match(pageSource, /data-sound-preset="moog"/);
  assert.match(pageSource, /const SOUND_STORAGE_KEY = "acoes-sound-preset";/);
  assert.match(pageSource, /soundPreset:storedSoundPreset\(\)/);
  assert.match(pageSource, /function playClassicSound\(ctx,direction,maxDuration\)/);
  assert.match(pageSource, /function playWaveSound\(ctx,direction,maxDuration\)/);
  assert.match(pageSource, /function playMoogSound\(ctx,direction,maxDuration\)/);
  assert.match(pageSource, /ctx\.createBiquadFilter\(\)/);
  assert.match(pageSource, /\["down","flat","up"\]/);
});
