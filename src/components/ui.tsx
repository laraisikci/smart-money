import { TrendingUp, TrendingDown, Building2, BarChart3, AlertTriangle } from 'lucide-react';
import type { SignalType } from '@/types';

export const SIGNAL_META: Record<
  SignalType,
  { icon: typeof TrendingUp; label: string; color: string; bg: string }
> = {
  insider: { icon: TrendingUp, label: 'Insider', color: 'text-teal-300', bg: 'bg-teal-400/15' },
  institution: { icon: Building2, label: 'Institution', color: 'text-sky-300', bg: 'bg-sky-400/15' },
  polymarket: { icon: BarChart3, label: 'Polymarket', color: 'text-violet-300', bg: 'bg-violet-400/15' },
};

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card shimmer h-24 w-full" />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-start gap-3 border-bear-500/30 bg-bear-500/5 p-4">
      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-bear-400" />
      <div className="flex-1">
        <p className="text-xs font-medium text-bear-300">Couldn't load live data</p>
        <p className="mt-0.5 text-2xs text-ink-500">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-2xs font-medium text-teal-300 hover:text-teal-200"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

interface SignalIconsProps {
  signals: SignalType[];
  size?: 'sm' | 'md';
}

export function SignalIcons({ signals, size = 'sm' }: SignalIconsProps) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconDim = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const total = Object.keys(SIGNAL_META).length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {(Object.keys(SIGNAL_META) as SignalType[]).map((type) => {
          const meta = SIGNAL_META[type];
          const Icon = meta.icon;
          const active = signals.includes(type);
          if (!active) {
            return (
              <div
                key={type}
                title={`${meta.label}: no data`}
                className={`${dim} flex items-center justify-center rounded-full bg-ink-700/40 text-ink-600`}
              >
                <Icon className={iconDim} />
              </div>
            );
          }
          return (
            <div
              key={type}
              title={`${meta.label}: active`}
              className={`${dim} flex items-center justify-center rounded-full ${meta.bg} ${meta.color}`}
            >
              <Icon className={iconDim} />
            </div>
          );
        })}
      </div>
      <span className="text-2xs font-medium text-ink-500">
        {signals.length}/{total}
      </span>
    </div>
  );
}

export function ActionBadge({
  action,
}: {
  action: 'new' | 'increased' | 'decreased' | 'exited' | 'BUY' | 'SELL';
}) {
  const config: Record<string, { label: string; cls: string; dot: string }> = {
    new: { label: 'New Position', cls: 'text-bull-400 bg-bull-500/15 border-bull-500/30', dot: 'bg-bull-400' },
    increased: { label: 'Increased', cls: 'text-bull-400 bg-bull-500/15 border-bull-500/30', dot: 'bg-bull-400' },
    decreased: { label: 'Decreased', cls: 'text-bear-400 bg-bear-500/15 border-bear-500/30', dot: 'bg-bear-400' },
    exited: { label: 'Exited', cls: 'text-bear-400 bg-bear-500/15 border-bear-500/30', dot: 'bg-bear-400' },
    BUY: { label: 'BUY', cls: 'text-bull-400 bg-bull-500/15 border-bull-500/30', dot: 'bg-bull-400' },
    SELL: { label: 'SELL', cls: 'text-bear-400 bg-bear-500/15 border-bear-500/30', dot: 'bg-bear-400' },
  };
  const c = config[action];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold ${c.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function MarketTag({ market, currency }: { market: 'EU' | 'US'; currency?: string }) {
  const label = market === 'EU' ? (currency ?? 'EU') : market;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-bold ${
        market === 'EU'
          ? 'bg-blue-500/15 text-blue-300'
          : 'bg-ink-600/40 text-ink-300'
      }`}
    >
      {label}
    </span>
  );
}

export function FundAvatar({ slug, color, size = 'md' }: { slug: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: color }}
    >
      {slug}
    </div>
  );
}

export function TickerSymbol({ symbol, name }: { symbol: string; name?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-sm font-bold text-ink-50">{symbol}</span>
      {name && <span className="truncate text-xs text-ink-400">{name}</span>}
    </div>
  );
}

export function TrendArrow({ direction }: { direction: 'up' | 'down' }) {
  return direction === 'up' ? (
    <TrendingUp className="h-3.5 w-3.5 text-bull-400" />
  ) : (
    <TrendingDown className="h-3.5 w-3.5 text-bear-400" />
  );
}
