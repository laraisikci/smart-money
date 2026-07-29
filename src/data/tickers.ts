import type { TickerMeta } from '@/types';

export const TICKERS: TickerMeta[] = [
  // European Tech
  { symbol: 'ASML', name: 'ASML Holding', sector: 'Tech', market: 'EU' },
  { symbol: 'SAP', name: 'SAP SE', sector: 'Tech', market: 'EU' },
  { symbol: 'SOPA', name: 'Sophos Group', sector: 'Tech', market: 'EU' },
  { symbol: 'LOGI', name: 'Logitech International', sector: 'Tech', market: 'EU' },
  // European Energy
  { symbol: 'SHEL', name: 'Shell plc', sector: 'Energy', market: 'EU' },
  { symbol: 'TTE', name: 'TotalEnergies SE', sector: 'Energy', market: 'EU' },
  { symbol: 'ENEL', name: 'Enel SpA', sector: 'Energy', market: 'EU' },
  { symbol: 'ORX', name: 'Ørsted', sector: 'Energy', market: 'EU' },
  // European Financials
  { symbol: 'HSBA', name: 'HSBC Holdings', sector: 'Financials', market: 'EU' },
  { symbol: 'BNP', name: 'BNP Paribas', sector: 'Financials', market: 'EU' },
  { symbol: 'DBK', name: 'Deutsche Bank', sector: 'Financials', market: 'EU' },
  { symbol: 'INGA', name: 'ING Groep', sector: 'Financials', market: 'EU' },
  // European Healthcare
  { symbol: 'NOVO', name: 'Novo Nordisk', sector: 'Healthcare', market: 'EU' },
  { symbol: 'NVS', name: 'Novartis AG', sector: 'Healthcare', market: 'EU' },
  { symbol: 'ROG', name: 'Roche Holding', sector: 'Healthcare', market: 'EU' },
  { symbol: 'SAN', name: 'Sanofi', sector: 'Healthcare', market: 'EU' },
  // European Consumer
  { symbol: 'MC', name: 'LVMH Moet Hennessy', sector: 'Consumer', market: 'EU' },
  { symbol: 'OR', name: "L'Oreal SA", sector: 'Consumer', market: 'EU' },
  { symbol: 'NESN', name: 'Nestle SA', sector: 'Consumer', market: 'EU' },
  { symbol: 'ABI', name: 'Anheuser-Busch InBev', sector: 'Consumer', market: 'EU' },
  // European Industrials
  { symbol: 'AIR', name: 'Airbus SE', sector: 'Industrials', market: 'EU' },
  { symbol: 'BMW', name: 'BMW AG', sector: 'Industrials', market: 'EU' },
  { symbol: 'VOW3', name: 'Volkswagen AG', sector: 'Industrials', market: 'EU' },
  // European Materials
  { symbol: 'BAS', name: 'BASF SE', sector: 'Materials', market: 'EU' },
  { symbol: 'AIRP', name: 'Air Liquide', sector: 'Materials', market: 'EU' },
  // US tickers (for cross-reference)
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

export function getTickerMeta(symbol: string): TickerMeta {
  return (
    TICKER_MAP[symbol] ?? {
      symbol,
      name: symbol,
      sector: 'Tech',
      market: 'EU',
    }
  );
}
