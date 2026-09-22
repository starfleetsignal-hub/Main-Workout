#!/usr/bin/env node
/**
 * Headless runner: the same engine the app uses, driven from a terminal.
 *
 *   npm run headless -- --paper
 *
 * Useful for leaving the engine running on a machine that stays awake, or for
 * watching its decisions in a log. It is gated by the same license check as
 * the app, so it is not a way around the paywall.
 *
 * Environment:
 *   ALPACA_KEY_ID, ALPACA_SECRET_KEY   required
 *   ALPACA_MODE=paper|live             default paper
 *   ALPACA_FEED=iex|sip                default iex
 *   TRADERUNNER_LICENSE                your license key
 *   EXPO_PUBLIC_LICENSE_PUBLIC_KEY     or a .env file with it
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublicKeyHex, parseArgs, verifyLicense } from '../tools/license/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = parseArgs(process.argv.slice(2));

// Load .env so the runner works the same way the app build does.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const distDir = path.join(root, 'dist-esm');
if (!existsSync(path.join(distDir, 'engine', 'engine.js'))) {
  console.error('Engine build missing. Run:  npx tsc -p tsconfig.node.json');
  process.exit(1);
}

// --- license gate ------------------------------------------------------------
const licenseKey = process.env.TRADERUNNER_LICENSE ?? (args.license ? String(args.license) : '');
const publicKeyHex = loadPublicKeyHex();
if (!publicKeyHex) {
  console.error('No license public key. Run "npm run license:keygen" or set EXPO_PUBLIC_LICENSE_PUBLIC_KEY.');
  process.exit(1);
}
if (!licenseKey) {
  console.error('No license key. Set TRADERUNNER_LICENSE=TR1.… (or pass --license).');
  process.exit(1);
}
const licenseCheck = verifyLicense(licenseKey, publicKeyHex);
if (!licenseCheck.ok) {
  console.error(`License rejected: ${licenseCheck.reason}`);
  process.exit(1);
}
console.log(`License OK — ${licenseCheck.payload.sub} (${licenseCheck.payload.plan})`);

// --- broker credentials ------------------------------------------------------
const keyId = process.env.ALPACA_KEY_ID ?? '';
const secretKey = process.env.ALPACA_SECRET_KEY ?? '';
if (!keyId || !secretKey) {
  console.error('Set ALPACA_KEY_ID and ALPACA_SECRET_KEY.');
  process.exit(1);
}
const mode = args.live ? 'live' : (process.env.ALPACA_MODE ?? 'paper') === 'live' && !args.paper ? 'live' : 'paper';
const feed = String(process.env.ALPACA_FEED ?? 'iex') === 'sip' ? 'sip' : 'iex';

const { AlpacaClient } = await import(path.join(distDir, 'broker/alpaca/rest.js'));
const { AlpacaStreams } = await import(path.join(distDir, 'broker/alpaca/stream.js'));
const { TradingEngine } = await import(path.join(distDir, 'engine/engine.js'));
const { normalizeParameters, DEFAULT_PARAMETERS } = await import(path.join(distDir, 'engine/parameters.js'));

let params = normalizeParameters(DEFAULT_PARAMETERS);
if (args.params) {
  const file = path.resolve(process.cwd(), String(args.params));
  params = normalizeParameters(JSON.parse(readFileSync(file, 'utf8')));
  console.log(`Loaded parameters from ${file}`);
}
if (args.symbols) {
  params = normalizeParameters({ ...params, watchlist: String(args.symbols).split(',') });
}

const creds = { keyId, secretKey, mode, feed };
const engine = new TradingEngine({ broker: new AlpacaClient(creds), streams: new AlpacaStreams(creds) }, params);

console.log(`Mode: ${mode.toUpperCase()}  Feed: ${feed.toUpperCase()}`);
console.log(`Watchlist: ${params.watchlist.join(', ')}`);
if (mode === 'live') console.log('*** LIVE MODE — real orders with real money ***');

let lastEventId = null;
engine.subscribe((snap) => {
  // Print only new activity, newest-last, so the log reads chronologically.
  const fresh = [];
  for (const ev of snap.activity) {
    if (ev.id === lastEventId) break;
    fresh.unshift(ev);
  }
  if (fresh.length) {
    lastEventId = snap.activity[0].id;
    for (const ev of fresh) {
      const t = new Date(ev.at).toISOString().slice(11, 19);
      console.log(`${t} ${ev.level.padEnd(6)} ${(ev.symbol ?? '').padEnd(8)} ${ev.message}`);
    }
  }
});

const shutdown = async (signal) => {
  console.log(`\n${signal} — stopping engine (positions are left open; use --flatten-on-exit to close them).`);
  await engine.stop('manual', Boolean(args['flatten-on-exit']));
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await engine.start();
