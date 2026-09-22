import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { runBacktest } = await import(path.join(root, 'backtest/harness.mjs'));

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 0, 5, 15, 0, 0); // a Monday, mid-session
const SATURDAY_NIGHT = Date.UTC(2026, 0, 3, 3, 0, 0); // well outside any stock session

/** A smooth, proportional uptrend — bar i is `stepPct` above bar i-1. */
function trendBars(count, { start = 100, stepPct = 0.0025, t0 = T0 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const c = start * (1 + i * stepPct);
    out.push({ t: t0 + i * MINUTE, o: c * 0.999, h: c * 1.0015, l: c * 0.998, c, v: 10_000 });
  }
  return out;
}

/** A flat, directionless series — no trend for VWAP/EMA to reward either side. */
function flatBars(count, { price = 100, t0 = T0 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    // Tiny alternating wobble so it isn't perfectly constant, without any drift.
    const c = price * (1 + (i % 2 === 0 ? 0.0002 : -0.0002));
    out.push({ t: t0 + i * MINUTE, o: c, h: c * 1.0005, l: c * 0.9995, c, v: 8_000 });
  }
  return out;
}

// The strategy scorer (src/engine/strategy.ts) is exercised by its own tests
// elsewhere; a smooth synthetic uptrend replayed bar-by-bar naturally scores
// in the 50s (RSI pins near 100 and volume never spikes), below the default
// minSignalScore of 65. These tests lower it so a clean uptrend reliably
// enters — the point here is to prove the harness wiring (sizing, fills,
// exits, reconciliation, equity/stat accounting), not to re-litigate scoring.
const RELAXED_SCORE = { minSignalScore: 40 };

test('a sustained uptrend produces winning long trades and a positive return', async () => {
  const bars = trendBars(400);
  const result = await runBacktest({
    barsBySymbol: { AAPL: bars },
    warmupBars: 40,
    params: { tradeCrypto: false, stockSessionOnly: false, skipOpeningMinutes: 0, ...RELAXED_SCORE },
  });

  assert.ok(result.trades.length > 0, 'expected at least one trade');
  assert.ok(
    result.trades.every((t) => t.side === 'long'),
    'shorts are not modeled by the backtest broker'
  );
  assert.ok(result.stats.winRate > 0, 'a clean uptrend should produce winners');
  assert.ok(result.stats.totalReturnPct > 0, `expected a positive return, got ${result.stats.totalReturnPct}`);
  assert.ok(result.snapshot.equityHistory.length >= 2, 'expected recorded equity samples');
  assert.equal(result.snapshot.status, 'stopped');
});

test('a flat, directionless market produces no trades', async () => {
  const bars = flatBars(400);
  const result = await runBacktest({
    barsBySymbol: { AAPL: bars },
    warmupBars: 40,
    params: { tradeCrypto: false, stockSessionOnly: false, skipOpeningMinutes: 0 },
  });

  assert.equal(result.trades.length, 0);
  assert.equal(result.stats.closedTrades, 0);
  assert.equal(result.stats.totalReturnPct, 0);
});

test('a sharp reversal after entry is closed by the stop-loss guard, recorded as a loss', async () => {
  const warmup = 40;
  const rising = trendBars(warmup + 1);
  const entryClose = rising[rising.length - 1].c;
  const crashClose = entryClose * 0.95; // well past the 0.8% default stop
  const t0 = T0 + (warmup + 1) * MINUTE;
  const crashBar = { t: t0, o: crashClose * 1.01, h: crashClose * 1.02, l: crashClose * 0.99, c: crashClose, v: 10_000 };
  const tail = [1, 2].map((i) => ({
    t: t0 + i * MINUTE,
    o: crashClose,
    h: crashClose * 1.002,
    l: crashClose * 0.998,
    c: crashClose,
    v: 10_000,
  }));

  const result = await runBacktest({
    barsBySymbol: { AAPL: [...rising, crashBar, ...tail] },
    warmupBars: warmup,
    params: { tradeCrypto: false, stockSessionOnly: false, skipOpeningMinutes: 0, ...RELAXED_SCORE },
  });

  assert.equal(result.trades.length, 1, 'expected exactly one trade (re-entry blocked by cooldown)');
  const [trade] = result.trades;
  assert.equal(trade.exitReason, 'stop_loss');
  assert.ok(trade.pnl < 0, `expected a loss, got ${trade.pnl}`);
  assert.ok(result.stats.maxDrawdownPct > 0, 'expected the loss to register as drawdown');
});

test('crypto trades outside stock market hours, unblocked by the session clock', async () => {
  const bars = trendBars(70, { start: 30_000, stepPct: 0.003, t0: SATURDAY_NIGHT });
  const result = await runBacktest({
    barsBySymbol: { 'BTC/USD': bars },
    warmupBars: 40,
    params: { tradeStocks: false, ...RELAXED_SCORE },
  });

  assert.ok(result.trades.length > 0, 'crypto should trade regardless of the (stock) session clock');
  assert.ok(
    result.trades.every((t) => t.assetClass === 'crypto'),
    'expected BTC/USD to be classified as crypto'
  );
  assert.equal(result.snapshot.clock.isOpen, true, 'a crypto-only backtest should report an always-open clock');
});

test('fewer bars than the warm-up window does not crash and simply never trades', async () => {
  const bars = Array.from({ length: 10 }, (_, i) => ({
    t: T0 + i * MINUTE,
    o: 100,
    h: 101,
    l: 99,
    c: 100,
    v: 1000,
  }));
  const result = await runBacktest({ barsBySymbol: { AAPL: bars } });

  assert.equal(result.trades.length, 0);
  assert.equal(result.snapshot.status, 'stopped');
  assert.ok(result.snapshot.equityHistory.length >= 1);
});

test('two symbols replayed in interleaved chronological order can both trade', async () => {
  const warmup = 40;
  const aapl = trendBars(warmup + 60, { start: 100, t0: T0 });
  const msft = trendBars(warmup + 60, { start: 300, t0: T0 });

  const result = await runBacktest({
    barsBySymbol: { AAPL: aapl, MSFT: msft },
    warmupBars: warmup,
    params: {
      tradeCrypto: false,
      stockSessionOnly: false,
      skipOpeningMinutes: 0,
      maxOpenPositions: 3,
      ...RELAXED_SCORE,
    },
  });

  const symbolsTraded = new Set(result.trades.map((t) => t.symbol));
  assert.ok(symbolsTraded.has('AAPL'), 'expected at least one AAPL trade');
  assert.ok(symbolsTraded.has('MSFT'), 'expected at least one MSFT trade');
});

test('runBacktest rejects an empty bar set', async () => {
  await assert.rejects(() => runBacktest({ barsBySymbol: {} }), /at least one symbol/);
});

test('the returned stats match computePerformanceStats over the returned snapshot', async () => {
  const { computePerformanceStats } = await import(path.join(root, 'dist-esm/engine/analytics.js'));
  const bars = trendBars(400);
  const result = await runBacktest({
    barsBySymbol: { AAPL: bars },
    warmupBars: 40,
    params: { tradeCrypto: false, stockSessionOnly: false, skipOpeningMinutes: 0, ...RELAXED_SCORE },
  });

  const recomputed = computePerformanceStats(result.snapshot.equityHistory, result.snapshot.trades);
  assert.deepEqual(result.stats, recomputed);
});
