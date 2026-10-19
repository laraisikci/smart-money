import type {
  ConvictionResult,
  ConvictionSignal,
  InsiderTrade,
  InstitutionalPosition,
  PolymarketMarket,
  NewsHeadline,
  SignalType,
  Sector,
  TechnicalIndicators,
} from '@/types';
import { getTickerMeta } from '@/data/tickers';
import { daysAgo } from '@/lib/format';
import { recentHeadlines, NEWS_MAX_AGE_DAYS } from '@/lib/newsSentiment';
import { technicalScore } from '@/lib/technicalReasoning';

// Matches the Insiders tab's default recency window. A trade older than this shouldn't silently
// count toward conviction just because it happened to be the most recent thing SEC EDGAR had —
// stale insider data is treated the same as no insider data, not as a live bullish signal.
const INSIDER_MAX_AGE_DAYS = 90;

// Weights: insider buys 35%, institutional changes 30%, technicals 20%, news 10%, prediction
// markets 5%. Smart-money signals (insider + institution) are the point of this app; news is a
// keyword-based heuristic over headlines and prediction markets are speculative, so both are
// deliberately light. Weights re-normalize over whichever signals actually fired.
export const WEIGHTS: Record<SignalType, number> = {
  insider: 0.35,
  institution: 0.30,
  technicals: 0.20,
  news: 0.10,
  polymarket: 0.05,
};

// A stock only counts as "high conviction" with at least two independent signals agreeing —
// one headline-driven signal shouldn't be able to produce a top score by itself.
export const HIGH_CONVICTION_THRESHOLD = 65;
export const MIN_SIGNALS_FOR_HIGH_CONVICTION = 2;
// News alone can contribute at most this many points to the final score.
export const NEWS_ONLY_MAX_SCORE = 15;
// News + prediction markets with no smart-money signal and no technicals behind them: together
// they carry 15% of the weight and are the two softest sources, so they can't rank a stock.
export const SOFT_SIGNALS_MAX_SCORE = 30;
// Any single signal, or any combination with no smart-money (insider/institution) signal at all,
// stays just under the "high conviction" line.
export const WEAK_BASIS_MAX_SCORE = HIGH_CONVICTION_THRESHOLD - 1;

export function isHighConviction(result: Pick<ConvictionResult, 'totalScore' | 'signalsActive'>): boolean {
  return (
    result.totalScore >= HIGH_CONVICTION_THRESHOLD &&
    result.signalsActive.length >= MIN_SIGNALS_FOR_HIGH_CONVICTION &&
    (result.signalsActive.includes('insider') || result.signalsActive.includes('institution'))
  );
}

export interface ConvictionInput {
  insiders: InsiderTrade[];
  institutions: InstitutionalPosition[];
  polymarket: PolymarketMarket[];
  news: NewsHeadline[];
  // Optional: per-ticker technicals. Adds a technicals signal to tickers that already have some
  // other data — it never creates a ticker on its own (otherwise the whole universe would "fire").
  technicals?: Record<string, TechnicalIndicators>;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function insiderSignal(allTrades: InsiderTrade[]): { score: number; detail: string } | null {
  // SEC Form 4 data here is already filtered upstream to meaningful open-market purchases, so it
  // is all BUY; EU PDMR data (AMF) also carries sells (Cession), which must pull the signal down
  // rather than be counted as more buying. Stale trades (older than the recency window) are
  // filtered out so the signal simply doesn't fire on old data.
  const trades = allTrades.filter((t) => daysAgo(t.filingDate) <= INSIDER_MAX_AGE_DAYS);
  const buys = trades.filter((t) => t.transactionType !== 'SELL');
  const sells = trades.filter((t) => t.transactionType === 'SELL');
  if (buys.length === 0 && sells.length === 0) return null;

  const sellValue = sells.reduce((sum, t) => sum + t.value, 0);
  const sym = (trades[0].currency ?? 'USD') === 'EUR' ? '€' : '$';
  if (buys.length === 0) {
    return { score: 20, detail: `${sells.length} sell${sells.length > 1 ? 's' : ''} · ${sym}${formatCompact(sellValue)}, no buys` };
  }

  const buyValue = buys.reduce((sum, t) => sum + t.value, 0);

  // Log-scaled per trade, summed across trades so multiple insiders buying reinforces
  // conviction rather than averaging out. Calibrated against $50k (the filter floor) through
  // large buys: ~$50k -> ~14, ~$500k -> ~35, ~$1M -> ~41, ~$10M -> ~62, ~$50M -> ~76.
  let score = 0;
  for (const t of buys) {
    score += Math.max(0, Math.log10(t.value) - 4) * 20.5;
  }
  // Sells discount the buy score in proportion to how much of the dollar flow they are.
  if (sells.length > 0) score *= 1 - sellValue / (buyValue + sellValue);

  const sellText = sells.length > 0 ? ` · ${sells.length} sell${sells.length > 1 ? 's' : ''}` : '';
  const detail = `${buys.length} buy${buys.length > 1 ? 's' : ''} · ${sym}${formatCompact(buyValue)}${sellText}`;
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
  // Bullish if yes price >= 0.6, bearish if <= 0.3; anything in between says nothing, and a set
  // of markets that all say nothing shouldn't count as a signal "firing" at all.
  let score = 0;
  let bullishCount = 0;
  let decisive = 0;
  for (const m of markets) {
    if (m.yesPrice >= 0.6) {
      score += Math.min(20, (m.yesPrice - 0.5) * 40);
      bullishCount++;
      decisive++;
    } else if (m.yesPrice <= 0.3) {
      score -= Math.min(15, (0.5 - m.yesPrice) * 30);
      decisive++;
    }
  }
  if (decisive === 0) return null;

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
  return `${n.toFixed(0)}`;
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

  // Hard rule: sample/illustrative data never contributes to a score, whatever feeds it in.
  for (const t of input.insiders) if (!t.sample) addToMap(t.ticker, t, 'insiders');
  for (const p of input.institutions) if (!p.sample) addToMap(p.ticker, p, 'institutions');
  for (const m of input.polymarket) {
    if (m.sample) continue;
    for (const ticker of m.relatedTickers) {
      addToMap(ticker, m, 'polymarket');
    }
  }
  for (const h of input.news) if (!h.sample) addToMap(h.ticker, h, 'news');

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
    // Only layered onto tickers that already have some other data (see ConvictionInput).
    const tech = input.technicals?.[ticker];
    const techScore = tech ? technicalScore(tech) : null;
    if (techScore && signals.length > 0) {
      signals.push({ type: 'technicals', score: techScore.score, detail: `Technicals ${techScore.score}% · ${techScore.detail}` });
      signalsActive.push('technicals');
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
    let normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;

    // Evidence caps (see the constants at the top). The weighted average alone can't be trusted
    // when it is renormalized over very few signals — a lone headline signal would otherwise read
    // as a perfect score.
    const hasSmartMoney = signalsActive.includes('insider') || signalsActive.includes('institution');
    const hasTechnicals = signalsActive.includes('technicals');
    if (signalsActive.length === 1 && signalsActive[0] === 'news') {
      normalizedScore = Math.min(normalizedScore, NEWS_ONLY_MAX_SCORE);
    } else if (!hasSmartMoney && !hasTechnicals) {
      normalizedScore = Math.min(normalizedScore, SOFT_SIGNALS_MAX_SCORE);
    } else if (signalsActive.length < MIN_SIGNALS_FOR_HIGH_CONVICTION || !hasSmartMoney) {
      normalizedScore = Math.min(normalizedScore, WEAK_BASIS_MAX_SCORE);
    }

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
