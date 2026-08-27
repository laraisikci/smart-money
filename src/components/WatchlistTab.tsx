import { useEffect, useMemo, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import type { AnalyzeResponse, InstitutionalPosition, NewsHeadline, TechnicalIndicators, WatchlistEntry } from '@/types';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { computeConviction } from '@/lib/conviction';
import { computeSectorPulse } from '@/lib/macroSectors';
import { registerAdHocTicker, isTrackedTicker } from '@/data/tickers';
import { getWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { buildWatchlistSnapshot } from '@/lib/watchlistSnapshot';
import {
  computeSignalHealth,
  computeExitScore,
  computeMacroWarnings,
  computeVerdict,
  EXIT_SCORE_OVERBOUGHT_THRESHOLD,
} from '@/lib/watchlistHealth';
import { MarketTag, LoadingCards, ErrorCard } from '@/components/ui';

export function WatchlistTab() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => getWatchlist());

  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');
  const news = useApi(api.news, 'news');
  const macro = useApi(api.macro, 'macro');

  const loading = insiders.loading || institutions.loading || polymarket.loading || news.loading || macro.loading;
  const error = insiders.error || institutions.error || polymarket.error || news.error || macro.error;

  const newsByTicker = useMemo(() => {
    const map = new Map<string, NewsHeadline[]>();
    for (const t of news.data?.data ?? []) map.set(t.ticker, t.headlines);
    return map;
  }, [news.data]);

  const institutionsByTicker = useMemo(() => {
    const map = new Map<string, InstitutionalPosition[]>();
    for (const p of institutions.data?.data ?? []) {
      const arr = map.get(p.ticker) ?? [];
      arr.push(p);
      map.set(p.ticker, arr);
    }
    return map;
  }, [institutions.data]);

  // Untracked watchlist tickers (saved via ad-hoc search) don't exist in any bulk endpoint —
  // /api/search/analyze/:symbol is the only source for their current insiders/institutions/news/
  // technicals, same as how ConvictionTab handles a one-off search result.
  const [adhocData, setAdhocData] = useState<Map<string, AnalyzeResponse>>(new Map());
  useEffect(() => {
    const untracked = watchlist.filter((w) => !isTrackedTicker(w.symbol) && !adhocData.has(w.symbol));
    untracked.forEach((w) => {
      api
        .analyze(w)
        .then((res) => {
          registerAdHocTicker({ symbol: res.ticker, name: res.name, sector: res.sector, market: res.market, currency: res.currency });
          setAdhocData((prev) => new Map(prev).set(res.ticker, res));
        })
        .catch(() => {
          // leave it out of adhocData — the card below just shows a "couldn't load live data" state
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // Tracked watchlist tickers get their technicals the normal on-demand way (/api/technicals/:ticker)
  // — never bulk-fetched for the whole universe, same as the detail drawer.
  const [trackedTechnicals, setTrackedTechnicals] = useState<Map<string, TechnicalIndicators | null>>(new Map());
  useEffect(() => {
    const tracked = watchlist.filter((w) => isTrackedTicker(w.symbol) && !trackedTechnicals.has(w.symbol));
    tracked.forEach((w) => {
      api
        .technicalsForTicker(w.symbol)
        .then((res) => setTrackedTechnicals((prev) => new Map(prev).set(w.symbol, res.data)))
        .catch(() => setTrackedTechnicals((prev) => new Map(prev).set(w.symbol, null)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  const adhocInsiders = useMemo(() => Array.from(adhocData.values()).flatMap((a) => a.insiders), [adhocData]);
  const adhocInstitutions = useMemo(() => Array.from(adhocData.values()).flatMap((a) => a.institutions), [adhocData]);
  const adhocNews = useMemo(() => Array.from(adhocData.values()).flatMap((a) => a.news), [adhocData]);

  const convictionByTicker = useMemo(() => {
    const results = computeConviction({
      insiders: [...(insiders.data?.data ?? []), ...adhocInsiders],
      institutions: [...(institutions.data?.data ?? []), ...adhocInstitutions],
      polymarket: polymarket.data?.data ?? [],
      news: [...Array.from(newsByTicker.values()).flat(), ...adhocNews],
    });
    return new Map(results.map((r) => [r.ticker, r.totalScore]));
  }, [insiders.data, institutions.data, polymarket.data, newsByTicker, adhocInsiders, adhocInstitutions, adhocNews]);

  const sectorPulses = useMemo(() => computeSectorPulse(macro.data?.data ?? []), [macro.data]);

  function currentTechnicalsFor(symbol: string): TechnicalIndicators | null | undefined {
    return isTrackedTicker(symbol) ? trackedTechnicals.get(symbol) : adhocData.get(symbol)?.technicals;
  }
  function currentInstitutionsFor(symbol: string): InstitutionalPosition[] {
    return isTrackedTicker(symbol) ? (institutionsByTicker.get(symbol) ?? []) : (adhocData.get(symbol)?.institutions ?? []);
  }
  function currentNewsFor(symbol: string): NewsHeadline[] {
    return isTrackedTicker(symbol) ? (newsByTicker.get(symbol) ?? []) : (adhocData.get(symbol)?.news ?? []);
  }

  function handleRemove(symbol: string) {
    setWatchlist(removeFromWatchlist(symbol));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Watchlist</h2>
      </div>

      {loading && watchlist.length > 0 && <LoadingCards count={Math.min(watchlist.length, 3)} />}
      {error && (
        <ErrorCard
          message={error}
          onRetry={() => {
            insiders.refetch();
            institutions.refetch();
            polymarket.refetch();
            news.refetch();
            macro.refetch();
          }}
        />
      )}

      {watchlist.length === 0 && (
        <div className="py-16 text-center">
          <Star className="mx-auto h-8 w-8 text-ink-700" />
          <p className="mt-3 text-sm text-ink-400">No stocks saved yet. Star any stock to add it here.</p>
        </div>
      )}

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {watchlist.map((entry) => {
          const technicals = currentTechnicalsFor(entry.symbol);
          const dataLoading = technicals === undefined;
          const conviction = convictionByTicker.get(entry.symbol) ?? 0;
          const entryInstitutions = currentInstitutionsFor(entry.symbol);
          const entryNews = currentNewsFor(entry.symbol);
          const currentSnapshot = buildWatchlistSnapshot({
            convictionScore: conviction,
            technicals: technicals ?? null,
            institutions: entryInstitutions,
            news: entryNews,
          });
          const health = computeSignalHealth(entry.snapshot, currentSnapshot);
          const exitScore = technicals
            ? computeExitScore({
                rsi: technicals.rsi14,
                stochK: technicals.stochK,
                price: technicals.price,
                sma200: technicals.sma200,
                analystTarget: technicals.analyst?.targetMeanPrice ?? null,
              })
            : 0;
          const overbought = exitScore > EXIT_SCORE_OVERBOUGHT_THRESHOLD;
          const macroWarnings = computeMacroWarnings(entry.sector, entry.market, macro.data?.data ?? [], sectorPulses);
          const verdict = computeVerdict(health.level, overbought, macroWarnings.length);

          return (
            <WatchlistCard
              key={entry.symbol}
              entry={entry}
              loading={dataLoading}
              conviction={conviction}
              technicals={technicals ?? null}
              health={health}
              exitScore={exitScore}
              overbought={overbought}
              macroWarnings={macroWarnings}
              verdict={verdict}
              onRemove={() => handleRemove(entry.symbol)}
            />
          );
        })}
      </div>
    </div>
  );
}

function healthColorClass(level: 'Intact' | 'Weakening' | 'ConsiderExit'): string {
  if (level === 'Intact') return 'text-bull-400 bg-bull-500/10 border-bull-500/25';
  if (level === 'Weakening') return 'text-warn-400 bg-warn-500/10 border-warn-500/25';
  return 'text-bear-400 bg-bear-500/10 border-bear-500/25';
}

function verdictColorClass(emoji: string): string {
  if (emoji === '🟢') return 'text-bull-300';
  if (emoji === '🔴') return 'text-bear-300';
  return 'text-warn-300';
}

function WatchlistCard({
  entry,
  loading,
  conviction,
  technicals,
  health,
  exitScore,
  overbought,
  macroWarnings,
  verdict,
  onRemove,
}: {
  entry: WatchlistEntry;
  loading: boolean;
  conviction: number;
  technicals: TechnicalIndicators | null;
  health: ReturnType<typeof computeSignalHealth>;
  exitScore: number;
  overbought: boolean;
  macroWarnings: string[];
  verdict: ReturnType<typeof computeVerdict>;
  onRemove: () => void;
}) {
  const vsSma200 = technicals?.sma200 != null ? (technicals.price >= technicals.sma200 ? 'Above' : 'Below') : null;

  return (
    <div className="card animate-fade-in-up p-4">
      {/* Ticker + name + remove */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-ink-50">{entry.symbol}</span>
          <MarketTag market={entry.market} currency={entry.currency} />
        </div>
        <button
          onClick={onRemove}
          aria-label={`Remove ${entry.symbol} from watchlist`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-bear-500/10 hover:text-bear-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-400">{entry.name}</p>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="card shimmer h-4 w-3/4" />
          <div className="card shimmer h-4 w-1/2" />
          <div className="card shimmer h-8 w-full" />
        </div>
      ) : (
        <>
          {/* Combined verdict */}
          <p className={`mt-3 text-sm font-semibold ${verdictColorClass(verdict.emoji)}`}>
            {verdict.emoji} {verdict.text}
          </p>
          <p className="mt-0.5 text-2xs text-ink-600">Not financial advice.</p>

          {/* Signal Health */}
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold ${healthColorClass(health.level)}`}>
            {health.emoji} {health.label}
          </div>
          <p className="mt-1 text-2xs text-ink-500">{health.reason}</p>

          {/* Exit Score gauge */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-2xs text-ink-500">
              <span>Overbought Exit Score</span>
              <span className="font-mono text-ink-300">{exitScore}/100</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-bear-500 transition-all"
                style={{ width: `${exitScore}%` }}
              />
            </div>
            {overbought && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-bear-500/30 bg-bear-500/10 px-2 py-0.5 text-2xs font-medium text-bear-300">
                ⚠️ Overbought
              </span>
            )}
          </div>

          {/* Macro headwind pills */}
          {macroWarnings.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {macroWarnings.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 rounded-full border border-warn-500/30 bg-warn-500/10 px-2 py-0.5 text-2xs font-medium text-warn-300"
                >
                  ⚠️ {w}
                </span>
              ))}
            </div>
          )}

          {/* Current conviction + key technicals */}
          <div className="mt-3 flex items-center gap-4 border-t border-ink-700/40 pt-3 font-mono text-2xs text-ink-400">
            <span>
              Conviction <span className="text-ink-100">{conviction}</span>
            </span>
            {technicals?.rsi14 != null && (
              <span>
                RSI <span className="text-ink-100">{technicals.rsi14.toFixed(0)}</span>
              </span>
            )}
            {vsSma200 && (
              <span>
                vs SMA200 <span className="text-ink-100">{vsSma200}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
