import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TradingEngine } = require(path.join(root, 'dist-node/engine/engine.js'));
const { normalizeParameters, DEFAULT_PARAMETERS } = require(path.join(root, 'dist-node/engine/parameters.js'));

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 0, 5, 15, 0, 0); // a Monday, mid-session

/**
 * A rising series that produces a strong bullish signal. The step is
 * proportional (0.25% per bar) so the same fixture is equally bullish at $100
 * or at $50,000 — the scorer works in relative terms, as it should.
 */
function bullishBars(symbol, count = 60, start = 100) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const c = start * (1 + i * 0.0025);
    out.push({ t: T0 - (count - i) * MINUTE, o: c * 0.999, h: c * 1.0015, l: c * 0.998, c, v: 10_000 });
  }
  // Final bar gets heavy volume so the volume component scores.
  out[out.length - 1].v = 40_000;
  return out;
}

class FakeBroker {
  constructor(opts = {}) {
    this.label = 'Fake';
    this.orders = [];
    this.positions = [];
    this.closed = [];
    this.equity = opts.equity ?? 100_000;
    this.lastEquity = opts.lastEquity ?? 100_000;
    this.isOpen = opts.isOpen ?? true;
    this.bars = opts.bars ?? {};
    this.news = opts.news ?? [];
    this.orderSeq = 0;
    this.fillPrice = opts.fillPrice ?? null;
    this.failOrders = opts.failOrders ?? false;
  }
  async getAccount() {
    return {
      equity: this.equity,
      lastEquity: this.lastEquity,
      cash: this.equity,
      buyingPower: this.equity * 2,
      currency: 'USD',
      status: 'ACTIVE',
      at: T0,
    };
  }
  async getClock() {
    return { isOpen: this.isOpen, nextOpen: T0 + 18 * 60 * MINUTE, nextClose: T0 + 60 * MINUTE, at: T0 };
  }
  async getPositions() {
    return this.positions;
  }
  async submitMarketOrder(req) {
    if (this.failOrders) throw new Error('broker rejected the order');
    this.orders.push(req);
    const id = `o${++this.orderSeq}`;
    const price = this.fillPrice ?? this.bars[req.symbol]?.at(-1)?.c ?? 100;
    this.positions.push({
      symbol: req.symbol,
      assetClass: req.assetClass,
      qty: req.qty,
      side: req.side === 'buy' ? 'long' : 'short',
      avgEntryPrice: price,
      marketValue: req.qty * price,
      unrealizedPnl: 0,
    });
    return { id, clientOrderId: req.clientOrderId ?? id, status: 'filled', filledQty: req.qty, filledAvgPrice: price };
  }
  async waitForFill(orderId) {
    const price = this.fillPrice ?? 100;
    const qty = this.orders.at(-1)?.qty ?? 0;
    return { id: orderId, clientOrderId: orderId, status: 'filled', filledQty: qty, filledAvgPrice: price };
  }
  async closePosition(symbol) {
    this.closed.push(symbol);
    this.positions = this.positions.filter((p) => p.symbol !== symbol);
    return null; // engine falls back to the last known price
  }
  async closeAllPositions() {
    this.positions = [];
  }
  async getBars(symbol) {
    return this.bars[symbol] ?? [];
  }
  async getLatestPrice(symbol) {
    return this.bars[symbol]?.at(-1)?.c ?? null;
  }
  async getNews() {
    return this.news;
  }
}

class FakeStreams {
  constructor() {
    this.handlers = null;
    this.started = false;
    this.symbols = [];
  }
  start(symbols, handlers) {
    this.started = true;
    this.symbols = symbols;
    this.handlers = handlers;
  }
  updateSymbols(symbols) {
    this.symbols = symbols;
  }
  stop() {
    this.started = false;
  }
}

function makeEngine(paramOverrides = {}, brokerOpts = {}) {
  const params = normalizeParameters({ ...DEFAULT_PARAMETERS, ...paramOverrides });
  const broker = new FakeBroker(brokerOpts);
  const streams = new FakeStreams();
  let clock = T0;
  const engine = new TradingEngine(
    { broker, streams, now: () => clock, setInterval: () => 0, clearInterval: () => {} },
    params
  );
  return { engine, broker, streams, advance: (ms) => (clock += ms), setNow: (t) => (clock = t) };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

test('engine enters a long position on a strong bullish signal', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, skipOpeningMinutes: 0 },
    { bars }
  );
  await engine.start();
  assert.ok(streams.started, 'streams should be started');

  // A live tick above VWAP triggers evaluation and an entry.
  streams.handlers.onTick('AAPL', 115, 100, T0);
  await settle();

  assert.equal(broker.orders.length, 1, 'expected exactly one entry order');
  assert.equal(broker.orders[0].side, 'buy');
  const snap = engine.snapshot();
  assert.ok(snap.positions.AAPL, 'expected an open AAPL position');
  assert.equal(snap.positions.AAPL.side, 'long');
  assert.equal(snap.tradesToday, 1);
});

test('position size respects the risk-per-trade and max-position caps', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  // 0.5% of 100k = $500 risk; a 1% stop on a ~$114 price implies ~438 shares,
  // but the 10% max position cap ($10k) limits it to ~87 shares.
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, riskPerTradePct: 0.5, stopLossPct: 1, maxPositionPct: 10 },
    { bars, fillPrice: 114 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 114, 100, T0);
  await settle();

  const qty = broker.orders[0].qty;
  assert.ok(qty * 114 <= 10_000 + 1, `notional ${qty * 114} should respect the 10% cap`);
  assert.ok(qty > 80, `expected roughly 87 shares, got ${qty}`);
});

test('a stop-loss breach closes the position and records the trade', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, stopLossPct: 1, cooldownMinutes: 15 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.ok(engine.snapshot().positions.AAPL);

  // Entry filled at 100, so the stop sits at 99.
  streams.handlers.onTick('AAPL', 98.5, 10, T0 + MINUTE);
  await settle();

  const snap = engine.snapshot();
  assert.equal(snap.positions.AAPL, undefined, 'position should be closed');
  assert.deepEqual(broker.closed, ['AAPL']);
  assert.equal(snap.trades.length, 1);
  assert.equal(snap.trades[0].exitReason, 'stop_loss');
  assert.ok(snap.trades[0].pnl < 0);
  assert.ok(snap.symbols.AAPL.cooldownUntil > T0, 'a cooldown should be set after an exit');
});

test('take profit closes the position for a gain', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, takeProfitPct: 2 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  streams.handlers.onTick('AAPL', 102.5, 10, T0 + MINUTE);
  await settle();

  const snap = engine.snapshot();
  assert.equal(snap.trades.length, 1);
  assert.equal(snap.trades[0].exitReason, 'take_profit');
  assert.ok(snap.trades[0].pnl > 0);
});

test('the cooldown blocks an immediate re-entry', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams, advance } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, stopLossPct: 1, cooldownMinutes: 30 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  streams.handlers.onTick('AAPL', 98.5, 10, T0 + MINUTE);
  await settle();
  assert.equal(broker.orders.length, 1);

  advance(MINUTE);
  streams.handlers.onBar('AAPL', { ...bars.AAPL.at(-1), t: T0 + 2 * MINUTE });
  await settle();

  assert.equal(broker.orders.length, 1, 'no new entry while cooling down');
  const signal = engine.snapshot().signals.AAPL;
  assert.ok(
    signal.blockers.some((b) => b.includes('Cooling down')),
    `expected a cooldown blocker, got ${JSON.stringify(signal.blockers)}`
  );
});

test('max open positions caps concurrent entries', async () => {
  const bars = { AAPL: bullishBars('AAPL'), MSFT: bullishBars('MSFT', 60, 200), NVDA: bullishBars('NVDA', 60, 300) };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL', 'MSFT', 'NVDA'], tradeCrypto: false, maxOpenPositions: 2 },
    { bars }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  streams.handlers.onTick('MSFT', 230, 10, T0);
  await settle();
  streams.handlers.onTick('NVDA', 330, 10, T0);
  await settle();

  assert.equal(Object.keys(engine.snapshot().positions).length, 2);
  assert.equal(broker.orders.length, 2);
});

test('the daily trade cap stops new entries', async () => {
  const bars = { AAPL: bullishBars('AAPL'), MSFT: bullishBars('MSFT', 60, 200) };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL', 'MSFT'], tradeCrypto: false, maxDailyTrades: 1, maxOpenPositions: 5 },
    { bars }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  streams.handlers.onTick('MSFT', 230, 10, T0);
  await settle();

  assert.equal(broker.orders.length, 1, 'only one trade allowed today');
});

test('negative news vetoes an otherwise valid entry', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, newsVetoSentiment: -0.2 },
    {
      bars,
      news: [
        {
          id: 'n1',
          headline: 'Regulators open fraud investigation into Apple; shares plunge on bankruptcy fears',
          summary: 'A lawsuit alleges massive accounting fraud.',
          source: 'test',
          symbols: ['AAPL'],
          createdAt: T0 - MINUTE,
        },
      ],
    }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();

  assert.equal(broker.orders.length, 0, 'hostile news should block the entry');
  const signal = engine.snapshot().signals.AAPL;
  assert.ok(
    signal.blockers.some((b) => b.includes('veto')),
    `expected a news veto, got ${JSON.stringify(signal.blockers)}`
  );
});

test('hostile news closes an open position', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, newsVetoSentiment: -0.2 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.ok(engine.snapshot().positions.AAPL);

  streams.handlers.onNews({
    id: 'n2',
    headline: 'Apple plunges as fraud probe and bankruptcy fears crush the stock',
    summary: 'Massive losses reported; lawsuit filed.',
    source: 'test',
    symbols: ['AAPL'],
    createdAt: T0 + MINUTE,
  });
  await settle();

  const snap = engine.snapshot();
  assert.equal(snap.positions.AAPL, undefined);
  assert.equal(snap.trades[0].exitReason, 'news_veto');
});

test('a closed market blocks stock entries but not crypto', async () => {
  const bars = { AAPL: bullishBars('AAPL'), 'BTC/USD': bullishBars('BTC/USD', 60, 50_000) };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL', 'BTC/USD'], stockSessionOnly: true },
    { bars, isOpen: false }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 120, 10, T0);
  await settle();
  streams.handlers.onTick('BTC/USD', 60_000, 1, T0);
  await settle();

  assert.deepEqual(
    broker.orders.map((o) => o.symbol),
    ['BTC/USD'],
    'only crypto should trade with the market closed'
  );
  assert.ok(engine.snapshot().signals.AAPL.blockers.includes('Market closed'));
});

test('crypto orders are submitted with the crypto asset class and fractional qty', async () => {
  const bars = { 'BTC/USD': bullishBars('BTC/USD', 60, 50_000) };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['BTC/USD'], tradeStocks: false, riskPerTradePct: 1, stopLossPct: 1 },
    { bars, isOpen: false }
  );
  await engine.start();
  streams.handlers.onTick('BTC/USD', 60_000, 1, T0);
  await settle();

  assert.equal(broker.orders.length, 1);
  assert.equal(broker.orders[0].assetClass, 'crypto');
  assert.ok(broker.orders[0].qty > 0 && broker.orders[0].qty < 1, 'expected a fractional BTC quantity');
});

test('a stale price feed blocks entry', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams, advance } = makeEngine({ watchlist: ['AAPL'], tradeCrypto: false }, { bars });
  await engine.start();
  // Tick, then jump the clock forward so the tick is 10 minutes old.
  streams.handlers.onTick('AAPL', 115, 10, T0 - 10 * MINUTE);
  await settle();
  advance(0);

  assert.equal(broker.orders.length, 0);
  assert.ok(engine.snapshot().signals.AAPL.blockers.includes('Price feed stale'));
});

test('the max signal score gate is respected', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, minSignalScore: 100 },
    { bars }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();

  assert.equal(broker.orders.length, 0, 'an unreachable score threshold should block everything');
  assert.ok(engine.snapshot().signals.AAPL.score < 100);
});

test('positions opened outside the engine are adopted with managed exits', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  // Seed a broker-side position before the engine starts.
  const { engine: e2, broker: b2, streams: s2 } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, minSignalScore: 100 },
    { bars }
  );
  b2.positions.push({
    symbol: 'AAPL',
    assetClass: 'stock',
    qty: 10,
    side: 'long',
    avgEntryPrice: 100,
    marketValue: 1000,
    unrealizedPnl: 0,
  });
  await e2.start();
  const pos = e2.snapshot().positions.AAPL;
  assert.ok(pos, 'the broker position should be adopted');
  assert.equal(pos.managed, false);
  assert.ok(pos.stopPrice > 0 && pos.takeProfitPrice > 0, 'adopted positions get exit levels');

  // And it is then managed: a stop breach closes it.
  s2.handlers.onTick('AAPL', 90, 10, T0);
  await settle();
  assert.equal(e2.snapshot().positions.AAPL, undefined);
});

test('a failed entry order is logged and leaves no phantom position', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams } = makeEngine({ watchlist: ['AAPL'], tradeCrypto: false }, { bars, failOrders: true });
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();

  const snap = engine.snapshot();
  assert.equal(snap.positions.AAPL, undefined);
  assert.ok(
    snap.activity.some((e) => e.level === 'error' && e.message.includes('Entry failed')),
    'the failure should be logged'
  );
});

test('stop(flatten) closes everything', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine({ watchlist: ['AAPL'], tradeCrypto: false }, { bars, fillPrice: 100 });
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.ok(engine.snapshot().positions.AAPL);

  await engine.stop('manual', true);
  await settle();

  assert.deepEqual(broker.closed, ['AAPL']);
  assert.equal(engine.snapshot().status, 'stopped');
  assert.equal(streams.started, false);
});

test('max hold time closes a position that goes nowhere', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams, advance } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, maxHoldMinutes: 10, trailingStopPct: 0 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();

  advance(11 * MINUTE);
  streams.handlers.onTick('AAPL', 100.1, 10, T0 + 11 * MINUTE);
  await settle();

  assert.equal(engine.snapshot().trades[0].exitReason, 'max_hold');
});

test('the trailing stop locks in a gain after price runs up', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, trailingStopPct: 1, takeProfitPct: 10, stopLossPct: 5 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();

  streams.handlers.onTick('AAPL', 105, 10, T0 + MINUTE); // arms the trail, high water 105
  await settle();
  streams.handlers.onTick('AAPL', 103.5, 10, T0 + 2 * MINUTE); // 1% below 105 is 103.95
  await settle();

  const trade = engine.snapshot().trades[0];
  assert.equal(trade.exitReason, 'trailing_stop');
  assert.ok(trade.pnl > 0, 'the trail should exit in profit');
});

test('parameter updates re-price stops on open positions', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, stopLossPct: 5, trailingStopPct: 0 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.equal(engine.snapshot().positions.AAPL.stopPrice, 95);

  engine.setParameters(normalizeParameters({ ...engine.getParameters(), stopLossPct: 2 }));
  assert.equal(engine.snapshot().positions.AAPL.stopPrice, 98);
});

test('the daily loss limit flattens and halts', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, maxDailyLossPct: 2 },
    { bars, fillPrice: 100 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.ok(engine.snapshot().positions.AAPL);

  // Equity drops 3% against a 2% limit.
  broker.equity = 97_000;
  await engine.housekeeping();
  await settle();

  const snap = engine.snapshot();
  assert.equal(snap.status, 'halted');
  assert.ok(broker.closed.includes('AAPL'));
  assert.ok(
    snap.activity.some((e) => e.message.includes('Daily loss limit')),
    'the halt should be logged'
  );
});

test('stock positions are flattened before the close', async () => {
  const bars = { AAPL: bullishBars('AAPL') };
  const { engine, broker, streams, setNow } = makeEngine(
    { watchlist: ['AAPL'], tradeCrypto: false, flattenBeforeCloseMinutes: 10, trailingStopPct: 0, maxHoldMinutes: 0 },
    // Fill at the same price the tick arrives at, so neither the stop nor the
    // target is already breached and the pre-close flatten is what fires.
    { bars, fillPrice: 115 }
  );
  await engine.start();
  streams.handlers.onTick('AAPL', 115, 10, T0);
  await settle();
  assert.ok(engine.snapshot().positions.AAPL, 'expected a position to manage into the close');

  // The fake clock closes at T0 + 60m; jump to 5 minutes before that.
  setNow(T0 + 55 * MINUTE);
  await engine.housekeeping();
  await settle();

  assert.ok(broker.closed.includes('AAPL'));
  assert.equal(engine.snapshot().trades[0].exitReason, 'market_close');
});
