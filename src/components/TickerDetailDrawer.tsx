import { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  Percent,
  TrendingDown,
  Newspaper,
  ExternalLink,
  Sparkles,
  LineChart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  ConvictionResult,
  InsiderTrade,
  InstitutionalPosition,
  PolymarketMarket,
  NewsHeadline,
  TechnicalIndicators,
} from '@/types';
import { getEarningsDate, daysUntilEarnings } from '@/data/earnings';
import { getShortInterest, shortInterestLevel } from '@/data/shortInterest';
import { getTickerMeta } from '@/data/tickers';
import { SignalIcons, ActionBadge, MarketTag, FundAvatar } from '@/components/ui';
import { WatchlistStarButton } from '@/components/WatchlistStar';
import { FUND_MAP } from '@/data/funds';
import { formatCurrency, formatShares, formatDate, timeAgo } from '@/lib/format';
import { SENTIMENT_DIRECTION } from '@/lib/newsSentiment';
import {
  reasonAboutTechnicals,
  technicalScore,
  rsiZone,
  stochZone,
  vsAverage,
  type Zone,
} from '@/lib/technicalReasoning';
import { buildFullAnalysis } from '@/lib/fullAnalysis';
import { api } from '@/lib/api';

const fmtPrice = (v: number) => `$${v.toFixed(2)}`;

function zoneColor(zone: Zone): string {
  if (zone === 'Overbought') return 'text-bear-400';
  if (zone === 'Oversold') return 'text-bull-400';
  return 'text-warn-400';
}

function IndicatorTile({
  label,
  value,
  badgeText,
  badgeColorClass,
}: {
  label: string;
  value: string;
  badgeText?: string;
  badgeColorClass?: string;
}) {
  return (
    <div className="card p-3">
      <p className="text-2xs text-ink-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-ink-50">{value}</span>
        {badgeText && <span className={`text-2xs font-semibold ${badgeColorClass}`}>{badgeText}</span>}
      </div>
    </div>
  );
}

interface TickerDetailDrawerProps {
  result: ConvictionResult | null;
  onClose: () => void;
  insiders: InsiderTrade[];
  institutions: InstitutionalPosition[];
  polymarket: PolymarketMarket[];
  news: NewsHeadline[];
  // Set (to a value or null) only for ad-hoc search results, which already carry their own
  // fully-fetched technicals from /api/search/analyze — skips the normal per-ticker on-demand
  // fetch below, which would 404 for a ticker outside the pre-tracked universe. Left undefined
  // for every other caller, which keeps the existing on-demand fetch behavior unchanged.
  technicalsOverride?: TechnicalIndicators | null;
  skipNewsFetch?: boolean;
}

export function TickerDetailDrawer({
  result,
  onClose,
  insiders: allInsiders,
  institutions: allInstitutions,
  polymarket: allPolymarket,
  news: bulkNews,
  technicalsOverride,
  skipNewsFetch,
}: TickerDetailDrawerProps) {
  useEffect(() => {
    if (result) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [result]);

  // On-demand fetch for the one ticker actually being viewed — tries GNews first server-side,
  // falling back to Yahoo (see /api/news/:ticker) — layered on top of the already-fetched bulk
  // `news` prop, which displays instantly while this is in flight rather than showing nothing.
  const [onDemandNews, setOnDemandNews] = useState<NewsHeadline[] | null>(null);
  useEffect(() => {
    setOnDemandNews(null);
    if (!result || skipNewsFetch) return;
    let cancelled = false;
    api
      .newsForTicker(result.ticker)
      .then((res) => {
        if (!cancelled) setOnDemandNews(res.data);
      })
      .catch(() => {
        // keep showing the bulk-fetched fallback rather than an error state for this
      });
    return () => {
      cancelled = true;
    };
  }, [result, skipNewsFetch]);

  // Technical indicators are computed server-side per ticker on demand (see /api/technicals/:ticker)
  // rather than bulk-fetched for the whole universe — nothing outside this drawer needs them.
  // Skipped entirely when technicalsOverride is set (ad-hoc search results already have theirs).
  const [technicals, setTechnicals] = useState<TechnicalIndicators | null>(null);
  const [technicalsLoading, setTechnicalsLoading] = useState(false);
  useEffect(() => {
    if (technicalsOverride !== undefined) return;
    setTechnicals(null);
    if (!result) return;
    let cancelled = false;
    setTechnicalsLoading(true);
    api
      .technicalsForTicker(result.ticker)
      .then((res) => {
        if (!cancelled) setTechnicals(res.data);
      })
      .catch(() => {
        // no technicals for this ticker (e.g. not enough price history, or Yahoo unreachable) —
        // the section below just doesn't render rather than showing an error
      })
      .finally(() => {
        if (!cancelled) setTechnicalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [result, technicalsOverride]);

  const effectiveTechnicals = technicalsOverride !== undefined ? technicalsOverride : technicals;

  const [fullAnalysisOpen, setFullAnalysisOpen] = useState(false);

  if (!result) return null;

  const meta = getTickerMeta(result.ticker);
  const earnings = getEarningsDate(result.ticker);
  const daysToEarn = earnings ? daysUntilEarnings(earnings.nextEarnings) : null;
  const shortInt = getShortInterest(result.ticker);
  const siLevel = shortInt ? shortInterestLevel(shortInt.shortInterestPct) : null;

  const insiders = allInsiders.filter((t) => t.ticker === result.ticker);
  const institutions = allInstitutions.filter((p) => p.ticker === result.ticker);
  const polymarkets = allPolymarket.filter((m) => m.relatedTickers.includes(result.ticker));
  const news = onDemandNews ?? bulkNews;
  const techReasoning = effectiveTechnicals ? reasonAboutTechnicals(effectiveTechnicals) : null;
  const techScore = effectiveTechnicals ? technicalScore(effectiveTechnicals) : null;
  const fullAnalysis = buildFullAnalysis(result, effectiveTechnicals, news);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
      />

      {/* Drawer — a bottom sheet on mobile, a centered wide modal with a 2-panel layout at lg: */}
      <div className="fixed bottom-0 left-1/2 z-50 max-h-[85vh] w-full max-w-md translate-x-[-50%] overflow-y-auto rounded-t-3xl border-t border-ink-700 bg-ink-900 pb-[env(safe-area-inset-bottom)] lg:top-1/2 lg:bottom-auto lg:max-h-[85vh] lg:w-full lg:max-w-4xl lg:-translate-y-1/2 lg:rounded-3xl lg:border">
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-ink-900/95 px-5 py-3 backdrop-blur-md lg:rounded-t-3xl lg:px-6">
          <div className="mx-auto h-1 w-10 rounded-full bg-ink-600 absolute left-1/2 top-2 translate-x-[-50%] lg:hidden" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-ink-50">{result.ticker}</span>
            <MarketTag market={meta.market} currency={meta.currency} />
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-ink-400 transition-colors hover:text-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 pb-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5 lg:space-y-0 lg:px-6 lg:pb-8">
          {/* Header — spans both panels on desktop */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink-50">{result.name}</h3>
              <WatchlistStarButton
                variant="pill"
                target={{ symbol: result.ticker, name: result.name, market: result.market, currency: result.currency, sector: result.sector }}
                convictionScore={result.totalScore}
                institutions={institutions}
                news={news}
                technicals={effectiveTechnicals}
                disabled={technicalsLoading}
              />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-ink-700/50 px-2 py-0.5 text-2xs font-medium text-ink-300">
                {result.sector}
              </span>
              <SignalIcons signals={result.signalsActive} size="md" />
            </div>
          </div>

          {/* Conviction score */}
          <div className="card flex items-center justify-between p-4 lg:col-start-1">
            <div>
              <p className="text-xs text-ink-400">Conviction Score</p>
              <p className="mt-0.5 text-2xs text-ink-500">Weighted across {result.signalsActive.length} signal{result.signalsActive.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="font-mono text-3xl font-bold text-teal-300">{result.totalScore}</div>
          </div>

          {/* Earnings date */}
          {earnings && daysToEarn !== null && daysToEarn > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-warn-500/20 bg-warn-500/5 px-4 py-3 lg:col-start-1">
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
            <div className="card p-4 lg:col-start-1">
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
          <div className="lg:col-start-1">
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

          {/* Full Analysis — combined reasoning across every signal this app tracks */}
          {fullAnalysis && (
            <div className="card overflow-hidden lg:col-start-1">
              <button
                onClick={() => setFullAnalysisOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 p-4 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <h4 className="text-xs font-medium uppercase tracking-wider text-ink-400">
                    Full Analysis
                  </h4>
                </div>
                {fullAnalysisOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-ink-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-500" />
                )}
              </button>
              {fullAnalysisOpen && (
                <div className="border-t border-ink-700/40 px-4 pb-4 pt-3">
                  <p className="text-xs leading-relaxed text-ink-300">{fullAnalysis.paragraph}</p>
                  <p className="mt-3 font-mono text-xs font-bold text-teal-300">
                    Overall verdict: {fullAnalysis.verdict}
                  </p>
                  <p className="mt-2 text-2xs text-ink-600">
                    This analysis is generated from public data. Not financial advice.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Technical Analysis */}
          {(technicalsLoading || effectiveTechnicals) && (
            <div className="lg:col-start-2">
              <div className="mb-2 flex items-center gap-1.5">
                <LineChart className="h-3.5 w-3.5 text-ink-400" />
                <h4 className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Technical Analysis
                </h4>
              </div>

              {technicalsLoading && !effectiveTechnicals && (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card shimmer h-14 w-full" />
                  ))}
                </div>
              )}

              {effectiveTechnicals && (
                <div className="space-y-4">
                  {techScore && (
                    <div className="card flex items-center justify-between p-4">
                      <div>
                        <p className="text-xs text-ink-400">Technical Score</p>
                        <p className="mt-0.5 text-2xs text-ink-500">{techScore.detail}</p>
                        <p className="mt-0.5 text-2xs text-ink-600">
                          Weighted 60% trend (price vs. moving averages) · 40% momentum (RSI +
                          Stochastic) — shown separately from the Conviction Score above
                        </p>
                      </div>
                      <div className="shrink-0 font-mono text-2xl font-bold text-teal-300">
                        {techScore.score}%
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-2xs font-medium text-ink-500">Moving Averages</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['SMA 20', effectiveTechnicals.sma20],
                          ['SMA 50', effectiveTechnicals.sma50],
                          ['SMA 200', effectiveTechnicals.sma200],
                          ['EMA 20', effectiveTechnicals.ema20],
                          ['EMA 50', effectiveTechnicals.ema50],
                          ['EMA 200', effectiveTechnicals.ema200],
                        ] as [string, number | null][]
                      ).map(([label, value]) => {
                        if (value === null) return null;
                        const rel = vsAverage(effectiveTechnicals.price, value);
                        return (
                          <IndicatorTile
                            key={label}
                            label={label}
                            value={fmtPrice(value)}
                            badgeText={rel === 'Above' ? 'Bullish' : 'Bearish'}
                            badgeColorClass={rel === 'Above' ? 'text-bull-400' : 'text-bear-400'}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-2xs font-medium text-ink-500">Oscillators</p>
                    <div className="grid grid-cols-2 gap-2">
                      {effectiveTechnicals.rsi14 !== null && (
                        <IndicatorTile
                          label="RSI 14"
                          value={effectiveTechnicals.rsi14.toFixed(1)}
                          badgeText={rsiZone(effectiveTechnicals.rsi14)}
                          badgeColorClass={zoneColor(rsiZone(effectiveTechnicals.rsi14))}
                        />
                      )}
                      {effectiveTechnicals.stochK !== null && effectiveTechnicals.stochD !== null && (
                        <IndicatorTile
                          label="Stochastic %K/%D"
                          value={`${effectiveTechnicals.stochK.toFixed(1)} / ${effectiveTechnicals.stochD.toFixed(1)}`}
                          badgeText={stochZone(effectiveTechnicals.stochK)}
                          badgeColorClass={zoneColor(stochZone(effectiveTechnicals.stochK))}
                        />
                      )}
                    </div>
                  </div>

                  {techReasoning && (
                    <div className="card p-3">
                      <p className="text-2xs font-medium uppercase tracking-wider text-ink-500">
                        What this means
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
                        {techReasoning.paragraph}
                      </p>
                      <p className="mt-2 font-mono text-xs font-bold text-teal-300">
                        Technical verdict: {techReasoning.verdict}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent insider trades */}
          {insiders.length > 0 && (
            <div className="lg:col-start-2">
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
            <div className="lg:col-start-2">
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
            <div className="lg:col-start-2">
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

          {/* Recent news */}
          {news.length > 0 && (
            <div className="lg:col-start-2">
              <div className="mb-2 flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5 text-ink-400" />
                <h4 className="text-xs font-medium uppercase tracking-wider text-ink-400">
                  Recent News
                </h4>
              </div>
              <p className="mb-2 text-2xs text-ink-600">
                Sentiment and impact tags are a keyword-based estimate, not financial advice.
              </p>
              <div className="space-y-2">
                {news.slice(0, 5).map((h, i) => {
                  const direction = SENTIMENT_DIRECTION[h.sentiment];
                  return (
                    <a
                      key={i}
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="card block p-3 transition-colors hover:border-ink-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-ink-200">{h.title}</p>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-ink-700/40 pt-2">
                        <span className="text-2xs text-ink-400">
                          {direction.emoji} {direction.label}
                        </span>
                        <span className="text-2xs text-ink-500">{timeAgo(h.publishedAt)}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
