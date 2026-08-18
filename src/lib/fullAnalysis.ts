import type { ConvictionResult, NewsHeadline, TechnicalIndicators, AnalystRating } from '@/types';
import { reasonAboutTechnicals } from './technicalReasoning';
import { aggregateSentiment, recentHeadlines } from './newsSentiment';

export type FullAnalysisVerdict = 'Bullish' | 'Bearish' | 'Mixed';

export interface FullAnalysis {
  paragraph: string;
  verdict: FullAnalysisVerdict;
}

type Direction = 'Bullish' | 'Bearish' | 'Neutral';
interface Clause {
  text: string;
  direction: Direction;
}

function smartMoneyClause(result: ConvictionResult): Clause | null {
  const insider = result.signals.find((s) => s.type === 'insider');
  const institution = result.signals.find((s) => s.type === 'institution');
  if (!insider && !institution) return null;

  const parts: string[] = [];
  let scoreSum = 0;
  let count = 0;
  if (insider) {
    parts.push(`insiders show ${insider.detail}`);
    scoreSum += insider.score;
    count++;
  }
  if (institution) {
    parts.push(`institutional filings show ${institution.detail}`);
    scoreSum += institution.score;
    count++;
  }
  const avg = scoreSum / count;
  const direction: Direction = avg >= 55 ? 'Bullish' : avg <= 45 ? 'Bearish' : 'Neutral';
  return { text: `Smart money: ${parts.join(', and ')}.`, direction };
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  strongBuy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strongSell: 'Strong Sell',
  none: 'No Rating',
};

function analystDirection(rating: AnalystRating): Direction {
  // Yahoo's own scale: 1 = Strong Buy ... 5 = Strong Sell.
  if (rating.recommendationMean <= 2.5) return 'Bullish';
  if (rating.recommendationMean >= 3.5) return 'Bearish';
  return 'Neutral';
}

function analystClause(rating: AnalystRating, price: number): Clause {
  const label = RECOMMENDATION_LABELS[rating.recommendationKey] ?? rating.recommendationKey;
  let targetText = '';
  if (rating.targetMeanPrice !== null) {
    const upside = ((rating.targetMeanPrice - price) / price) * 100;
    const dir = upside >= 0 ? 'upside' : 'downside';
    targetText = ` with an average price target implying ${Math.abs(upside).toFixed(0)}% ${dir}`;
  }
  return {
    text: `${rating.numberOfAnalysts} analyst${rating.numberOfAnalysts !== 1 ? 's' : ''} rate it a consensus ${label}${targetText}.`,
    direction: analystDirection(rating),
  };
}

function newsClause(headlines: NewsHeadline[]): Clause | null {
  const recent = recentHeadlines(headlines);
  if (recent.length === 0) return null;
  const agg = aggregateSentiment(recent);
  const direction: Direction = agg === 'Mixed' ? 'Neutral' : agg;
  return {
    text: `News sentiment over the past week reads ${agg.toLowerCase()} across ${recent.length} headline${recent.length !== 1 ? 's' : ''}.`,
    direction,
  };
}

/**
 * Synthesizes every signal this app tracks for one ticker into a single briefing paragraph, plus
 * an overall verdict. Deterministic and rule-based, not an LLM call — matches how every other
 * "reasoning" function in this app works. Returns null when there's nothing at all to reason
 * about (no insider/institutional activity, no technicals, no news) rather than fabricating
 * commentary from an empty state.
 */
export function buildFullAnalysis(
  result: ConvictionResult,
  technicals: TechnicalIndicators | null,
  headlines: NewsHeadline[],
): FullAnalysis | null {
  const clauses: Clause[] = [];

  const smartMoney = smartMoneyClause(result);
  if (smartMoney) clauses.push(smartMoney);

  if (technicals) {
    const reasoning = reasonAboutTechnicals(technicals);
    if (reasoning) {
      const direction: Direction =
        reasoning.verdict === 'Bullish' ? 'Bullish' : reasoning.verdict === 'Bearish' ? 'Bearish' : 'Neutral';
      clauses.push({ text: `Technicals read ${reasoning.verdict.toLowerCase()}.`, direction });
    }
    if (technicals.analyst) {
      clauses.push(analystClause(technicals.analyst, technicals.price));
    }
  }

  const news = newsClause(headlines);
  if (news) clauses.push(news);

  if (clauses.length === 0) return null;

  const bullish = clauses.filter((c) => c.direction === 'Bullish').length;
  const bearish = clauses.filter((c) => c.direction === 'Bearish').length;

  let verdict: FullAnalysisVerdict;
  let agreementText: string;
  if (bullish > 0 && bearish > 0) {
    verdict = 'Mixed';
    agreementText =
      'Signals conflict across sources — some point bullish, others bearish, so conviction should be lower than any single signal suggests.';
  } else if (bullish > bearish && bullish >= 2) {
    verdict = 'Bullish';
    agreementText = 'Multiple independent signals agree, which adds confidence to the bullish read.';
  } else if (bearish > bullish && bearish >= 2) {
    verdict = 'Bearish';
    agreementText = 'Multiple independent signals agree, which adds confidence to the bearish read.';
  } else if (bullish > bearish) {
    verdict = 'Bullish';
    agreementText = 'The lean is bullish, but only one signal is driving it — treat with less confidence than a fuller alignment.';
  } else if (bearish > bullish) {
    verdict = 'Bearish';
    agreementText = 'The lean is bearish, but only one signal is driving it — treat with less confidence than a fuller alignment.';
  } else {
    verdict = 'Mixed';
    agreementText = 'Signals are balanced with no clear majority in either direction.';
  }

  const paragraph = [...clauses.map((c) => c.text), agreementText].join(' ');
  return { paragraph, verdict };
}
