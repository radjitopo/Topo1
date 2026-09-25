const STOCKS = [
  { ticker: '7203', symbol: '7203.T', name: 'Toyota' },
  { ticker: '6758', symbol: '6758.T', name: 'Sony' },
  { ticker: '8306', symbol: '8306.T', name: 'Mitsubishi UFJ' },
  { ticker: '9984', symbol: '9984.T', name: 'SoftBank Group' },
  { ticker: '6501', symbol: '6501.T', name: 'Hitachi' },
  { ticker: '6861', symbol: '6861.T', name: 'Keyence' },
  { ticker: '8035', symbol: '8035.T', name: 'Tokyo Electron' },
  { ticker: '7974', symbol: '7974.T', name: 'Nintendo' },
  { ticker: '9983', symbol: '9983.T', name: 'Fast Retailing' },
  { ticker: '6098', symbol: '6098.T', name: 'Recruit' },
  { ticker: '9432', symbol: '9432.T', name: 'NTT' },
  { ticker: '8316', symbol: '8316.T', name: 'Sumitomo Mitsui FG' },
  { ticker: '8411', symbol: '8411.T', name: 'Mizuho Financial' },
  { ticker: '8058', symbol: '8058.T', name: 'Mitsubishi Corp.' },
  { ticker: '8001', symbol: '8001.T', name: 'Itochu' },
  { ticker: '8766', symbol: '8766.T', name: 'Tokio Marine' },
  { ticker: '7011', symbol: '7011.T', name: 'Mitsubishi Heavy' },
  { ticker: '7751', symbol: '7751.T', name: 'Canon' },
  { ticker: '7267', symbol: '7267.T', name: 'Honda' },
  { ticker: '6902', symbol: '6902.T', name: 'Denso' },
  { ticker: '4502', symbol: '4502.T', name: 'Takeda' },
  { ticker: '4519', symbol: '4519.T', name: 'Chugai Pharma' },
  { ticker: '4568', symbol: '4568.T', name: 'Daiichi Sankyo' },
  { ticker: '4063', symbol: '4063.T', name: 'Shin-Etsu Chemical' },
  { ticker: '6981', symbol: '6981.T', name: 'Murata Manufacturing' },
  { ticker: '6594', symbol: '6594.T', name: 'Nidec' },
  { ticker: '6954', symbol: '6954.T', name: 'FANUC' },
  { ticker: '7733', symbol: '7733.T', name: 'Olympus' },
  { ticker: '4901', symbol: '4901.T', name: 'Fujifilm' },
  { ticker: '9433', symbol: '9433.T', name: 'KDDI' },
];

function lastNumber(values) {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i] === 'number' && Number.isFinite(values[i])) return values[i];
  }
  return null;
}

async function requestQuote(stock, host) {
  const url =
    'https://' +
    host +
    '/v8/finance/chart/' +
    encodeURIComponent(stock.symbol) +
    '?interval=1m&range=1d&includePrePost=false&events=div%2Csplits';

  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 AcoesTokyoPrototype/1.0',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error('Tokyo quote ' + stock.ticker + ' returned ' + response.status);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No market data for ' + stock.ticker);

  return result;
}

async function fetchQuote(stock) {
  let result;
  let lastError;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      result = await requestQuote(stock, host);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!result) throw lastError || new Error('No market data for ' + stock.ticker);

  const meta = result.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const price =
    typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : lastNumber(closes);

  if (price == null) throw new Error('Price not found for ' + stock.ticker);

  return {
    ticker: stock.ticker,
    symbol: stock.symbol,
    name: stock.name,
    price,
    currency: meta.currency || 'JPY',
    marketState: meta.marketState || null,
    sourceUpdated:
      typeof meta.regularMarketTime === 'number'
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    source: 'Yahoo Finance / TSE',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const settled = await Promise.allSettled(STOCKS.map(fetchQuote));
    const quotes = settled.map((item, index) => {
      if (item.status === 'fulfilled') return { ...item.value, ok: true };
      return {
        ticker: STOCKS[index].ticker,
        symbol: STOCKS[index].symbol,
        name: STOCKS[index].name,
        ok: false,
        error: item.reason && item.reason.message ? item.reason.message : 'Unavailable',
      };
    });

    const okCount = quotes.filter((q) => q.ok).length;
    const expectedCount = STOCKS.length;
    res.status(okCount ? 200 : 502).json({
      ok: okCount === expectedCount,
      expectedCount,
      okCount,
      market: 'Tokyo Stock Exchange',
      currency: 'JPY',
      fetchedAt: new Date().toISOString(),
      quotes,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      market: 'Tokyo Stock Exchange',
      currency: 'JPY',
      fetchedAt: new Date().toISOString(),
      error: error && error.message ? error.message : 'Unexpected error',
      quotes: [],
    });
  }
}
