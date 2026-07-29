import { TrendingUp, TrendingDown, Building2, Landmark, BarChart3 } from 'lucide-react';
import type { SignalType } from '@/types';

export const SIGNAL_META: Record<
  SignalType,
  { icon: typeof TrendingUp; label: string; color: string; bg: string }
> = {
  insider: { icon: TrendingUp, label: 'Insider', color: 'text-teal-300', bg: 'bg-teal-400/15' },
  institution: { icon: Building2, label: 'Institution', color: 'text-sky-300', bg: 'bg-sky-400/15' },
  congress: { icon: Landmark, label: 'Politician', color: 'text-amber-300', bg: 'bg-amber-400/15' },
  polymarket: { icon: BarChart3, label: 'Polymarket', color: 'text-violet-300', bg: 'bg-violet-400/15' },
};

interface SignalIconsProps {
  signals: SignalType[];
  size?: 'sm' | 'md';
}

export function SignalIcons({ signals, size = 'sm' }: SignalIconsProps) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconDim = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-1">
      {(Object.keys(SIGNAL_META) as SignalType[]).map((type) => {
        const meta = SIGNAL_META[type];
        const Icon = meta.icon;
        const active = signals.includes(type);
        if (!active) {
          return (
            <div
              key={type}
              className={`${dim} flex items-center justify-center rounded-full bg-ink-700/40 text-ink-600`}
            >
              <Icon className={iconDim} />
            </div>
          );
        }
        return (
          <div
            key={type}
            className={`${dim} flex items-center justify-center rounded-full ${meta.bg} ${meta.color}`}
          >
            <Icon className={iconDim} />
          </div>
        );
      })}
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

export function MarketTag({ market }: { market: 'EU' | 'US' }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-bold ${
        market === 'EU'
          ? 'bg-blue-500/15 text-blue-300'
          : 'bg-ink-600/40 text-ink-300'
      }`}
    >
      {market}
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
