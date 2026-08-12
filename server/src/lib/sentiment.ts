export type Sentiment = 'Positive' | 'Negative' | 'Neutral';

// Deliberately simple: a keyword match against the headline text, nothing more. This is not
// NLP/ML sentiment analysis and shouldn't be presented as more sophisticated than it is — it's
// a fast, free, transparent heuristic. Positive/negative lists are the ones specified, plus a
// modest set of common finance-headline synonyms so obvious cases (surge, upgrade, plunge,
// bankruptcy) aren't missed just for using different wording than the original list.
const POSITIVE_KEYWORDS = [
  'beats', 'beat', 'raises', 'raised', 'acquires', 'acquisition', 'growth', 'record',
  'surge', 'surges', 'soar', 'soars', 'rally', 'rallies', 'upgrade', 'upgraded', 'profit',
  'outperform', 'jumps', 'jump', 'gains', 'gain', 'expands', 'expansion',
];
const NEGATIVE_KEYWORDS = [
  'misses', 'miss', 'cuts', 'cut', 'layoffs', 'layoff', 'investigation', 'loss', 'losses',
  'downgrade', 'downgraded', 'plunge', 'plunges', 'tumble', 'tumbles', 'crash', 'crashes',
  'fraud', 'bankruptcy', 'recall', 'lawsuit', 'probe', 'scandal', 'slumps', 'slump', 'warns',
  'warning', 'plummets',
];

const POSITIVE_RE = new RegExp(`\\b(${POSITIVE_KEYWORDS.join('|')})\\b`, 'i');
const NEGATIVE_RE = new RegExp(`\\b(${NEGATIVE_KEYWORDS.join('|')})\\b`, 'i');

export function classifySentiment(headline: string): Sentiment {
  const hasPositive = POSITIVE_RE.test(headline);
  const hasNegative = NEGATIVE_RE.test(headline);
  // A headline matching both lists (e.g. "beats estimates despite layoffs") is treated as
  // Neutral rather than guessing which signal dominates — that's a judgment call this simple
  // approach isn't equipped to make.
  if (hasPositive && !hasNegative) return 'Positive';
  if (hasNegative && !hasPositive) return 'Negative';
  return 'Neutral';
}

export type AggregateSentiment = 'Bullish' | 'Bearish' | 'Mixed';

// "Mixed" covers both genuinely mixed signals (positive and negative both present) and no
// signal at all (everything Neutral, or no headlines) — in both cases there's no clean bullish
// or bearish read, which is the honest thing to show rather than defaulting to one direction.
export function aggregateSentiment(sentiments: Sentiment[]): AggregateSentiment {
  const positive = sentiments.filter((s) => s === 'Positive').length;
  const negative = sentiments.filter((s) => s === 'Negative').length;
  if (positive === 0 && negative === 0) return 'Mixed';
  if (positive > negative) return 'Bullish';
  if (negative > positive) return 'Bearish';
  return 'Mixed';
}
