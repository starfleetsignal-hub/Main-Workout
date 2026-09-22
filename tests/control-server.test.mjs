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
        positions: { 'BTC/USD': {}, 'AAPL': {} },
        account: { equity: 12345 },
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
  server = await startControlServer({ engine, token: TOKEN, port, log: () => {} });
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
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
  assert.equal(body.openPositions, 2);
  assert.equal(body.equity, 12345);
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
