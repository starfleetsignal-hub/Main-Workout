#!/usr/bin/env node
/**
 * Headless runner: the same engine the app uses, driven from a terminal.
 *
 *   npm run headless -- --paper                                  # Alpaca, via env vars below
 *   npm run headless -- --creds-file jupiter-creds.json           # any venue
 *
 * Useful for leaving the engine running on a machine that stays awake, or for
 * watching its decisions in a log. It is gated by the same license check as
 * the app, so it is not a way around the paywall.
 *
 * It is also the way around a real limitation of the web build: some venue
 * APIs (Jupiter's quote API among them) do not send CORS headers, so a
 * browser refuses to let the app call them at all — that is a browser-only
 * restriction, not a network problem, and it does not exist here since
 * Node's fetch does not enforce CORS.
 *
 * --creds-file points at a JSON file shaped like this app's own credential
 * object: {"venue":"jupiter","privateKey":"...","rpcUrl":"...","slippageBps":"50"}
 * (venue is one of alpaca, coinbase, robinhood, uphold, jupiter — see each
 * venue's descriptor in src/broker/registry.ts for its exact field names).
 * Keep that file out of version control the same way you would a live API key.
 *
 * Environment:
 *   ALPACA_KEY_ID, ALPACA_SECRET_KEY   Alpaca shorthand; ignored if --creds-file is set
 *   ALPACA_MODE=paper|live             default paper
 *   ALPACA_FEED=iex|sip                default iex
 *   TRADERUNNER_LICENSE                your license key
 *   EXPO_PUBLIC_LICENSE_PUBLIC_KEY     or a .env file with it
 *   CONTROL_TOKEN, CONTROL_PORT        optional local kill-switch server;
 *                                      see headless/control-server.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPublicKeyHex, parseArgs, verifyLicense } from '../tools/license/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * A bare Windows path (e.g. "C:\...") passed to import() throws
 * ERR_UNSUPPORTED_ESM_URL_SCHEME — Node's ESM loader treats the drive
 * letter as a URL scheme. file:// URLs work on every OS, so build one
 * instead of relying on the loader to accept a raw filesystem path.
 */
const importPath = (...segments) => import(pathToFileURL(path.join(...segments)).href);

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
const { createConnection } = await importPath(distDir, 'broker/registry.js');
const { TradingEngine } = await importPath(distDir, 'engine/engine.js');
const { normalizeParameters, DEFAULT_PARAMETERS } = await importPath(distDir, 'engine/parameters.js');

let creds;
let mode = 'paper';
if (args['creds-file']) {
  const file = path.resolve(process.cwd(), String(args['creds-file']));
  creds = JSON.parse(readFileSync(file, 'utf8'));
  if (!creds.venue) {
    console.error(`${file} needs a "venue" field (alpaca, coinbase, robinhood, uphold, or jupiter).`);
    process.exit(1);
  }
  mode = args.live ? 'live' : creds.mode ?? 'paper';
  creds.mode = mode;
  console.log(`Loaded ${creds.venue} credentials from ${file}`);
} else {
  const keyId = process.env.ALPACA_KEY_ID ?? '';
  const secretKey = process.env.ALPACA_SECRET_KEY ?? '';
  if (!keyId || !secretKey) {
    console.error('Set ALPACA_KEY_ID and ALPACA_SECRET_KEY, or pass --creds-file for another venue.');
    process.exit(1);
  }
  mode = args.live ? 'live' : (process.env.ALPACA_MODE ?? 'paper') === 'live' && !args.paper ? 'live' : 'paper';
  const feed = String(process.env.ALPACA_FEED ?? 'iex') === 'sip' ? 'sip' : 'iex';
  creds = { venue: 'alpaca', keyId, secretKey, mode, feed };
}

let params = normalizeParameters(DEFAULT_PARAMETERS);
if (args.params) {
  const file = path.resolve(process.cwd(), String(args.params));
  params = normalizeParameters(JSON.parse(readFileSync(file, 'utf8')));
  console.log(`Loaded parameters from ${file}`);
}
if (args.symbols) {
  params = normalizeParameters({ ...params, watchlist: String(args.symbols).split(',') });
}

const { broker, streams } = createConnection(creds);
const engine = new TradingEngine({ broker, streams }, params);

console.log(`Venue: ${broker.label}  Mode: ${mode.toUpperCase()}`);
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

const controlPort = Number(process.env.CONTROL_PORT ?? args['control-port'] ?? 0) || null;
if (controlPort) {
  const controlToken = process.env.CONTROL_TOKEN ?? (args['control-token'] ? String(args['control-token']) : '');
  if (!controlToken) {
    console.error('Set CONTROL_TOKEN (or --control-token) to enable the control server.');
    process.exit(1);
  }
  const controlHost = String(process.env.CONTROL_HOST ?? args['control-host'] ?? '127.0.0.1');
  const { startControlServer } = await importPath(root, 'headless/control-server.mjs');
  await startControlServer({ engine, token: controlToken, port: controlPort, host: controlHost });
  console.log(`Control server on ${controlHost}:${controlPort} — POST /flatten, POST /stop?flatten=1, GET /status`);
  if (controlHost !== '127.0.0.1' && controlHost !== 'localhost') {
    console.warn(
      `WARNING: control server bound to ${controlHost}, not localhost. Make sure this is behind your own firewall or VPN — it is not internet-safe on its own.`
    );
  }
}

const shutdown = async (signal) => {
  console.log(`\n${signal} — stopping engine (positions are left open; use --flatten-on-exit to close them).`);
  await engine.stop('manual', Boolean(args['flatten-on-exit']));
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await engine.start();
