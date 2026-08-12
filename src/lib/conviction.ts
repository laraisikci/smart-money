import type {
  ConvictionResult,
  ConvictionSignal,
  InsiderTrade,
  InstitutionalPosition,
  PolymarketMarket,
  NewsHeadline,
  SignalType,
  Sector,
} from '@/types';
import { getTickerMeta } from '@/data/tickers';
import { daysAgo } from '@/lib/format';
import { recentHeadlines, NEWS_MAX_AGE_DAYS } from '@/lib/newsSentiment';

// Matches the Insiders tab's default recency window. A trade older than this shouldn't silently
// count toward conviction just because it happened to be the most recent thing SEC EDGAR had —
// stale insider data is treated the same as no insider data, not as a live bullish signal.
const INSIDER_MAX_AGE_DAYS = 90;

// Insider buys carry the highest weight since /api/insiders only returns curated, meaningful
// signal (open-market purchases above $50k from CEO/CFO/COO/President/Chairman/Director) rather
// than a noisy mix of every Form 4 line — a filtered buy is worth more than an unfiltered one.
// Institutional 13F activity gets more weight than Polymarket, a softer/more speculative signal.
// News sentiment is a keyword-based heuristic over headlines, not real NLP — kept at the lowest
// weight to match how much confidence that method actually deserves. There's no congress/
// parliament weight: that data source doesn't exist (see /api/congress).
const WEIGHTS: Record<SignalType, number> = {
  insider: 0.40,
  institution: 0.30,
  polymarket: 0.15,
  news: 0.15,
};

export interface ConvictionInput {
  insiders: InsiderTrade[];
  institutions: InstitutionalPosition[];
  polymarket: PolymarketMarket[];
  news: NewsHeadline[];
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function insiderSignal(allTrades: InsiderTrade[]): { score: number; detail: string } | null {
  // /api/insiders only ever returns open-market purchases above $50k from a CEO/CFO/COO/
  // President/Chairman/Director — every trade here is already a meaningful buy, so there's
  // nothing to net against sells (none exist) and no reason to discount for volume the way the
  // old buy/sell-mix version did. Stale trades (older than the recency window) are filtered out
  // here rather than upstream, so this signal simply doesn't fire on old data instead of
  // silently contributing a score based on something that happened years ago.
  const trades = allTrades.filter((t) => daysAgo(t.filingDate) <= INSIDER_MAX_AGE_DAYS);
  if (trades.length === 0) return null;

  const totalValue = trades.reduce((sum, t) => sum + t.value, 0);

  // Log-scaled per trade, summed across trades so multiple insiders buying reinforces
  // conviction rather than averaging out. Calibrated against $50k (the filter floor) through
  // large buys: ~$50k -> ~14, ~$500k -> ~35, ~$1M -> ~41, ~$10M -> ~62, ~$50M -> ~76.
  let score = 0;
  for (const t of trades) {
    score += Math.max(0, Math.log10(t.value) - 4) * 20.5;
  }

  const detail = `${trades.length} buy${trades.length > 1 ? 's' : ''} · $${formatCompact(totalValue)}`;
  return { score: clampScore(score), detail };
}

function institutionSignal(
  positions: InstitutionalPosition[],
): { score: number; detail: string } | null {
  if (positions.length === 0) return null;
  const bullish = positions.filter(
    (p) => p.action === 'new' || p.action === 'increased',
  );
  const bearish = positions.filter(
    (p) => p.action === 'decreased' || p.action === 'exited',
  );
  if (bullish.length === 0 && bearish.length === 0) return null;

  let score = 0;
  // Multiple funds piling in is the strongest signal
  score += Math.min(45, bullish.length * 15);
  // "New position" carries extra weight
  const newCount = bullish.filter((p) => p.action === 'new').length;
  score += newCount * 8;
  // Penalize exits / decreases
  score -= Math.min(35, bearish.length * 12);

  const detail = `${bullish.length} bullish · ${bearish.length} bearish move${bearish.length !== 1 ? 's' : ''}`;
  return { score: clampScore(score), detail };
}

function polymarketSignal(
  markets: PolymarketMarket[],
): { score: number; detail: string } | null {
  if (markets.length === 0) return null;
  // Bullish if yes price > 0.55 on positive-outcome questions
  let score = 0;
  let bullishCount = 0;
  for (const m of markets) {
    if (m.yesPrice >= 0.6) {
      score += Math.min(20, (m.yesPrice - 0.5) * 40);
      bullishCount++;
    } else if (m.yesPrice <= 0.3) {
      score -= Math.min(15, (0.5 - m.yesPrice) * 30);
    }
  }

  const detail = `${markets.length} market${markets.length !== 1 ? 's' : ''} · ${bullishCount} bullish`;
  return { score: clampScore(score), detail };
}

function newsSignal(allHeadlines: NewsHeadline[]): { score: number; detail: string } | null {
  // Only the last 7 days count — a positive headline from a month ago shouldn't move today's
  // score. This is a keyword-based heuristic, not real sentiment analysis, so it's scored more
  // conservatively than the other signals (smaller per-item swing, lower cap either direction).
  const headlines = recentHeadlines(allHeadlines, NEWS_MAX_AGE_DAYS);
  if (headlines.length === 0) return null;

  const positive = headlines.filter((h) => h.sentiment === 'Positive').length;
  const negative = headlines.filter((h) => h.sentiment === 'Negative').length;
  if (positive === 0 && negative === 0) return null; // all-Neutral week: no signal either way

  const score = clampScore(50 + (positive - negative) * 12);
  const detail = `${headlines.length} headline${headlines.length !== 1 ? 's' : ''} this week · ${positive} positive, ${negative} negative`;
  return { score, detail };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export function computeConviction(input: ConvictionInput): ConvictionResult[] {
  const tickerMap = new Map<
    string,
    {
      insiders: InsiderTrade[];
      institutions: InstitutionalPosition[];
      polymarket: PolymarketMarket[];
      news: NewsHeadline[];
    }
  >();

  const addToMap = (
    key: string,
    item: InsiderTrade | InstitutionalPosition | PolymarketMarket | NewsHeadline,
    field: 'insiders' | 'institutions' | 'polymarket' | 'news',
  ) => {
    const entry = tickerMap.get(key) ?? {
      insiders: [],
      institutions: [],
      polymarket: [],
      news: [],
    };
    entry[field].push(item as never);
    tickerMap.set(key, entry);
  };

  for (const t of input.insiders) addToMap(t.ticker, t, 'insiders');
  for (const p of input.institutions) addToMap(p.ticker, p, 'institutions');
  for (const m of input.polymarket) {
    for (const ticker of m.relatedTickers) {
      addToMap(ticker, m, 'polymarket');
    }
  }
  for (const h of input.news) addToMap(h.ticker, h, 'news');

  const results: ConvictionResult[] = [];

  for (const [ticker, data] of tickerMap) {
    const meta = getTickerMeta(ticker);
    const signals: ConvictionSignal[] = [];
    const signalsActive: SignalType[] = [];

    const ins = insiderSignal(data.insiders);
    if (ins) {
      signals.push({ type: 'insider', score: ins.score, detail: ins.detail });
      signalsActive.push('insider');
    }
    const inst = institutionSignal(data.institutions);
    if (inst) {
      signals.push({ type: 'institution', score: inst.score, detail: inst.detail });
      signalsActive.push('institution');
    }
    const poly = polymarketSignal(data.polymarket);
    if (poly) {
      signals.push({ type: 'polymarket', score: poly.score, detail: poly.detail });
      signalsActive.push('polymarket');
    }
    const news = newsSignal(data.news);
    if (news) {
      signals.push({ type: 'news', score: news.score, detail: news.detail });
      signalsActive.push('news');
    }

    if (signals.length === 0) continue;

    // Weighted total — only count active signals, re-normalize weights
    let totalScore = 0;
    let totalWeight = 0;
    for (const sig of signals) {
      const w = WEIGHTS[sig.type];
      totalScore += sig.score * w;
      totalWeight += w;
    }
    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;

    results.push({
      ticker,
      name: meta.name,
      sector: meta.sector,
      currency: meta.currency,
      market: meta.market,
      totalScore: clampScore(normalizedScore),
      signals,
      signalsActive,
    });
  }

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

export function getSectorTopPick(
  results: ConvictionResult[],
  sector: Sector,
): ConvictionResult | null {
  const filtered = results.filter((r) => r.sector === sector);
  if (filtered.length === 0) return null;
  return filtered[0];
}
