#!/usr/bin/env node
/**
 * Backtest CLI: replays historical bars through the real trading engine
 * (see backtest/harness.mjs) and prints a performance report.
 *
 *   npm run backtest -- --bars-file tests/fixtures/aapl-2026-01.json
 *   npm run backtest -- --symbols AAPL,BTC/USD --key-id ... --secret-key ...
 *
 * Bar file format: { "AAPL": [{"t":..,"o":..,"h":..,"l":..,"c":..,"v":..}, ...], "BTC/USD": [...] }
 * ("t" as epoch ms or an ISO string; symbols use "BTC/USD"-style slashes for crypto, plain tickers for stocks.)
 *
 * Alpaca mode pulls the most recent `--limit` one-minute bars per symbol
 * (Alpaca's REST bars endpoint only returns a recent window per call — this
 * is a quick way to backtest against real recent data, not an arbitrary
 * historical date-range fetch).
 *
 * No historical news is simulated in either mode — see the limitations
 * documented at the top of backtest/harness.mjs.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from './license/lib.mjs';

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

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args['bars-file'] && !args.symbols)) {
  console.log('Usage:');
  console.log('  npm run backtest -- --bars-file <path.json> [--params <path.json>] [--cash 100000] [--json]');
  console.log('  npm run backtest -- --symbols AAPL,BTC/USD --key-id <id> --secret-key <key> [--mode paper|live]');
  console.log('                       [--feed iex|sip] [--limit 1000] [--params <path.json>] [--cash 100000] [--json]');
  process.exit(args.help ? 0 : 1);
}

if (!existsSync(path.join(distDir, 'engine/engine.js'))) {
  console.error('Engine build missing. Run:  node tools/build-node.mjs');
  process.exit(1);
}

function parseBarFileEntry(raw) {
  return {
    t: typeof raw.t === 'string' ? Date.parse(raw.t) : Number(raw.t),
    o: Number(raw.o),
    h: Number(raw.h),
    l: Number(raw.l),
    c: Number(raw.c),
    v: Number(raw.v ?? 0),
  };
}

async function loadBars() {
  if (args['bars-file']) {
    const file = path.resolve(process.cwd(), String(args['bars-file']));
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const barsBySymbol = {};
    for (const [symbol, list] of Object.entries(raw)) {
      barsBySymbol[symbol] = (list ?? []).map(parseBarFileEntry);
    }
    return barsBySymbol;
  }

  const keyId = process.env.ALPACA_KEY_ID ?? (args['key-id'] ? String(args['key-id']) : '');
  const secretKey = process.env.ALPACA_SECRET_KEY ?? (args['secret-key'] ? String(args['secret-key']) : '');
  if (!keyId || !secretKey) {
    console.error('Set --key-id/--secret-key (or ALPACA_KEY_ID/ALPACA_SECRET_KEY) to pull bars from Alpaca.');
    process.exit(1);
  }
  const mode = String(args.mode ?? 'paper') === 'live' ? 'live' : 'paper';
  const feed = String(args.feed ?? 'iex') === 'sip' ? 'sip' : 'iex';
  const limit = Math.max(1, Number(args.limit ?? 1000));

  const { AlpacaClient } = await importPath(distDir, 'broker/alpaca/rest.js');
  const { assetClassOf } = await importPath(distDir, 'broker/alpaca/symbols.js');
  const client = new AlpacaClient({ keyId, secretKey, mode, feed });

  const symbols = String(args.symbols).split(',').map((s) => s.trim()).filter(Boolean);
  const barsBySymbol = {};
  for (const symbol of symbols) {
    console.log(`Fetching ${limit} bars for ${symbol}…`);
    barsBySymbol[symbol] = await client.getBars(symbol, assetClassOf(symbol), limit);
  }
  return barsBySymbol;
}

const barsBySymbol = await loadBars();
const symbolCounts = Object.entries(barsBySymbol).map(([s, b]) => `${s} (${b.length} bars)`);
if (!args.json) console.log(`Loaded: ${symbolCounts.join(', ')}`);

let params = {};
if (args.params) {
  const file = path.resolve(process.cwd(), String(args.params));
  params = JSON.parse(readFileSync(file, 'utf8'));
}

const { runBacktest } = await importPath(root, 'backtest/harness.mjs');

const result = await runBacktest({
  barsBySymbol,
  params,
  startingCash: Number(args.cash ?? 100_000),
  warmupBars: args.warmup ? Number(args.warmup) : undefined,
  housekeepingEveryMinutes: args['housekeeping-every'] ? Number(args['housekeeping-every']) : undefined,
});

if (args.json) {
  console.log(JSON.stringify({ stats: result.stats, trades: result.trades }, null, 2));
  process.exit(0);
}

const s = result.stats;
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n) => `$${n.toFixed(2)}`;

console.log('');
console.log('=== Backtest report ===');
console.log(`Total return      ${pct(s.totalReturnPct)}`);
console.log(`Max drawdown      ${s.maxDrawdownPct.toFixed(2)}%`);
console.log(`Closed trades     ${s.closedTrades}`);
console.log(`Win rate          ${s.winRate.toFixed(1)}%`);
console.log(`Profit factor     ${Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}`);
console.log(`Avg win / loss    ${money(s.avgWin)} / ${money(s.avgLoss)}`);
console.log(`Net P&L           ${money(s.netPnl)}`);
console.log('');
console.log(`Trades (${result.trades.length}):`);
for (const t of [...result.trades].reverse()) {
  const opened = new Date(t.openedAt).toISOString();
  const pnl = t.pnl === null ? 'open' : `${pct(t.pnlPct * 100)} (${money(t.pnl)})`;
  console.log(`  ${opened}  ${t.symbol.padEnd(10)} ${t.side.padEnd(5)} ${String(t.qty).padEnd(10)} ${pnl}  ${t.exitReason ?? ''}`);
}
