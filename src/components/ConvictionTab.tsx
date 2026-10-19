import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Calendar, Globe2 } from 'lucide-react';
import type {
  ConvictionResult,
  SignalType,
  Sector,
  NewsHeadline,
  InstitutionalPosition,
  TechnicalIndicators,
  SearchResult,
  AnalyzeResponse,
} from '@/types';
import { SECTORS } from '@/types';
import { computeConviction, getSectorTopPick, isHighConviction } from '@/lib/conviction';
import { recordScores, getAllHistoryInfo, type ScoreHistoryInfo } from '@/lib/scoreHistory';
import { quarterEnd, THIRTEEN_F_AMBER_DAYS, THIRTEEN_F_RED_DAYS } from '@/lib/freshness';
import { trendLabel, distanceFrom52wHigh, currencySymbol, TREND_STYLE } from '@/lib/cardStats';
import { applyConvictionCap, evaluateSignalAlignment } from '@/lib/signalConflict';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getEarningsDate, daysUntilEarnings } from '@/data/earnings';
import { registerAdHocTicker, isTrackedTicker } from '@/data/tickers';
import { SignalIcons, MarketTag, TrendArrow, SentimentBadge, LoadingCards, ErrorCard, FreshnessBadge, FailedBadge } from '@/components/ui';
import { WatchlistStarButton } from '@/components/WatchlistStar';
import { TickerDetailDrawer } from '@/components/TickerDetailDrawer';
import { SearchBar } from '@/components/SearchBar';
import { TrackedUniverseModal } from '@/components/TrackedUniverseModal';
import { TICKERS } from '@/data/tickers';

type MarketFilter = 'ALL' | 'EU' | 'US';
const MARKET_FILTERS: { label: string; value: MarketFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'EU Only', value: 'EU' },
  { label: 'US Only', value: 'US' },
];

type ConfirmationFilter = 'ALL' | 'CONFIRMED';
const CONFIRMATION_FILTERS: { label: string; value: ConfirmationFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed only', value: 'CONFIRMED' },
];

export function ConvictionTab() {
  const [selected, setSelected] = useState<ConvictionResult | null>(null);
  // Defaults to EU Only per how this app is actually used (Barcelona-based investing).
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('EU');
  const [confirmationFilter, setConfirmationFilter] = useState<ConfirmationFilter>('ALL');
  const [universeOpen, setUniverseOpen] = useState(false);
  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');
  const news = useApi(api.news, 'news');
  // Not part of `loading`/`error` below (those gate the main conviction lists) — the drawer's
  // Fear & Greed read and Market Sentiment badge just render without them until this lands.
  const macro = useApi(api.macro);
  // Analyst-free technicals for the whole tracked universe — powers the technical-breakdown cap,
  // the Signal Conflict badge, and the "Confirmed only" filter below. Also not part of
  // `loading`/`error`: scores render with the un-capped total until this lands, same progressive-
  // render philosophy as everything else on this tab, rather than blocking the whole list on it.
  const coreTechnicals = useApi(api.coreTechnicals, 'technicals');
  const coreTechByTicker = coreTechnicals.data?.data;

  const loading = insiders.loading || institutions.loading || polymarket.loading || news.loading;
  const error = insiders.error || institutions.error || polymarket.error || news.error;
  // "All 4 sources have finished trying" (succeeded or failed) — not "all 4 succeeded". Used only
  // to decide when it's safe to show a terminal "nothing here" message; individual sections
  // render progressively from whatever has actually landed, they don't wait on this.
  const settled = !loading;

  // Sources that errored (vs. simply having nothing on a given stock): shown greyed out with a ✗
  // on every card and excluded from the score — they never contribute silently.
  const failedSources = useMemo<SignalType[]>(() => {
    const out: SignalType[] = [];
    if (insiders.error) out.push('insider');
    if (institutions.error) out.push('institution');
    if (polymarket.error) out.push('polymarket');
    if (news.error) out.push('news');
    if (coreTechnicals.error) out.push('technicals');
    return out;
  }, [insiders.error, institutions.error, polymarket.error, news.error, coreTechnicals.error]);

  // Search & watchlist: results reached this way live outside the pre-tracked TICKERS universe,
  // so they get their own fetch (/api/search/analyze) rather than the bulk endpoints above. Kept
  // in one map, keyed by ticker, whether they got here via a one-off search or a saved watchlist
  // entry — both need the exact same override treatment in the detail drawer below.
  const [adhocAnalyses, setAdhocAnalyses] = useState<Map<string, AnalyzeResponse>>(new Map());
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

  const adhocInsiders = useMemo(() => Array.from(adhocAnalyses.values()).flatMap((a) => a.insiders), [adhocAnalyses]);
  const adhocInstitutions = useMemo(
    () => Array.from(adhocAnalyses.values()).flatMap((a) => a.institutions),
    [adhocAnalyses],
  );
  const adhocNews = useMemo(() => Array.from(adhocAnalyses.values()).flatMap((a) => a.news), [adhocAnalyses]);

  // Per-ticker lookup for the watchlist star button, which needs this stock's institutional
  // positions alone to compute its "increasing/decreasing/neutral" stance at add-time.
  const institutionsByTicker = useMemo(() => {
    const map = new Map<string, InstitutionalPosition[]>();
    for (const p of [...(institutions.data?.data ?? []), ...adhocInstitutions]) {
      const arr = map.get(p.ticker) ?? [];
      arr.push(p);
      map.set(p.ticker, arr);
    }
    return map;
  }, [institutions.data, adhocInstitutions]);

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
      technicals: coreTechByTicker,
    });
  }, [insiders.data, institutions.data, polymarket.data, allHeadlines, adhocInsiders, adhocInstitutions, adhocNews, coreTechByTicker]);

  // Applies the technical-breakdown cap and re-sorts, so a capped stock actually drops out of
  // Top 3 / sector picks rather than just displaying a lower number while still ranking as if
  // nothing changed. Left untouched (and unsorted-by-cap) for any ticker the bulk technicals
  // scan hasn't covered yet — no false cap while that data is still loading.
  const cappedResults = useMemo(() => {
    if (!coreTechByTicker) return allResults;
    return [...allResults]
      .map((r) => ({ ...r, totalScore: applyConvictionCap(r.totalScore, coreTechByTicker[r.ticker]) }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [allResults, coreTechByTicker]);

  // Daily score history (localStorage). Only recorded once the sources that carry real weight have
  // actually loaded — a half-loaded or failed-source score would put a misleading point in the
  // trend line. Prediction markets (5% weight) are allowed to be missing.
  const latest13fQuarter = useMemo(() => {
    const quarters = (institutions.data?.data ?? []).map((p) => p.quarter).filter((q) => quarterEnd(q));
    quarters.sort((a, b) => (quarterEnd(a)?.getTime() ?? 0) - (quarterEnd(b)?.getTime() ?? 0));
    return quarters[quarters.length - 1] ?? null;
  }, [institutions.data]);

  const [historyVersion, setHistoryVersion] = useState(0);
  const readyToRecord =
    !!insiders.data && !!institutions.data && !!news.data && !!coreTechByTicker && cappedResults.length > 0;
  useEffect(() => {
    if (!readyToRecord) return;
    recordScores(cappedResults);
    setHistoryVersion((v) => v + 1);
  }, [readyToRecord, cappedResults]);
  const historyByTicker = useMemo(
    () => getAllHistoryInfo(cappedResults),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cappedResults, historyVersion],
  );

  const results = useMemo(() => {
    let list = marketFilter === 'ALL' ? cappedResults : cappedResults.filter((r) => r.market === marketFilter);
    if (confirmationFilter === 'CONFIRMED') {
      list = list.filter((r) => evaluateSignalAlignment(r, coreTechByTicker?.[r.ticker]).confirmed);
    }
    return list;
  }, [cappedResults, marketFilter, confirmationFilter, coreTechByTicker]);

  async function handleSearchSelect(result: SearchResult) {
    setSearchError(null);
    if (result.tracked) {
      // Tracked tickers always open through the normal drawer path — never the ad-hoc analyze
      // endpoint below. That endpoint treats its :symbol param as an already-Yahoo-native symbol
      // (correct for genuine search results, which come straight from Yahoo's own search), but a
      // tracked ticker's *internal* symbol (e.g. "INFX") usually isn't its real Yahoo symbol (the
      // real one is "IFX.DE") — that's the entire reason resolveTickerYahooSymbol/the override
      // map exist server-side. Sending "INFX" to Yahoo as if it were valid hung for 20s+ with no
      // data, verified directly. The normal drawer path already resolves this correctly via
      // /api/technicals/:ticker and /api/news/:ticker, so a tracked ticker with no active
      // conviction signal just gets a zero-score placeholder result and opens exactly like any
      // other tracked ticker — no ad-hoc fetch needed at all.
      const existing = cappedResults.find((r) => r.ticker === result.symbol);
      setSelected(
        existing ?? {
          ticker: result.symbol,
          name: result.name,
          sector: result.sector,
          market: result.market,
          currency: result.currency,
          totalScore: 0,
          signals: [],
          signalsActive: [],
        },
      );
      return;
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
        <button onClick={() => setUniverseOpen(true)} className="mt-2 text-2xs font-medium text-teal-300 hover:text-teal-200">
          View all {TICKERS.length} tracked stocks →
        </button>
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

      {/* Confirmed-only filter — smart money AND technicals bullish at once, a cleaner (if
          shorter) list of genuine, technically-backed opportunities */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {CONFIRMATION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setConfirmationFilter(f.value)}
            className={`pill shrink-0 ${confirmationFilter === f.value ? 'pill-active' : 'pill-idle'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Data sources — when each last loaded, and which failed. A failed source is excluded from
          every score above and shown here (and as a greyed ✗ on each card), never left as blank. */}
      <div className="flex flex-wrap gap-1.5">
        {insiders.error ? (
          <FailedBadge label="Insiders" />
        ) : (
          insiders.data && <FreshnessBadge label="Insiders" asOf={insiders.data.generatedAt} amberDays={1} redDays={3} suffix="ago" />
        )}
        {institutions.error ? (
          <FailedBadge label="13F" />
        ) : (
          institutions.data && (
            <>
              {latest13fQuarter && quarterEnd(latest13fQuarter) && (
                <FreshnessBadge
                  label={`13F data: ${latest13fQuarter}`}
                  asOf={quarterEnd(latest13fQuarter) as Date}
                  amberDays={THIRTEEN_F_AMBER_DAYS}
                  redDays={THIRTEEN_F_RED_DAYS}
                />
              )}
              {institutions.data.failedFunds.map((f) => (
                <FailedBadge key={f} label={f} />
              ))}
            </>
          )
        )}
        {news.error ? (
          <FailedBadge label="News" />
        ) : (
          news.data && <FreshnessBadge label="News" asOf={news.data.generatedAt} amberDays={1} redDays={3} suffix="ago" />
        )}
        {polymarket.error ? (
          <FailedBadge label="Prediction markets" />
        ) : (
          polymarket.data && (
            <FreshnessBadge label="Prediction markets" asOf={polymarket.data.generatedAt} amberDays={1} redDays={3} suffix="ago" />
          )
        )}
        {coreTechnicals.error ? (
          <FailedBadge label="Technicals" />
        ) : (
          coreTechnicals.data && (
            <FreshnessBadge label="Technicals" asOf={coreTechnicals.data.generatedAt} amberDays={1} redDays={3} suffix="ago" />
          )
        )}
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
                institutions={institutionsByTicker.get(r.ticker) ?? []}
                technicals={adhocAnalyses.get(r.ticker)?.technicals}
                hasConflict={evaluateSignalAlignment(r, coreTechByTicker?.[r.ticker]).hasConflict}
                stats={coreTechByTicker?.[r.ticker]}
                history={historyByTicker.get(r.ticker)}
                failed={failedSources}
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
              institutions={institutionsByTicker.get(r.ticker) ?? []}
              technicals={adhocAnalyses.get(r.ticker)?.technicals}
              hasConflict={evaluateSignalAlignment(r, coreTechByTicker?.[r.ticker]).hasConflict}
                stats={coreTechByTicker?.[r.ticker]}
                history={historyByTicker.get(r.ticker)}
                failed={failedSources}
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
                institutions={institutionsByTicker.get(pick.ticker) ?? []}
                technicals={adhocAnalyses.get(pick.ticker)?.technicals}
                hasConflict={evaluateSignalAlignment(pick, coreTechByTicker?.[pick.ticker]).hasConflict}
                stats={coreTechByTicker?.[pick.ticker]}
                history={historyByTicker.get(pick.ticker)}
                failed={failedSources}
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

      {universeOpen && (
        <TrackedUniverseModal
          onClose={() => setUniverseOpen(false)}
          onSelect={(t) => {
            setUniverseOpen(false);
            void handleSearchSelect({
              symbol: t.symbol,
              name: t.name,
              exchange: '',
              market: t.market,
              currency: t.currency,
              sector: t.sector,
              tracked: true,
            });
          }}
        />
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
        macro={macro.data?.data ?? []}
        scoreHistory={selected ? historyByTicker.get(selected.ticker) : undefined}
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

// Cards render an outer <div role="button"> rather than a native <button> so the watchlist star
// (a real <button> of its own, with its own click handler) can nest inside without producing
// invalid button-in-button markup.
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// "+12" green / "-8" red next to the score. Null until we hold an entry at least 7 days old —
// shown as nothing rather than guessed at.
function ScoreChange({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return null;
  const cls = value > 0 ? 'text-bull-400' : value < 0 ? 'text-bear-400' : 'text-ink-500';
  return (
    <span title={`${label} score change`} className={`font-mono text-2xs font-semibold ${cls}`}>
      {value > 0 ? '+' : ''}
      {value}
    </span>
  );
}

function FirstFlagged({ history }: { history: ScoreHistoryInfo | undefined }) {
  if (!history) return null;
  return (
    <span
      title={
        history.trackingStartedHere
          ? 'Score tracking began on this date in this browser — the stock may have been flagged earlier.'
          : 'First day this stock appeared in the tracked universe with any signal.'
      }
      className="text-2xs text-ink-600"
    >
      {history.trackingStartedHere ? 'Tracking since' : 'First flagged'} {formatDay(history.firstFlagged)}
    </span>
  );
}

// Price, distance from the 52-week high, RSI and a single SMA200-based trend label — on the card
// itself, so the analyst doesn't have to open every stock to see where it trades.
function CardStats({ technicals, currency }: { technicals: TechnicalIndicators | undefined; currency: string }) {
  if (!technicals) return null;
  const dist = distanceFrom52wHigh(technicals);
  const trend = trendLabel(technicals);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs text-ink-400">
      <span className="font-semibold text-ink-200">
        {currencySymbol(currency)}
        {technicals.price.toFixed(2)}
      </span>
      {dist != null && <span>{dist >= -0.05 ? 'at 52w high' : `${dist.toFixed(0)}% from 52w high`}</span>}
      {technicals.rsi14 != null && <span>RSI {technicals.rsi14.toFixed(0)}</span>}
      {trend && <span className={`font-sans font-semibold ${TREND_STYLE[trend]}`}>{trend}</span>}
    </div>
  );
}

function HighConvictionBadge() {
  return (
    <span
      title="Two or more independent signals agree and the score is 65+"
      className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-400/10 px-2 py-0.5 text-2xs font-semibold text-teal-300"
    >
      ⚡ High conviction
    </span>
  );
}

function SignalConflictBadge() {
  return (
    <span
      title="Smart money bullish but price action disagrees — wait for technical confirmation before acting."
      className="inline-flex items-center gap-1 rounded-full border border-warn-500/30 bg-warn-500/10 px-2 py-0.5 text-2xs font-medium text-warn-300"
    >
      ⚠️ Signal conflict
    </span>
  );
}

function ConvictionCard({
  result,
  rank,
  featured,
  headlines,
  institutions,
  technicals,
  hasConflict,
  stats,
  history,
  failed,
  onClick,
}: {
  result: ConvictionResult;
  rank: number;
  featured?: boolean;
  headlines: NewsHeadline[];
  institutions: InstitutionalPosition[];
  technicals?: TechnicalIndicators | null;
  hasConflict?: boolean;
  stats?: TechnicalIndicators;
  history?: ScoreHistoryInfo;
  failed: SignalType[];
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`card w-full cursor-pointer animate-fade-in-up p-4 text-left transition-all duration-200 hover:border-teal-500/40 active:scale-[0.99] ${
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
        <div className="flex flex-col items-end gap-1">
          <WatchlistStarButton
            target={{ symbol: result.ticker, name: result.name, market: result.market, currency: result.currency, sector: result.sector }}
            convictionScore={result.totalScore}
            institutions={institutions}
            news={headlines}
            technicals={technicals}
          />
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <ScoreChange value={history?.change7d} label="7-day" />
              <span className="font-mono text-2xl font-bold text-teal-300">{result.totalScore}</span>
            </div>
            <p className="text-2xs text-ink-500">conviction</p>
          </div>
        </div>
      </div>

      <CardStats technicals={stats} currency={result.currency} />

      <div className="mt-3 flex items-center justify-between">
        <SignalIcons signals={result.signalsActive} failed={failed} />
        <span className="rounded-full bg-ink-700/50 px-2 py-0.5 text-2xs font-medium text-ink-300">
          {result.sector}
        </span>
      </div>

      {/* Earnings badge + signal conflict warning */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {isHighConviction(result) && <HighConvictionBadge />}
        <EarningsBadge ticker={result.ticker} />
        {hasConflict && <SignalConflictBadge />}
        <FirstFlagged history={history} />
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
    </div>
  );
}

function SectorRow({
  sector,
  result,
  headlines,
  institutions,
  technicals,
  hasConflict,
  stats,
  history,
  failed,
  onClick,
}: {
  sector: Sector;
  result: ConvictionResult;
  headlines: NewsHeadline[];
  institutions: InstitutionalPosition[];
  technicals?: TechnicalIndicators | null;
  hasConflict?: boolean;
  stats?: TechnicalIndicators;
  history?: ScoreHistoryInfo;
  failed: SignalType[];
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="card flex w-full cursor-pointer items-center justify-between p-3 text-left transition-all duration-200 hover:border-ink-600 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs font-medium text-ink-400">{sector}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink-100">{result.ticker}</span>
            <MarketTag market={result.market} currency={result.currency} />
          </div>
          <p className="truncate text-2xs text-ink-500">{result.name}</p>
          <CardStats technicals={stats} currency={result.currency} />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isHighConviction(result) && <HighConvictionBadge />}
            <SentimentBadge headlines={headlines} />
            {hasConflict && <SignalConflictBadge />}
            <FirstFlagged history={history} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SignalIcons signals={result.signalsActive} failed={failed} />
        <ScoreChange value={history?.change7d} label="7-day" />
        <span className="font-mono text-sm font-bold text-teal-300">{result.totalScore}</span>
        <WatchlistStarButton
          target={{ symbol: result.ticker, name: result.name, market: result.market, currency: result.currency, sector: result.sector }}
          convictionScore={result.totalScore}
          institutions={institutions}
          news={headlines}
          technicals={technicals}
        />
        <ChevronRight className="h-4 w-4 text-ink-500" />
      </div>
    </div>
  );
}
