import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { ema, rsi, atr, vwap, averageVolume, computeIndicators, sessionStartFor } = await import(pathToFileURL(path.join(root, 'dist-esm/engine/indicators.js')).href);

function bars(closes, volume = 1000) {
  return closes.map((c, i) => ({
    t: Date.UTC(2026, 0, 5, 15, i, 0),
    o: c,
    h: c + 0.5,
    l: c - 0.5,
    c,
    v: volume,
  }));
}

test('ema converges toward a constant series', () => {
  const out = ema([10, 10, 10, 10, 10], 3);
  assert.equal(out.length, 5);
  for (const v of out) assert.equal(v, 10);
});

test('ema reacts faster than a longer period', () => {
  const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const fast = ema(series, 3).at(-1);
  const slow = ema(series, 9).at(-1);
  assert.ok(fast > slow, `expected fast EMA ${fast} above slow EMA ${slow} in an uptrend`);
});

test('rsi is 100 for a monotonic rise and low for a fall', () => {
  const rising = Array.from({ length: 30 }, (_, i) => 100 + i);
  assert.equal(rsi(rising, 14), 100);
  const falling = Array.from({ length: 30 }, (_, i) => 100 - i);
  assert.ok(rsi(falling, 14) < 1, 'a monotonic decline should pin RSI near zero');
});

test('rsi returns NaN without enough data', () => {
  assert.ok(Number.isNaN(rsi([1, 2, 3], 14)));
});

test('atr measures the average true range', () => {
  // Every bar spans exactly 1.0 and closes flat, so TR is 1.0 throughout.
  const flat = Array.from({ length: 20 }, (_, i) => ({
    t: i * 60000,
    o: 10,
    h: 10.5,
    l: 9.5,
    c: 10,
    v: 1,
  }));
  assert.ok(Math.abs(atr(flat, 14) - 1) < 1e-9);
});

test('vwap weights by volume', () => {
  const two = [
    { t: 0, o: 10, h: 10, l: 10, c: 10, v: 1 },
    { t: 60000, o: 20, h: 20, l: 20, c: 20, v: 3 },
  ];
  // (10*1 + 20*3) / 4 = 17.5
  assert.equal(vwap(two, null), 17.5);
});

test('vwap ignores bars before the session start', () => {
  const session = Date.UTC(2026, 0, 5, 14, 30);
  const list = [
    { t: session - 60_000, o: 1, h: 1, l: 1, c: 1, v: 1000 },
    { t: session + 60_000, o: 50, h: 50, l: 50, c: 50, v: 10 },
  ];
  assert.equal(vwap(list, session), 50);
});

test('averageVolume excludes the last bar by default', () => {
  const list = bars([1, 1, 1], 100);
  list[list.length - 1].v = 999999;
  assert.equal(averageVolume(list, 20, true), 100);
});

test('computeIndicators needs a minimum history', () => {
  assert.equal(computeIndicators(bars([1, 2, 3]), false), null);
});

test('computeIndicators detects a fresh bullish cross', () => {
  // Long decline then a sharp rally: the fast EMA crosses above the slow one at the end.
  const closes = [
    ...Array.from({ length: 30 }, (_, i) => 100 - i * 0.5),
    ...Array.from({ length: 6 }, (_, i) => 85.5 + i * 3),
  ];
  const ind = computeIndicators(bars(closes), false);
  assert.ok(ind, 'expected indicators');
  assert.equal(ind.recentCross, 1);
  assert.ok(ind.ema9 > ind.ema21);
});

test('sessionStartFor returns null for crypto and a 24h-bounded time for stocks', () => {
  assert.equal(sessionStartFor(Date.now(), true), null);
  const t = Date.UTC(2026, 6, 15, 18, 0); // mid-July, DST in effect
  const start = sessionStartFor(t, false);
  assert.equal(new Date(start).getUTCHours(), 13);
  assert.equal(new Date(start).getUTCMinutes(), 30);
});
