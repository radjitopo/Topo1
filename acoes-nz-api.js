const TOKYO_STOCKS = [
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

const BOVESPA_STOCKS = [
  { ticker: 'PETR4', symbol: 'PETR4.SA', name: 'Petrobras' },
  { ticker: 'VALE3', symbol: 'VALE3.SA', name: 'Vale' },
  { ticker: 'ITUB4', symbol: 'ITUB4.SA', name: 'Itaú Unibanco' },
  { ticker: 'BBDC4', symbol: 'BBDC4.SA', name: 'Bradesco' },
  { ticker: 'BBAS3', symbol: 'BBAS3.SA', name: 'Banco do Brasil' },
  { ticker: 'ABEV3', symbol: 'ABEV3.SA', name: 'Ambev' },
  { ticker: 'WEGE3', symbol: 'WEGE3.SA', name: 'WEG' },
  { ticker: 'B3SA3', symbol: 'B3SA3.SA', name: 'B3' },
  { ticker: 'RENT3', symbol: 'RENT3.SA', name: 'Localiza' },
  { ticker: 'SUZB3', symbol: 'SUZB3.SA', name: 'Suzano' },
  { ticker: 'ELET3', symbol: 'ELET3.SA', name: 'Eletrobras' },
  { ticker: 'EQTL3', symbol: 'EQTL3.SA', name: 'Equatorial' },
  { ticker: 'PRIO3', symbol: 'PRIO3.SA', name: 'PRIO' },
  { ticker: 'RAIL3', symbol: 'RAIL3.SA', name: 'Rumo' },
  { ticker: 'JBSS3', symbol: 'JBSS3.SA', name: 'JBS' },
  { ticker: 'EMBR3', symbol: 'EMBR3.SA', name: 'Embraer' },
  { ticker: 'GGBR4', symbol: 'GGBR4.SA', name: 'Gerdau' },
  { ticker: 'CSNA3', symbol: 'CSNA3.SA', name: 'CSN' },
  { ticker: 'CMIG4', symbol: 'CMIG4.SA', name: 'Cemig' },
  { ticker: 'CPLE6', symbol: 'CPLE6.SA', name: 'Copel' },
  { ticker: 'RADL3', symbol: 'RADL3.SA', name: 'Raia Drogasil' },
  { ticker: 'VIVT3', symbol: 'VIVT3.SA', name: 'Telefônica Brasil' },
  { ticker: 'TIMS3', symbol: 'TIMS3.SA', name: 'TIM Brasil' },
  { ticker: 'LREN3', symbol: 'LREN3.SA', name: 'Lojas Renner' },
  { ticker: 'MGLU3', symbol: 'MGLU3.SA', name: 'Magazine Luiza' },
  { ticker: 'HAPV3', symbol: 'HAPV3.SA', name: 'Hapvida' },
  { ticker: 'BPAC11', symbol: 'BPAC11.SA', name: 'BTG Pactual' },
  { ticker: 'SANB11', symbol: 'SANB11.SA', name: 'Santander Brasil' },
  { ticker: 'BBSE3', symbol: 'BBSE3.SA', name: 'BB Seguridade' },
  { ticker: 'ITSA4', symbol: 'ITSA4.SA', name: 'Itaúsa' },
];

const FRANKFURT_STOCKS = [
  { ticker: 'SAP', symbol: 'SAP.DE', name: 'SAP' },
  { ticker: 'SIE', symbol: 'SIE.DE', name: 'Siemens' },
  { ticker: 'ALV', symbol: 'ALV.DE', name: 'Allianz' },
  { ticker: 'MBG', symbol: 'MBG.DE', name: 'Mercedes-Benz' },
  { ticker: 'DBK', symbol: 'DBK.DE', name: 'Deutsche Bank' },
  { ticker: 'AIR', symbol: 'AIR.DE', name: 'Airbus' },
  { ticker: 'ENR', symbol: 'ENR.DE', name: 'Siemens Energy' },
  { ticker: 'RHM', symbol: 'RHM.DE', name: 'Rheinmetall' },
  { ticker: 'BAS', symbol: 'BAS.DE', name: 'BASF' },
  { ticker: 'IFX', symbol: 'IFX.DE', name: 'Infineon' },
  { ticker: 'CBK', symbol: 'CBK.DE', name: 'Commerzbank' },
  { ticker: 'DTE', symbol: 'DTE.DE', name: 'Deutsche Telekom' },
  { ticker: 'MUV2', symbol: 'MUV2.DE', name: 'Munich Re' },
  { ticker: 'BMW', symbol: 'BMW.DE', name: 'BMW' },
  { ticker: 'BAYN', symbol: 'BAYN.DE', name: 'Bayer' },
  { ticker: 'EOAN', symbol: 'EOAN.DE', name: 'E.ON' },
  { ticker: 'FRE', symbol: 'FRE.DE', name: 'Fresenius' },
  { ticker: 'VOW3', symbol: 'VOW3.DE', name: 'Volkswagen' },
  { ticker: 'VNA', symbol: 'VNA.DE', name: 'Vonovia' },
  { ticker: 'DB1', symbol: 'DB1.DE', name: 'Deutsche Börse' },
  { ticker: 'DHL', symbol: 'DHL.DE', name: 'DHL Group' },
  { ticker: 'SHL', symbol: 'SHL.DE', name: 'Siemens Healthineers' },
  { ticker: 'DTG', symbol: 'DTG.DE', name: 'Daimler Truck' },
  { ticker: 'ADS', symbol: 'ADS.DE', name: 'Adidas' },
  { ticker: 'RWE', symbol: 'RWE.DE', name: 'RWE' },
  { ticker: 'SY1', symbol: 'SY1.DE', name: 'Symrise' },
  { ticker: 'HEN3', symbol: 'HEN3.DE', name: 'Henkel' },
  { ticker: 'BEI', symbol: 'BEI.DE', name: 'Beiersdorf' },
  { ticker: 'HEI', symbol: 'HEI.DE', name: 'Heidelberg Materials' },
  { ticker: 'MTX', symbol: 'MTX.DE', name: 'MTU Aero Engines' },
];

const MADRID_STOCKS = [
  { ticker: 'SAN', symbol: 'SAN.MC', name: 'Banco Santander' },
  { ticker: 'BBVA', symbol: 'BBVA.MC', name: 'BBVA' },
  { ticker: 'IBE', symbol: 'IBE.MC', name: 'Iberdrola' },
  { ticker: 'ITX', symbol: 'ITX.MC', name: 'Inditex' },
  { ticker: 'CABK', symbol: 'CABK.MC', name: 'CaixaBank' },
  { ticker: 'SAB', symbol: 'SAB.MC', name: 'Banco Sabadell' },
  { ticker: 'REP', symbol: 'REP.MC', name: 'Repsol' },
  { ticker: 'TEF', symbol: 'TEF.MC', name: 'Telefónica' },
  { ticker: 'IAG', symbol: 'IAG.MC', name: 'IAG' },
  { ticker: 'FER', symbol: 'FER.MC', name: 'Ferrovial' },
  { ticker: 'ACS', symbol: 'ACS.MC', name: 'ACS' },
  { ticker: 'AENA', symbol: 'AENA.MC', name: 'Aena' },
  { ticker: 'AMS', symbol: 'AMS.MC', name: 'Amadeus' },
  { ticker: 'CLNX', symbol: 'CLNX.MC', name: 'Cellnex' },
  { ticker: 'BKT', symbol: 'BKT.MC', name: 'Bankinter' },
  { ticker: 'MAP', symbol: 'MAP.MC', name: 'Mapfre' },
  { ticker: 'ELE', symbol: 'ELE.MC', name: 'Endesa' },
  { ticker: 'MTS', symbol: 'MTS.MC', name: 'ArcelorMittal' },
  { ticker: 'NTGY', symbol: 'NTGY.MC', name: 'Naturgy' },
  { ticker: 'IDR', symbol: 'IDR.MC', name: 'Indra' },
  { ticker: 'ANA', symbol: 'ANA.MC', name: 'Acciona' },
  { ticker: 'RED', symbol: 'RED.MC', name: 'Redeia' },
  { ticker: 'GRF', symbol: 'GRF.MC', name: 'Grifols' },
  { ticker: 'UNI', symbol: 'UNI.MC', name: 'Unicaja Banco' },
  { ticker: 'ACX', symbol: 'ACX.MC', name: 'Acerinox' },
  { ticker: 'PUIG', symbol: 'PUIG.MC', name: 'Puig' },
  { ticker: 'SCYR', symbol: 'SCYR.MC', name: 'Sacyr' },
  { ticker: 'SLR', symbol: 'SLR.MC', name: 'Solaria' },
  { ticker: 'ENG', symbol: 'ENG.MC', name: 'Enagás' },
  { ticker: 'MRL', symbol: 'MRL.MC', name: 'Merlin Properties' },
];

const MARKETS = {
  tokyo: {
    key: 'tokyo',
    name: 'Tokyo Stock Exchange',
    currency: 'JPY',
    source: 'Yahoo Finance / TSE',
    stocks: TOKYO_STOCKS,
  },
  bovespa: {
    key: 'bovespa',
    name: 'B3 / Bovespa',
    currency: 'BRL',
    source: 'Yahoo Finance / B3',
    stocks: BOVESPA_STOCKS,
  },
  frankfurt: {
    key: 'frankfurt',
    name: 'Frankfurt Stock Exchange / Xetra',
    currency: 'EUR',
    source: 'Yahoo Finance / Xetra',
    stocks: FRANKFURT_STOCKS,
  },
  madrid: {
    key: 'madrid',
    name: 'Bolsa de Madrid / BME',
    currency: 'EUR',
    source: 'Yahoo Finance / BME',
    stocks: MADRID_STOCKS,
  },
};

function marketFromRequest(req) {
  const queryMarket = Array.isArray(req.query?.market) ? req.query.market[0] : req.query?.market;
  return MARKETS[queryMarket] || MARKETS.tokyo;
}

function lastNumber(values) {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i] === 'number' && Number.isFinite(values[i])) return values[i];
  }
  return null;
}

async function requestQuote(stock, host, market) {
  const url =
    'https://' +
    host +
    '/v8/finance/chart/' +
    encodeURIComponent(stock.symbol) +
    '?interval=1m&range=1d&includePrePost=false&events=div%2Csplits';

  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 AcoesSoundBoard/2.0',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(market.name + ' quote ' + stock.ticker + ' returned ' + response.status);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No market data for ' + stock.ticker);

  return result;
}

async function fetchQuote(stock, market) {
  let result;
  let lastError;

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      result = await requestQuote(stock, host, market);
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
    currency: meta.currency || market.currency,
    marketState: meta.marketState || null,
    sourceUpdated:
      typeof meta.regularMarketTime === 'number'
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    source: market.source,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const market = marketFromRequest(req);
  const stocks = market.stocks;

  try {
    const settled = await Promise.allSettled(stocks.map((stock) => fetchQuote(stock, market)));
    const quotes = settled.map((item, index) => {
      if (item.status === 'fulfilled') return { ...item.value, ok: true };
      return {
        ticker: stocks[index].ticker,
        symbol: stocks[index].symbol,
        name: stocks[index].name,
        ok: false,
        error: item.reason && item.reason.message ? item.reason.message : 'Unavailable',
      };
    });

    const okCount = quotes.filter((quote) => quote.ok).length;
    const expectedCount = stocks.length;
    res.status(okCount ? 200 : 502).json({
      ok: okCount === expectedCount,
      marketKey: market.key,
      expectedCount,
      okCount,
      market: market.name,
      currency: market.currency,
      fetchedAt: new Date().toISOString(),
      quotes,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      marketKey: market.key,
      market: market.name,
      currency: market.currency,
      fetchedAt: new Date().toISOString(),
      error: error && error.message ? error.message : 'Unexpected error',
      quotes: [],
    });
  }
}
