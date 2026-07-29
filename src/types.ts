export type Sector =
  | 'Tech'
  | 'Energy'
  | 'Financials'
  | 'Healthcare'
  | 'Consumer'
  | 'Industrials'
  | 'Materials';

  export const SECTORS: Sector[] = [
    'Tech',
    'Energy',
    'Financials',
    'Healthcare',
    'Consumer',
    'Industrials',
    'Materials',
  ];

export type SignalType = 'insider' | 'institution' | 'congress' | 'polymarket';

export interface TickerMeta {
  symbol: string;
  name: string;
  sector: Sector;
  market: 'EU' | 'US';
}

export interface InsiderTrade {
  id: string;
  ticker: string;
  insiderName: string;
  insiderTitle: string;
  transactionType: 'BUY' | 'SELL';
  shares: number;
  price: number;
  value: number;
  filingDate: string;
  market: 'EU' | 'US';
}

export type InstitutionalAction =
  | 'new'
  | 'increased'
  | 'decreased'
  | 'exited';

export interface InstitutionalPosition {
  id: string;
  fundName: string;
  fundSlug: string;
  ticker: string;
  companyName: string;
  action: InstitutionalAction;
  shares: number;
  marketValue: number;
  pctChange: number;
  filingDate: string;
  quarter: string;
}

export interface PoliticianTrade {
  id: string;
  politicianName: string;
  country: 'EU' | 'US';
  body: string;
  ticker: string;
  transactionType: 'BUY' | 'SELL';
  amountRange: string;
  tradeDate: string;
  disclosureDate: string;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  relatedTickers: string[];
}

export interface ConvictionSignal {
  type: SignalType;
  score: number;
  detail: string;
}

export interface ConvictionResult {
  ticker: string;
  name: string;
  sector: Sector;
  market: 'EU' | 'US';
  totalScore: number;
  signals: ConvictionSignal[];
  signalsActive: SignalType[];
}

export interface EarningsDate {
  ticker: string;
  nextEarnings: string;
  source: 'sample';
}

export interface ShortInterest {
  ticker: string;
  shortInterestPct: number;
  float: number;
  daysToCover: number;
  source: 'sample';
}
