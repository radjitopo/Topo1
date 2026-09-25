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
  { ticker: 'AXIA3', symbol: 'AXIA3.SA', name: 'Axia Energia' },
  { ticker: 'EQTL3', symbol: 'EQTL3.SA', name: 'Equatorial' },
  { ticker: 'PRIO3', symbol: 'PRIO3.SA', name: 'PRIO' },
  { ticker: 'RAIL3', symbol: 'RAIL3.SA', name: 'Rumo' },
  { ticker: 'JBSS32', symbol: 'JBSS32.SA', name: 'JBS' },
  { ticker: 'EMBJ3', symbol: 'EMBJ3.SA', name: 'Embraer' },
  { ticker: 'GGBR4', symbol: 'GGBR4.SA', name: 'Gerdau' },
  { ticker: 'CSNA3', symbol: 'CSNA3.SA', name: 'CSN' },
  { ticker: 'CMIG4', symbol: 'CMIG4.SA', name: 'Cemig' },
  { ticker: 'CPLE3', symbol: 'CPLE3.SA', name: 'Copel' },
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

const PARIS_STOCKS = [
  { ticker: 'AIR', symbol: 'AIR.PA', name: 'Airbus' },
  { ticker: 'AI', symbol: 'AI.PA', name: 'Air Liquide' },
  { ticker: 'CS', symbol: 'CS.PA', name: 'AXA' },
  { ticker: 'BNP', symbol: 'BNP.PA', name: 'BNP Paribas' },
  { ticker: 'EN', symbol: 'EN.PA', name: 'Bouygues' },
  { ticker: 'CAP', symbol: 'CAP.PA', name: 'Capgemini' },
  { ticker: 'CA', symbol: 'CA.PA', name: 'Carrefour' },
  { ticker: 'ACA', symbol: 'ACA.PA', name: 'Crédit Agricole' },
  { ticker: 'BN', symbol: 'BN.PA', name: 'Danone' },
  { ticker: 'DSY', symbol: 'DSY.PA', name: 'Dassault Systèmes' },
  { ticker: 'ENGI', symbol: 'ENGI.PA', name: 'Engie' },
  { ticker: 'EL', symbol: 'EL.PA', name: 'EssilorLuxottica' },
  { ticker: 'RMS', symbol: 'RMS.PA', name: 'Hermès' },
  { ticker: 'KER', symbol: 'KER.PA', name: 'Kering' },
  { ticker: 'OR', symbol: 'OR.PA', name: 'L’Oréal' },
  { ticker: 'LR', symbol: 'LR.PA', name: 'Legrand' },
  { ticker: 'MC', symbol: 'MC.PA', name: 'LVMH' },
  { ticker: 'ML', symbol: 'ML.PA', name: 'Michelin' },
  { ticker: 'ORA', symbol: 'ORA.PA', name: 'Orange' },
  { ticker: 'RI', symbol: 'RI.PA', name: 'Pernod Ricard' },
  { ticker: 'PUB', symbol: 'PUB.PA', name: 'Publicis' },
  { ticker: 'RNO', symbol: 'RNO.PA', name: 'Renault' },
  { ticker: 'SAF', symbol: 'SAF.PA', name: 'Safran' },
  { ticker: 'SGO', symbol: 'SGO.PA', name: 'Saint-Gobain' },
  { ticker: 'SAN', symbol: 'SAN.PA', name: 'Sanofi' },
  { ticker: 'SU', symbol: 'SU.PA', name: 'Schneider Electric' },
  { ticker: 'GLE', symbol: 'GLE.PA', name: 'Société Générale' },
  { ticker: 'HO', symbol: 'HO.PA', name: 'Thales' },
  { ticker: 'TTE', symbol: 'TTE.PA', name: 'TotalEnergies' },
  { ticker: 'DG', symbol: 'DG.PA', name: 'Vinci' },
];

const LONDON_STOCKS = [
  { ticker: 'AZN', symbol: 'AZN.L', name: 'AstraZeneca' },
  { ticker: 'SHEL', symbol: 'SHEL.L', name: 'Shell' },
  { ticker: 'HSBA', symbol: 'HSBA.L', name: 'HSBC' },
  { ticker: 'ULVR', symbol: 'ULVR.L', name: 'Unilever' },
  { ticker: 'BP', symbol: 'BP.L', name: 'BP' },
  { ticker: 'RIO', symbol: 'RIO.L', name: 'Rio Tinto' },
  { ticker: 'GSK', symbol: 'GSK.L', name: 'GSK' },
  { ticker: 'DGE', symbol: 'DGE.L', name: 'Diageo' },
  { ticker: 'REL', symbol: 'REL.L', name: 'RELX' },
  { ticker: 'BATS', symbol: 'BATS.L', name: 'British American Tobacco' },
  { ticker: 'LSEG', symbol: 'LSEG.L', name: 'London Stock Exchange Group' },
  { ticker: 'NG', symbol: 'NG.L', name: 'National Grid' },
  { ticker: 'BARC', symbol: 'BARC.L', name: 'Barclays' },
  { ticker: 'LLOY', symbol: 'LLOY.L', name: 'Lloyds Banking Group' },
  { ticker: 'NWG', symbol: 'NWG.L', name: 'NatWest Group' },
  { ticker: 'STAN', symbol: 'STAN.L', name: 'Standard Chartered' },
  { ticker: 'GLEN', symbol: 'GLEN.L', name: 'Glencore' },
  { ticker: 'AAL', symbol: 'AAL.L', name: 'Anglo American' },
  { ticker: 'BA', symbol: 'BA.L', name: 'BAE Systems' },
  { ticker: 'RR', symbol: 'RR.L', name: 'Rolls-Royce' },
  { ticker: 'VOD', symbol: 'VOD.L', name: 'Vodafone' },
  { ticker: 'TSCO', symbol: 'TSCO.L', name: 'Tesco' },
  { ticker: 'SBRY', symbol: 'SBRY.L', name: 'Sainsbury’s' },
  { ticker: 'IMB', symbol: 'IMB.L', name: 'Imperial Brands' },
  { ticker: 'CPG', symbol: 'CPG.L', name: 'Compass Group' },
  { ticker: 'EXPN', symbol: 'EXPN.L', name: 'Experian' },
  { ticker: 'INF', symbol: 'INF.L', name: 'Informa' },
  { ticker: 'PRU', symbol: 'PRU.L', name: 'Prudential' },
  { ticker: 'AV', symbol: 'AV.L', name: 'Aviva' },
  { ticker: 'MNG', symbol: 'MNG.L', name: 'M&G' },
];

const NEW_YORK_STOCKS = [
  { ticker: 'AAPL', symbol: 'AAPL', name: 'Apple' },
  { ticker: 'MSFT', symbol: 'MSFT', name: 'Microsoft' },
  { ticker: 'NVDA', symbol: 'NVDA', name: 'NVIDIA' },
  { ticker: 'GOOGL', symbol: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN', symbol: 'AMZN', name: 'Amazon' },
  { ticker: 'CRM', symbol: 'CRM', name: 'Salesforce' },
  { ticker: 'CSCO', symbol: 'CSCO', name: 'Cisco' },
  { ticker: 'IBM', symbol: 'IBM', name: 'IBM' },
  { ticker: 'JPM', symbol: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'GS', symbol: 'GS', name: 'Goldman Sachs' },
  { ticker: 'AXP', symbol: 'AXP', name: 'American Express' },
  { ticker: 'V', symbol: 'V', name: 'Visa' },
  { ticker: 'TRV', symbol: 'TRV', name: 'Travelers' },
  { ticker: 'UNH', symbol: 'UNH', name: 'UnitedHealth' },
  { ticker: 'JNJ', symbol: 'JNJ', name: 'Johnson & Johnson' },
  { ticker: 'MRK', symbol: 'MRK', name: 'Merck' },
  { ticker: 'AMGN', symbol: 'AMGN', name: 'Amgen' },
  { ticker: 'BA', symbol: 'BA', name: 'Boeing' },
  { ticker: 'CAT', symbol: 'CAT', name: 'Caterpillar' },
  { ticker: 'HON', symbol: 'HON', name: 'Honeywell' },
  { ticker: 'MMM', symbol: 'MMM', name: '3M' },
  { ticker: 'WMT', symbol: 'WMT', name: 'Walmart' },
  { ticker: 'PG', symbol: 'PG', name: 'Procter & Gamble' },
  { ticker: 'KO', symbol: 'KO', name: 'Coca-Cola' },
  { ticker: 'MCD', symbol: 'MCD', name: 'McDonald’s' },
  { ticker: 'NKE', symbol: 'NKE', name: 'Nike' },
  { ticker: 'DIS', symbol: 'DIS', name: 'Disney' },
  { ticker: 'HD', symbol: 'HD', name: 'Home Depot' },
  { ticker: 'CVX', symbol: 'CVX', name: 'Chevron' },
  { ticker: 'SHW', symbol: 'SHW', name: 'Sherwin-Williams' },
];

const AUSTRALIA_STOCKS = [
  { ticker: 'CBA', symbol: 'CBA.AX', name: 'Commonwealth Bank' },
  { ticker: 'BHP', symbol: 'BHP.AX', name: 'BHP Group' },
  { ticker: 'CSL', symbol: 'CSL.AX', name: 'CSL' },
  { ticker: 'NAB', symbol: 'NAB.AX', name: 'National Australia Bank' },
  { ticker: 'WBC', symbol: 'WBC.AX', name: 'Westpac' },
  { ticker: 'ANZ', symbol: 'ANZ.AX', name: 'ANZ Group' },
  { ticker: 'WES', symbol: 'WES.AX', name: 'Wesfarmers' },
  { ticker: 'MQG', symbol: 'MQG.AX', name: 'Macquarie Group' },
  { ticker: 'GMG', symbol: 'GMG.AX', name: 'Goodman Group' },
  { ticker: 'RIO', symbol: 'RIO.AX', name: 'Rio Tinto' },
  { ticker: 'WDS', symbol: 'WDS.AX', name: 'Woodside Energy' },
  { ticker: 'FMG', symbol: 'FMG.AX', name: 'Fortescue' },
  { ticker: 'WOW', symbol: 'WOW.AX', name: 'Woolworths' },
  { ticker: 'TLS', symbol: 'TLS.AX', name: 'Telstra' },
  { ticker: 'TCL', symbol: 'TCL.AX', name: 'Transurban' },
  { ticker: 'ALL', symbol: 'ALL.AX', name: 'Aristocrat Leisure' },
  { ticker: 'QBE', symbol: 'QBE.AX', name: 'QBE Insurance' },
  { ticker: 'RMD', symbol: 'RMD.AX', name: 'ResMed' },
  { ticker: 'COL', symbol: 'COL.AX', name: 'Coles Group' },
  { ticker: 'REA', symbol: 'REA.AX', name: 'REA Group' },
  { ticker: 'JHX', symbol: 'JHX.AX', name: 'James Hardie' },
  { ticker: 'STO', symbol: 'STO.AX', name: 'Santos' },
  { ticker: 'XRO', symbol: 'XRO.AX', name: 'Xero' },
  { ticker: 'BXB', symbol: 'BXB.AX', name: 'Brambles' },
  { ticker: 'SUN', symbol: 'SUN.AX', name: 'Suncorp' },
  { ticker: 'IAG', symbol: 'IAG.AX', name: 'Insurance Australia Group' },
  { ticker: 'AMC', symbol: 'AMC.AX', name: 'Amcor' },
  { ticker: 'CPU', symbol: 'CPU.AX', name: 'Computershare' },
  { ticker: 'ORG', symbol: 'ORG.AX', name: 'Origin Energy' },
  { ticker: 'S32', symbol: 'S32.AX', name: 'South32' },
];

const KOREA_STOCKS = [
  { ticker: '005930', symbol: '005930.KS', name: 'Samsung Electronics' },
  { ticker: '000660', symbol: '000660.KS', name: 'SK Hynix' },
  { ticker: '402340', symbol: '402340.KS', name: 'SK Square' },
  { ticker: '005380', symbol: '005380.KS', name: 'Hyundai Motor' },
  { ticker: '373220', symbol: '373220.KS', name: 'LG Energy Solution' },
  { ticker: '207940', symbol: '207940.KS', name: 'Samsung Biologics' },
  { ticker: '028260', symbol: '028260.KS', name: 'Samsung C&T' },
  { ticker: '105560', symbol: '105560.KS', name: 'KB Financial' },
  { ticker: '032830', symbol: '032830.KS', name: 'Samsung Life Insurance' },
  { ticker: '012450', symbol: '012450.KS', name: 'Hanwha Aerospace' },
  { ticker: '034020', symbol: '034020.KS', name: 'Doosan Enerbility' },
  { ticker: '055550', symbol: '055550.KS', name: 'Shinhan Financial' },
  { ticker: '329180', symbol: '329180.KS', name: 'HD Hyundai Heavy Industries' },
  { ticker: '000270', symbol: '000270.KS', name: 'Kia' },
  { ticker: '068270', symbol: '068270.KS', name: 'Celltrion' },
  { ticker: '009150', symbol: '009150.KS', name: 'Samsung Electro-Mechanics' },
  { ticker: '066570', symbol: '066570.KS', name: 'LG Electronics' },
  { ticker: '086790', symbol: '086790.KS', name: 'Hana Financial' },
  { ticker: '034730', symbol: '034730.KS', name: 'SK Inc.' },
  { ticker: '012330', symbol: '012330.KS', name: 'Hyundai Mobis' },
  { ticker: '010120', symbol: '010120.KS', name: 'LS Electric' },
  { ticker: '035420', symbol: '035420.KS', name: 'NAVER' },
  { ticker: '000810', symbol: '000810.KS', name: 'Samsung Fire & Marine' },
  { ticker: '298040', symbol: '298040.KS', name: 'Hyosung Heavy Industries' },
  { ticker: '000150', symbol: '000150.KS', name: 'Doosan Corp.' },
  { ticker: '267260', symbol: '267260.KS', name: 'HD Hyundai Electric' },
  { ticker: '316140', symbol: '316140.KS', name: 'Woori Financial' },
  { ticker: '096770', symbol: '096770.KS', name: 'SK Innovation' },
  { ticker: '042660', symbol: '042660.KS', name: 'Hanwha Ocean' },
  { ticker: '009540', symbol: '009540.KS', name: 'HD Korea Shipbuilding & Offshore' },
];

const CHINA_STOCKS = [
  { ticker: '600519', symbol: '600519.SS', name: 'Kweichow Moutai' },
  { ticker: '601398', symbol: '601398.SS', name: 'ICBC' },
  { ticker: '601288', symbol: '601288.SS', name: 'Agricultural Bank of China' },
  { ticker: '601988', symbol: '601988.SS', name: 'Bank of China' },
  { ticker: '601857', symbol: '601857.SS', name: 'PetroChina' },
  { ticker: '601088', symbol: '601088.SS', name: 'China Shenhua Energy' },
  { ticker: '601318', symbol: '601318.SS', name: 'Ping An Insurance' },
  { ticker: '600036', symbol: '600036.SS', name: 'China Merchants Bank' },
  { ticker: '600900', symbol: '600900.SS', name: 'China Yangtze Power' },
  { ticker: '601628', symbol: '601628.SS', name: 'China Life Insurance' },
  { ticker: '601166', symbol: '601166.SS', name: 'Industrial Bank' },
  { ticker: '601601', symbol: '601601.SS', name: 'China Pacific Insurance' },
  { ticker: '601668', symbol: '601668.SS', name: 'China State Construction' },
  { ticker: '600030', symbol: '600030.SS', name: 'CITIC Securities' },
  { ticker: '600276', symbol: '600276.SS', name: 'Jiangsu Hengrui Pharmaceuticals' },
  { ticker: '600887', symbol: '600887.SS', name: 'Inner Mongolia Yili' },
  { ticker: '600309', symbol: '600309.SS', name: 'Wanhua Chemical' },
  { ticker: '601899', symbol: '601899.SS', name: 'Zijin Mining' },
  { ticker: '601728', symbol: '601728.SS', name: 'China Telecom' },
  { ticker: '601919', symbol: '601919.SS', name: 'COSCO Shipping Holdings' },
  { ticker: '600050', symbol: '600050.SS', name: 'China United Network' },
  { ticker: '600031', symbol: '600031.SS', name: 'Sany Heavy Industry' },
  { ticker: '600406', symbol: '600406.SS', name: 'NARI Technology' },
  { ticker: '600809', symbol: '600809.SS', name: 'Shanxi Fen Wine' },
  { ticker: '600150', symbol: '600150.SS', name: 'China CSSC' },
  { ticker: '603986', symbol: '603986.SS', name: 'GigaDevice' },
  { ticker: '688981', symbol: '688981.SS', name: 'SMIC' },
  { ticker: '688041', symbol: '688041.SS', name: 'Hygon Information' },
  { ticker: '688111', symbol: '688111.SS', name: 'Kingsoft Office' },
  { ticker: '688521', symbol: '688521.SS', name: 'VeriSilicon' },
];

const CURRENCY_STOCKS = [
  { ticker: 'EUR', symbol: 'USDEUR=X', name: 'Euro', invert: true },
  { ticker: 'JPY', symbol: 'USDJPY=X', name: 'Yen japonês', invert: true },
  { ticker: 'GBP', symbol: 'USDGBP=X', name: 'Libra esterlina', invert: true },
  { ticker: 'CNY', symbol: 'USDCNY=X', name: 'Yuan chinês', invert: true },
  { ticker: 'CHF', symbol: 'USDCHF=X', name: 'Franco suíço', invert: true },
  { ticker: 'AUD', symbol: 'USDAUD=X', name: 'Dólar australiano', invert: true },
  { ticker: 'CAD', symbol: 'USDCAD=X', name: 'Dólar canadense', invert: true },
  { ticker: 'HKD', symbol: 'USDHKD=X', name: 'Dólar de Hong Kong', invert: true },
  { ticker: 'SGD', symbol: 'USDSGD=X', name: 'Dólar de Singapura', invert: true },
  { ticker: 'INR', symbol: 'USDINR=X', name: 'Rupia indiana', invert: true },
  { ticker: 'KRW', symbol: 'USDKRW=X', name: 'Won sul-coreano', invert: true },
  { ticker: 'SEK', symbol: 'USDSEK=X', name: 'Coroa sueca', invert: true },
  { ticker: 'MXN', symbol: 'USDMXN=X', name: 'Peso mexicano', invert: true },
  { ticker: 'NZD', symbol: 'USDNZD=X', name: 'Dólar neozelandês', invert: true },
  { ticker: 'NOK', symbol: 'USDNOK=X', name: 'Coroa norueguesa', invert: true },
  { ticker: 'TWD', symbol: 'USDTWD=X', name: 'Dólar taiwanês', invert: true },
  { ticker: 'BRL', symbol: 'USDBRL=X', name: 'Real brasileiro', invert: true },
  { ticker: 'ZAR', symbol: 'USDZAR=X', name: 'Rand sul-africano', invert: true },
  { ticker: 'PLN', symbol: 'USDPLN=X', name: 'Zlóti polonês', invert: true },
  { ticker: 'DKK', symbol: 'USDDKK=X', name: 'Coroa dinamarquesa', invert: true },
  { ticker: 'IDR', symbol: 'USDIDR=X', name: 'Rupia indonésia', invert: true },
  { ticker: 'TRY', symbol: 'USDTRY=X', name: 'Lira turca', invert: true },
  { ticker: 'THB', symbol: 'USDTHB=X', name: 'Baht tailandês', invert: true },
  { ticker: 'ILS', symbol: 'USDILS=X', name: 'Shekel israelense', invert: true },
  { ticker: 'HUF', symbol: 'USDHUF=X', name: 'Florim húngaro', invert: true },
  { ticker: 'CZK', symbol: 'USDCZK=X', name: 'Coroa tcheca', invert: true },
  { ticker: 'CLP', symbol: 'USDCLP=X', name: 'Peso chileno', invert: true },
  { ticker: 'PHP', symbol: 'USDPHP=X', name: 'Peso filipino', invert: true },
  { ticker: 'COP', symbol: 'USDCOP=X', name: 'Peso colombiano', invert: true },
  { ticker: 'MYR', symbol: 'USDMYR=X', name: 'Ringgit malaio', invert: true },
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
  paris: {
    key: 'paris',
    name: 'Euronext Paris',
    currency: 'EUR',
    source: 'Yahoo Finance / Euronext Paris',
    stocks: PARIS_STOCKS,
  },
  london: {
    key: 'london',
    name: 'London Stock Exchange',
    currency: 'GBP',
    source: 'Yahoo Finance / LSE',
    stocks: LONDON_STOCKS,
  },
  newyork: {
    key: 'newyork',
    name: 'Dow Jones Industrial Average',
    currency: 'USD',
    source: 'Yahoo Finance / NYSE & Nasdaq',
    stocks: NEW_YORK_STOCKS,
  },
  australia: {
    key: 'australia',
    name: 'Australian Securities Exchange',
    currency: 'AUD',
    source: 'Yahoo Finance / ASX',
    stocks: AUSTRALIA_STOCKS,
  },
  korea: {
    key: 'korea',
    name: 'Korea Exchange / KOSPI',
    currency: 'KRW',
    source: 'Yahoo Finance / KRX',
    stocks: KOREA_STOCKS,
  },
  china: {
    key: 'china',
    name: 'Shanghai Stock Exchange',
    currency: 'CNY',
    source: 'Yahoo Finance / SSE',
    stocks: CHINA_STOCKS,
  },
  currencies: {
    key: 'currencies',
    name: 'Global foreign exchange market',
    currency: 'USD',
    source: 'Yahoo Finance / FX',
    stocks: CURRENCY_STOCKS,
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
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(market.name + ' quote ' + stock.ticker + ' returned ' + response.status);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No market data for ' + stock.ticker);

  return result;
}

async function requestQuoteBatch(stocks, host, market) {
  const symbols = stocks.map((stock) => stock.symbol).join(',');
  const url =
    'https://' +
    host +
    '/v7/finance/spark?symbols=' +
    encodeURIComponent(symbols) +
    '&interval=1d&range=1d';

  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 AcoesSoundBoard/2.0',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(market.name + ' quote batch returned ' + response.status);
  }

  const data = await response.json();
  const results = data?.spark?.result;
  if (!Array.isArray(results)) throw new Error('No batch market data for ' + market.name);

  return new Map(
    results
      .filter((item) => item && item.symbol && item.response?.[0])
      .map((item) => [item.symbol, item.response[0]]),
  );
}

function quoteFromResult(stock, market, result) {
  const meta = result.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const rawPrice =
    typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : lastNumber(closes);

  if (rawPrice == null || rawPrice === 0) throw new Error('Price not found for ' + stock.ticker);

  const price = stock.invert
    ? 1 / rawPrice
    : market.key === 'london' && meta.currency === 'GBp'
      ? rawPrice / 100
      : rawPrice;

  return {
    ticker: stock.ticker,
    symbol: stock.symbol,
    name: stock.name,
    price,
    currency: market.currency,
    marketState: meta.marketState || null,
    sourceUpdated:
      typeof meta.regularMarketTime === 'number'
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    source: market.source,
  };
}

async function fetchQuote(stock, market) {
  let result;
  let lastError;

  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      result = await requestQuote(stock, host, market);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!result) throw lastError || new Error('No market data for ' + stock.ticker);

  return quoteFromResult(stock, market, result);
}

async function fetchQuoteGroup(stocks, market) {
  let resultMap;

  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      resultMap = await requestQuoteBatch(stocks, host, market);
      break;
    } catch (error) {
      resultMap = null;
    }
  }

  return Promise.allSettled(
    stocks.map((stock) => {
      const result = resultMap?.get(stock.symbol);
      return result ? Promise.resolve(quoteFromResult(stock, market, result)) : fetchQuote(stock, market);
    }),
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const market = marketFromRequest(req);
  const stocks = market.stocks;

  try {
    const groups = [];
    for (let index = 0; index < stocks.length; index += 10) {
      groups.push(stocks.slice(index, index + 10));
    }
    const settled = (await Promise.all(groups.map((group) => fetchQuoteGroup(group, market)))).flat();
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
