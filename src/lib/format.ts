export function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatEuro(n: number): string {
  if (n >= 1_000_000_000) return `€${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

export function formatShares(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Days between an ISO date and right now. Used both for display (timeAgo) and for recency
// filtering, so both stay consistent with each other and with the real clock — this used to be
// computed against a hardcoded reference date left over from the mock-data prototype, which
// silently produced wrong "time ago" text once real (and much older) filing dates showed up.
export function daysAgo(iso: string): number {
  const now = Date.now();
  const d = new Date(iso);
  return Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function timeAgo(iso: string): string {
  const diff = daysAgo(iso);
  if (diff <= 0) return 'today';
  if (diff === 1) return '1 day ago';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  const years = Math.floor(diff / 365);
  return `${years}y ago`;
}
