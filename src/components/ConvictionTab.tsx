import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Calendar, Globe2, Star } from 'lucide-react';
import type { ConvictionResult, Sector, NewsHeadline, SearchResult, AnalyzeResponse } from '@/types';
import { SECTORS } from '@/types';
import { computeConviction, getSectorTopPick } from '@/lib/conviction';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getEarningsDate, daysUntilEarnings } from '@/data/earnings';
import { registerAdHocTicker, isTrackedTicker } from '@/data/tickers';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isWatchlisted } from '@/lib/watchlist';
import { SignalIcons, MarketTag, TrendArrow, SentimentBadge, LoadingCards, ErrorCard } from '@/components/ui';
import { TickerDetailDrawer } from '@/components/TickerDetailDrawer';
import { SearchBar } from '@/components/SearchBar';

type MarketFilter = 'ALL' | 'EU' | 'US';
const MARKET_FILTERS: { label: string; value: MarketFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'EU Only', value: 'EU' },
  { label: 'US Only', value: 'US' },
];

export function ConvictionTab() {
  const [selected, setSelected] = useState<ConvictionResult | null>(null);
  // Defaults to EU Only per how this app is actually used (Barcelona-based investing).
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('EU');
  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');
  const news = useApi(api.news, 'news');

  const loading = insiders.loading || institutions.loading || polymarket.loading || news.loading;
  const error = insiders.error || institutions.error || polymarket.error || news.error;
  // "All 4 sources have finished trying" (succeeded or failed) — not "all 4 succeeded". Used only
  // to decide when it's safe to show a terminal "nothing here" message; individual sections
  // render progressively from whatever has actually landed, they don't wait on this.
  const settled = !loading;

  // Search & watchlist: results reached this way live outside the pre-tracked TICKERS universe,
  // so they get their own fetch (/api/search/analyze) rather than the bulk endpoints above. Kept
  // in one map, keyed by ticker, whether they got here via a one-off search or a saved watchlist
  // entry — both need the exact same override treatment in the detail drawer below.
  const [adhocAnalyses, setAdhocAnalyses] = useState<Map<string, AnalyzeResponse>>(new Map());
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Bulk-only — feeds computeConviction below, which also gets adhocNews spread in separately.
  // Keeping this one bulk-only avoids double-counting an ad-hoc ticker's headlines into its own
  // news signal.
  const newsByTicker = useMemo(() => {
    const map = new Map<string, NewsHeadline[]>();
    for (const t of news.data?.data ?? []) map.set(t.ticker, t.headlines);
    return map;
  }, [news.data]);
  const allHeadlines = useMemo(() => Array.from(newsByTicker.values()).flat(), [newsByTicker]);

  // Bulk + ad-hoc merged — for display lookups only (SentimentBadge on cards), never fed into
  // computeConviction.
  const displayNewsByTicker = useMemo(() => {
    const map = new Map(newsByTicker);
    for (const a of adhocAnalyses.values()) map.set(a.ticker, a.news);
    return map;
  }, [newsByTicker, adhocAnalyses]);

  async function analyzeAndCache(target: {
    symbol: string;
    name: string;
    market: 'EU' | 'US';
    currency: SearchResult['currency'];
    sector: Sector;
  }): Promise<AnalyzeResponse | null> {
    try {
      const analysis = await api.analyze(target);
      registerAdHocTicker({
        symbol: analysis.ticker,
        name: analysis.name,
        sector: analysis.sector,
        market: analysis.market,
        currency: analysis.currency,
      });
      setAdhocAnalyses((prev) => new Map(prev).set(analysis.ticker, analysis));
      return analysis;
    } catch {
      return null;
    }
  }

  // Fetch (once) for every saved watchlist ticker so it's folded into the main list below,
  // exactly like the pre-tracked universe — this is what makes "save to watchlist" actually mean
  // something rather than just storing a symbol nobody reads back.
  useEffect(() => {
    const toFetch = watchlist.filter((w) => !adhocAnalyses.has(w.symbol));
    if (toFetch.length === 0) return;
    toFetch.forEach((w) =>
      analyzeAndCache({ symbol: w.symbol, name: w.name, market: w.market, currency: w.currency, sector: w.sector }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  const adhocInsiders = useMemo(() => Array.from(adhocAnalyses.values()).flatMap((a) => a.insiders), [adhocAnalyses]);
  const adhocInstitutions = useMemo(
    () => Array.from(adhocAnalyses.values()).flatMap((a) => a.institutions),
    [adhocAnalyses],
  );
  const adhocNews = useMemo(() => Array.from(adhocAnalyses.values()).flatMap((a) => a.news), [adhocAnalyses]);

  // Deliberately not gated on `ready` (all 4 sources loaded) — computeConviction already treats
  // every signal as optional, so a ticker with just 1 of 4 signals in produces a valid result.
  // Recomputing from whatever has landed so far means results appear as each source arrives
  // instead of the whole tab waiting on the single slowest one.
  const allResults = useMemo(() => {
    return computeConviction({
      insiders: [...(insiders.data?.data ?? []), ...adhocInsiders],
      institutions: [...(institutions.data?.data ?? []), ...adhocInstitutions],
      polymarket: polymarket.data?.data ?? [],
      news: [...allHeadlines, ...adhocNews],
    });
  }, [insiders.data, institutions.data, polymarket.data, allHeadlines, adhocInsiders, adhocInstitutions, adhocNews]);

  const results = useMemo(
    () => (marketFilter === 'ALL' ? allResults : allResults.filter((r) => r.market === marketFilter)),
    [allResults, marketFilter],
  );

  const watchlistResults = useMemo(
    () => watchlist.map((w) => allResults.find((r) => r.ticker === w.symbol)).filter((r): r is ConvictionResult => !!r),
    [watchlist, allResults],
  );

  async function handleSearchSelect(result: SearchResult) {
    setSearchError(null);
    if (result.tracked) {
      const existing = allResults.find((r) => r.ticker === result.symbol);
      if (existing) {
        setSelected(existing);
        return;
      }
      // Bulk-tracked but no active signal yet (or bulk data still loading) — fall through to the
      // ad-hoc path below so the user sees something rather than nothing.
    }
    setSearchLoading(true);
    const analysis = await analyzeAndCache(result);
    setSearchLoading(false);
    if (!analysis) {
      setSearchError(`Couldn't load data for ${result.symbol}. Try again in a moment.`);
      return;
    }
    const computed = computeConviction({
      insiders: analysis.insiders,
      institutions: analysis.institutions,
      polymarket: [],
      news: analysis.news,
    });
    const found = computed.find((r) => r.ticker === analysis.ticker);
    setSelected(
      found ?? {
        ticker: analysis.ticker,
        name: analysis.name,
        sector: analysis.sector,
        market: analysis.market,
        currency: analysis.currency,
        totalScore: 0,
        signals: [],
        signalsActive: [],
      },
    );
  }

  function handleToggleWatchlist() {
    if (!selected) return;
    if (isWatchlisted(selected.ticker)) {
      setWatchlist(removeFromWatchlist(selected.ticker));
    } else {
      setWatchlist(
        addToWatchlist({
          symbol: selected.ticker,
          name: selected.name,
          market: selected.market,
          currency: selected.currency,
          sector: selected.sector,
        }),
      );
    }
  }

  const selectedAdhoc = selected ? adhocAnalyses.get(selected.ticker) : undefined;
  const selectedIsAdhoc = !!selected && !isTrackedTicker(selected.ticker);

  const top3 = results.slice(0, 3);
  const topTickers = new Set(top3.map((r) => r.ticker));
  const remaining = results.filter((r) => !topTickers.has(r.ticker));

  // Only worth showing as a distinguishing subset when the view is otherwise mixed — with the
  // EU Only filter active, everything below is already EU, so this section would just duplicate
  // Top 3 / By Sector.
  const europeanMovers = useMemo(
    () => (marketFilter === 'ALL' ? results.filter((r) => r.market === 'EU').slice(0, 5) : []),
    [results, marketFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Conviction Scores</h2>
      </div>

      {/* Custom stock search — works for any ticker or company name, not just the tracked
          universe (see /api/search + /api/search/analyze). */}
      <div>
        <SearchBar onSelect={handleSearchSelect} />
        {searchLoading && <p className="mt-2 text-2xs text-ink-500">Analyzing…</p>}
        {searchError && <p className="mt-2 text-2xs text-bear-400">{searchError}</p>}
      </div>

      {/* Market filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {MARKET_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setMarketFilter(f.value)}
            className={`pill shrink-0 ${marketFilter === f.value ? 'pill-active' : 'pill-idle'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Only shown before anything has landed at all — once the first results render below,
          they update in place as more sources arrive rather than being replaced by this again. */}
      {loading && allResults.length === 0 && <LoadingCards />}
      {error && (
        <ErrorCard
          message={error}
          onRetry={() => {
            insiders.refetch();
            institutions.refetch();
            polymarket.refetch();
            news.refetch();
          }}
        />
      )}

      {/* My Watchlist — stocks saved from search, regardless of tracked-universe rank */}
      {watchlistResults.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-teal-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
              My Watchlist
            </p>
          </div>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {watchlistResults.map((r, i) => (
              <ConvictionCard
                key={`watch-${r.ticker}`}
                result={r}
                rank={i + 1}
                headlines={displayNewsByTicker.get(r.ticker) ?? []}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* European Movers — EU-tagged tickers only, ranked separately from the global list */}
      {europeanMovers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-teal-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
              European Movers
            </p>
          </div>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {europeanMovers.map((r, i) => (
              <ConvictionCard
                key={`eu-${r.ticker}`}
                result={r}
                rank={i + 1}
                headlines={displayNewsByTicker.get(r.ticker) ?? []}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top 3 High-Conviction */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          Top 3 High-Conviction
        </p>
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {top3.map((r, i) => (
            <ConvictionCard
              key={r.ticker}
              result={r}
              rank={i + 1}
              featured
              headlines={displayNewsByTicker.get(r.ticker) ?? []}
              onClick={() => setSelected(r)}
            />
          ))}
        </div>
      </div>

      {/* By Sector */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          By Sector
        </p>
        <div className="space-y-2">
          {SECTORS.map((sector) => {
            const pick = getSectorTopPick(remaining, sector as Sector);
            if (!pick) return null;
            return (
              <SectorRow
                key={sector}
                sector={sector as Sector}
                result={pick}
                headlines={displayNewsByTicker.get(pick.ticker) ?? []}
                onClick={() => setSelected(pick)}
              />
            );
          })}
        </div>
      </div>

      {settled && results.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No conviction signals detected yet.
        </div>
      )}

      <TickerDetailDrawer
        result={selected}
        onClose={() => setSelected(null)}
        insiders={selectedIsAdhoc ? (selectedAdhoc?.insiders ?? []) : (insiders.data?.data ?? [])}
        institutions={selectedIsAdhoc ? (selectedAdhoc?.institutions ?? []) : (institutions.data?.data ?? [])}
        polymarket={polymarket.data?.data ?? []}
        news={selected ? (displayNewsByTicker.get(selected.ticker) ?? []) : []}
        technicalsOverride={selectedIsAdhoc ? (selectedAdhoc?.technicals ?? null) : undefined}
        skipNewsFetch={selectedIsAdhoc}
        watchlisted={selected ? isWatchlisted(selected.ticker) : false}
        onToggleWatchlist={selectedIsAdhoc ? handleToggleWatchlist : undefined}
      />
    </div>
  );
}

function EarningsBadge({ ticker }: { ticker: string }) {
  const earnings = getEarningsDate(ticker);
  if (!earnings) return null;
  const days = daysUntilEarnings(earnings.nextEarnings);
  if (days === null || days <= 0 || days > 60) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warn-500/30 bg-warn-500/10 px-2 py-0.5 text-2xs font-medium text-warn-300">
      <Calendar className="h-2.5 w-2.5" />
      Earnings in {days} day{days !== 1 ? 's' : ''}
    </span>
  );
}

function ConvictionCard({
  result,
  rank,
  featured,
  headlines,
  onClick,
}: {
  result: ConvictionResult;
  rank: number;
  featured?: boolean;
  headlines: NewsHeadline[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`card w-full animate-fade-in-up p-4 text-left transition-all duration-200 hover:border-teal-500/40 active:scale-[0.99] ${
        featured ? 'border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-sm font-bold text-teal-300">
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-ink-50">{result.ticker}</span>
              <MarketTag market={result.market} currency={result.currency} />
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-400">{result.name}</p>
            <div className="mt-1">
              <SentimentBadge headlines={headlines} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-teal-300">{result.totalScore}</div>
          <p className="text-2xs text-ink-500">conviction</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <SignalIcons signals={result.signalsActive} />
        <span className="rounded-full bg-ink-700/50 px-2 py-0.5 text-2xs font-medium text-ink-300">
          {result.sector}
        </span>
      </div>

      {/* Earnings badge */}
      <div className="mt-2">
        <EarningsBadge ticker={result.ticker} />
      </div>

      {/* Signal breakdown */}
      <div className="mt-3 space-y-1.5 border-t border-ink-700/40 pt-3">
        {result.signals.map((sig) => (
          <div key={sig.type} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-300">
              <TrendArrow direction={sig.score >= 50 ? 'up' : 'down'} />
              {sig.detail}
            </span>
            <span className="font-mono text-ink-400">{sig.score}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function SectorRow({
  sector,
  result,
  headlines,
  onClick,
}: {
  sector: Sector;
  result: ConvictionResult;
  headlines: NewsHeadline[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card flex w-full items-center justify-between p-3 text-left transition-all duration-200 hover:border-ink-600 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs font-medium text-ink-400">{sector}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink-100">{result.ticker}</span>
            <MarketTag market={result.market} currency={result.currency} />
          </div>
          <p className="truncate text-2xs text-ink-500">{result.name}</p>
          <div className="mt-1">
            <SentimentBadge headlines={headlines} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SignalIcons signals={result.signalsActive} />
        <span className="font-mono text-sm font-bold text-teal-300">{result.totalScore}</span>
        <ChevronRight className="h-4 w-4 text-ink-500" />
      </div>
    </button>
  );
}
