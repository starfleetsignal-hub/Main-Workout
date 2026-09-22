/**
 * Checks the exchange request-signing helpers against Node's own crypto.
 * These adapters cannot be exercised against the live venues from here, so
 * verifying the signatures independently is what keeps them honest.
 */
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  robinhoodSignature,
  coinbaseJwt,
  parseCoinbaseSecret,
  sec1PrivateScalar,
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
} = await import(path.join(root, 'dist-esm/broker/signing.js'));

test('base64 round-trips against Node for random bytes', () => {
  for (let i = 0; i < 60; i++) {
    const len = 1 + Math.floor(Math.random() * 70);
    const bytes = Buffer.from(Array.from({ length: len }, () => Math.floor(Math.random() * 256)));
    assert.equal(bytesToBase64(bytes), bytes.toString('base64'), 'encode mismatch');
    assert.deepEqual(Buffer.from(base64ToBytes(bytes.toString('base64'))), bytes, 'decode mismatch');
    assert.equal(bytesToBase64Url(bytes), bytes.toString('base64url'), 'base64url mismatch');
  }
});

test('base64ToBytes accepts the url-safe alphabet too', () => {
  const bytes = Buffer.from([251, 255, 190, 0, 17]);
  assert.deepEqual(Buffer.from(base64ToBytes(bytes.toString('base64url'))), bytes);
});

test('a Robinhood signature verifies as Ed25519 over the documented message', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');

  const apiKey = 'rh-api-1234';
  const ts = 1790000000;
  const p = '/api/v1/crypto/trading/orders/';
  const method = 'POST';
  const body = JSON.stringify({ symbol: 'BTC-USD', side: 'buy' });

  const sig = robinhoodSignature(seed.toString('base64'), apiKey, ts, p, method, body);
  const message = Buffer.from(`${apiKey}${ts}${p}${method}${body}`, 'utf8');
  assert.ok(verify(null, message, publicKey, Buffer.from(sig, 'base64')), 'signature should verify');
});

test('a Robinhood signature changes when any signed field changes', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url').toString('base64');
  const base = robinhoodSignature(seed, 'k', 1, '/p', 'GET', '');
  assert.notEqual(base, robinhoodSignature(seed, 'k2', 1, '/p', 'GET', ''));
  assert.notEqual(base, robinhoodSignature(seed, 'k', 2, '/p', 'GET', ''));
  assert.notEqual(base, robinhoodSignature(seed, 'k', 1, '/q', 'GET', ''));
  assert.notEqual(base, robinhoodSignature(seed, 'k', 1, '/p', 'POST', ''));
  assert.notEqual(base, robinhoodSignature(seed, 'k', 1, '/p', 'GET', '{}'));
});

test('a Robinhood key that decodes to 64 bytes uses the seed half', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const seed = Buffer.from(jwk.d, 'base64url');
  const pub = Buffer.from(jwk.x, 'base64url');
  const combined = Buffer.concat([seed, pub]).toString('base64');
  assert.equal(
    robinhoodSignature(combined, 'k', 1, '/p', 'GET', ''),
    robinhoodSignature(seed.toString('base64'), 'k', 1, '/p', 'GET', '')
  );
});

test('a Robinhood key of the wrong length is rejected clearly', () => {
  assert.throws(() => robinhoodSignature(Buffer.alloc(10).toString('base64'), 'k', 1, '/p', 'GET', ''), /32 bytes/);
});

test('the SEC1 parser recovers the private scalar from a P-256 PEM', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ format: 'pem', type: 'sec1' });
  const expected = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  const parsed = parseCoinbaseSecret(pem);
  assert.equal(parsed.kind, 'ec');
  assert.deepEqual(Buffer.from(parsed.secret), expected);
});

test('the parser also handles a PKCS#8 P-256 PEM', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' });
  const expected = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  const parsed = parseCoinbaseSecret(pem);
  assert.deepEqual(Buffer.from(parsed.secret), expected);
});

test('escaped newlines in a pasted PEM are tolerated', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ format: 'pem', type: 'sec1' }).replace(/\n/g, '\\n');
  const expected = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  assert.deepEqual(Buffer.from(parseCoinbaseSecret(pem).secret), expected);
});

test('a base64 Ed25519 Coinbase secret is detected', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const combined = Buffer.concat([
    Buffer.from(jwk.d, 'base64url'),
    Buffer.from(jwk.x, 'base64url'),
  ]).toString('base64');
  const parsed = parseCoinbaseSecret(combined);
  assert.equal(parsed.kind, 'ed25519');
  assert.equal(parsed.secret.length, 32);
});

test('an unrecognised Coinbase secret is rejected with a useful message', () => {
  assert.throws(() => parseCoinbaseSecret('not-a-key'), /Unrecognised Coinbase API secret/);
});

test('a Coinbase ES256 JWT verifies against the matching public key', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ format: 'pem', type: 'sec1' });
  const jwt = coinbaseJwt({
    keyName: 'organizations/abc/apiKeys/def',
    key: parseCoinbaseSecret(pem),
    method: 'GET',
    host: 'api.coinbase.com',
    path: '/api/v3/brokerage/accounts',
    nowSeconds: 1790000000,
  });

  const [h, p, s] = jwt.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());

  assert.equal(header.alg, 'ES256');
  assert.equal(header.typ, 'JWT');
  assert.equal(header.kid, 'organizations/abc/apiKeys/def');
  assert.match(header.nonce, /^[0-9a-f]{32}$/);
  assert.equal(payload.iss, 'cdp');
  assert.equal(payload.sub, 'organizations/abc/apiKeys/def');
  assert.equal(payload.uri, 'GET api.coinbase.com/api/v3/brokerage/accounts');
  assert.equal(payload.nbf, 1790000000);
  assert.equal(payload.exp, 1790000120);

  const publicKey = createPublicKey(createPrivateKey(pem));
  const ok = verify(
    'sha256',
    Buffer.from(`${h}.${p}`, 'utf8'),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(s, 'base64url')
  );
  assert.ok(ok, 'the ES256 signature should verify');
});

test('a Coinbase EdDSA JWT verifies against the matching public key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const combined = Buffer.concat([
    Buffer.from(jwk.d, 'base64url'),
    Buffer.from(jwk.x, 'base64url'),
  ]).toString('base64');

  const jwt = coinbaseJwt({
    keyName: 'key-name',
    key: parseCoinbaseSecret(combined),
    method: 'POST',
    host: 'api.coinbase.com',
    path: '/api/v3/brokerage/orders',
    nowSeconds: 1790000000,
  });
  const [h, p, s] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString()).alg, 'EdDSA');
  assert.ok(verify(null, Buffer.from(`${h}.${p}`, 'utf8'), publicKey, Buffer.from(s, 'base64url')));
});

test('each Coinbase JWT carries a distinct nonce', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const key = parseCoinbaseSecret(privateKey.export({ format: 'pem', type: 'sec1' }));
  const nonces = new Set();
  for (let i = 0; i < 25; i++) {
    const jwt = coinbaseJwt({ keyName: 'k', key, method: 'GET', host: 'h', path: '/p' });
    nonces.add(JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString()).nonce);
  }
  assert.equal(nonces.size, 25);
});

test('the SEC1 parser does not mistake the public point for the scalar', () => {
  // Run enough keys that a naive scan would hit a 0x04 0x20 sequence inside
  // the public key at least once.
  for (let i = 0; i < 40; i++) {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const expected = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
    const der = privateKey.export({ format: 'der', type: 'sec1' });
    assert.deepEqual(Buffer.from(sec1PrivateScalar(new Uint8Array(der))), expected, `key ${i}`);
  }
});
