import type { OptionActivity } from '@/types';
import type { SmartMoneyDirection } from './signalConflict';

export function daysToExpiry(item: OptionActivity): number {
  return Math.round((new Date(item.expiry).getTime() - Date.now()) / 86_400_000);
}

export type Moneyness = 'OTM' | 'ITM' | 'ATM';

export function moneyness(item: OptionActivity): { pct: number; direction: Moneyness } {
  const pct = (Math.abs(item.strike - item.currentPrice) / item.currentPrice) * 100;
  if (pct < 2) return { pct, direction: 'ATM' };
  const isOtm = item.type === 'CALL' ? item.strike > item.currentPrice : item.strike < item.currentPrice;
  return { pct, direction: isOtm ? 'OTM' : 'ITM' };
}

export function volumeOiRatio(item: OptionActivity): number {
  return item.volume / Math.max(item.openInterest, 1);
}

// Total dollar premium traded today at this strike (contract price × 100 shares × volume) — the
// size of the flow, not the per-contract cost.
export function estimatedPremium(item: OptionActivity): number {
  return item.lastPrice * item.volume * 100;
}

export type FlowSignal = 'Unusual Call Activity' | 'Unusual Put Activity' | 'Possible Hedge';

// No "sweep" category — that's a multi-exchange, tick-level execution signal no free data source
// can see; claiming to detect it from a delayed chain snapshot would be fabricating the signal.
// "Possible Hedge" is a real, data-driven distinction instead: unusual put buying on a ticker
// this app's own smart-money signals already read as bullish looks more like protective hedging
// on an existing position than a fresh bearish bet.
export function classifyFlowSignal(item: OptionActivity, smartMoney: SmartMoneyDirection | null): FlowSignal {
  if (item.type === 'CALL') return 'Unusual Call Activity';
  if (smartMoney === 'Bullish') return 'Possible Hedge';
  return 'Unusual Put Activity';
}

export const FLOW_SIGNAL_STYLE: Record<FlowSignal, { emoji: string; className: string }> = {
  'Unusual Call Activity': { emoji: '📈', className: 'text-bull-400 bg-bull-500/15 border-bull-500/30' },
  'Unusual Put Activity': { emoji: '📉', className: 'text-bear-400 bg-bear-500/15 border-bear-500/30' },
  'Possible Hedge': { emoji: '🛡️', className: 'text-warn-400 bg-warn-500/15 border-warn-500/30' },
};

function sizePhrase(item: OptionActivity): string {
  if (item.openInterest === 0) {
    return `Every one of today's ${item.volume.toLocaleString()} contracts is brand new — there was no prior open interest at this strike.`;
  }
  const ratio = volumeOiRatio(item);
  return `Volume today is ${ratio.toFixed(1)}x the existing open interest — most of this activity is new positioning, not existing contracts changing hands.`;
}

function timingPhrase(dte: number): string {
  if (dte <= 14) return `With only ${dte} day${dte === 1 ? '' : 's'} until expiry, whoever's behind this expects the move soon.`;
  if (dte <= 45) return `Expiry is ${dte} days out — a several-week window for the thesis to play out.`;
  return `With ${dte} days until expiry, this is a longer-dated bet giving the move months to happen.`;
}

function moneynessPhrase(item: OptionActivity, pct: number, direction: Moneyness): string {
  if (direction === 'ATM') return 'This strike sits right at the current price.';
  const pctText = `${pct.toFixed(0)}%`;
  if (direction === 'OTM') {
    return item.type === 'CALL'
      ? `This strike is ${pctText} above the current price (out of the money), so it only pays off if ${item.ticker} rises significantly before expiry.`
      : `This strike is ${pctText} below the current price (out of the money), so it only pays off if ${item.ticker} falls significantly before expiry.`;
  }
  return `This strike is already ${pctText} in the money.`;
}

// Rule-based, deterministic — matches how every other "what does this mean" explainer in this
// app works (technicalReasoning.ts, macroSectors.ts, fullAnalysis.ts). Not an LLM call.
export function explainFlowItem(item: OptionActivity, signal: FlowSignal): string {
  const dte = daysToExpiry(item);
  const { pct, direction } = moneyness(item);
  const size = sizePhrase(item);
  const timing = timingPhrase(dte);
  const moneynessText = moneynessPhrase(item, pct, direction);

  if (signal === 'Possible Hedge') {
    return `Unusual ${item.type === 'CALL' ? 'call' : 'put'} activity on ${item.ticker} today, but insiders and institutions here already read bullish — this looks more like a large holder protecting an existing position than a fresh bearish bet. ${size} Check whether insiders are also selling before treating this as a bearish signal.`;
  }
  if (item.type === 'CALL') {
    const conviction =
      direction === 'OTM' && dte > 45
        ? ' Buying expensive out-of-the-money calls with months until expiry suggests the buyer expects a large move — possibly an earnings beat or major announcement.'
        : '';
    return `Someone bought a large amount of ${item.ticker} calls today. ${size} ${moneynessText} ${timing}${conviction} This reads bullish.`;
  }
  return `More ${item.ticker} puts than normal were bought today. ${size} This could mean a large holder is protecting their position against downside, or someone is betting on a decline — check if insiders are also selling before treating this as a clean bearish signal. ${moneynessText} ${timing}`;
}

export interface TickerPutCallRatio {
  ticker: string;
  companyName: string;
  ratio: number;
  sample?: boolean;
}

// Computed only from the unusual-activity items this tab already has (the server only returns
// each ticker's top few most-unusual contracts, not the full chain) — a real signal, just scoped
// to "today's flagged flow," not a comprehensive market-wide put/call ratio across all volume.
export function computePutCallRatios(items: OptionActivity[]): TickerPutCallRatio[] {
  const byTicker = new Map<string, { calls: number; puts: number; name: string; sample?: boolean }>();
  for (const item of items) {
    const entry = byTicker.get(item.ticker) ?? { calls: 0, puts: 0, name: item.companyName, sample: item.sample };
    if (item.type === 'CALL') entry.calls += item.volume;
    else entry.puts += item.volume;
    byTicker.set(item.ticker, entry);
  }
  return Array.from(byTicker.entries()).map(([ticker, { calls, puts, name, sample }]) => ({
    ticker,
    companyName: name,
    ratio: calls > 0 ? puts / calls : puts > 0 ? Infinity : 0,
    sample,
  }));
}

export function putCallInterpretation(ratio: number): { emoji: string; label: string } {
  if (ratio > 2) return { emoji: '🔴🔴', label: 'Extreme put buying — strong bearish signal or major hedge' };
  if (ratio > 1) return { emoji: '🔴', label: 'More puts than calls — market hedging or bearish bets' };
  if (ratio >= 0.5) return { emoji: '⚪', label: 'Neutral options sentiment' };
  return { emoji: '🟢', label: 'Market is bullish on this stock — more calls than puts' };
}

export type AlignmentSignal = 'StrongBullish' | 'Conflicting' | 'AheadOfSignals';

const HIGH_CONVICTION = 65;
const LOW_CONVICTION = 40;

export function classifyAlignment(
  convictionScore: number,
  hasUnusualCalls: boolean,
  hasUnusualPuts: boolean,
): AlignmentSignal | null {
  if (convictionScore >= HIGH_CONVICTION && hasUnusualCalls) return 'StrongBullish';
  if (convictionScore >= HIGH_CONVICTION && hasUnusualPuts) return 'Conflicting';
  if (convictionScore < LOW_CONVICTION && hasUnusualCalls) return 'AheadOfSignals';
  return null;
}

export const ALIGNMENT_LABEL: Record<AlignmentSignal, { emoji: string; text: string }> = {
  StrongBullish: { emoji: '⚡', text: 'Strong bullish alignment' },
  Conflicting: { emoji: '⚠️', text: 'Conflicting signals — worth investigating' },
  AheadOfSignals: { emoji: '👀', text: 'Options activity ahead of signals — watch this one' },
};
