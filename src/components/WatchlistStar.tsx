import { useState } from 'react';
import { Star } from 'lucide-react';
import type { AnalyzeTarget, InstitutionalPosition, NewsHeadline, TechnicalIndicators } from '@/types';
import { isWatchlisted, addToWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { isTrackedTicker } from '@/data/tickers';
import { buildWatchlistSnapshot } from '@/lib/watchlistSnapshot';
import { api } from '@/lib/api';

interface WatchlistStarButtonProps {
  target: AnalyzeTarget;
  convictionScore: number;
  institutions: InstitutionalPosition[];
  news: NewsHeadline[];
  // Pass already-fetched technicals when the caller has them (e.g. the detail drawer, or an
  // ad-hoc search result that came back from /api/search/analyze). Omit for cards that never
  // load technicals themselves — the button fetches them on demand for tracked tickers only,
  // since /api/technicals/:ticker 404s for anything outside the pre-tracked universe.
  technicals?: TechnicalIndicators | null;
  onChange?: (watchlisted: boolean) => void;
  variant?: 'icon' | 'pill';
  className?: string;
  disabled?: boolean;
}

export function WatchlistStarButton({
  target,
  convictionScore,
  institutions,
  news,
  technicals,
  onChange,
  variant = 'icon',
  className = '',
  disabled = false,
}: WatchlistStarButtonProps) {
  const [watchlisted, setWatchlisted] = useState(() => isWatchlisted(target.symbol));
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;

    if (watchlisted) {
      removeFromWatchlist(target.symbol);
      setWatchlisted(false);
      onChange?.(false);
      return;
    }

    setBusy(true);
    let tech = technicals;
    if (tech === undefined) {
      if (isTrackedTicker(target.symbol)) {
        try {
          tech = (await api.technicalsForTicker(target.symbol)).data;
        } catch {
          tech = null;
        }
      } else {
        tech = null;
      }
    }
    const snapshot = buildWatchlistSnapshot({ convictionScore, technicals: tech ?? null, institutions, news });
    addToWatchlist(target, snapshot);
    setWatchlisted(true);
    setBusy(false);
    onChange?.(true);
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleClick}
        disabled={busy || disabled}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors disabled:opacity-50 ${
          watchlisted
            ? 'border-teal-500/40 bg-teal-400/15 text-teal-300'
            : 'border-ink-700 bg-ink-800/60 text-ink-300 hover:border-ink-600 hover:text-ink-100'
        } ${className}`}
      >
        <Star className={`h-3.5 w-3.5 ${watchlisted ? 'fill-teal-300' : ''}`} />
        {watchlisted ? 'Watchlisted' : 'Save to Watchlist'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || disabled}
      aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        watchlisted ? 'text-teal-300' : 'text-ink-500 hover:text-ink-200'
      } ${className}`}
    >
      <Star className={`h-4 w-4 ${watchlisted ? 'fill-teal-300' : ''}`} />
    </button>
  );
}
