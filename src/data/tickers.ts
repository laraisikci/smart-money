import type { TickerMeta } from '@/types';

// Full constituents of EURO STOXX 50, IBEX 35, DAX 40, CAC 40 and AEX (deduplicated — many
// companies sit in more than one index, e.g. ASML is both AEX and EURO STOXX 50). Sourced from
// each index's public constituent list (2026-07). Currency reflects each company's actual
// primary listing exchange, not just its index membership — most Eurozone constituents are EUR,
// but Shell and Unilever both moved their primary listing to London (GBP) despite still being
// dual-listed on Euronext Amsterdam, and pre-existing tickers (Roche/Novartis/Nestle on SIX,
// HSBC on LSE, Novo Nordisk/Ørsted on Nasdaq Copenhagen) keep their real currencies too.
//
// One real-world ticker collision: Sanofi (Euronext Paris) and Banco Santander (Bolsa de
// Madrid) both trade locally as "SAN". Sanofi keeps the bare symbol (pre-existing in this app);
// Santander is disambiguated as "SAN.MC" to match how financial data providers handle this.
export const TICKERS: TickerMeta[] = [
  // ---- European Tech ----
  { symbol: 'ASML', name: 'ASML Holding', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'SAP', name: 'SAP SE', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'SOPA', name: 'Sophos Group', sector: 'Tech', market: 'EU', currency: 'GBP' },
  { symbol: 'LOGI', name: 'Logitech International', sector: 'Tech', market: 'EU', currency: 'CHF' },
  { symbol: 'INFX', name: 'Infineon Technologies', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'PRX', name: 'Prosus', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'WKL', name: 'Wolters Kluwer', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'AMS', name: 'Amadeus IT Group', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'IDR', name: 'Indra Sistemas', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'G24', name: 'Scout24', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'CAP', name: 'Capgemini', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'DSY', name: 'Dassault Systèmes', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'STM', name: 'STMicroelectronics', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'ASM', name: 'ASM International', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'BESI', name: 'BE Semiconductor Industries', sector: 'Tech', market: 'EU', currency: 'EUR' },
  { symbol: 'REN', name: 'RELX', sector: 'Tech', market: 'EU', currency: 'EUR' },

  // ---- European Energy ----
  { symbol: 'SHEL', name: 'Shell plc', sector: 'Energy', market: 'EU', currency: 'GBP' },
  { symbol: 'TTE', name: 'TotalEnergies SE', sector: 'Energy', market: 'EU', currency: 'EUR' },
  { symbol: 'ENI', name: 'Eni SpA', sector: 'Energy', market: 'EU', currency: 'EUR' },
  { symbol: 'ANE', name: 'Acciona Energía', sector: 'Energy', market: 'EU', currency: 'EUR' },
  { symbol: 'ENG', name: 'Enagás', sector: 'Energy', market: 'EU', currency: 'EUR' },
  { symbol: 'REP', name: 'Repsol', sector: 'Energy', market: 'EU', currency: 'EUR' },
  { symbol: 'SLR', name: 'Solaria Energía', sector: 'Energy', market: 'EU', currency: 'EUR' },

  // ---- European Telecom ----
  { symbol: 'DTE', name: 'Deutsche Telekom', sector: 'Telecom', market: 'EU', currency: 'EUR' },
  { symbol: 'CLNX', name: 'Cellnex Telecom', sector: 'Telecom', market: 'EU', currency: 'EUR' },
  { symbol: 'TEF', name: 'Telefónica', sector: 'Telecom', market: 'EU', currency: 'EUR' },
  { symbol: 'ORA', name: 'Orange SA', sector: 'Telecom', market: 'EU', currency: 'EUR' },
  { symbol: 'KPN', name: 'Koninklijke KPN', sector: 'Telecom', market: 'EU', currency: 'EUR' },

  // ---- European Utilities ----
  { symbol: 'ENEL', name: 'Enel SpA', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'IBE', name: 'Iberdrola', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'ELE', name: 'Endesa', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'NTGY', name: 'Naturgy', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'RED', name: 'Redeia Corporación', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'EOAN', name: 'E.ON SE', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'RWE', name: 'RWE AG', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'ENGI', name: 'Engie', sector: 'Utilities', market: 'EU', currency: 'EUR' },
  { symbol: 'VIE', name: 'Veolia Environnement', sector: 'Utilities', market: 'EU', currency: 'EUR' },

  // ---- European Financials ----
  { symbol: 'HSBA', name: 'HSBC Holdings', sector: 'Financials', market: 'EU', currency: 'GBP' },
  { symbol: 'BNP', name: 'BNP Paribas', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'DBK', name: 'Deutsche Bank', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'INGA', name: 'ING Groep', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ADYEN', name: 'Adyen', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ALV', name: 'Allianz SE', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'CS', name: 'Axa', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'BBVA', name: 'BBVA', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'SAN.MC', name: 'Banco Santander', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'DB1', name: 'Deutsche Börse', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ISP', name: 'Intesa Sanpaolo', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'MUV2', name: 'Munich Re', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'NDA', name: 'Nordea Bank', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'UCG', name: 'UniCredit', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'BKT', name: 'Bankinter', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'CABK', name: 'CaixaBank', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'MAP', name: 'Mapfre', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'SAB', name: 'Banco Sabadell', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'UNI', name: 'Unicaja Banco', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'CBK', name: 'Commerzbank', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'HNR1', name: 'Hannover Rück', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ACA', name: 'Crédit Agricole', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'EDEN', name: 'Edenred', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'GLE', name: 'Société Générale', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ABN', name: 'ABN AMRO Bank', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'AGN', name: 'Aegon', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'ASRNL', name: 'ASR Nederland', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'EXO', name: 'Exor', sector: 'Financials', market: 'EU', currency: 'EUR' },
  { symbol: 'NN', name: 'NN Group', sector: 'Financials', market: 'EU', currency: 'EUR' },

  // ---- European Healthcare ----
  { symbol: 'NOVO', name: 'Novo Nordisk', sector: 'Healthcare', market: 'EU', currency: 'DKK' },
  { symbol: 'NVS', name: 'Novartis AG', sector: 'Healthcare', market: 'EU', currency: 'CHF' },
  { symbol: 'ROG', name: 'Roche Holding', sector: 'Healthcare', market: 'EU', currency: 'CHF' },
  { symbol: 'SAN', name: 'Sanofi', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'ARGX', name: 'Argenx', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'BAYN', name: 'Bayer AG', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'EL', name: 'EssilorLuxottica', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'GRF', name: 'Grifols', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'ROVI', name: 'Laboratorios Rovi', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'FRE', name: 'Fresenius SE', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'FME', name: 'Fresenius Medical Care', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'MRK', name: 'Merck KGaA', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'QIA', name: 'Qiagen', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'SHL', name: 'Siemens Healthineers', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'ERF', name: 'Eurofins Scientific', sector: 'Healthcare', market: 'EU', currency: 'EUR' },
  { symbol: 'PHIA', name: 'Philips', sector: 'Healthcare', market: 'EU', currency: 'EUR' },

  // ---- European Consumer ----
  { symbol: 'MC', name: 'LVMH Moet Hennessy', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'OR', name: "L'Oreal SA", sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'NESN', name: 'Nestle SA', sector: 'Consumer', market: 'EU', currency: 'CHF' },
  { symbol: 'ABI', name: 'Anheuser-Busch InBev', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'ADS', name: 'Adidas AG', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'AD', name: 'Ahold Delhaize', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'BN', name: 'Danone', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'RACE', name: 'Ferrari NV', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'RMS', name: 'Hermès International', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'ITX', name: 'Inditex', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'PUIG', name: 'Puig Brands', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'BEI', name: 'Beiersdorf AG', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'HEN3', name: 'Henkel AG', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'ZAL', name: 'Zalando SE', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'AC', name: 'Accor SA', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'CA', name: 'Carrefour', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'KER', name: 'Kering', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'RI', name: 'Pernod Ricard', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'PUB', name: 'Publicis Groupe', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'HEIA', name: 'Heineken', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'UMG', name: 'Universal Music Group', sector: 'Consumer', market: 'EU', currency: 'EUR' },
  { symbol: 'UNA', name: 'Unilever', sector: 'Consumer', market: 'EU', currency: 'GBP' },

  // ---- European Industrials ----
  { symbol: 'AIR', name: 'Airbus SE', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'BMW', name: 'BMW AG', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'VOW3', name: 'Volkswagen AG', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'MBG', name: 'Mercedes-Benz Group', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'RHM', name: 'Rheinmetall AG', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'SAF', name: 'Safran SA', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'SGO', name: 'Saint-Gobain', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'SU', name: 'Schneider Electric', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'SIE', name: 'Siemens AG', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'ENR', name: 'Siemens Energy', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'DG', name: 'Vinci SA', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'DHL', name: 'DHL Group', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'ACS', name: 'ACS Group', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'ANA', name: 'Acciona', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'AENA', name: 'Aena', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'FDR', name: 'Fluidra', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'FER', name: 'Ferrovial', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'IAG', name: 'International Airlines Group', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'LOG', name: 'Logista', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'SCYR', name: 'Sacyr', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'BNR', name: 'Brenntag SE', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'CON', name: 'Continental AG', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'DTG', name: 'Daimler Truck Holding', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'G1A', name: 'GEA Group', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'MTX', name: 'MTU Aero Engines', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'PAH3', name: 'Porsche SE', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'EN', name: 'Bouygues', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'BVI', name: 'Bureau Veritas', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'LR', name: 'Legrand SA', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'ML', name: 'Michelin', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'RNO', name: 'Renault', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'STLA', name: 'Stellantis', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'TEP', name: 'Teleperformance', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'HO', name: 'Thales SA', sector: 'Industrials', market: 'EU', currency: 'EUR' },
  { symbol: 'RAND', name: 'Randstad NV', sector: 'Industrials', market: 'EU', currency: 'EUR' },

  // ---- European Materials ----
  { symbol: 'BAS', name: 'BASF SE', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'AI', name: 'Air Liquide', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'ACX', name: 'Acerinox', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'MT', name: 'ArcelorMittal', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'HEI', name: 'Heidelberg Materials', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'SY1', name: 'Symrise AG', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'AKZA', name: 'AkzoNobel', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'DSFIR', name: 'DSM-Firmenich', sector: 'Materials', market: 'EU', currency: 'EUR' },
  { symbol: 'IMCD', name: 'IMCD NV', sector: 'Materials', market: 'EU', currency: 'EUR' },

  // ---- European Real Estate ----
  { symbol: 'COL', name: 'Inmobiliaria Colonial', sector: 'RealEstate', market: 'EU', currency: 'EUR' },
  { symbol: 'MRL', name: 'Merlin Properties', sector: 'RealEstate', market: 'EU', currency: 'EUR' },
  { symbol: 'VNA', name: 'Vonovia SE', sector: 'RealEstate', market: 'EU', currency: 'EUR' },
  { symbol: 'URW', name: 'Unibail-Rodamco-Westfield', sector: 'RealEstate', market: 'EU', currency: 'EUR' },

  // ---- Danish/Nordic (not part of the 5 target indices, kept for continuity) ----
  { symbol: 'ORX', name: 'Ørsted', sector: 'Energy', market: 'EU', currency: 'DKK' },

  // ---- US tickers (for cross-reference) ----
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tech', market: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Tech', market: 'US', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Tech', market: 'US', currency: 'USD' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', market: 'US', currency: 'USD' },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', market: 'US', currency: 'USD' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', market: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer', market: 'US', currency: 'USD' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', market: 'US', currency: 'USD' },
];

export const TICKER_MAP: Record<string, TickerMeta> = Object.fromEntries(
  TICKERS.map((t) => [t.symbol, t]),
);

export function getTickerMeta(symbol: string): TickerMeta {
  return (
    TICKER_MAP[symbol] ?? {
      symbol,
      name: symbol,
      sector: 'Tech',
      market: 'EU',
      currency: 'EUR',
    }
  );
}
