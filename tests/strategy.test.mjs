/**
 * Direct unit tests for the entry scoring model (src/engine/strategy.ts),
 * built by handing evaluateEntry a synthetic SymbolState rather than
 * replaying bars — the point here is the scoring logic itself, in
 * particular the 'trend' vs 'dip' entryStyle switch, which the backtest
 * suite (tests/backtest.test.mjs) proves out end-to-end separately.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { evaluateEntry } = await import(pathToFileURL(path.join(root, 'dist-esm/engine/strategy.js')).href);
const { normalizeParameters } = await import(pathToFileURL(path.join(root, 'dist-esm/engine/parameters.js')).href);

const NOW = Date.UTC(2026, 0, 5, 15, 0, 0);

function state(overrides = {}) {
  return {
    symbol: 'SOL/USDC',
    assetClass: 'crypto',
    bars: [],
    lastPrice: 100,
    lastTickAt: NOW,
    indicators: {
      ema9: 101,
      ema21: 100,
      rsi14: 60,
      vwap: 98,
      atr14: 1,
      avgVolume20: 100,
      lastVolume: 150,
      recentCross: 1,
    },
    news: [],
    newsScore: 0,
    cooldownUntil: 0,
    ...overrides,
  };
}

function params(overrides = {}) {
  return normalizeParameters({
    watchlist: ['SOL/USDC'],
    tradeCrypto: true,
    tradeStocks: false,
    requireNewsConfirmation: false,
    minSignalScore: 70,
    ...overrides,
  });
}

test('trend mode enters on a breakout: price above VWAP with a fresh bullish cross', () => {
  const st = state({ indicators: { ...state().indicators, vwap: 98 } }); // lastPrice 100 > vwap 98
  const signal = evaluateEntry(st, params({ entryStyle: 'trend' }), null, NOW);
  assert.equal(signal.side, 'long');
  assert.ok(signal.score >= 70, `expected a high score, got ${signal.score}`);
});

test('trend mode scores the same setup far lower once price is below VWAP', () => {
  const st = state({ indicators: { ...state().indicators, vwap: 105 } }); // lastPrice 100 < vwap 105
  const trendSignal = evaluateEntry(st, params({ entryStyle: 'trend' }), null, NOW);
  assert.notEqual(trendSignal.side, 'long');
});

test('dip mode enters on a discount: price below VWAP with the same fresh bullish cross', () => {
  const st = state({
    indicators: { ...state().indicators, vwap: 105, rsi14: 30 }, // lastPrice 100 < vwap 105, oversold-ish RSI
  });
  const signal = evaluateEntry(st, params({ entryStyle: 'dip', rsiMin: 20, rsiMax: 42 }), null, NOW);
  assert.equal(signal.side, 'long');
  assert.ok(signal.score >= 70, `expected a high score, got ${signal.score}`);
});

test('dip mode scores the same breakout setup far lower once price is above VWAP', () => {
  const st = state({ indicators: { ...state().indicators, vwap: 98, rsi14: 30 } }); // lastPrice 100 > vwap 98
  const dipSignal = evaluateEntry(st, params({ entryStyle: 'dip', rsiMin: 20, rsiMax: 42 }), null, NOW);
  assert.notEqual(dipSignal.side, 'long');
});

test('dip mode still requires a fresh bullish cross — it does not buy a price that is still falling', () => {
  const st = state({
    indicators: { ...state().indicators, vwap: 105, rsi14: 30, recentCross: 0, ema9: 99, ema21: 100 },
  });
  const signal = evaluateEntry(st, params({ entryStyle: 'dip', rsiMin: 20, rsiMax: 42 }), null, NOW);
  assert.notEqual(signal.side, 'long');
});

test('an unset/invalid entryStyle normalizes to trend, matching all existing presets', () => {
  const p = normalizeParameters({ watchlist: ['SOL/USDC'] });
  assert.equal(p.entryStyle, 'trend');
  const p2 = normalizeParameters({ watchlist: ['SOL/USDC'], entryStyle: 'sideways' });
  assert.equal(p2.entryStyle, 'trend');
});
