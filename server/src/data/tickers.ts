export type Sector =
  | 'Tech'
  | 'Energy'
  | 'Financials'
  | 'Healthcare'
  | 'Consumer'
  | 'Industrials'
  | 'Materials';

export interface TickerMeta {
  symbol: string;
  name: string;
  sector: Sector;
  market: 'EU' | 'US';
}

// Mirrors src/data/tickers.ts on the frontend — this is the universe of tickers the dashboard
// tracks. Kept in sync manually since frontend and server are separately deployable packages.
export const TICKERS: TickerMeta[] = [
  { symbol: 'ASML', name: 'ASML Holding', sector: 'Tech', market: 'EU' },
  { symbol: 'SAP', name: 'SAP SE', sector: 'Tech', market: 'EU' },
  { symbol: 'SOPA', name: 'Sophos Group', sector: 'Tech', market: 'EU' },
  { symbol: 'LOGI', name: 'Logitech International', sector: 'Tech', market: 'EU' },
  { symbol: 'SHEL', name: 'Shell plc', sector: 'Energy', market: 'EU' },
  { symbol: 'TTE', name: 'TotalEnergies SE', sector: 'Energy', market: 'EU' },
  { symbol: 'ENEL', name: 'Enel SpA', sector: 'Energy', market: 'EU' },
  { symbol: 'ORX', name: 'Ørsted', sector: 'Energy', market: 'EU' },
  { symbol: 'HSBA', name: 'HSBC Holdings', sector: 'Financials', market: 'EU' },
  { symbol: 'BNP', name: 'BNP Paribas', sector: 'Financials', market: 'EU' },
  { symbol: 'DBK', name: 'Deutsche Bank', sector: 'Financials', market: 'EU' },
  { symbol: 'INGA', name: 'ING Groep', sector: 'Financials', market: 'EU' },
  { symbol: 'NOVO', name: 'Novo Nordisk', sector: 'Healthcare', market: 'EU' },
  { symbol: 'NVS', name: 'Novartis AG', sector: 'Healthcare', market: 'EU' },
  { symbol: 'ROG', name: 'Roche Holding', sector: 'Healthcare', market: 'EU' },
  { symbol: 'SAN', name: 'Sanofi', sector: 'Healthcare', market: 'EU' },
  { symbol: 'MC', name: 'LVMH Moet Hennessy', sector: 'Consumer', market: 'EU' },
  { symbol: 'OR', name: "L'Oreal SA", sector: 'Consumer', market: 'EU' },
  { symbol: 'NESN', name: 'Nestle SA', sector: 'Consumer', market: 'EU' },
  { symbol: 'ABI', name: 'Anheuser-Busch InBev', sector: 'Consumer', market: 'EU' },
  { symbol: 'AIR', name: 'Airbus SE', sector: 'Industrials', market: 'EU' },
  { symbol: 'BMW', name: 'BMW AG', sector: 'Industrials', market: 'EU' },
  { symbol: 'VOW3', name: 'Volkswagen AG', sector: 'Industrials', market: 'EU' },
  { symbol: 'BAS', name: 'BASF SE', sector: 'Materials', market: 'EU' },
  { symbol: 'AIRP', name: 'Air Liquide', sector: 'Materials', market: 'EU' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tech', market: 'US' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Tech', market: 'US' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Tech', market: 'US' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', market: 'US' },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', market: 'US' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', market: 'US' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer', market: 'US' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', market: 'US' },
];

export const TICKER_MAP: Record<string, TickerMeta> = Object.fromEntries(
  TICKERS.map((t) => [t.symbol, t]),
);
