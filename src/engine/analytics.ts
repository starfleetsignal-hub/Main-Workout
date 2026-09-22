import type { EquityPoint, TradeRecord } from './types';

/**
 * Performance statistics derived from the engine's own equity history and
 * trade log. Pure functions over data the engine already tracks, so they can
 * be tested without a broker and reused by both the app and a backtest report.
 */
export interface PerformanceStats {
  /** Peak-to-trough decline over the equity history, as a positive percentage. */
  maxDrawdownPct: number;
  /** Equity at the point the current/last drawdown began. */
  peakEquity: number;
  /** Gross profit divided by gross loss. Infinity if there were no losses. */
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  closedTrades: number;
  netPnl: number;
  /** Total return over the equity history, as a percentage. */
  totalReturnPct: number;
}

const EMPTY_STATS: PerformanceStats = {
  maxDrawdownPct: 0,
  peakEquity: 0,
  profitFactor: 0,
  avgWin: 0,
  avgLoss: 0,
  winRate: 0,
  closedTrades: 0,
  netPnl: 0,
  totalReturnPct: 0,
};

/** Peak-to-trough decline, as a positive percentage of the running peak. */
export function computeMaxDrawdown(history: EquityPoint[]): { maxDrawdownPct: number; peakEquity: number } {
  if (history.length === 0) return { maxDrawdownPct: 0, peakEquity: 0 };
  let peak = history[0].equity;
  let maxDrawdown = 0;
  for (const point of history) {
    if (point.equity > peak) peak = point.equity;
    if (peak > 0) {
      const drawdown = ((peak - point.equity) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return { maxDrawdownPct: maxDrawdown, peakEquity: peak };
}

export function computeTradeStats(trades: TradeRecord[]): Pick<
  PerformanceStats,
  'profitFactor' | 'avgWin' | 'avgLoss' | 'winRate' | 'closedTrades' | 'netPnl'
> {
  const closed = trades.filter((t) => t.pnl !== null);
  if (closed.length === 0) {
    return { profitFactor: 0, avgWin: 0, avgLoss: 0, winRate: 0, closedTrades: 0, netPnl: 0 };
  }
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const grossWin = wins.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + (t.pnl ?? 0), 0));
  return {
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    winRate: (wins.length / closed.length) * 100,
    closedTrades: closed.length,
    netPnl: grossWin - grossLoss,
  };
}

export function computePerformanceStats(history: EquityPoint[], trades: TradeRecord[]): PerformanceStats {
  const { maxDrawdownPct, peakEquity } = computeMaxDrawdown(history);
  const tradeStats = computeTradeStats(trades);
  const first = history[0]?.equity ?? 0;
  const last = history[history.length - 1]?.equity ?? 0;
  const totalReturnPct = first > 0 ? ((last - first) / first) * 100 : 0;
  return { ...EMPTY_STATS, maxDrawdownPct, peakEquity, ...tradeStats, totalReturnPct };
}

/**
 * Downsamples an equity history to at most `maxPoints` for cheap SVG
 * rendering, always keeping the first and last point so the curve's
 * endpoints are exact.
 */
export function downsampleEquity(history: EquityPoint[], maxPoints = 80): EquityPoint[] {
  if (history.length <= maxPoints) return history;
  const step = (history.length - 1) / (maxPoints - 1);
  const out: EquityPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(history[Math.round(i * step)]);
  }
  return out;
}
