import { useMemo, useState } from 'react';
import { Activity, ChevronRight, Calendar, Globe2 } from 'lucide-react';
import type { ConvictionResult, Sector } from '@/types';
import { SECTORS } from '@/types';
import { computeConviction, getSectorTopPick } from '@/lib/conviction';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getEarningsDate, daysUntilEarnings } from '@/data/earnings';
import { SignalIcons, MarketTag, TrendArrow, LoadingCards, ErrorCard } from '@/components/ui';
import { TickerDetailDrawer } from '@/components/TickerDetailDrawer';

export function ConvictionTab() {
  const [selected, setSelected] = useState<ConvictionResult | null>(null);
  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');

  const loading = insiders.loading || institutions.loading || polymarket.loading;
  const error = insiders.error || institutions.error || polymarket.error;
  const ready = insiders.data && institutions.data && polymarket.data;

  const results = useMemo(() => {
    if (!ready) return [];
    return computeConviction({
      insiders: insiders.data!.data,
      institutions: institutions.data!.data,
      polymarket: polymarket.data!.data,
    });
  }, [ready, insiders.data, institutions.data, polymarket.data]);

  const top3 = results.slice(0, 3);
  const topTickers = new Set(top3.map((r) => r.ticker));
  const remaining = results.filter((r) => !topTickers.has(r.ticker));

  const europeanMovers = useMemo(
    () => results.filter((r) => r.market === 'EU').slice(0, 5),
    [results],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Conviction Scores</h2>
      </div>

      {loading && <LoadingCards />}
      {error && (
        <ErrorCard
          message={error}
          onRetry={() => {
            insiders.refetch();
            institutions.refetch();
            polymarket.refetch();
          }}
        />
      )}

      {/* European Movers — EU-tagged tickers only, ranked separately from the global list */}
      {ready && europeanMovers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-teal-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
              European Movers
            </p>
          </div>
          <div className="space-y-3">
            {europeanMovers.map((r, i) => (
              <ConvictionCard
                key={`eu-${r.ticker}`}
                result={r}
                rank={i + 1}
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
        <div className="space-y-3">
          {top3.map((r, i) => (
            <ConvictionCard
              key={r.ticker}
              result={r}
              rank={i + 1}
              featured
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
                onClick={() => setSelected(pick)}
              />
            );
          })}
        </div>
      </div>

      {ready && results.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No conviction signals detected yet.
        </div>
      )}

      <TickerDetailDrawer
        result={selected}
        onClose={() => setSelected(null)}
        insiders={insiders.data?.data ?? []}
        institutions={institutions.data?.data ?? []}
        polymarket={polymarket.data?.data ?? []}
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
  onClick,
}: {
  result: ConvictionResult;
  rank: number;
  featured?: boolean;
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
  onClick,
}: {
  sector: Sector;
  result: ConvictionResult;
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
