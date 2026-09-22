import type { Side } from './types';

/**
 * The user-tunable parameters that bound what the engine is allowed to do.
 * Percentages are expressed as whole numbers (1.5 means 1.5%).
 */
export interface Parameters {
  // --- Universe -----------------------------------------------------------
  /** Symbols to watch. Stocks as "AAPL", crypto as "BTC/USD". */
  watchlist: string[];
  tradeStocks: boolean;
  tradeCrypto: boolean;

  // --- Position sizing & exposure -----------------------------------------
  /** % of account equity risked per trade (distance to stop × qty). */
  riskPerTradePct: number;
  /** Max notional of any single position as a % of equity. */
  maxPositionPct: number;
  maxOpenPositions: number;
  /** Allow fractional share quantities for stocks. */
  fractionalShares: boolean;

  // --- Daily circuit breakers ---------------------------------------------
  /** If today's P&L falls below -X% of starting equity, flatten and halt. */
  maxDailyLossPct: number;
  /** Stop opening new positions after this many trades today. */
  maxDailyTrades: number;

  // --- Exits --------------------------------------------------------------
  stopLossPct: number;
  takeProfitPct: number;
  /** 0 disables the trailing stop. */
  trailingStopPct: number;
  /** 0 disables the time-based exit. */
  maxHoldMinutes: number;
  /** Exit when the fast EMA crosses back below the slow EMA (or above, for shorts). */
  exitOnTrendBreak: boolean;
  /** Per-symbol cooldown after an exit before re-entering. */
  cooldownMinutes: number;

  // --- Sessions -----------------------------------------------------------
  /** Only trade stocks during the regular session. */
  stockSessionOnly: boolean;
  /** Close all stock positions this many minutes before the close. */
  flattenBeforeCloseMinutes: number;
  /** Don't open new stock positions in the first N minutes after the open. */
  skipOpeningMinutes: number;

  // --- Entry signal -------------------------------------------------------
  allowShorts: boolean;
  /** Composite score (0..100) required to enter. */
  minSignalScore: number;
  /** Last bar's volume must be at least this multiple of the 20-bar average. */
  minVolumeMultiple: number;
  rsiMin: number;
  rsiMax: number;

  // --- News ---------------------------------------------------------------
  /** Minutes of news history that count toward a symbol's news score. */
  newsLookbackMinutes: number;
  /** Require the news score to be at least this value before entering long. */
  newsMinSentiment: number;
  /** Block entries (and exit longs) when the news score falls below this. */
  newsVetoSentiment: number;
  /** If true, an entry needs at least one recent news item to exist. */
  requireNewsConfirmation: boolean;
}

export const DEFAULT_PARAMETERS: Parameters = {
  watchlist: ['AAPL', 'NVDA', 'TSLA', 'AMD', 'SPY', 'BTC/USD', 'ETH/USD', 'SOL/USD'],
  tradeStocks: true,
  tradeCrypto: true,

  riskPerTradePct: 0.5,
  maxPositionPct: 20,
  maxOpenPositions: 3,
  fractionalShares: true,

  maxDailyLossPct: 2,
  maxDailyTrades: 15,

  stopLossPct: 0.8,
  takeProfitPct: 1.6,
  trailingStopPct: 0.6,
  maxHoldMinutes: 120,
  exitOnTrendBreak: true,
  cooldownMinutes: 15,

  stockSessionOnly: true,
  flattenBeforeCloseMinutes: 10,
  skipOpeningMinutes: 5,

  allowShorts: false,
  minSignalScore: 65,
  minVolumeMultiple: 1.3,
  rsiMin: 50,
  rsiMax: 72,

  newsLookbackMinutes: 90,
  newsMinSentiment: 0,
  newsVetoSentiment: -0.35,
  requireNewsConfirmation: false,
};

export interface ParameterPreset {
  id: string;
  name: string;
  description: string;
  values: Partial<Parameters>;
}

export const PARAMETER_PRESETS: ParameterPreset[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Small size, tight daily loss cap, high signal bar. Good for a first week of paper trading.',
    values: {
      riskPerTradePct: 0.25,
      maxPositionPct: 10,
      maxOpenPositions: 2,
      maxDailyLossPct: 1,
      maxDailyTrades: 8,
      stopLossPct: 0.6,
      takeProfitPct: 1.2,
      trailingStopPct: 0.4,
      minSignalScore: 75,
      requireNewsConfirmation: true,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'The defaults: moderate sizing with a 2% daily loss halt.',
    values: { ...DEFAULT_PARAMETERS, watchlist: DEFAULT_PARAMETERS.watchlist },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Larger size and more trades per day. Higher variance; paper trade it first.',
    values: {
      riskPerTradePct: 1,
      maxPositionPct: 30,
      maxOpenPositions: 5,
      maxDailyLossPct: 3,
      maxDailyTrades: 30,
      stopLossPct: 1,
      takeProfitPct: 2.5,
      trailingStopPct: 0.8,
      minSignalScore: 60,
      minVolumeMultiple: 1.2,
    },
  },
];

interface Bound {
  min: number;
  max: number;
  step?: number;
}

/** Sane ranges the UI enforces. */
export const PARAMETER_BOUNDS: Record<
  Exclude<
    keyof Parameters,
    | 'watchlist'
    | 'tradeStocks'
    | 'tradeCrypto'
    | 'fractionalShares'
    | 'exitOnTrendBreak'
    | 'stockSessionOnly'
    | 'allowShorts'
    | 'requireNewsConfirmation'
  >,
  Bound
> = {
  riskPerTradePct: { min: 0.05, max: 5, step: 0.05 },
  maxPositionPct: { min: 1, max: 100, step: 1 },
  maxOpenPositions: { min: 1, max: 20, step: 1 },
  maxDailyLossPct: { min: 0.25, max: 25, step: 0.25 },
  maxDailyTrades: { min: 1, max: 200, step: 1 },
  stopLossPct: { min: 0.1, max: 20, step: 0.1 },
  takeProfitPct: { min: 0.1, max: 50, step: 0.1 },
  trailingStopPct: { min: 0, max: 20, step: 0.1 },
  maxHoldMinutes: { min: 0, max: 1440, step: 5 },
  cooldownMinutes: { min: 0, max: 240, step: 1 },
  flattenBeforeCloseMinutes: { min: 0, max: 120, step: 1 },
  skipOpeningMinutes: { min: 0, max: 120, step: 1 },
  minSignalScore: { min: 0, max: 100, step: 1 },
  minVolumeMultiple: { min: 0, max: 10, step: 0.1 },
  rsiMin: { min: 0, max: 100, step: 1 },
  rsiMax: { min: 0, max: 100, step: 1 },
  newsLookbackMinutes: { min: 5, max: 1440, step: 5 },
  newsMinSentiment: { min: -1, max: 1, step: 0.05 },
  newsVetoSentiment: { min: -1, max: 1, step: 0.05 },
};

function clamp(n: number, b: Bound): number {
  if (!Number.isFinite(n)) return b.min;
  return Math.min(b.max, Math.max(b.min, n));
}

/** Merge a possibly-partial/possibly-stale stored object onto the defaults and clamp it. */
export function normalizeParameters(input: unknown): Parameters {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<Parameters>;
  const out: Parameters = { ...DEFAULT_PARAMETERS, ...src };
  for (const key of Object.keys(PARAMETER_BOUNDS) as (keyof typeof PARAMETER_BOUNDS)[]) {
    out[key] = clamp(Number(out[key]), PARAMETER_BOUNDS[key]);
  }
  if (out.rsiMin > out.rsiMax) [out.rsiMin, out.rsiMax] = [out.rsiMax, out.rsiMin];
  if (out.newsVetoSentiment > out.newsMinSentiment) out.newsVetoSentiment = out.newsMinSentiment;
  out.watchlist = Array.from(
    new Set(
      (Array.isArray(src.watchlist) ? src.watchlist : DEFAULT_PARAMETERS.watchlist)
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.\-]{1,12}(\/[A-Z]{3,5})?$/.test(s))
    )
  );
  return out;
}

/** A human-readable one-line explanation of a side, for logs. */
export function sideLabel(side: Side): string {
  return side === 'long' ? 'LONG' : 'SHORT';
}
