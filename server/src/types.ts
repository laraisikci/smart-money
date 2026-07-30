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

export type InstitutionalAction = 'new' | 'increased' | 'decreased' | 'exited';

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

export interface EuropeanRegulatorLink {
  country: string;
  regulator: string;
  description: string;
  url: string;
}
