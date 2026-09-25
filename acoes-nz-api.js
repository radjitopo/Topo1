const STOCKS = [
  { ticker: "FPH", name: "Fisher & Paykel" },
  { ticker: "MEL", name: "Meridian" },
  { ticker: "IFT", name: "Infratil" },
  { ticker: "AIA", name: "Auckland Airport" },
  { ticker: "MCY", name: "Mercury" },
  { ticker: "CEN", name: "Contact Energy" },
  { ticker: "EBO", name: "EBOS" },
  { ticker: "SPK", name: "Spark" },
  { ticker: "MFT", name: "Mainfreight" },
  { ticker: "SUM", name: "Summerset" }
];

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function parseNZX(html) {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );

  const priceMatch = text.match(/\$([0-9]+(?:\.[0-9]{1,4})?)\s*NZD/i);
  const updatedMatch = text.match(/Last Updated:\s*([^$]{0,80}?)(?=\s*\$|\s*Issued By:|\s*ISIN:)/i);

  return {
    price: priceMatch ? Number(priceMatch[1]) : null,
    sourceUpdated: updatedMatch ? updatedMatch[1].trim() : null
  };
}

async function fetchQuote(stock) {
  const url = "https://www.nzx.com/instruments/" + stock.ticker;
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "AcoesNZPrototype/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("NZX " + stock.ticker + " returned " + response.status);
  }

  const html = await response.text();
  const parsed = parseNZX(html);

  if (parsed.price == null) {
    throw new Error("Price not found for " + stock.ticker);
  }

  return {
    ticker: stock.ticker,
    name: stock.name,
    price: parsed.price,
    sourceUpdated: parsed.sourceUpdated,
    source: "NZX"
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
        name: STOCKS[index].name,
        ok: false,
        error: item.reason && item.reason.message ? item.reason.message : "Unavailable"
      };
    });

    const okCount = quotes.filter(q => q.ok).length;
    res.status(okCount ? 200 : 502).json({
      ok: okCount > 0,
      delayedMinutes: 20,
      fetchedAt: new Date().toISOString(),
      quotes
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      delayedMinutes: 20,
      fetchedAt: new Date().toISOString(),
      error: error && error.message ? error.message : "Unexpected error",
      quotes: []
    });
  }
};