const STOCKS = [
  { ticker: "7203", symbol: "7203.T", name: "Toyota" },
  { ticker: "6758", symbol: "6758.T", name: "Sony" },
  { ticker: "8306", symbol: "8306.T", name: "Mitsubishi UFJ" },
  { ticker: "9984", symbol: "9984.T", name: "SoftBank Group" },
  { ticker: "6501", symbol: "6501.T", name: "Hitachi" },
  { ticker: "6861", symbol: "6861.T", name: "Keyence" },
  { ticker: "8035", symbol: "8035.T", name: "Tokyo Electron" },
  { ticker: "7974", symbol: "7974.T", name: "Nintendo" },
  { ticker: "9983", symbol: "9983.T", name: "Fast Retailing" },
  { ticker: "6098", symbol: "6098.T", name: "Recruit" }
];

function lastNumber(values) {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i] === "number" && Number.isFinite(values[i])) return values[i];
  }
  return null;
}

async function fetchQuote(stock) {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(stock.symbol) +
    "?interval=1m&range=1d&includePrePost=false&events=div%2Csplits";

  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 AcoesTokyoPrototype/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Tokyo quote " + stock.ticker + " returned " + response.status);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No market data for " + stock.ticker);

  const meta = result.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const price =
    typeof meta.regularMarketPrice === "number"
      ? meta.regularMarketPrice
      : lastNumber(closes);

  if (price == null) throw new Error("Price not found for " + stock.ticker);

  return {
    ticker: stock.ticker,
    symbol: stock.symbol,
    name: stock.name,
    price,
    currency: meta.currency || "JPY",
    marketState: meta.marketState || null,
    sourceUpdated:
      typeof meta.regularMarketTime === "number"
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    source: "Yahoo Finance / TSE"
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const settled = await Promise.allSettled(STOCKS.map(fetchQuote));
    const quotes = settled.map((item, index) => {
      if (item.status === "fulfilled") return { ...item.value, ok: true };
      return {
        ticker: STOCKS[index].ticker,
        symbol: STOCKS[index].symbol,
        name: STOCKS[index].name,
        ok: false,
        error: item.reason && item.reason.message ? item.reason.message : "Unavailable"
      };
    });

    const okCount = quotes.filter(q => q.ok).length;
    res.status(okCount ? 200 : 502).json({
      ok: okCount > 0,
      market: "Tokyo Stock Exchange",
      currency: "JPY",
      fetchedAt: new Date().toISOString(),
      quotes
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      market: "Tokyo Stock Exchange",
      currency: "JPY",
      fetchedAt: new Date().toISOString(),
      error: error && error.message ? error.message : "Unexpected error",
      quotes: []
    });
  }
};