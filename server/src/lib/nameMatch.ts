const SUFFIXES = [
  'incorporated', 'inc', 'corporation', 'corp', 'company', 'co', 'plc', 'se', 'sa', 'nv', 'ag',
  'ltd', 'llc', 'lp', 'holding', 'holdings', 'group', 'the',
];

function normalize(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[.,'’()]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.includes(w));
  return cleaned.join(' ').trim();
}

/**
 * 13F information tables only carry a free-text issuer name (e.g. "APPLE INC") and a CUSIP —
 * no ticker. We match that name against our tracked ticker universe by normalizing both sides
 * (stripping corporate suffixes/punctuation) and requiring the shorter string to be a substring
 * of the longer one, which is tolerant of "ASML HOLDING NV" vs "ASML Holding" without being so
 * loose it matches unrelated companies.
 */
export function matchIssuerName<T extends { symbol: string; name: string }>(
  issuerName: string,
  candidates: T[],
): T | null {
  const target = normalize(issuerName);
  if (!target) return null;
  for (const c of candidates) {
    const candidateNorm = normalize(c.name);
    if (!candidateNorm) continue;
    if (target === candidateNorm) return c;
  }
  for (const c of candidates) {
    const candidateNorm = normalize(c.name);
    if (!candidateNorm) continue;
    const [shorter, longer] =
      candidateNorm.length <= target.length ? [candidateNorm, target] : [target, candidateNorm];
    if (shorter.length >= 3 && longer.includes(shorter)) return c;
  }
  return null;
}
