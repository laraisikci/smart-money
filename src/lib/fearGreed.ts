export type FearGreedZone = 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';

// Thresholds as specified: 0-25 Extreme Fear, 25-45 Fear, 45-55 Neutral, 55-75 Greed, 75-100
// Extreme Greed. Duplicated from the server's own zone labeling (macro.ts) rather than shared
// across the client/server boundary — same intentional-duplication call already made for
// aggregateSentiment() in newsSentiment.ts.
const ZONES: { max: number; zone: FearGreedZone }[] = [
  { max: 25, zone: 'Extreme Fear' },
  { max: 45, zone: 'Fear' },
  { max: 55, zone: 'Neutral' },
  { max: 75, zone: 'Greed' },
  { max: Infinity, zone: 'Extreme Greed' },
];

export function fearGreedZone(score: number): FearGreedZone {
  return ZONES.find((z) => score <= z.max)?.zone ?? 'Extreme Greed';
}

export const FEAR_GREED_ZONE_COLOR: Record<FearGreedZone, string> = {
  'Extreme Fear': '#f87171',
  Fear: '#fbbf24',
  Neutral: '#8896a8',
  Greed: '#2dd4bf',
  'Extreme Greed': '#f87171',
};
