import type { Broker, MarketStreams, RawNews } from '../broker/types';
import { assetClassOf } from '../broker/alpaca/symbols';
import { computeIndicators } from './indicators';
import type { Parameters } from './parameters';
import { aggregateNews, scoreSentiment } from './sentiment';
import { evaluateEntry } from './strategy';
import type {
  AccountSnapshot,
  ActivityEvent,
  ActivityLevel,
  AssetClass,
  Bar,
  EngineSnapshot,
  EngineStatus,
  EquityPoint,
  ExitReason,
  MarketClock,
  NewsItem,
  OpenPosition,
  Side,
  Signal,
  StreamStatus,
  SymbolState,
  TradeRecord,
} from './types';

export interface EngineDeps {
  broker: Broker;
  streams: MarketStreams;
  now?: () => number;
  /** Test hook: replace timers. */
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
}

export interface EngineOptions {
  /** Ms between account/clock refreshes and housekeeping. */
  housekeepingMs?: number;
  /** Max bars retained per symbol. */
  maxBars?: number;
  /** Max activity events retained. */
  maxActivity?: number;
  /** Max news items retained globally. */
  maxNews?: number;
  /** Max equity samples retained for the performance curve. */
  maxEquityPoints?: number;
}

const MAX_BARS = 400;
/** Bars requested per symbol on start. Exported so the backtest harness can mirror the live warm-up window. */
export const BOOTSTRAP_BARS = 300;
/** Minimum gap between tick-driven entry evaluations for one symbol. */
const EVAL_THROTTLE_MS = 1000;

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/**
 * The trading engine. It is a plain class with no UI or platform dependencies:
 * feed it a Broker and MarketStreams and it manages the whole trade lifecycle
 * (signal → sizing → entry → exit management → daily circuit breakers).
 *
 * All state changes are published through `subscribe()` as immutable snapshots.
 */
export class TradingEngine {
  private params: Parameters;
  private status: EngineStatus = 'stopped';
  private statusDetail = 'Not running';
  private account: AccountSnapshot | null = null;
  private clock: MarketClock | null = null;
  private symbols: Record<string, SymbolState> = {};
  private positions: Record<string, OpenPosition> = {};
  private trades: TradeRecord[] = [];
  private activity: ActivityEvent[] = [];
  private signals: Record<string, Signal> = {};
  private news: NewsItem[] = [];
  private tradesToday = 0;
  private realizedPnlToday = 0;
  private tradingDay = '';
  private streams: EngineSnapshot['streams'] = { stocks: 'off', crypto: 'off', news: 'off' };
  private lastTickAt = 0;

  private pendingOrders = new Set<string>();
  private lastEvalAt: Record<string, number> = {};
  /** Equity first seen today, used where the venue publishes no prior-day mark. */
  private dayStartEquity: number | null = null;
  /** Equity samples for the performance curve, oldest first. */
  private equityHistory: EquityPoint[] = [];
  private housekeepingTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(s: EngineSnapshot) => void>();
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => number;
  private readonly opts: Required<EngineOptions>;

  constructor(
    private readonly deps: EngineDeps,
    params: Parameters,
    opts: EngineOptions = {}
  ) {
    this.params = params;
    this.now = deps.now ?? (() => Date.now());
    this.opts = {
      housekeepingMs: opts.housekeepingMs ?? 20_000,
      maxBars: opts.maxBars ?? MAX_BARS,
      maxActivity: opts.maxActivity ?? 300,
      maxNews: opts.maxNews ?? 200,
      maxEquityPoints: opts.maxEquityPoints ?? 1000,
    };
    for (const s of params.watchlist) this.ensureSymbol(s);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  subscribe(fn: (s: EngineSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  snapshot(): EngineSnapshot {
    return {
      status: this.status,
      statusDetail: this.statusDetail,
      account: this.account,
      clock: this.clock,
      symbols: { ...this.symbols },
      positions: { ...this.positions },
      trades: [...this.trades],
      activity: [...this.activity],
      signals: { ...this.signals },
      news: [...this.news],
      tradesToday: this.tradesToday,
      realizedPnlToday: this.realizedPnlToday,
      streams: { ...this.streams },
      lastTickAt: this.lastTickAt,
      equityHistory: [...this.equityHistory],
    };
  }

  getParameters(): Parameters {
    return this.params;
  }

  setParameters(next: Parameters) {
    const prevWatch = this.params.watchlist.join(',');
    this.params = next;
    for (const s of next.watchlist) this.ensureSymbol(s);
    // Drop symbols no longer watched unless we hold a position in them.
    for (const s of Object.keys(this.symbols)) {
      if (!next.watchlist.includes(s) && !this.positions[s]) {
        delete this.symbols[s];
        delete this.signals[s];
      }
    }
    if (this.status === 'running' && prevWatch !== next.watchlist.join(',')) {
      this.deps.streams.updateSymbols(this.activeSymbols());
      void this.bootstrapSymbols(next.watchlist.filter((s) => this.symbols[s].bars.length === 0));
    }
    // Re-price stops for open positions when exit parameters change.
    for (const p of Object.values(this.positions)) this.applyExitLevels(p, p.entryPrice);
    this.log('info', `Parameters updated`);
    this.emit();
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') return;
    this.setStatus('starting', 'Connecting to broker…');
    try {
      await this.refreshAccountAndClock();
      this.resetDayIfNeeded();
      await this.reconcilePositions(true);
      this.setStatus('starting', 'Loading history…');
      await this.bootstrapSymbols(this.activeSymbols());
      this.setStatus('starting', 'Loading news…');
      await this.bootstrapNews();
      this.deps.streams.start(this.activeSymbols(), {
        onTick: (s, p, sz, t) => this.onTick(s, p, sz, t),
        onBar: (s, b) => this.onBar(s, b),
        onNews: (n) => this.onNews(n),
        onStatus: (name, st, detail) => this.onStreamStatus(name, st, detail),
      });
      this.housekeepingTimer = (this.deps.setInterval ?? setInterval)(() => {
        void this.housekeeping();
      }, this.opts.housekeepingMs);
      this.setStatus('running', `Watching ${this.activeSymbols().length} symbols`);
      this.log('info', `Engine started on ${this.deps.broker.label}`);
    } catch (e) {
      this.setStatus('error', errorMessage(e));
      this.log('error', `Start failed: ${errorMessage(e)}`);
      this.deps.streams.stop();
    }
  }

  async stop(reason: 'manual' | 'engine_stop' = 'manual', flatten = false): Promise<void> {
    if (this.housekeepingTimer) (this.deps.clearInterval ?? clearInterval)(this.housekeepingTimer);
    this.housekeepingTimer = null;
    this.deps.streams.stop();
    if (flatten) await this.flattenAll(reason === 'manual' ? 'manual' : 'engine_stop');
    this.setStatus('stopped', flatten ? 'Stopped and flattened' : 'Stopped');
    this.log('info', flatten ? 'Engine stopped; all positions closed' : 'Engine stopped');
  }

  async flattenAll(reason: ExitReason = 'manual'): Promise<void> {
    const open = Object.values(this.positions);
    if (open.length === 0) return;
    this.log('warn', `Closing ${open.length} position${open.length === 1 ? '' : 's'} (${reason})`);
    await Promise.all(open.map((p) => this.exitPosition(p, reason)));
  }

  async closePosition(symbol: string): Promise<void> {
    const p = this.positions[symbol];
    if (p) await this.exitPosition(p, 'manual');
  }

  /** Resume after a daily-loss halt. Only sensible on a new trading day. */
  async resume(): Promise<void> {
    if (this.status !== 'halted') return;
    this.status = 'stopped';
    await this.start();
  }

  // ---------------------------------------------------------------------
  // Data ingestion
  // ---------------------------------------------------------------------

  private onTick(symbol: string, price: number, _size: number, t: number) {
    const st = this.symbols[symbol];
    if (!st || !Number.isFinite(price) || price <= 0) return;
    st.lastPrice = price;
    st.lastTickAt = t;
    this.lastTickAt = this.now();
    const pos = this.positions[symbol];
    if (pos) {
      this.checkPriceExits(pos, price);
    } else {
      // Ticks drive entries too: waiting for the next bar close would give up
      // most of a fast move. Indicators are cached, so this is just score math,
      // and it is throttled per symbol to keep a burst of prints cheap.
      const last = this.lastEvalAt[symbol] ?? 0;
      if (this.now() - last >= EVAL_THROTTLE_MS) {
        this.lastEvalAt[symbol] = this.now();
        this.evaluateSymbol(symbol);
      }
    }
    this.emit();
  }

  private onBar(symbol: string, bar: Bar) {
    const st = this.symbols[symbol];
    if (!st) return;
    const last = st.bars[st.bars.length - 1];
    if (last && last.t === bar.t) st.bars[st.bars.length - 1] = bar;
    else if (!last || bar.t > last.t) st.bars.push(bar);
    else return; // out of order; ignore
    if (st.bars.length > this.opts.maxBars) st.bars.splice(0, st.bars.length - this.opts.maxBars);
    if (!st.lastPrice) st.lastPrice = bar.c;
    st.lastTickAt = Math.max(st.lastTickAt, bar.t + 60_000);
    st.indicators = computeIndicators(st.bars, st.assetClass === 'crypto');
    this.evaluateSymbol(symbol);
    this.emit();
  }

  private onNews(raw: RawNews) {
    if (this.news.some((n) => n.id === raw.id)) return;
    const s = scoreSentiment(`${raw.headline}. ${raw.summary}`);
    const item: NewsItem = { ...raw, sentiment: s.score, confidence: s.confidence };
    this.news.unshift(item);
    if (this.news.length > this.opts.maxNews) this.news.length = this.opts.maxNews;

    const affected = raw.symbols.filter((sym) => this.symbols[sym]);
    for (const sym of affected) {
      const st = this.symbols[sym];
      st.news.unshift(item);
      if (st.news.length > 50) st.news.length = 50;
      this.recomputeNewsScore(st);
      if (Math.abs(s.score) >= 0.3) {
        this.log('signal', `${s.score > 0 ? 'Positive' : 'Negative'} news (${fmtSigned(s.score)}): ${raw.headline}`, sym);
      }
      this.evaluateSymbol(sym);
    }
    this.emit();
  }

  private onStreamStatus(name: keyof EngineSnapshot['streams'], status: StreamStatus, detail?: string) {
    if (this.streams[name] === status) return;
    this.streams[name] = status;
    if (status === 'error') this.log('warn', `${name} stream: ${detail ?? 'error'}`);
    this.emit();
  }

  // ---------------------------------------------------------------------
  // Decision making
  // ---------------------------------------------------------------------

  private evaluateSymbol(symbol: string) {
    const st = this.symbols[symbol];
    if (!st) return;
    const now = this.now();
    const pos = this.positions[symbol];

    if (pos) {
      // Bar-level exit checks (trend break, news veto).
      if (this.params.exitOnTrendBreak && st.indicators) {
        const dir = pos.side === 'long' ? 1 : -1;
        const aligned = (st.indicators.ema9 - st.indicators.ema21) * dir > 0;
        if (!aligned && now - pos.openedAt > 3 * 60_000) {
          void this.exitPosition(pos, 'trend_break');
          return;
        }
      }
      const directional = pos.side === 'long' ? st.newsScore : -st.newsScore;
      if (directional < this.params.newsVetoSentiment && st.news.length > 0) {
        void this.exitPosition(pos, 'news_veto');
      }
      return;
    }

    const signal = evaluateEntry(st, this.params, this.clock, now);
    this.signals[symbol] = signal;
    if (signal.side && this.status === 'running') void this.tryEnter(st, signal);
  }

  private async tryEnter(st: SymbolState, signal: Signal) {
    const { symbol } = st;
    if (this.positions[symbol] || this.pendingOrders.has(symbol)) return;
    if (Object.keys(this.positions).length >= this.params.maxOpenPositions) return;
    if (this.tradesToday >= this.params.maxDailyTrades) {
      this.log('warn', `Daily trade cap reached (${this.params.maxDailyTrades}); no new entries`);
      return;
    }
    if (!this.account) return;
    if (this.dailyLossBreached()) return;

    const side = signal.side as Side;
    if (!this.venueAllows(side)) {
      this.log('warn', `${this.deps.broker.label} cannot sell short, so this signal is skipped`, symbol);
      return;
    }
    const price = st.lastPrice;
    const qty = this.sizePosition(st, price);
    if (qty <= 0) {
      this.log('warn', `Signal ${signal.score} for ${side} but position size rounds to zero`, symbol);
      return;
    }

    this.pendingOrders.add(symbol);
    const reason = `score ${signal.score}: ${topReasons(signal)}`;
    this.log('signal', `${side.toUpperCase()} signal ${signal.score}/100 → ${qty} @ ~${fmtPrice(price)}`, symbol);
    try {
      const order = await this.deps.broker.submitMarketOrder({
        symbol,
        assetClass: st.assetClass,
        side: side === 'long' ? 'buy' : 'sell',
        qty,
        clientOrderId: nextId('tr-entry'),
      });
      const filled = await this.deps.broker.waitForFill(order.id, 20_000);
      if (filled.status !== 'filled' || filled.filledQty <= 0) {
        this.log('warn', `Entry order ${filled.status}; will reconcile with broker`, symbol);
        await this.reconcilePositions(false);
        return;
      }
      const entry = filled.filledAvgPrice ?? price;
      const pos: OpenPosition = {
        symbol,
        assetClass: st.assetClass,
        side,
        qty: filled.filledQty,
        entryPrice: entry,
        openedAt: this.now(),
        stopPrice: 0,
        takeProfitPrice: 0,
        highWater: entry,
        entryReason: reason,
        managed: true,
      };
      this.applyExitLevels(pos, entry);
      this.positions[symbol] = pos;
      this.tradesToday += 1;
      this.log(
        'order',
        `Opened ${side.toUpperCase()} ${filled.filledQty} @ ${fmtPrice(entry)} · stop ${fmtPrice(pos.stopPrice)} · target ${fmtPrice(pos.takeProfitPrice)} · order ${order.id}`,
        symbol
      );

      // The order is already filled and cannot be undone; the guard's job is
      // to notice a bad fill and stop the engine from compounding it, not to
      // prevent the fill itself.
      const slippagePct = price > 0 ? (Math.abs(entry - price) / price) * 100 : 0;
      if (slippagePct > this.params.maxSlippagePct) {
        st.cooldownUntil = Math.max(st.cooldownUntil, this.now() + this.params.cooldownMinutes * 60_000);
        this.log(
          'warn',
          `Slippage guard: filled ${slippagePct.toFixed(2)}% away from the ${fmtPrice(price)} this was sized at (limit ${this.params.maxSlippagePct}%); cooling down`,
          symbol
        );
      }
    } catch (e) {
      this.log('error', `Entry failed: ${errorMessage(e)}`, symbol);
    } finally {
      this.pendingOrders.delete(symbol);
      this.emit();
    }
  }

  private sizePosition(st: SymbolState, price: number): number {
    const acct = this.account!;
    const equity = acct.equity;
    const riskAmount = (equity * this.params.riskPerTradePct) / 100;
    const stopDistance = (price * this.params.stopLossPct) / 100;
    let qty = stopDistance > 0 ? riskAmount / stopDistance : 0;
    const maxNotional = (equity * this.params.maxPositionPct) / 100;
    qty = Math.min(qty, maxNotional / price);

    // Cap combined exposure across all open positions in this asset class,
    // independent of the single-position cap above.
    const classExposure = this.assetClassExposure(st.assetClass);
    const classBudget = Math.max(0, (equity * this.params.maxAssetClassExposurePct) / 100 - classExposure);
    qty = Math.min(qty, classBudget / price);

    const bp = st.assetClass === 'crypto' ? Math.min(acct.cash, acct.buyingPower) : acct.buyingPower;
    qty = Math.min(qty, (bp * 0.95) / price);
    if (st.assetClass === 'crypto') qty = floorTo(qty, 4);
    else qty = this.params.fractionalShares ? floorTo(qty, 2) : Math.floor(qty);
    if (qty * price < 1) return 0;
    return qty;
  }

  /** Current mark-to-market notional of open positions in one asset class. */
  private assetClassExposure(assetClass: AssetClass): number {
    let sum = 0;
    for (const pos of Object.values(this.positions)) {
      if (pos.assetClass !== assetClass) continue;
      const price = this.symbols[pos.symbol]?.lastPrice || pos.entryPrice;
      sum += pos.qty * price;
    }
    return sum;
  }

  private applyExitLevels(pos: OpenPosition, entry: number) {
    const dir = pos.side === 'long' ? 1 : -1;
    pos.stopPrice = entry * (1 - (dir * this.params.stopLossPct) / 100);
    pos.takeProfitPrice = entry * (1 + (dir * this.params.takeProfitPct) / 100);
  }

  private checkPriceExits(pos: OpenPosition, price: number) {
    const dir = pos.side === 'long' ? 1 : -1;
    if (dir > 0) pos.highWater = Math.max(pos.highWater, price);
    else pos.highWater = Math.min(pos.highWater, price);

    if ((price - pos.stopPrice) * dir <= 0) return void this.exitPosition(pos, 'stop_loss');
    if ((price - pos.takeProfitPrice) * dir >= 0) return void this.exitPosition(pos, 'take_profit');

    const trail = this.params.trailingStopPct;
    if (trail > 0) {
      const armed = (pos.highWater - pos.entryPrice) * dir >= (pos.entryPrice * trail) / 100;
      const trailStop = pos.highWater * (1 - (dir * trail) / 100);
      if (armed && (price - trailStop) * dir <= 0) return void this.exitPosition(pos, 'trailing_stop');
    }
    if (this.params.maxHoldMinutes > 0 && this.now() - pos.openedAt >= this.params.maxHoldMinutes * 60_000) {
      return void this.exitPosition(pos, 'max_hold');
    }
  }

  private async exitPosition(pos: OpenPosition, reason: ExitReason) {
    const { symbol } = pos;
    if (!this.positions[symbol] || this.pendingOrders.has(symbol)) return;
    this.pendingOrders.add(symbol);
    this.log('signal', `Exit (${reason.replace('_', ' ')})`, symbol);
    try {
      const order = await this.deps.broker.closePosition(symbol);
      const orderId = order?.id ?? 'n/a';
      let exitPrice = this.symbols[symbol]?.lastPrice ?? pos.entryPrice;
      if (order) {
        const filled = await this.deps.broker.waitForFill(order.id, 20_000);
        if (filled.filledAvgPrice) exitPrice = filled.filledAvgPrice;
      }
      const dir = pos.side === 'long' ? 1 : -1;
      const pnl = (exitPrice - pos.entryPrice) * dir * pos.qty;
      const pnlPct = ((exitPrice - pos.entryPrice) * dir) / pos.entryPrice;
      delete this.positions[symbol];
      this.realizedPnlToday += pnl;
      this.trades.unshift({
        id: nextId('trade'),
        symbol,
        assetClass: pos.assetClass,
        side: pos.side,
        qty: pos.qty,
        entryPrice: pos.entryPrice,
        exitPrice,
        openedAt: pos.openedAt,
        closedAt: this.now(),
        pnl,
        pnlPct,
        entryReason: pos.entryReason,
        exitReason: reason,
      });
      if (this.trades.length > 500) this.trades.length = 500;
      const st = this.symbols[symbol];
      if (st) st.cooldownUntil = this.now() + this.params.cooldownMinutes * 60_000;
      this.log(
        'order',
        `Closed ${pos.side.toUpperCase()} ${pos.qty} @ ${fmtPrice(exitPrice)} · P&L ${fmtSigned(pnl, 2)} (${fmtSigned(pnlPct * 100, 2)}%) · order ${orderId}`,
        symbol
      );
    } catch (e) {
      this.log('error', `Exit failed: ${errorMessage(e)}`, symbol);
    } finally {
      this.pendingOrders.delete(symbol);
      this.emit();
    }
  }

  // ---------------------------------------------------------------------
  // Housekeeping
  // ---------------------------------------------------------------------

  private async housekeeping() {
    if (this.status !== 'running') return;
    try {
      await this.refreshAccountAndClock();
      this.resetDayIfNeeded();
      await this.reconcilePositions(false);

      if (this.dailyLossBreached()) {
        this.log('error', `Daily loss limit hit (${this.params.maxDailyLossPct}%). Flattening and halting.`);
        await this.flattenAll('daily_loss_halt');
        await this.stop('engine_stop', false);
        this.setStatus('halted', 'Daily loss limit reached');
        return;
      }

      const now = this.now();
      for (const pos of Object.values(this.positions)) {
        const st = this.symbols[pos.symbol];
        if (st?.lastPrice) this.checkPriceExits(pos, st.lastPrice);
        if (pos.assetClass === 'stock' && this.clock?.isOpen && this.params.stockSessionOnly) {
          const minsToClose = (this.clock.nextClose - now) / 60_000;
          if (minsToClose <= this.params.flattenBeforeCloseMinutes) void this.exitPosition(pos, 'market_close');
        }
      }
      // Re-evaluate entries periodically too, so time-based blockers clear without a new bar.
      for (const s of Object.keys(this.symbols)) if (!this.positions[s]) this.evaluateSymbol(s);
    } catch (e) {
      this.log('warn', `Housekeeping: ${errorMessage(e)}`);
    } finally {
      this.emit();
    }
  }

  private async refreshAccountAndClock() {
    const [account, clock] = await Promise.all([this.deps.broker.getAccount(), this.deps.broker.getClock()]);
    this.account = account;
    this.clock = clock;
    if (this.dayStartEquity === null && account.equity > 0) this.dayStartEquity = account.equity;
    if (account.equity > 0) this.recordEquity(account.equity);
  }

  /** Appends an equity sample, capped so the history stays a bounded size. */
  private recordEquity(equity: number) {
    const t = this.now();
    const last = this.equityHistory[this.equityHistory.length - 1];
    if (last && t - last.t < 1000) return; // avoid duplicate samples within the same tick
    this.equityHistory.push({ t, equity });
    if (this.equityHistory.length > this.opts.maxEquityPoints) {
      this.equityHistory.splice(0, this.equityHistory.length - this.opts.maxEquityPoints);
    }
  }

  /**
   * Measures the day against the broker's own prior-day equity mark when it
   * publishes one. Exchanges and wallets do not, so the engine falls back to
   * the equity it first saw this session, which is the only baseline it can
   * honestly claim.
   */
  private dailyLossBreached(): boolean {
    const account = this.account;
    if (!account) return false;
    const baseline =
      account.lastEquity > 0 && account.lastEquity !== account.equity ? account.lastEquity : this.dayStartEquity;
    if (!baseline || baseline <= 0) return false;
    const pct = ((account.equity - baseline) / baseline) * 100;
    return pct <= -this.params.maxDailyLossPct;
  }

  private resetDayIfNeeded() {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (day !== this.tradingDay) {
      this.tradingDay = day;
      this.tradesToday = 0;
      this.realizedPnlToday = 0;
      this.dayStartEquity = this.account?.equity ?? null;
    }
  }

  /** Bring the engine's view of open positions in line with the broker's. */
  private async reconcilePositions(initial: boolean) {
    const brokerPositions = await this.deps.broker.getPositions();
    const seen = new Set<string>();
    for (const bp of brokerPositions) {
      seen.add(bp.symbol);
      if (this.pendingOrders.has(bp.symbol)) continue;
      const existing = this.positions[bp.symbol];
      if (existing) {
        existing.qty = bp.qty;
        continue;
      }
      if (!this.params.watchlist.includes(bp.symbol)) continue; // not ours to manage
      const st = this.ensureSymbol(bp.symbol);

      /*
       * Exchanges report a balance, not a position, so there is no average
       * entry price to inherit. Anchoring the exits on zero would put the
       * stop at zero and trigger the target immediately, so fall back to the
       * current price and say so plainly: the stop protects from here, not
       * from wherever the balance was actually acquired.
       */
      let basis = bp.avgEntryPrice;
      let inferred = false;
      if (!Number.isFinite(basis) || basis <= 0) {
        basis = st.lastPrice || (await this.deps.broker.getLatestPrice(bp.symbol, bp.assetClass).catch(() => null)) || 0;
        inferred = true;
      }
      if (!Number.isFinite(basis) || basis <= 0) {
        this.log('warn', `Holding ${bp.qty} but no price is available, so it cannot be managed yet`, bp.symbol);
        continue;
      }

      const pos: OpenPosition = {
        symbol: bp.symbol,
        assetClass: bp.assetClass,
        side: bp.side,
        qty: bp.qty,
        entryPrice: basis,
        openedAt: this.now(),
        stopPrice: 0,
        takeProfitPrice: 0,
        highWater: basis,
        entryReason: inferred ? 'adopted from an existing balance' : 'adopted from broker',
        managed: false,
      };
      this.applyExitLevels(pos, basis);
      this.positions[bp.symbol] = pos;
      this.log(
        'warn',
        inferred
          ? `Adopted an existing ${bp.qty} balance; exits are measured from the current price, not your original cost`
          : `Adopted existing ${bp.side} ${bp.qty} position; exits now managed`,
        bp.symbol
      );
    }
    for (const sym of Object.keys(this.positions)) {
      if (!seen.has(sym) && !this.pendingOrders.has(sym)) {
        delete this.positions[sym];
        if (!initial) this.log('warn', `Position closed outside the engine`, sym);
      }
    }
  }

  private async bootstrapSymbols(symbols: string[]) {
    await Promise.all(
      symbols.map(async (sym) => {
        const st = this.ensureSymbol(sym);
        try {
          const [bars, price] = await Promise.all([
            this.deps.broker.getBars(sym, st.assetClass, BOOTSTRAP_BARS),
            this.deps.broker.getLatestPrice(sym, st.assetClass),
          ]);
          st.bars = bars.slice(-this.opts.maxBars);
          st.indicators = computeIndicators(st.bars, st.assetClass === 'crypto');
          if (price) {
            st.lastPrice = price;
            st.lastTickAt = this.now();
          } else if (bars.length) {
            st.lastPrice = bars[bars.length - 1].c;
            st.lastTickAt = bars[bars.length - 1].t;
          }
        } catch (e) {
          this.log('warn', `History load failed: ${errorMessage(e)}`, sym);
        }
      })
    );
    for (const s of symbols) this.evaluateSymbol(s);
  }

  private async bootstrapNews() {
    if (this.deps.broker.capabilities?.news === false) {
      this.log('info', `${this.deps.broker.label} has no news feed, so the news component scores neutral`);
      return;
    }
    try {
      const raw = await this.deps.broker.getNews(this.params.watchlist, 50);
      for (const n of raw.reverse()) this.onNews(n);
    } catch (e) {
      this.log('warn', `News load failed: ${errorMessage(e)}`);
    }
  }

  /** True when the venue can actually act on the side the signal chose. */
  private venueAllows(side: Side): boolean {
    if (side === 'short') return this.deps.broker.capabilities?.shorts !== false;
    return true;
  }

  private recomputeNewsScore(st: SymbolState) {
    st.newsScore = aggregateNews(st.news, this.now(), this.params.newsLookbackMinutes);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private activeSymbols(): string[] {
    return Array.from(new Set([...this.params.watchlist, ...Object.keys(this.positions)]));
  }

  private ensureSymbol(symbol: string): SymbolState {
    let st = this.symbols[symbol];
    if (!st) {
      st = {
        symbol,
        assetClass: assetClassOf(symbol),
        bars: [],
        lastPrice: 0,
        lastTickAt: 0,
        indicators: null,
        news: [],
        newsScore: 0,
        cooldownUntil: 0,
      };
      // Attach any news we already hold for this symbol.
      st.news = this.news.filter((n) => n.symbols.includes(symbol)).slice(0, 50);
      this.recomputeNewsScore(st);
      this.symbols[symbol] = st;
    }
    return st;
  }

  private setStatus(status: EngineStatus, detail: string) {
    this.status = status;
    this.statusDetail = detail;
    this.emit();
  }

  private log(level: ActivityLevel, message: string, symbol?: string) {
    this.activity.unshift({ id: nextId('ev'), at: this.now(), level, symbol, message });
    if (this.activity.length > this.opts.maxActivity) this.activity.length = this.opts.maxActivity;
  }

  /** Coalesce bursts of ticks into at most ~4 UI updates per second. */
  private emit() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      const snap = this.snapshot();
      for (const l of this.listeners) l(snap);
    }, 250);
  }
}

function floorTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.floor(n * f) / f;
}

function topReasons(signal: Signal): string {
  return signal.components
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ');
}

export function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function fmtSigned(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(decimals);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
