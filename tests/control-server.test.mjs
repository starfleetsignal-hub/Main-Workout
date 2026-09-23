/**
 * Tests the headless runner's local kill-switch server against a real HTTP
 * request, so the bearer-token check and the route wiring are proven, not
 * just assumed.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { startControlServer } = await import(pathToFileURL(path.join(root, 'headless/control-server.mjs')).href);

const TOKEN = 'test-control-token';
let server;
let baseUrl;
let engine;

function makeFakeEngine() {
  return {
    flattenCalls: 0,
    stopCalls: [],
    snapshot() {
      return {
        status: 'running',
        statusDetail: 'Watching 3 symbols',
        positions: {
          'BTC/USD': { symbol: 'BTC/USD', side: 'long', qty: 0.5, entryPrice: 100, stopPrice: 90, takeProfitPrice: 120, openedAt: 1 },
          AAPL: { symbol: 'AAPL', side: 'long', qty: 2, entryPrice: 50, stopPrice: 45, takeProfitPrice: 60, openedAt: 2 },
        },
        symbols: { 'BTC/USD': { lastPrice: 110 }, AAPL: { lastPrice: 48 } },
        account: { equity: 12345, cash: 500 },
        trades: [{ symbol: 'MSFT', side: 'long', qty: 1, pnl: 5, pnlPct: 0.01, exitReason: 'take_profit', closedAt: 3 }],
        activity: [{ id: 'a1', at: 4, level: 'info', symbol: 'AAPL', message: 'entered' }],
        signals: {
          'BTC/USD': { symbol: 'BTC/USD', score: 82, side: 'long', blockers: [], reasons: ['Trend up', 'Volume confirming'] },
          AAPL: { symbol: 'AAPL', score: 40, side: null, blockers: ['Warming up: not enough bars for indicators'], reasons: [] },
        },
        tradesToday: 1,
        realizedPnlToday: 5,
        streams: { stocks: 'connected', crypto: 'connected', news: 'off' },
        lastTickAt: 5,
      };
    },
    async flattenAll() {
      this.flattenCalls += 1;
    },
    async stop(reason, flatten) {
      this.stopCalls.push({ reason, flatten });
    },
  };
}

before(async () => {
  engine = makeFakeEngine();
  const port = 9200 + Math.floor(Math.random() * 300);
  server = await startControlServer({ engine, token: TOKEN, port, venue: 'Jupiter', mode: 'live', log: () => {} });
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

test('the dashboard page loads without a token', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.match(body, /TradeRunner monitor/);
});

test('a request with no token is refused', async () => {
  const res = await fetch(`${baseUrl}/status`);
  assert.equal(res.status, 401);
});

test('a request with the wrong token is refused', async () => {
  const res = await fetch(`${baseUrl}/status`, { headers: { Authorization: 'Bearer wrong-token' } });
  assert.equal(res.status, 401);
});

test('status reports the engine snapshot', async () => {
  const res = await fetch(`${baseUrl}/status`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'running');
  assert.equal(body.venue, 'Jupiter');
  assert.equal(body.mode, 'live');
  assert.equal(body.openPositions, 2);
  assert.equal(body.equity, 12345);
  assert.equal(body.account.cash, 500);
  assert.equal(body.realizedPnlToday, 5);

  const btc = body.positions.find((p) => p.symbol === 'BTC/USD');
  assert.equal(btc.lastPrice, 110);
  assert.equal(btc.unrealizedPnl, (110 - 100) * 0.5);

  assert.equal(body.recentTrades.length, 1);
  assert.equal(body.recentTrades[0].symbol, 'MSFT');
  assert.equal(body.activity.length, 1);
  assert.equal(body.activity[0].message, 'entered');

  assert.equal(body.signals.length, 2);
  const aaplSignal = body.signals.find((s) => s.symbol === 'AAPL');
  assert.equal(aaplSignal.score, 40);
  assert.equal(aaplSignal.side, null);
  assert.deepEqual(aaplSignal.blockers, ['Warming up: not enough bars for indicators']);
});

test('POST /flatten calls flattenAll on the engine', async () => {
  const before = engine.flattenCalls;
  const res = await fetch(`${baseUrl}/flatten`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(engine.flattenCalls, before + 1);
});

test('POST /stop without flatten=1 stops without flattening', async () => {
  const res = await fetch(`${baseUrl}/stop`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const call = engine.stopCalls.at(-1);
  assert.equal(call.flatten, false);
});

test('POST /stop?flatten=1 stops and flattens', async () => {
  await fetch(`${baseUrl}/stop?flatten=1`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
  const call = engine.stopCalls.at(-1);
  assert.equal(call.flatten, true);
});

test('an unknown route returns 404', async () => {
  const res = await fetch(`${baseUrl}/nope`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 404);
});

test('starting a server without a token throws rather than opening unprotected', async () => {
  await assert.rejects(startControlServer({ engine, token: '', port: 9500 }));
});
