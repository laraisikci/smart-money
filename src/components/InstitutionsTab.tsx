import { useMemo, useState } from 'react';
import { Building2, TrendingUp, ArrowUpRight } from 'lucide-react';
import { FUNDS, FUND_MAP } from '@/data/funds';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { InstitutionalPosition } from '@/types';
import { formatCurrency, formatShares, formatPct, timeAgo } from '@/lib/format';
import { ActionBadge, FundAvatar, MarketTag, LoadingCards, ErrorCard } from '@/components/ui';
import { getTickerMeta } from '@/data/tickers';

type FilterMode = 'all' | 'bullish';

export function InstitutionsTab() {
  const [activeFund, setActiveFund] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<FilterMode>('bullish');
  const { data, loading, error, refetch } = useApi(api.institutions, 'institutions');
  const positions = useMemo(() => data?.data ?? [], [data]);

  const filtered = useMemo(() => {
    let list = [...positions];
    if (activeFund !== 'ALL') {
      list = list.filter((p) => p.fundSlug === activeFund);
    }
    if (filterMode === 'bullish') {
      list = list.filter((p) => p.action === 'new' || p.action === 'increased');
    }
    return list.sort(
      (a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime(),
    );
  }, [positions, activeFund, filterMode]);

  // Most bought this quarter — tickers appearing most frequently as new/increased
  const mostBought = useMemo(() => {
    const bullish = positions.filter(
      (p) => p.action === 'new' || p.action === 'increased',
    );
    const counts = new Map<string, { count: number; funds: Set<string> }>();
    for (const p of bullish) {
      const entry = counts.get(p.ticker) ?? { count: 0, funds: new Set() };
      entry.count++;
      entry.funds.add(p.fundName);
      counts.set(p.ticker, entry);
    }
    return Array.from(counts.entries())
      .map(([ticker, { count, funds }]) => ({
        ticker,
        count,
        fundCount: funds.size,
        meta: getTickerMeta(ticker),
      }))
      .sort((a, b) => b.fundCount - a.fundCount || b.count - a.count)
      .slice(0, 5);
  }, [positions]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Institutions</h2>
      </div>

      <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2">
        <p className="text-2xs text-teal-300/80">
          Live SEC EDGAR 13F data · holdings limited to companies in our tracked ticker list
          {data && data.failedFunds.length > 0 && ` · couldn't load: ${data.failedFunds.join(', ')}`}
        </p>
      </div>

      {loading && <LoadingCards />}
      {error && <ErrorCard message={error} onRetry={refetch} />}

      {data && (
        <>
      {/* Most bought this quarter */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-xs font-medium text-ink-300">Most bought this quarter</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {mostBought.map((item, i) => (
            <div
              key={item.ticker}
              className="card shrink-0 w-32 animate-fade-in-up p-3 text-center"
            >
              <div className="mb-1 flex items-center justify-center gap-1">
                <span className="text-2xs font-bold text-ink-500">#{i + 1}</span>
              </div>
              <p className="font-mono text-sm font-bold text-ink-50">{item.ticker}</p>
              <p className="truncate text-2xs text-ink-500">{item.meta.name}</p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <span className="signal-dot bg-teal-400/15 text-teal-300">
                  {item.fundCount}
                </span>
                <span className="text-2xs text-ink-400">funds</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fund pills */}
      <div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setActiveFund('ALL')}
            className={`pill shrink-0 ${activeFund === 'ALL' ? 'pill-active' : 'pill-idle'}`}
          >
            All Funds
          </button>
          {FUNDS.map((fund) => (
            <button
              key={fund.slug}
              onClick={() => setActiveFund(fund.slug)}
              className={`pill shrink-0 ${activeFund === fund.slug ? 'pill-active' : 'pill-idle'}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: fund.color }}
              />
              {fund.name}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle: All moves / Buys only */}
      <div className="inline-flex rounded-lg border border-ink-700 bg-ink-800/50 p-0.5">
        <button
          onClick={() => setFilterMode('bullish')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            filterMode === 'bullish'
              ? 'bg-teal-400/15 text-teal-200'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          Buys & increases only
        </button>
        <button
          onClick={() => setFilterMode('all')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            filterMode === 'all'
              ? 'bg-teal-400/15 text-teal-200'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          All moves
        </button>
      </div>

      {/* Position cards */}
      <div className="space-y-3">
        {filtered.map((pos) => (
          <PositionCard key={pos.id} pos={pos} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No positions match the current filter.
        </div>
      )}
        </>
      )}
    </div>
  );
}

function PositionCard({ pos }: { pos: InstitutionalPosition }) {
  const fund = FUND_MAP[pos.fundSlug];
  const meta = getTickerMeta(pos.ticker);
  const isBullish = pos.action === 'new' || pos.action === 'increased';

  return (
    <div className="card animate-fade-in-up p-4 transition-all duration-200 hover:border-ink-600">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FundAvatar slug={pos.fundSlug} color={fund?.color ?? '#4a5668'} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink-50">{pos.ticker}</span>
              <MarketTag market={meta.market} currency={meta.currency} />
              <ActionBadge action={pos.action} />
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-300">{pos.companyName}</p>
            <p className="text-2xs text-ink-500">{pos.fundName}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-ink-50">
            {formatCurrency(pos.marketValue)}
          </div>
          <p className="text-2xs text-ink-500">{timeAgo(pos.filingDate)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink-700/40 pt-3">
        <div className="flex gap-4">
          <div>
            <p className="text-2xs text-ink-500">Shares</p>
            <p className="font-mono text-xs text-ink-200">{formatShares(pos.shares)}</p>
          </div>
          <div>
            <p className="text-2xs text-ink-500">Qtr Change</p>
            <p
              className={`font-mono text-xs font-semibold ${
                isBullish ? 'text-bull-400' : 'text-bear-400'
              }`}
            >
              {formatPct(pos.pctChange)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isBullish ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-bull-400" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 rotate-90 text-bear-400" />
          )}
          <span className="text-2xs text-ink-500">{pos.quarter}</span>
        </div>
      </div>
    </div>
  );
}
