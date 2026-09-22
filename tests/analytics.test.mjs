import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { computeMaxDrawdown, computeTradeStats, computePerformanceStats, downsampleEquity } = await import(
  path.join(root, 'dist-esm/engine/analytics.js')
);

function eq(t, equity) {
  return { t, equity };
}

function trade(pnl) {
  return { pnl, pnlPct: null };
}

test('max drawdown is zero for a rising equity curve', () => {
  const history = [eq(0, 100), eq(1, 110), eq(2, 130)];
  assert.equal(computeMaxDrawdown(history).maxDrawdownPct, 0);
});

test('max drawdown measures peak to trough, not start to trough', () => {
  const history = [eq(0, 100), eq(1, 200), eq(2, 150), eq(3, 180)];
  const { maxDrawdownPct, peakEquity } = computeMaxDrawdown(history);
  assert.equal(peakEquity, 200);
  assert.ok(Math.abs(maxDrawdownPct - 25) < 1e-9, `expected 25%, got ${maxDrawdownPct}`);
});

test('max drawdown finds the worst of several drawdowns', () => {
  const history = [eq(0, 100), eq(1, 120), eq(2, 90), eq(3, 150), eq(4, 60)];
  // Second drawdown: 150 -> 60 is 60%, worse than the first (120 -> 90 = 25%).
  const { maxDrawdownPct } = computeMaxDrawdown(history);
  assert.ok(Math.abs(maxDrawdownPct - 60) < 1e-9, `expected 60%, got ${maxDrawdownPct}`);
});

test('max drawdown on an empty or single-point history is zero', () => {
  assert.equal(computeMaxDrawdown([]).maxDrawdownPct, 0);
  assert.equal(computeMaxDrawdown([eq(0, 100)]).maxDrawdownPct, 0);
});

test('trade stats separate wins from losses correctly', () => {
  const trades = [trade(100), trade(-40), trade(60), trade(-20), trade(null)];
  const stats = computeTradeStats(trades);
  assert.equal(stats.closedTrades, 4, 'the open trade (pnl null) should be excluded');
  assert.equal(stats.winRate, 50);
  assert.equal(stats.avgWin, 80);
  assert.equal(stats.avgLoss, 30);
  assert.equal(stats.netPnl, 100);
  // profit factor = gross win / gross loss = 160 / 60
  assert.ok(Math.abs(stats.profitFactor - 160 / 60) < 1e-9);
});

test('trade stats with no losses report an infinite profit factor', () => {
  const stats = computeTradeStats([trade(50), trade(30)]);
  assert.equal(stats.profitFactor, Infinity);
  assert.equal(stats.avgLoss, 0);
});

test('trade stats with no closed trades are all zero, not NaN', () => {
  const stats = computeTradeStats([trade(null)]);
  assert.deepEqual(stats, { profitFactor: 0, avgWin: 0, avgLoss: 0, winRate: 0, closedTrades: 0, netPnl: 0 });
});

test('total return reads from the first and last equity points', () => {
  const history = [eq(0, 100), eq(1, 90), eq(2, 110)];
  const stats = computePerformanceStats(history, []);
  assert.ok(Math.abs(stats.totalReturnPct - 10) < 1e-9);
});

test('downsampling keeps the array under the cap and preserves both endpoints', () => {
  const history = Array.from({ length: 500 }, (_, i) => eq(i, 100 + i));
  const out = downsampleEquity(history, 50);
  assert.ok(out.length <= 50);
  assert.equal(out[0].t, 0);
  assert.equal(out[out.length - 1].t, 499);
});

test('downsampling is a no-op when already under the cap', () => {
  const history = [eq(0, 100), eq(1, 101)];
  assert.deepEqual(downsampleEquity(history, 50), history);
});
