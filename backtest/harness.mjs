/**
 * Backtest harness: replays historical bars through the real TradingEngine —
 * the same class the app and the headless runner use — instead of a
 * reimplementation of the strategy. It works the same way the engine test
 * suite does: fake Broker/MarketStreams implementations feed the engine, and
 * a simulated clock stands in for `Date.now()`.
 *
 * Known v1 limitations, documented here rather than hidden:
 *  - No historical news. `capabilities.news = false` makes the engine skip
 *    news loading entirely (the same path real venues without a news feed
 *    take), so the news component of every signal scores neutral.
 *  - Exits are checked once per bar, at that bar's close — not by scanning
 *    the bar's high/low. A stop or target that pierced intrabar and
 *    recovered before the close will not show as hit.
 *  - No margin is modeled: buying power equals cash on hand.
 *  - Shorting is not modeled (`capabilities.shorts = false`); the strategy
 *    only takes long entries, exactly as it would on a spot-only venue.
 *  - Session boundaries for stocks use `sessionStartFor`'s DST-aware 9:30am
 *    ET open, but a bar outside market hours simply rolls to "+24h" for the
 *    next session rather than a real NYSE calendar (no weekend/holiday
 *    skipping). This only affects the reported clock, not which bars get
 *    replayed.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist-esm');

/**
 * A bare Windows path (e.g. "C:\...") passed to import() throws
 * ERR_UNSUPPORTED_ESM_URL_SCHEME — Node's ESM loader treats the drive
 * letter as a URL scheme. file:// URLs work on every OS, so build one
 * instead of relying on the loader to accept a raw filesystem path.
 */
const importPath = (...segments) => import(pathToFileURL(path.join(...segments)).href);

async function loadDist() {
  const engineFile = path.join(distDir, 'engine/engine.js');
  if (!existsSync(engineFile)) {
    throw new Error('Engine build missing. Run: node tools/build-node.mjs');
  }
  const [engine, parameters, analytics, symbols, indicators, venues] = await Promise.all([
    importPath(distDir, 'engine/engine.js'),
    importPath(distDir, 'engine/parameters.js'),
    importPath(distDir, 'engine/analytics.js'),
    importPath(distDir, 'broker/alpaca/symbols.js'),
    importPath(distDir, 'engine/indicators.js'),
    importPath(distDir, 'broker/venues.js'),
  ]);
  return { engine, parameters, analytics, symbols, indicators, venues };
}

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

/**
 * A cash-account, long-only, no-margin broker backed by pre-loaded bars.
 * Implements the same `Broker` interface as the real venue adapters
 * (src/broker/types.ts) — the engine cannot tell it apart from a live one.
 */
class BacktestBroker {
  constructor({ startingCash, warmupBars, capabilities, clockFn }) {
    this.label = 'Backtest';
    this.capabilities = capabilities;
    this.cash = startingCash;
    this.warmupBars = warmupBars; // Map<symbol, Bar[]>
    this.clockFn = clockFn;
    this.positions = new Map(); // symbol -> { symbol, assetClass, qty, avgEntryPrice }
    this.priceMap = new Map();
    this.orders = new Map();
    this.seq = 0;
  }

  setPrice(symbol, price) {
    if (Number.isFinite(price) && price > 0) this.priceMap.set(symbol, price);
  }

  equity() {
    let marketValue = 0;
    for (const pos of this.positions.values()) {
      const price = this.priceMap.get(pos.symbol) ?? pos.avgEntryPrice;
      marketValue += pos.qty * price;
    }
    return this.cash + marketValue;
  }

  async getAccount() {
    const equity = this.equity();
    return {
      equity,
      // No broker-reported prior-day mark; the engine falls back to the
      // equity it first saw each simulated day, which is the only honest
      // baseline a backtest can claim.
      lastEquity: equity,
      cash: Math.max(0, this.cash),
      buyingPower: Math.max(0, this.cash),
      currency: 'USD',
      status: 'ACTIVE',
      at: this.clockFn().at,
    };
  }

  async getClock() {
    return this.clockFn();
  }

  async getPositions() {
    // Reported on every housekeeping pass so `reconcilePositions` doesn't
    // mistake an engine-managed position for one closed outside the engine.
    const out = [];
    for (const pos of this.positions.values()) {
      const price = this.priceMap.get(pos.symbol) ?? pos.avgEntryPrice;
      out.push({
        symbol: pos.symbol,
        assetClass: pos.assetClass,
        qty: pos.qty,
        side: 'long',
        avgEntryPrice: pos.avgEntryPrice,
        marketValue: pos.qty * price,
        unrealizedPnl: (price - pos.avgEntryPrice) * pos.qty,
      });
    }
    return out;
  }

  async submitMarketOrder(req) {
    if (req.side !== 'buy') {
      throw new Error('Backtest broker only fills long entries; shorts are not modeled (capabilities.shorts = false).');
    }
    const price = this.priceMap.get(req.symbol);
    if (!price || price <= 0) throw new Error(`No simulated price for ${req.symbol} yet`);
    const id = `bt-${++this.seq}`;
    this.cash -= req.qty * price;
    this.positions.set(req.symbol, { symbol: req.symbol, assetClass: req.assetClass, qty: req.qty, avgEntryPrice: price });
    const result = { id, clientOrderId: req.clientOrderId ?? id, status: 'filled', filledQty: req.qty, filledAvgPrice: price };
    this.orders.set(id, result);
    return result;
  }

  async waitForFill(orderId) {
    return this.orders.get(orderId) ?? { id: orderId, clientOrderId: orderId, status: 'rejected', filledQty: 0, filledAvgPrice: null };
  }

  async closePosition(symbol) {
    const pos = this.positions.get(symbol);
    if (!pos) return null;
    const price = this.priceMap.get(symbol) ?? pos.avgEntryPrice;
    this.cash += pos.qty * price;
    this.positions.delete(symbol);
    const id = `bt-close-${++this.seq}`;
    const result = { id, clientOrderId: id, status: 'filled', filledQty: pos.qty, filledAvgPrice: price };
    this.orders.set(id, result);
    return result;
  }

  async closeAllPositions() {
    for (const symbol of Array.from(this.positions.keys())) await this.closePosition(symbol);
  }

  async getBars(symbol) {
    return this.warmupBars.get(symbol) ?? [];
  }

  async getLatestPrice() {
    return null; // there is no separate quote feed; onTick/onBar drive price
  }

  async getNews() {
    return []; // capabilities.news = false means the engine never calls this
  }
}

class BacktestStreams {
  constructor() {
    this.handlers = null;
  }
  start(_symbols, handlers) {
    this.handlers = handlers;
  }
  updateSymbols() {}
  stop() {
    this.handlers = null;
  }
}

/**
 * @param {object} options
 * @param {Record<string, {t:number,o:number,h:number,l:number,c:number,v:number}[]>} options.barsBySymbol
 *   Historical bars per symbol, oldest first (or any order — they are sorted). Use "BTC/USD"-style
 *   symbols for crypto and plain tickers ("AAPL") for stocks (matches `assetClassOf`).
 * @param {object} [options.params] Overrides merged over DEFAULT_PARAMETERS (watchlist is set automatically).
 * @param {number} [options.startingCash] Default 100,000.
 * @param {number} [options.warmupBars] Bars per symbol reserved for indicator warm-up before replay starts.
 *   Defaults to BOOTSTRAP_BARS (300, the same window the live engine requests on start).
 * @param {number} [options.housekeepingEveryMinutes] Simulated minutes between housekeeping passes
 *   (daily-loss check, pre-close flatten, equity sampling). Default 5.
 */
export async function runBacktest(options) {
  const { barsBySymbol, params: paramOverrides = {}, startingCash = 100_000, housekeepingEveryMinutes = 5 } = options;

  const symbols = Object.keys(barsBySymbol ?? {});
  if (symbols.length === 0) throw new Error('runBacktest requires at least one symbol in barsBySymbol');

  const { engine: engineMod, parameters: parametersMod, analytics, symbols: symbolsMod, indicators, venues } = await loadDist();
  const { TradingEngine, BOOTSTRAP_BARS } = engineMod;
  const { normalizeParameters, DEFAULT_PARAMETERS } = parametersMod;
  const { computePerformanceStats } = analytics;
  const { assetClassOf } = symbolsMod;
  const { sessionStartFor } = indicators;
  const { alwaysOpenClock } = venues;

  const warmupCount = Math.max(0, options.warmupBars ?? BOOTSTRAP_BARS);
  const warmup = new Map();
  const replayEvents = [];
  let hasStocks = false;
  let lastWarmupBarT = 0;

  for (const symbol of symbols) {
    if (assetClassOf(symbol) === 'stock') hasStocks = true;
    const bars = [...(barsBySymbol[symbol] ?? [])].sort((a, b) => a.t - b.t);
    const cut = Math.min(warmupCount, bars.length);
    const warmupBars = bars.slice(0, cut);
    warmup.set(symbol, warmupBars);
    if (warmupBars.length) lastWarmupBarT = Math.max(lastWarmupBarT, warmupBars[warmupBars.length - 1].t);
    for (const bar of bars.slice(cut)) replayEvents.push({ t: bar.t, symbol, bar });
  }
  replayEvents.sort((a, b) => a.t - b.t);

  const params = normalizeParameters({ ...DEFAULT_PARAMETERS, watchlist: symbols, ...paramOverrides });

  const SESSION_MS = 6.5 * 60 * 60_000;
  const DAY_MS = 24 * 60 * 60_000;
  function stockClockAt(t) {
    const start = sessionStartFor(t, false);
    if (start === null) return alwaysOpenClock(t);
    const close = start + SESSION_MS;
    if (t < start) return { isOpen: false, nextOpen: start, nextClose: close, at: t };
    if (t >= close) {
      const nextOpen = start + DAY_MS;
      return { isOpen: false, nextOpen, nextClose: nextOpen + SESSION_MS, at: t };
    }
    return { isOpen: true, nextOpen: start, nextClose: close, at: t };
  }

  const clockState = { now: replayEvents[0]?.t ?? (lastWarmupBarT || Date.now()) };
  const clockFn = () => (hasStocks ? stockClockAt(clockState.now) : alwaysOpenClock(clockState.now));

  const capabilities = {
    stocks: true,
    crypto: true,
    shorts: false,
    news: false,
    streaming: true,
    marketHours: hasStocks,
    brokerPositions: true,
    paper: true,
    custodial: true,
    historicalBars: true,
  };

  const broker = new BacktestBroker({ startingCash, warmupBars: warmup, capabilities, clockFn });
  const streams = new BacktestStreams();
  for (const symbol of symbols) {
    const last = warmup.get(symbol)?.at(-1);
    if (last) broker.setPrice(symbol, last.c);
  }

  const engine = new TradingEngine(
    { broker, streams, now: () => clockState.now, setInterval: () => 0, clearInterval: () => {} },
    params
  );

  await engine.start();
  await flushMicrotasks();

  const housekeepingEveryMs = Math.max(1, housekeepingEveryMinutes) * 60_000;
  let lastHousekeepingAt = clockState.now;

  for (const ev of replayEvents) {
    clockState.now = ev.t;
    broker.setPrice(ev.symbol, ev.bar.c);
    streams.handlers?.onBar(ev.symbol, ev.bar);
    await flushMicrotasks();
    streams.handlers?.onTick(ev.symbol, ev.bar.c, ev.bar.v, ev.t);
    await flushMicrotasks();

    if (clockState.now - lastHousekeepingAt >= housekeepingEveryMs) {
      lastHousekeepingAt = clockState.now;
      await engine.housekeeping();
    }
  }

  await engine.housekeeping(); // final mark so the equity curve includes the last bar
  await engine.stop('manual', true); // flatten whatever is still open at the end of the window
  await flushMicrotasks();

  const snapshot = engine.snapshot();
  const stats = computePerformanceStats(snapshot.equityHistory, snapshot.trades);
  return { snapshot, stats, trades: snapshot.trades };
}
