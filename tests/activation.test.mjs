/**
 * End-to-end tests for server-side activation.
 *
 * These boot the real activation server as a child process against a
 * throwaway key pair and ledger, then drive it with the same client code the
 * app uses. Seat counting and revocation are the whole point of the server, so
 * they are tested against the real thing rather than a mock.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { issueLicense } from '../tools/license/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { verifyLease, requestActivation, decideUnlock, toGrace } = await import(
  path.join(root, 'dist-esm/license/activation.js')
);

const ADMIN_TOKEN = 'test-admin-token';
let dir;
let child;
let baseUrl;
let publicKeyHex;
let privateKey;

const config = () => ({ serverUrl: baseUrl, publicKeyHex, graceSeconds: 3600 });

function makeLicense(sub = 'buyer@example.com') {
  return issueLicense(privateKey, { sub, plan: 'lifetime' });
}

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return await res.json();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('activation server did not start');
}

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'tr-activation-'));
  const kp = generateKeyPairSync('ed25519');
  const pem = kp.privateKey.export({ format: 'pem', type: 'pkcs8' });
  privateKey = createPrivateKey(pem);
  publicKeyHex = Buffer.from(kp.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
  writeFileSync(path.join(dir, 'license-private.key'), pem, { mode: 0o600 });

  const port = 8900 + Math.floor(Math.random() * 400);
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(root, 'server/activation.mjs'), '--port', String(port), '--seats', '2'], {
    cwd: dir,
    env: { ...process.env, ADMIN_TOKEN, LEASE_HOURS: '1' },
    stdio: 'ignore',
  });
  const health = await waitForServer(baseUrl);
  assert.equal(health.publicKeyHex, publicKeyHex, 'server should sign with the test key');
});

after(() => {
  child?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const activate = (key, deviceId, action = 'activate') =>
  requestActivation(
    config(),
    { licenseKey: key, deviceId, deviceName: 'test', platform: 'node' },
    action
  );

async function admin(route, body) {
  const res = await fetch(`${baseUrl}/admin/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('a first activation returns a verifiable lease', async () => {
  const { key } = makeLicense();
  const state = await activate(key, 'device-1');
  assert.equal(state.status, 'active', JSON.stringify(state));
  assert.equal(state.lease.seats, 1);
  assert.equal(state.lease.maxSeats, 2);

  const verified = verifyLease(state.lease.token, publicKeyHex);
  assert.equal(verified.ok, true, 'the lease should verify against the public key');
  assert.equal(verified.lease.did, 'device-1');
});

test('a lease does not verify against a different public key', async () => {
  const { key } = makeLicense();
  const state = await activate(key, 'device-x');
  const other = generateKeyPairSync('ed25519');
  const otherHex = Buffer.from(other.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
  assert.deepEqual(verifyLease(state.lease.token, otherHex), { ok: false, reason: 'bad_signature' });
});

test('the same device re-activating does not consume a second seat', async () => {
  const { key } = makeLicense();
  await activate(key, 'device-a');
  const again = await activate(key, 'device-a');
  assert.equal(again.status, 'active');
  assert.equal(again.lease.seats, 1, 'should still be one seat');
});

test('the seat limit refuses an extra device', async () => {
  const { key } = makeLicense();
  assert.equal((await activate(key, 'd1')).status, 'active');
  assert.equal((await activate(key, 'd2')).status, 'active');

  const third = await activate(key, 'd3');
  assert.equal(third.status, 'seat_limit');
  assert.equal(third.seats, 2);
  assert.equal(third.maxSeats, 2);
});

test('deactivating frees a seat for another device', async () => {
  const { key } = makeLicense();
  await activate(key, 'e1');
  await activate(key, 'e2');
  assert.equal((await activate(key, 'e3')).status, 'seat_limit');

  await activate(key, 'e1', 'deactivate');
  const now = await activate(key, 'e3');
  assert.equal(now.status, 'active', 'the freed seat should be reusable');
});

test('a revoked license is refused even though its signature is valid', async () => {
  const { key, payload } = makeLicense('pirate@example.com');
  assert.equal((await activate(key, 'r1')).status, 'active');

  const res = await admin('revoke', { licenseId: payload.id, reason: 'Refunded.' });
  assert.equal(res.status, 200);

  const after = await activate(key, 'r1', 'renew');
  assert.equal(after.status, 'revoked');
  assert.match(after.reason, /Refunded/);
});

test('a revoked license can be restored', async () => {
  const { key, payload } = makeLicense();
  await activate(key, 'u1');
  await admin('revoke', { licenseId: payload.id, reason: 'mistake' });
  assert.equal((await activate(key, 'u1', 'renew')).status, 'revoked');

  await admin('unrevoke', { licenseId: payload.id });
  assert.equal((await activate(key, 'u1', 'renew')).status, 'active');
});

test('the seat allowance can be raised for one license', async () => {
  const { key, payload } = makeLicense();
  await activate(key, 's1');
  await activate(key, 's2');
  assert.equal((await activate(key, 's3')).status, 'seat_limit');

  await admin('seats', { licenseId: payload.id, maxSeats: 5 });
  const after = await activate(key, 's3');
  assert.equal(after.status, 'active');
  assert.equal(after.lease.maxSeats, 5);
});

test('a key the server cannot verify is rejected', async () => {
  const other = generateKeyPairSync('ed25519');
  const foreign = issueLicense(createPrivateKey(other.privateKey.export({ format: 'pem', type: 'pkcs8' })), {
    sub: 'forged',
  });
  const state = await activate(foreign.key, 'f1');
  assert.equal(state.status, 'revoked', 'a foreign key must not activate');
});

test('admin routes require the admin token', async () => {
  const res = await fetch(`${baseUrl}/admin/licenses`);
  assert.equal(res.status, 401);

  const ok = await fetch(`${baseUrl}/admin/licenses`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.ok(Array.isArray(body.licenses));
});

test('the admin listing shows the devices using a license', async () => {
  const { key, payload } = makeLicense('listed@example.com');
  await activate(key, 'l1');
  const res = await fetch(`${baseUrl}/admin/licenses`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
  const body = await res.json();
  const row = body.licenses.find((l) => l.licenseId === payload.id);
  assert.ok(row, 'the license should be listed');
  assert.ok(row.devices.some((d) => d.deviceId === 'l1'));
});

test('activation state survives a server restart', async () => {
  const { key } = makeLicense();
  await activate(key, 'p1');
  await activate(key, 'p2');

  // The ledger is the database, so a fresh process rebuilds the same state.
  const port = Number(new URL(baseUrl).port);
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
  child = spawn(process.execPath, [path.join(root, 'server/activation.mjs'), '--port', String(port), '--seats', '2'], {
    cwd: dir,
    env: { ...process.env, ADMIN_TOKEN, LEASE_HOURS: '1' },
    stdio: 'ignore',
  });
  await waitForServer(baseUrl);

  const third = await activate(key, 'p3');
  assert.equal(third.status, 'seat_limit', 'seats should be remembered across a restart');
});

test('an unreachable server reports offline rather than refusing', async () => {
  const { key } = makeLicense();
  const state = await requestActivation(
    { serverUrl: 'http://127.0.0.1:1', publicKeyHex, graceSeconds: 3600 },
    { licenseKey: key, deviceId: 'off-1', deviceName: 'test', platform: 'node' },
    'activate'
  );
  assert.equal(state.status, 'offline', JSON.stringify(state));
});

// ---------------------------------------------------------------------------
// The unlock decision
// ---------------------------------------------------------------------------

const goodCheck = { ok: true, license: { sub: 'x', plan: 'lifetime', exp: null, key: 'k', v: 1, id: 'i', iat: 0 } };

test('an invalid signature stays locked whatever the server says', () => {
  const d = decideUnlock({ ok: false, reason: 'bad_signature' }, { status: 'active', lease: fakeLease() }, config());
  assert.equal(d.unlocked, false);
});

test('a build with no activation server unlocks on the offline check alone', () => {
  const d = decideUnlock(goodCheck, { status: 'unknown' }, { serverUrl: '', publicKeyHex, graceSeconds: 0 });
  assert.equal(d.unlocked, true);
  assert.equal(d.message, null);
});

test('a revoked license locks the app and says why', () => {
  const d = decideUnlock(goodCheck, { status: 'revoked', reason: 'Refunded.' }, config());
  assert.equal(d.unlocked, false);
  assert.equal(d.message, 'Refunded.');
});

test('exceeding the seat limit locks the app with a countable message', () => {
  const d = decideUnlock(goodCheck, { status: 'seat_limit', seats: 3, maxSeats: 3 }, config());
  assert.equal(d.unlocked, false);
  assert.match(d.message, /3 of 3 devices/);
});

test('an unreachable server keeps a paying customer working', () => {
  const d = decideUnlock(goodCheck, { status: 'offline', detail: 'timeout' }, config());
  assert.equal(d.unlocked, true, 'an outage must not lock out a valid license');
  assert.equal(d.inGrace, true);
  assert.match(d.message, /Could not reach/);
});

test('an expired lease keeps working through the grace window, then stops', () => {
  const lease = fakeLease({ exp: Math.floor(Date.now() / 1000) - 10 });
  const grace = toGrace(lease, 3600);
  const inside = decideUnlock(goodCheck, grace, config(), Math.floor(Date.now() / 1000));
  assert.equal(inside.unlocked, true, 'still inside the grace window');

  const outside = decideUnlock(goodCheck, grace, config(), lease.exp + 7200);
  assert.equal(outside.unlocked, false, 'past the grace window it locks');
  assert.match(outside.message, /has not checked in/);
});

test('a lease past its halfway point asks to be renewed', () => {
  const now = Math.floor(Date.now() / 1000);
  const fresh = decideUnlock(goodCheck, { status: 'active', lease: fakeLease({ iat: now, exp: now + 3600 }) }, config(), now);
  assert.equal(fresh.needsRenewal, false);

  const stale = decideUnlock(
    goodCheck,
    { status: 'active', lease: fakeLease({ iat: now - 3000, exp: now + 600 }) },
    config(),
    now
  );
  assert.equal(stale.needsRenewal, true);
});

function fakeLease(over = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { v: 1, lid: 'lic', did: 'dev', iat: now, exp: now + 3600, seats: 1, maxSeats: 3, token: 'TRL1.a.b', ...over };
}
