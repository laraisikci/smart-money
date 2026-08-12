import type {
  InsiderTrade,
  InstitutionalPosition,
  PolymarketMarket,
  EuropeanRegulatorLink,
  OfficialSourceLink,
  TickerNews,
  NewsHeadline,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface InsidersResponse {
  data: InsiderTrade[];
  generatedAt: string;
  coverage: { resolved: string[]; unresolved: string[] };
}

export interface InstitutionsResponse {
  data: InstitutionalPosition[];
  generatedAt: string;
  failedFunds: string[];
}

export interface MarketsResponse {
  data: PolymarketMarket[];
  generatedAt: string;
}

export interface EuropeanResponse {
  data: EuropeanRegulatorLink[];
  note: string;
  majorHoldings: EuropeanRegulatorLink[];
  majorHoldingsNote: string;
}

export interface CongressResponse {
  available: false;
  reason: string;
  officialSources: OfficialSourceLink[];
}

export interface NewsResponse {
  data: TickerNews[];
  generatedAt: string;
}

export interface TickerNewsResponse {
  data: NewsHeadline[];
  generatedAt: string;
  source: 'gnews' | 'yahoo' | 'cache';
}

export const api = {
  insiders: () => getJson<InsidersResponse>('/api/insiders'),
  institutions: () => getJson<InstitutionsResponse>('/api/institutions'),
  markets: () => getJson<MarketsResponse>('/api/markets'),
  european: () => getJson<EuropeanResponse>('/api/european'),
  congress: () => getJson<CongressResponse>('/api/congress'),
  news: () => getJson<NewsResponse>('/api/news'),
  newsForTicker: (ticker: string) => getJson<TickerNewsResponse>(`/api/news/${encodeURIComponent(ticker)}`),
};
