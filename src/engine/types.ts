/**
 * Core domain types shared by the trading engine, broker adapters and UI.
 * Everything here is platform-agnostic: no React, no React Native, no Node.
 */

export type AssetClass = 'stock' | 'crypto';
export type Side = 'long' | 'short';
export type OrderSide = 'buy' | 'sell';

/** One OHLCV bar. `t` is epoch milliseconds of the bar's open time. */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Volume-weighted price for the bar, when the feed provides it. */
  vw?: number;
}

/** A single trade print from the real-time feed. */
export interface Tick {
  symbol: string;
  price: number;
  size: number;
  t: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url?: string;
  symbols: string[];
  /** epoch ms */
  createdAt: number;
  /** Sentiment in [-1, 1], produced by the sentiment scorer. */
  sentiment: number;
  /** Absolute strength of the sentiment signal in [0, 1]. */
  confidence: number;
}

export interface Indicators {
  ema9: number;
  ema21: number;
  rsi14: number;
  vwap: number;
  atr14: number;
  avgVolume20: number;
  lastVolume: number;
  /** +1 if EMA9 crossed above EMA21 in the last 3 bars, -1 if below, 0 otherwise. */
  recentCross: -1 | 0 | 1;
}

export interface SymbolState {
  symbol: string;
  assetClass: AssetClass;
  bars: Bar[];
  lastPrice: number;
  lastTickAt: number;
  indicators: Indicators | null;
  /** Recent news for this symbol (newest first). */
  news: NewsItem[];
  /** Aggregate news sentiment in [-1, 1] over the lookback window. */
  newsScore: number;
  /** Timestamp (ms) until which new entries are blocked for this symbol. */
  cooldownUntil: number;
}

export interface SignalComponent {
  name: string;
  points: number;
  max: number;
  detail: string;
}

export interface Signal {
  symbol: string;
  side: Side | null;
  /** 0..100 composite score for the chosen side. */
  score: number;
  components: SignalComponent[];
  reasons: string[];
  /** Hard blocks that prevent an entry regardless of score. */
  blockers: string[];
  at: number;
}

export interface OpenPosition {
  symbol: string;
  assetClass: AssetClass;
  side: Side;
  qty: number;
  entryPrice: number;
  openedAt: number;
  stopPrice: number;
  takeProfitPrice: number;
  /** Best price seen since entry (highest for longs, lowest for shorts). */
  highWater: number;
  /** Why the engine entered (for the activity log). */
  entryReason: string;
  /** Whether the engine opened it, or adopted it from the broker on start. */
  managed: boolean;
}

export type ExitReason =
  | 'stop_loss'
  | 'take_profit'
  | 'trailing_stop'
  | 'max_hold'
  | 'news_veto'
  | 'trend_break'
  | 'market_close'
  | 'daily_loss_halt'
  | 'manual'
  | 'engine_stop';

export interface TradeRecord {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  side: Side;
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
  openedAt: number;
  closedAt: number | null;
  pnl: number | null;
  pnlPct: number | null;
  entryReason: string;
  exitReason: ExitReason | null;
}

export type ActivityLevel = 'info' | 'signal' | 'order' | 'warn' | 'error';

export interface ActivityEvent {
  id: string;
  at: number;
  level: ActivityLevel;
  symbol?: string;
  message: string;
}

export interface AccountSnapshot {
  equity: number;
  lastEquity: number;
  cash: number;
  buyingPower: number;
  currency: string;
  status: string;
  /** epoch ms when the snapshot was taken */
  at: number;
}

export interface MarketClock {
  isOpen: boolean;
  nextOpen: number;
  nextClose: number;
  at: number;
}

export type EngineStatus = 'stopped' | 'starting' | 'running' | 'halted' | 'error';

/** One equity sample for the performance curve. */
export interface EquityPoint {
  t: number;
  equity: number;
}

export interface EngineSnapshot {
  status: EngineStatus;
  statusDetail: string;
  account: AccountSnapshot | null;
  clock: MarketClock | null;
  symbols: Record<string, SymbolState>;
  positions: Record<string, OpenPosition>;
  trades: TradeRecord[];
  activity: ActivityEvent[];
  signals: Record<string, Signal>;
  news: NewsItem[];
  tradesToday: number;
  realizedPnlToday: number;
  streams: { stocks: StreamStatus; crypto: StreamStatus; news: StreamStatus };
  lastTickAt: number;
  /** Equity samples taken over the session, oldest first, for the performance curve. */
  equityHistory: EquityPoint[];
}

export type StreamStatus = 'off' | 'connecting' | 'connected' | 'reconnecting' | 'error';
