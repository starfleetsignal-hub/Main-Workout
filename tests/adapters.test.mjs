/**
 * Adapter tests against a mocked fetch.
 *
 * None of these venues are reachable from the build environment, so these
 * tests pin the request shape (path, method, headers, body) and the response
 * mapping. They prove the adapter does what the published API documents; they
 * cannot prove the documentation matches the live service.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { CoinbaseClient, toCoinbaseProduct, fromCoinbaseProduct } = await import(
  path.join(root, 'dist-esm/broker/coinbase/rest.js')
);
const { RobinhoodClient } = await import(pathToFileURL(path.join(root, 'dist-esm/broker/robinhood/rest.js')).href);
const { UpholdClient } = await import(pathToFileURL(path.join(root, 'dist-esm/broker/uphold/rest.js')).href);
const { JupiterClient } = await import(pathToFileURL(path.join(root, 'dist-esm/broker/jupiter/rest.js')).href);
const { PollingStreams, barsFromPrices } = await import(pathToFileURL(path.join(root, 'dist-esm/broker/polling.js')).href);
const { normalizeForVenue, unsupportedSymbols, defaultWatchlistFor, VENUE_LIST } = await import(
  path.join(root, 'dist-esm/broker/registry.js')
);

const EC_PEM = [
  '-----BEGIN EC PRIVATE KEY-----',
  'MHcCAQEEIJ1kKqPqLKRHOFwEXn7nUCBVjKFjwvLyqBtQOwjKPZKkoAoGCCqGSM49',
  'AwEHoUQDQgAEoQ0vJ1uOEg0nqIVL9m7Gb+Tz7VLJxCJzZnZ8XxvXWJ1hFqWl0vXJ',
  'sIYXKMBLhFZBxXJqZKcLlBGKr0xkxXhGZA==',
  '-----END EC PRIVATE KEY-----',
].join('\n');

const settle = () => new Promise((r) => setTimeout(r, 5));

/** Installs a fetch stub and records every call. */
function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const result = await handler(String(url), init, calls.length - 1);
    const { status = 200, body = {} } = result ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    };
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

// ---------------------------------------------------------------------------
// Coinbase
// ---------------------------------------------------------------------------

test('coinbase symbols convert to and from the product form', () => {
  assert.equal(toCoinbaseProduct('BTC/USD'), 'BTC-USD');
  assert.equal(fromCoinbaseProduct('ETH-USD'), 'ETH/USD');
});

test('coinbase sends a bearer JWT and reads balances into an account', async () => {
  const { calls, restore } = mockFetch((url) => {
    if (url.includes('/accounts')) {
      return {
        body: {
          accounts: [
            { currency: 'USD', available_balance: { value: '2500.00' }, hold: { value: '0' } },
            { currency: 'BTC', available_balance: { value: '0.05' }, hold: { value: '0' } },
          ],
        },
      };
    }
    if (url.includes('/ticker')) return { body: { trades: [{ price: '60000' }] } };
    return { body: {} };
  });
  try {
    const client = new CoinbaseClient({ keyName: 'org/keys/1', privateKey: EC_PEM });
    const acct = await client.getAccount();
    assert.equal(acct.cash, 2500);
    assert.equal(acct.equity, 2500 + 0.05 * 60000);
    assert.equal(acct.currency, 'USD');

    const auth = calls[0].init.headers.Authorization;
    assert.match(auth, /^Bearer eyJ/, 'should send a JWT');
    const header = JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[0], 'base64url').toString());
    assert.equal(header.alg, 'ES256');
    assert.equal(header.kid, 'org/keys/1');
  } finally {
    restore();
  }
});

test('a coinbase market buy is denominated in quote currency', async () => {
  let orderBody = null;
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/products/BTC-USD/ticker')) return { body: { trades: [{ price: '50000' }] } };
    if (url.includes('/products/BTC-USD') && !url.includes('/candles')) {
      return { body: { base_increment: '0.00000001', quote_increment: '0.01' } };
    }
    if (url.endsWith('/orders') && init.method === 'POST') {
      orderBody = JSON.parse(init.body);
      return { body: { success: true, success_response: { order_id: 'o1', client_order_id: 'c1' } } };
    }
    return { body: {} };
  });
  try {
    const client = new CoinbaseClient({ keyName: 'k', privateKey: EC_PEM });
    const res = await client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', qty: 0.01 });
    assert.equal(res.id, 'o1');
    assert.equal(orderBody.product_id, 'BTC-USD');
    assert.equal(orderBody.side, 'BUY');
    // 0.01 BTC at 50,000 is $500 of quote currency.
    assert.equal(orderBody.order_configuration.market_market_ioc.quote_size, '500');
    assert.equal(orderBody.order_configuration.market_market_ioc.base_size, undefined);
  } finally {
    restore();
  }
});

test('a coinbase market sell is denominated in base size', async () => {
  let orderBody = null;
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/products/BTC-USD') && !url.includes('ticker')) {
      return { body: { base_increment: '0.00000001', quote_increment: '0.01' } };
    }
    if (url.endsWith('/orders') && init.method === 'POST') {
      orderBody = JSON.parse(init.body);
      return { body: { success: true, success_response: { order_id: 'o2' } } };
    }
    return { body: {} };
  });
  try {
    const client = new CoinbaseClient({ keyName: 'k', privateKey: EC_PEM });
    await client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'sell', qty: 0.25 });
    assert.equal(orderBody.order_configuration.market_market_ioc.base_size, '0.25');
  } finally {
    restore();
  }
});

test('a rejected coinbase order raises the venue message', async () => {
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/products/')) return { body: { trades: [{ price: '100' }], base_increment: '0.1', quote_increment: '0.01' } };
    if (url.endsWith('/orders') && init.method === 'POST') {
      return { body: { success: false, error_response: { message: 'INSUFFICIENT_FUND' } } };
    }
    return { body: {} };
  });
  try {
    const client = new CoinbaseClient({ keyName: 'k', privateKey: EC_PEM });
    await assert.rejects(
      client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', qty: 1 }),
      /INSUFFICIENT_FUND/
    );
  } finally {
    restore();
  }
});

test('coinbase dust balances are not reported as positions', async () => {
  const { restore } = mockFetch((url) => {
    if (url.includes('/accounts')) {
      return {
        body: {
          accounts: [
            { currency: 'BTC', available_balance: { value: '0.000001' }, hold: { value: '0' } },
            { currency: 'ETH', available_balance: { value: '1' }, hold: { value: '0' } },
          ],
        },
      };
    }
    if (url.includes('BTC-USD')) return { body: { trades: [{ price: '50000' }] } };
    if (url.includes('ETH-USD')) return { body: { trades: [{ price: '3000' }] } };
    return { body: {} };
  });
  try {
    const client = new CoinbaseClient({ keyName: 'k', privateKey: EC_PEM });
    const positions = await client.getPositions();
    // 0.000001 BTC is 5 cents, below the $1 dust floor.
    assert.deepEqual(positions.map((p) => p.symbol), ['ETH/USD']);
    assert.equal(positions[0].qty, 1);
  } finally {
    restore();
  }
});

test('coinbase candles are mapped and sorted oldest first', async () => {
  const { restore } = mockFetch(() => ({
    body: {
      candles: [
        { start: '200', open: '2', high: '3', low: '1', close: '2.5', volume: '10' },
        { start: '100', open: '1', high: '2', low: '0.5', close: '1.5', volume: '5' },
      ],
    },
  }));
  try {
    const client = new CoinbaseClient({ keyName: 'k', privateKey: EC_PEM });
    const bars = await client.getBars('BTC/USD', 'crypto', 10);
    assert.equal(bars.length, 2);
    assert.equal(bars[0].t, 100_000);
    assert.equal(bars[1].t, 200_000);
    assert.equal(bars[0].c, 1.5);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Robinhood
// ---------------------------------------------------------------------------

const RH_KEY = Buffer.alloc(32, 7).toString('base64');

test('robinhood sends the three signing headers', async () => {
  const { calls, restore } = mockFetch(() => ({ body: { buying_power: '1000', status: 'active' } }));
  try {
    const client = new RobinhoodClient({ apiKey: 'rh-api-x', privateKey: RH_KEY });
    await client.getAccount();
    const headers = calls[0].init.headers;
    assert.equal(headers['x-api-key'], 'rh-api-x');
    assert.match(headers['x-timestamp'], /^\d+$/);
    assert.ok(headers['x-signature'].length > 40, 'should carry a signature');
    assert.match(calls[0].url, /\/api\/v1\/crypto\/trading\/accounts\/$/);
  } finally {
    restore();
  }
});

test('a robinhood market order uses market_order_config', async () => {
  let body = null;
  const { restore } = mockFetch((url, init) => {
    if (init.method === 'POST') {
      body = JSON.parse(init.body);
      return { body: { id: 'ord-1', state: 'open', client_order_id: body.client_order_id } };
    }
    return { body: {} };
  });
  try {
    const client = new RobinhoodClient({ apiKey: 'k', privateKey: RH_KEY });
    const res = await client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', qty: 0.001 });
    assert.equal(body.symbol, 'BTC-USD');
    assert.equal(body.side, 'buy');
    assert.equal(body.type, 'market');
    assert.equal(body.market_order_config.asset_quantity, '0.001');
    assert.match(body.client_order_id, /^[0-9a-f-]{36}$/);
    assert.equal(res.status, 'accepted');
  } finally {
    restore();
  }
});

test('robinhood executions are averaged into a fill price', async () => {
  const { restore } = mockFetch(() => ({
    body: {
      id: 'ord-2',
      state: 'filled',
      executions: [
        { quantity: '1', effective_price: '100' },
        { quantity: '3', effective_price: '200' },
      ],
    },
  }));
  try {
    const client = new RobinhoodClient({ apiKey: 'k', privateKey: RH_KEY });
    const res = await client.getOrder('ord-2');
    assert.equal(res.filledQty, 4);
    assert.equal(res.filledAvgPrice, 175); // (100 + 600) / 4
    assert.equal(res.status, 'filled');
  } finally {
    restore();
  }
});

test('robinhood prices from the mid of the inclusive bid and ask', async () => {
  const { restore } = mockFetch(() => ({
    body: { results: [{ bid_inclusive_of_sell_spread: '99', ask_inclusive_of_buy_spread: '101' }] },
  }));
  try {
    const client = new RobinhoodClient({ apiKey: 'k', privateKey: RH_KEY });
    assert.equal(await client.getLatestPrice('BTC/USD'), 100);
  } finally {
    restore();
  }
});

test('a robinhood error body surfaces its detail', async () => {
  const { restore } = mockFetch(() => ({ status: 400, body: { errors: [{ detail: 'insufficient buying power' }] } }));
  try {
    const client = new RobinhoodClient({ apiKey: 'k', privateKey: RH_KEY });
    await assert.rejects(client.getAccount(), /insufficient buying power/);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Uphold
// ---------------------------------------------------------------------------

test('an uphold buy creates and then commits a transaction', async () => {
  const seen = [];
  const { restore } = mockFetch((url, init) => {
    seen.push(`${init.method ?? 'GET'} ${url.replace('https://api-sandbox.uphold.com', '')}`);
    if (url.endsWith('/v0/me/cards')) {
      return {
        body: [
          { id: 'usd-card', currency: 'USD', balance: '1000', available: '1000' },
          { id: 'btc-card', currency: 'BTC', balance: '0', available: '0' },
        ],
      };
    }
    if (url.includes('/commit')) {
      return { body: { id: 'tx1', status: 'completed', origin: { amount: '500' }, destination: { amount: '0.01' }, rate: '50000' } };
    }
    if (url.includes('/transactions') && init.method === 'POST') return { body: { id: 'tx1' } };
    return { body: {} };
  });
  try {
    const client = new UpholdClient({ token: 't', mode: 'sandbox' });
    const res = await client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', qty: 0.01 });
    assert.ok(seen.some((s) => s === 'POST /v0/me/cards/usd-card/transactions'), seen.join(' | '));
    assert.ok(seen.some((s) => s.includes('/commit')), 'should commit the transaction');
    assert.equal(res.status, 'filled');
    assert.equal(res.filledQty, 0.01);
    assert.equal(res.filledAvgPrice, 50000);
  } finally {
    restore();
  }
});

test('uphold refuses to trade a pair with no destination card', async () => {
  const { restore } = mockFetch(() => ({
    body: [{ id: 'usd-card', currency: 'USD', balance: '1000', available: '1000' }],
  }));
  try {
    const client = new UpholdClient({ token: 't', mode: 'sandbox' });
    await assert.rejects(
      client.submitMarketOrder({ symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', qty: 0.01 }),
      /No BTC card/
    );
  } finally {
    restore();
  }
});

test('uphold uses the sandbox host when asked', async () => {
  const { calls, restore } = mockFetch(() => ({ body: [] }));
  try {
    await new UpholdClient({ token: 't', mode: 'sandbox' }).getAccount();
    assert.match(calls[0].url, /api-sandbox\.uphold\.com/);
  } finally {
    restore();
  }
  const live = mockFetch(() => ({ body: [] }));
  try {
    await new UpholdClient({ token: 't', mode: 'live' }).getAccount();
    assert.match(live.calls[0].url, /\/\/api\.uphold\.com/);
  } finally {
    live.restore();
  }
});

// ---------------------------------------------------------------------------
// Jupiter
// ---------------------------------------------------------------------------

const WALLET_KEY = (() => {
  // A deterministic 64-byte keypair in base58, the format wallets export.
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from(jwk.d, 'base64url'), Buffer.from(jwk.x, 'base64url')]);
  return base58(raw);
})();

function base58(buf) {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < buf.length && buf[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += A[digits[i]];
  return out;
}

test('jupiter derives a wallet address from the private key', () => {
  const client = new JupiterClient({ privateKey: WALLET_KEY });
  assert.match(client.address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});

test('jupiter rejects a key it cannot read', () => {
  assert.throws(() => new JupiterClient({ privateKey: 'nonsense!!' }), /Unrecognised Solana key/);
});

test('jupiter prices a one-unit trade through the quote endpoint', async () => {
  const { calls, restore } = mockFetch(() => ({ body: { inAmount: '1000000000', outAmount: '150000000' } }));
  try {
    const client = new JupiterClient({ privateKey: WALLET_KEY });
    const price = await client.getLatestPrice('SOL/USDC');
    assert.equal(price, 150); // 150000000 / 1e6
    assert.match(calls[0].url, /\/quote\?/);
    assert.match(calls[0].url, /amount=1000000000/); // one SOL, 9 decimals
  } finally {
    restore();
  }
});

test('jupiter refuses a token outside the built-in list', async () => {
  const client = new JupiterClient({ privateKey: WALLET_KEY });
  assert.equal(await client.getLatestPrice('NOTAREALTOKEN/USDC'), null);
});

test('jupiter leaves a SOL buffer for transaction fees', async () => {
  const { restore } = mockFetch((url, init) => {
    const body = init.body ? JSON.parse(init.body) : {};
    if (body.method === 'getBalance') return { body: { result: { value: 1e9 } } }; // 1 SOL
    if (body.method === 'getTokenAccountsByOwner') return { body: { result: { value: [] } } };
    return { body: { inAmount: '1000000000', outAmount: '150000000' } };
  });
  try {
    const client = new JupiterClient({ privateKey: WALLET_KEY });
    const positions = await client.getPositions();
    const sol = positions.find((p) => p.symbol === 'SOL/USDC');
    assert.ok(sol, 'expected a SOL position');
    assert.equal(sol.qty, 0.98, 'should hold back 0.02 SOL for fees');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Polling streams
// ---------------------------------------------------------------------------

test('polling streams emit ticks and fold prices into bars', async () => {
  let price = 100;
  let now = 60_000;
  const broker = { getLatestPrice: async () => price };
  const ticks = [];
  const bars = [];
  const statuses = [];
  const streams = new PollingStreams(broker, {
    setInterval: () => 0,
    clearInterval: () => {},
    now: () => now,
  });
  streams.start(['BTC/USD'], {
    onTick: (s, p, _sz, t) => ticks.push({ s, p, t }),
    onBar: (s, b) => bars.push({ s, b }),
    onNews: () => {},
    onStatus: (name, status) => statuses.push(`${name}:${status}`),
  });

  // start() kicks off a poll of its own; let it land before driving more.
  await settle();
  price = 110;
  now = 90_000;
  await streams.poll();
  assert.equal(bars.length, 0, 'still inside the first minute');

  now = 121_000; // next bar bucket
  price = 105;
  await streams.poll();

  assert.equal(ticks.length, 3, 'one tick per poll');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].b.o, 100);
  assert.equal(bars[0].b.h, 110);
  assert.equal(bars[0].b.l, 100);
  assert.equal(bars[0].b.c, 110);
  assert.ok(statuses.includes('crypto:connected'));
  assert.ok(statuses.includes('news:off'), 'a polled venue has no news feed');
  streams.stop();
});

test('polling streams report an error after repeated failures', async () => {
  const broker = {
    getLatestPrice: async () => {
      throw new Error('network down');
    },
  };
  const statuses = [];
  const streams = new PollingStreams(broker, { setInterval: () => 0, clearInterval: () => {} });
  streams.start(['BTC/USD'], {
    onTick: () => {},
    onBar: () => {},
    onNews: () => {},
    onStatus: (name, status) => name === 'crypto' && statuses.push(status),
  });
  await settle();
  for (let i = 0; i < 4; i++) {
    await streams.poll();
    await settle();
  }
  assert.ok(statuses.includes('error'), statuses.join(','));
  streams.stop();
});

test('barsFromPrices buckets a price series into candles', () => {
  const bars = barsFromPrices(
    [
      { t: 0, p: 10 },
      { t: 30_000, p: 12 },
      { t: 61_000, p: 9 },
    ],
    60_000
  );
  assert.equal(bars.length, 2);
  assert.deepEqual([bars[0].o, bars[0].h, bars[0].l, bars[0].c], [10, 12, 10, 12]);
  assert.equal(bars[1].o, 9);
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

test('symbols are rewritten into each venue form', () => {
  assert.equal(normalizeForVenue('BTC-USD', 'coinbase'), 'BTC/USD');
  assert.equal(normalizeForVenue('AAPL', 'alpaca'), 'AAPL');
  // On a crypto-only venue a bare ticker gains the venue's quote currency.
  assert.equal(normalizeForVenue('SOL', 'jupiter'), 'SOL/USDC');
  assert.equal(normalizeForVenue('ETH', 'coinbase'), 'ETH/USD');
});

test('unsupported symbols are reported per venue', () => {
  assert.deepEqual(unsupportedSymbols(['AAPL', 'BTC/USD'], 'coinbase'), ['AAPL']);
  assert.deepEqual(unsupportedSymbols(['AAPL', 'BTC/USD'], 'alpaca'), []);
  // Jupiter only knows the mints it ships with.
  assert.deepEqual(unsupportedSymbols(['SOL/USDC', 'FAKECOIN/USDC'], 'jupiter'), ['FAKECOIN/USDC']);
});

test('every venue has a usable default watchlist and no unsupported symbols in it', () => {
  for (const descriptor of VENUE_LIST) {
    const list = defaultWatchlistFor(descriptor.id);
    assert.ok(list.length > 0, `${descriptor.id} needs a default watchlist`);
    assert.deepEqual(unsupportedSymbols(list, descriptor.id), [], `${descriptor.id} default list must be tradable`);
  }
});

test('every venue declares credentials, docs and a maturity level', () => {
  for (const d of VENUE_LIST) {
    assert.ok(d.credentialFields.length > 0, `${d.id} needs credential fields`);
    assert.match(d.docsUrl, /^https:\/\//, `${d.id} needs a docs link`);
    assert.ok(['verified', 'untested', 'experimental'].includes(d.maturity), `${d.id} maturity`);
    // Anything not verified has to say so to the user.
    if (d.maturity !== 'verified') assert.ok(d.warning, `${d.id} must carry a warning`);
  }
});

test('the self-custody venue is flagged as non-custodial and experimental', () => {
  const jup = VENUE_LIST.find((v) => v.id === 'jupiter');
  assert.equal(jup.capabilities.custodial, false);
  assert.equal(jup.maturity, 'experimental');
  assert.match(jup.warning, /self-custody/i);
});
