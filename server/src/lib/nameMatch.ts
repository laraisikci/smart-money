const SUFFIXES = [
  'incorporated', 'inc', 'corporation', 'corp', 'company', 'co', 'plc', 'se', 'sa', 'spa', 'nv',
  'ag', 'ltd', 'llc', 'lp', 'holding', 'holdings', 'group', 'the',
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
 * loose it matches unrelated companies. Exact match is always tried first and preferred.
 *
 * The tracked universe is ~160 tickers (EURO STOXX 50 / DAX / CAC 40 / IBEX 35 / AEX plus US
 * names). Some large 13F filers (Vanguard, BlackRock, State Street) report thousands of holding
 * rows, so this builds an index once per request rather than re-normalizing all ~160 candidates
 * on every row — that turns exact matches (the common case) into an O(1) lookup instead of an
 * O(candidates) scan repeated per row.
 */
export interface IssuerMatcher<T> {
  match(issuerName: string): T | null;
}

export function buildIssuerMatcher<T extends { symbol: string; name: string }>(
  candidates: T[],
): IssuerMatcher<T> {
  const exact = new Map<string, T>();
  const normalized: { key: string; candidate: T }[] = [];
  for (const c of candidates) {
    const key = normalize(c.name);
    if (!key) continue;
    exact.set(key, c);
    normalized.push({ key, candidate: c });
  }

  return {
    match(issuerName: string): T | null {
      const target = normalize(issuerName);
      if (!target) return null;

      const exactHit = exact.get(target);
      if (exactHit) return exactHit;

      for (const { key, candidate } of normalized) {
        const [shorter, longer] = key.length <= target.length ? [key, target] : [target, key];
        if (shorter.length >= 4 && longer.includes(shorter)) return candidate;
      }
      return null;
    },
  };
}
