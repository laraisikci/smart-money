import { useMemo, useState } from 'react';
import { BarChart3, Flame } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { formatCurrency, timeAgo } from '@/lib/format';
import { MarketTag, LoadingCards, ErrorCard } from '@/components/ui';
import { getTickerMeta } from '@/data/tickers';

export function PolymarketTab() {
  const [minVolume, setMinVolume] = useState(0);
  const { data, loading, error, refetch } = useApi(api.markets, 'markets');

  const filtered = useMemo(() => {
    const markets = data?.data ?? [];
    return markets.filter((m) => m.volume >= minVolume).sort((a, b) => b.volume - a.volume);
  }, [data, minVolume]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Prediction Markets</h2>
      </div>

      {/* Volume filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { label: 'All', value: 0 },
          { label: '$1M+', value: 1_000_000 },
          { label: '$2M+', value: 2_000_000 },
        ].map((v) => (
          <button
            key={v.value}
            onClick={() => setMinVolume(v.value)}
            className={`pill shrink-0 ${minVolume === v.value ? 'pill-active' : 'pill-idle'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading && <LoadingCards />}
      {error && <ErrorCard message={error} onRetry={refetch} />}

      {/* Market cards */}
      <div className="space-y-3">
        {filtered.map((market) => {
          const isBullish = market.yesPrice >= 0.55;
          const isBearish = market.yesPrice <= 0.35;
          return (
            <div
              key={market.id}
              className="card animate-fade-in-up p-4 transition-all duration-200 hover:border-ink-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug text-ink-100">
                    {market.question}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-ink-700/50 px-2 py-0.5 text-2xs font-medium text-ink-300">
                      {market.category}
                    </span>
                    {isBullish && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bull-500/15 px-2 py-0.5 text-2xs font-semibold text-bull-400">
                        <Flame className="h-2.5 w-2.5" /> Bullish
                      </span>
                    )}
                    {isBearish && (
                      <span className="rounded-full bg-bear-500/15 px-2 py-0.5 text-2xs font-semibold text-bear-400">
                        Bearish
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono text-2xl font-bold ${
                      isBullish ? 'text-bull-400' : isBearish ? 'text-bear-400' : 'text-ink-200'
                    }`}
                  >
                    {(market.yesPrice * 100).toFixed(0)}%
                  </div>
                  <p className="text-2xs text-ink-500">YES</p>
                </div>
              </div>

              {/* Related tickers */}
              {market.relatedTickers.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-700/40 pt-3">
                  {market.relatedTickers.map((ticker) => {
                    const meta = getTickerMeta(ticker);
                    return (
                      <span
                        key={ticker}
                        className="inline-flex items-center gap-1 rounded-md bg-ink-800/60 px-2 py-0.5"
                      >
                        <span className="font-mono text-2xs font-bold text-ink-200">{ticker}</span>
                        <MarketTag market={meta.market} currency={meta.currency} />
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xs text-ink-500">
                  Vol {formatCurrency(market.volume)} · Ends {timeAgo(market.endDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {data && filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-400">
          No markets match the current filter.
        </div>
      )}
    </div>
  );
}
