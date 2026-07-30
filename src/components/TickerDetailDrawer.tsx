import { useEffect } from 'react';
import { X, Calendar, Percent, TrendingDown } from 'lucide-react';
import type { ConvictionResult, InsiderTrade, InstitutionalPosition, PolymarketMarket } from '@/types';
import { getEarningsDate, daysUntilEarnings } from '@/data/earnings';
import { getShortInterest, shortInterestLevel } from '@/data/shortInterest';
import { getTickerMeta } from '@/data/tickers';
import { SignalIcons, ActionBadge, MarketTag, FundAvatar } from '@/components/ui';
import { FUND_MAP } from '@/data/funds';
import { formatCurrency, formatShares, formatDate, timeAgo } from '@/lib/format';

interface TickerDetailDrawerProps {
  result: ConvictionResult | null;
  onClose: () => void;
  insiders: InsiderTrade[];
  institutions: InstitutionalPosition[];
  polymarket: PolymarketMarket[];
}

export function TickerDetailDrawer({
  result,
  onClose,
  insiders: allInsiders,
  institutions: allInstitutions,
  polymarket: allPolymarket,
}: TickerDetailDrawerProps) {
  useEffect(() => {
    if (result) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [result]);

  if (!result) return null;

  const meta = getTickerMeta(result.ticker);
  const earnings = getEarningsDate(result.ticker);
  const daysToEarn = earnings ? daysUntilEarnings(earnings.nextEarnings) : null;
  const shortInt = getShortInterest(result.ticker);
  const siLevel = shortInt ? shortInterestLevel(shortInt.shortInterestPct) : null;

  const insiders = allInsiders.filter((t) => t.ticker === result.ticker);
  const institutions = allInstitutions.filter((p) => p.ticker === result.ticker);
  const polymarkets = allPolymarket.filter((m) => m.relatedTickers.includes(result.ticker));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-1/2 z-50 max-h-[85vh] w-full max-w-md translate-x-[-50%] overflow-y-auto rounded-t-3xl border-t border-ink-700 bg-ink-900 pb-[env(safe-area-inset-bottom)]">
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-ink-900/95 px-5 py-3 backdrop-blur-md">
          <div className="mx-auto h-1 w-10 rounded-full bg-ink-600 absolute left-1/2 top-2 translate-x-[-50%]" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-ink-50">{result.ticker}</span>
            <MarketTag market={meta.market} />
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-ink-400 transition-colors hover:text-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 pb-6">
          {/* Header */}
          <div>
            <h3 className="text-base font-semibold text-ink-50">{result.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-ink-700/50 px-2 py-0.5 text-2xs font-medium text-ink-300">
                {result.sector}
              </span>
              <SignalIcons signals={result.signalsActive} size="md" />
            </div>
          </div>

          {/* Conviction score */}
          <div className="card flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-ink-400">Conviction Score</p>
              <p className="mt-0.5 text-2xs text-ink-500">Weighted across {result.signalsActive.length} signal{result.signalsActive.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="font-mono text-3xl font-bold text-teal-300">{result.totalScore}</div>
          </div>

          {/* Earnings date */}
          {earnings && daysToEarn !== null && daysToEarn > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-warn-500/20 bg-warn-500/5 px-4 py-3">
              <Calendar className="h-4.5 w-4.5 text-warn-400" />
              <div>
                <p className="text-xs font-semibold text-warn-300">
                  Earnings in {daysToEarn} day{daysToEarn !== 1 ? 's' : ''}
                </p>
                <p className="text-2xs text-ink-500">{formatDate(earnings.nextEarnings)}</p>
              </div>
            </div>
          )}

          {/* Short interest */}
          {shortInt && siLevel && (
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-ink-400" />
                <h4 className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Short Interest
                </h4>
                <span className="ml-auto text-2xs text-ink-600">sample data</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-bold text-ink-50">
                      {shortInt.shortInterestPct.toFixed(1)}%
                    </span>
                    <span className="text-2xs text-ink-500">of float</span>
                  </div>
                  <p className="mt-0.5 text-2xs text-ink-500">
                    {formatShares(shortInt.float)} float · {shortInt.daysToCover.toFixed(1)} days to cover
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${siLevel.bg} ${siLevel.color}`}
                >
                  <Percent className="h-3 w-3" />
                  {siLevel.label}
                </span>
              </div>
            </div>
          )}

          {/* Signal breakdown */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400">
              Signal Breakdown
            </h4>
            <div className="space-y-2">
              {result.signals.map((sig) => (
                <div key={sig.type} className="card flex items-center justify-between p-3">
                  <div>
                    <p className="text-xs font-medium text-ink-200 capitalize">{sig.type}</p>
                    <p className="text-2xs text-ink-500">{sig.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-teal-300">{sig.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent insider trades */}
          {insiders.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400">
                Insider Trades
              </h4>
              <div className="space-y-2">
                {insiders.map((t) => (
                  <div key={t.id} className="card p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-ink-200">{t.insiderName}</p>
                        <p className="text-2xs text-ink-500">{t.insiderTitle}</p>
                      </div>
                      <ActionBadge action={t.transactionType} />
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-ink-700/40 pt-2">
                      <span className="font-mono text-2xs text-ink-400">
                        {formatShares(t.shares)} @ ${t.price.toFixed(2)}
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink-100">
                        {formatCurrency(t.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Institutional positions */}
          {institutions.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400">
                Institutional Positions
              </h4>
              <div className="space-y-2">
                {institutions.map((p) => {
                  const fund = FUND_MAP[p.fundSlug];
                  return (
                    <div key={p.id} className="card p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FundAvatar slug={p.fundSlug} color={fund?.color ?? '#4a5668'} size="sm" />
                          <div>
                            <p className="text-xs font-medium text-ink-200">{p.fundName}</p>
                            <p className="text-2xs text-ink-500">{p.quarter}</p>
                          </div>
                        </div>
                        <ActionBadge action={p.action} />
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-ink-700/40 pt-2">
                        <span className="font-mono text-2xs text-ink-400">
                          {formatShares(p.shares)} sh
                        </span>
                        <span className="font-mono text-xs font-semibold text-ink-100">
                          {formatCurrency(p.marketValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related prediction markets */}
          {polymarkets.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400">
                Prediction Markets
              </h4>
              <div className="space-y-2">
                {polymarkets.map((m) => (
                  <div key={m.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-ink-200">{m.question}</p>
                      <span className="font-mono text-sm font-bold text-ink-50">
                        {(m.yesPrice * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-ink-500">
                      Vol {formatCurrency(m.volume)} · ends {timeAgo(m.endDate)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
