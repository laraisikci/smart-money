import { useMemo, useState } from 'react';
import { HeartPulse, LayoutGrid, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ConvictionResult, NewsHeadline, MacroIndicator, Sector } from '@/types';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { computeConviction } from '@/lib/conviction';
import { computeSectorPulse, type SectorPulse, type SectorPulseSignal } from '@/lib/macroSectors';
import { MarketTag, SentimentBadge, LoadingCards, ErrorCard } from '@/components/ui';
import { TickerDetailDrawer } from '@/components/TickerDetailDrawer';

function formatIndicatorValue(indicator: MacroIndicator): string {
  switch (indicator.id) {
    case 'ecbRate':
    case 'inflation':
      return `${indicator.value.toFixed(2)}%`;
    case 'eurUsd':
      return indicator.value.toFixed(4);
    case 'brent':
      return `$${indicator.value.toFixed(2)}`;
    case 'vix':
      return indicator.value.toFixed(2);
    case 'stoxx50':
      return indicator.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

function formatChangeLabel(indicator: MacroIndicator): string {
  if (indicator.changePercent !== null) {
    const sign = indicator.changePercent > 0 ? '+' : '';
    return `${sign}${indicator.changePercent.toFixed(2)}%`;
  }
  const sign = indicator.change > 0 ? '+' : '';
  return `${sign}${indicator.change.toFixed(2)}pp`;
}

// The inflation series only carries a "YYYY-MM" period (no day), so it gets its own display
// path rather than going through Date parsing meant for full dates — otherwise it'd render a
// fabricated "1st of the month" that isn't in the source data.
function formatAsOf(indicator: MacroIndicator): string {
  if (indicator.id === 'inflation') {
    const [y, m] = indicator.asOf.split('-').map(Number);
    return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
  return new Date(indicator.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MacroCard({ indicator }: { indicator: MacroIndicator }) {
  const good = indicator.goodForMarkets;
  const changeColor = good === null ? 'text-ink-400' : good ? 'text-bull-400' : 'text-bear-400';
  const ChangeIcon = indicator.change > 0 ? TrendingUp : indicator.change < 0 ? TrendingDown : Minus;

  return (
    <div className="card animate-fade-in-up p-3.5">
      <p className="text-2xs font-medium uppercase tracking-wider text-ink-400">{indicator.label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-xl font-bold text-ink-50">{formatIndicatorValue(indicator)}</span>
        <span className={`flex shrink-0 items-center gap-0.5 font-mono text-2xs font-semibold ${changeColor}`}>
          <ChangeIcon className="h-3 w-3" />
          {formatChangeLabel(indicator)}
        </span>
      </div>
      <p className="mt-2 text-2xs leading-snug text-ink-400">{indicator.interpretation}</p>
      <p className="mt-1.5 text-2xs text-ink-600">as of {formatAsOf(indicator)}</p>
    </div>
  );
}

function GridSkeleton({
  count,
  height,
  desktopCols = 3,
}: {
  count: number;
  height: string;
  desktopCols?: 3 | 4;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${desktopCols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`card shimmer w-full ${height}`} />
      ))}
    </div>
  );
}

const SIGNAL_STYLES: Record<SectorPulseSignal, { border: string; bg: string; text: string }> = {
  Tailwind: { border: 'border-bull-500/30', bg: 'bg-bull-500/10', text: 'text-bull-400' },
  Headwind: { border: 'border-bear-500/30', bg: 'bg-bear-500/10', text: 'text-bear-400' },
  Neutral: { border: 'border-warn-500/20', bg: 'bg-warn-500/5', text: 'text-warn-400' },
};

function SectorTile({ pulse }: { pulse: SectorPulse }) {
  const s = SIGNAL_STYLES[pulse.signal];
  return (
    <div className={`animate-fade-in-up rounded-2xl border p-3.5 ${s.border} ${s.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-100">{pulse.label}</span>
        <span className={`text-2xs font-bold uppercase tracking-wider ${s.text}`}>{pulse.signal}</span>
      </div>
      <p className="mt-1.5 text-2xs leading-snug text-ink-400">{pulse.reason}</p>
    </div>
  );
}

function PickCard({
  result,
  sectorLabel,
  headlines,
  onClick,
}: {
  result: ConvictionResult;
  sectorLabel: string;
  headlines: NewsHeadline[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card w-full animate-fade-in-up p-3.5 text-left transition-all duration-200 hover:border-teal-500/40 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink-50">{result.ticker}</span>
            <MarketTag market={result.market} currency={result.currency} />
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-400">{result.name}</p>
          <span className="mt-1 inline-flex items-center rounded-full bg-bull-500/15 px-1.5 py-0.5 text-2xs font-medium text-bull-400">
            {sectorLabel} tailwind
          </span>
          <div className="mt-1">
            <SentimentBadge headlines={headlines} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xl font-bold text-teal-300">{result.totalScore}</div>
          <p className="text-2xs text-ink-500">conviction</p>
        </div>
      </div>
    </button>
  );
}

export function PulseTab() {
  const [selected, setSelected] = useState<ConvictionResult | null>(null);
  const macro = useApi(api.macro, 'macro');
  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');
  const news = useApi(api.news, 'news');

  const newsByTicker = useMemo(() => {
    const map = new Map<string, NewsHeadline[]>();
    for (const t of news.data?.data ?? []) map.set(t.ticker, t.headlines);
    return map;
  }, [news.data]);
  const allHeadlines = useMemo(() => Array.from(newsByTicker.values()).flat(), [newsByTicker]);

  const convictionLoading = insiders.loading || institutions.loading || polymarket.loading || news.loading;
  const convictionError = insiders.error || institutions.error || polymarket.error || news.error;

  // Not gated on every source having landed — see the same change in ConvictionTab.tsx. Picks
  // computed from whatever's in so far, so this section can show up before the slowest source
  // (often Polymarket) finishes.
  const allResults = useMemo(() => {
    return computeConviction({
      insiders: insiders.data?.data ?? [],
      institutions: institutions.data?.data ?? [],
      polymarket: polymarket.data?.data ?? [],
      news: allHeadlines,
    });
  }, [insiders.data, institutions.data, polymarket.data, allHeadlines]);

  const sectorPulses = useMemo(
    () => (macro.data ? computeSectorPulse(macro.data.data) : []),
    [macro.data],
  );
  const tailwindSectors = useMemo(
    () => new Set(sectorPulses.filter((p) => p.signal === 'Tailwind').map((p) => p.sector)),
    [sectorPulses],
  );
  const sectorLabelOf = useMemo(() => {
    const map = new Map<Sector, string>(sectorPulses.map((p) => [p.sector, p.label]));
    return (sector: Sector) => map.get(sector) ?? sector;
  }, [sectorPulses]);

  const alignedPicks = useMemo(
    () => (macro.data ? allResults.filter((r) => tailwindSectors.has(r.sector)).slice(0, 5) : []),
    [macro.data, allResults, tailwindSectors],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Market Pulse</h2>
      </div>

      {/* Section 1: Macro Indicators */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          Macro Indicators
        </p>
        {macro.loading && <GridSkeleton count={6} height="h-28" desktopCols={3} />}
        {macro.error && <ErrorCard message={macro.error} onRetry={macro.refetch} />}
        {macro.data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {macro.data.data.map((ind) => (
                <MacroCard key={ind.id} indicator={ind} />
              ))}
            </div>
            {macro.data.unavailable.length > 0 && (
              <p className="mt-2 text-2xs text-ink-600">
                Unavailable right now: {macro.data.unavailable.join(', ')}
              </p>
            )}
          </>
        )}
      </div>

      {/* Section 2: Sector Rotation Signal */}
      <div>
        <div className="mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-teal-400" />
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Sector Rotation Signal
          </p>
        </div>
        {macro.loading && <GridSkeleton count={8} height="h-20" desktopCols={4} />}
        {macro.data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {sectorPulses.map((p) => (
              <SectorTile key={p.sector} pulse={p} />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Macro-Aligned Picks */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-400" />
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Macro-Aligned Picks
          </p>
        </div>
        <p className="mb-3 text-2xs text-ink-600">
          Tracked stocks in sectors currently reading as a macro tailwind, ranked by conviction
          score. Not financial advice.
        </p>
        {(convictionLoading || macro.loading) && alignedPicks.length === 0 && <LoadingCards count={3} />}
        {convictionError && (
          <ErrorCard
            message={convictionError}
            onRetry={() => {
              insiders.refetch();
              institutions.refetch();
              polymarket.refetch();
              news.refetch();
            }}
          />
        )}
        {macro.data && (
          <div className="space-y-3">
            {alignedPicks.map((r) => (
              <PickCard
                key={r.ticker}
                result={r}
                sectorLabel={sectorLabelOf(r.sector)}
                headlines={newsByTicker.get(r.ticker) ?? []}
                onClick={() => setSelected(r)}
              />
            ))}
            {alignedPicks.length === 0 && !convictionLoading && (
              <div className="py-8 text-center text-sm text-ink-400">
                No tracked stocks align with a current sector tailwind.
              </div>
            )}
          </div>
        )}
      </div>

      <TickerDetailDrawer
        result={selected}
        onClose={() => setSelected(null)}
        insiders={insiders.data?.data ?? []}
        institutions={institutions.data?.data ?? []}
        polymarket={polymarket.data?.data ?? []}
        news={selected ? (newsByTicker.get(selected.ticker) ?? []) : []}
      />
    </div>
  );
}
