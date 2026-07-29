import { useMemo, useState } from 'react';
import { Landmark, Globe2 } from 'lucide-react';
import { POLITICIAN_TRADES } from '@/data/politicians';
import { ActionBadge, MarketTag } from '@/components/ui';
import { timeAgo, formatDate } from '@/lib/format';
import { getTickerMeta } from '@/data/tickers';

type Region = 'ALL' | 'EU' | 'US';

export function ParliamentTab() {
  const [region, setRegion] = useState<Region>('EU');

  const filtered = useMemo(() => {
    let list = [...POLITICIAN_TRADES];
    if (region !== 'ALL') {
      list = list.filter((t) => t.country === region);
    }
    return list.sort(
      (a, b) => new Date(b.disclosureDate).getTime() - new Date(a.disclosureDate).getTime(),
    );
  }, [region]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Politician Trades</h2>
      </div>

      {/* Region filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(['EU', 'US', 'ALL'] as Region[]).map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={`pill shrink-0 ${region === r ? 'pill-active' : 'pill-idle'}`}
          >
            {r === 'EU' && <Globe2 className="h-3 w-3" />}
            {r === 'EU' ? 'European Parliament' : r === 'US' ? 'US Congress' : 'All'}
          </button>
        ))}
      </div>

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
                      {trade.politicianName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink-50">{trade.ticker}</span>
                      <MarketTag market={trade.country} />
                      <ActionBadge action={trade.transactionType} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-200">{trade.politicianName}</p>
                    <p className="text-2xs text-ink-500">{trade.body}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-ink-100">
                    {trade.amountRange}
                  </div>
                  <p className="text-2xs text-ink-500">filed {formatDate(trade.disclosureDate)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-700/40 pt-3">
                <span className="text-2xs text-ink-500">
                  Traded {formatDate(trade.tradeDate)}
                </span>
                <span className="text-2xs text-ink-500">{meta.sector}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No politician trades for this region.
        </div>
      )}
    </div>
  );
}
