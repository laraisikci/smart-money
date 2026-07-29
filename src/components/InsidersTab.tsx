import { useMemo, useState } from 'react';
import { Filter, UserCircle2 } from 'lucide-react';
import { INSIDER_TRADES } from '@/data/insiders';
import { getTickerMeta } from '@/data/tickers';
import { formatCurrency, formatShares, timeAgo } from '@/lib/format';
import { ActionBadge, MarketTag } from '@/components/ui';

const THRESHOLDS = [
  { label: 'Any', value: 0 },
  { label: '$100k+', value: 100_000 },
  { label: '$500k+', value: 500_000 },
  { label: '$1M+', value: 1_000_000 },
];

export function InsidersTab() {
  const [threshold, setThreshold] = useState(100_000);

  const filtered = useMemo(() => {
    return INSIDER_TRADES.filter((t) => t.value >= threshold).sort(
      (a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime(),
    );
  }, [threshold]);

  const activeThreshold = THRESHOLDS.find((t) => t.value === threshold);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <UserCircle2 className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Insider Trades</h2>
      </div>

      {/* Dollar value filter */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-400" />
          <span className="text-xs font-medium text-ink-400">Min buy size</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {THRESHOLDS.map((t) => (
            <button
              key={t.value}
              onClick={() => setThreshold(t.value)}
              className={`pill shrink-0 ${
                threshold === t.value ? 'pill-active' : 'pill-idle'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-500">
        Showing {filtered.length} trade{filtered.length !== 1 ? 's' : ''}{' '}
        {activeThreshold && activeThreshold.value > 0 && `above ${activeThreshold.label}`}
      </p>

      {/* Trade cards */}
      <div className="space-y-3">
        {filtered.map((trade) => {
          const meta = getTickerMeta(trade.ticker);
          return (
            <div
              key={trade.id}
              className="card animate-fade-in-up p-4 transition-all duration-200 hover:border-ink-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-800">
                    <span className="text-xs font-bold text-ink-300">
                      {trade.insiderName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink-50">{trade.ticker}</span>
                      <MarketTag market={trade.market} />
                      <ActionBadge action={trade.transactionType} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-300">{trade.insiderName}</p>
                    <p className="text-2xs text-ink-500">{trade.insiderTitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-ink-50">
                    {formatCurrency(trade.value)}
                  </div>
                  <p className="text-2xs text-ink-500">{timeAgo(trade.filingDate)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-700/40 pt-3">
                <div className="flex gap-4">
                  <div>
                    <p className="text-2xs text-ink-500">Shares</p>
                    <p className="font-mono text-xs text-ink-200">{formatShares(trade.shares)}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-ink-500">Price</p>
                    <p className="font-mono text-xs text-ink-200">${trade.price.toFixed(2)}</p>
                  </div>
                </div>
                <span className="text-2xs text-ink-500">{meta.sector}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No trades match the current filter.
        </div>
      )}
    </div>
  );
}
