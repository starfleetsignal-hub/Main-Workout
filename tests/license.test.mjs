import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  defaultDaysFor,
  generateKeyPair,
  issueLicense,
  verifyLicense,
} from '../tools/license/lib.mjs';
import { createPrivateKey } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
void root;

function freshKeys() {
  const kp = generateKeyPair();
  return { privateKey: createPrivateKey(kp.privateKeyPem), publicKeyHex: kp.publicKeyHex };
}

test('an issued key verifies against its own public key', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key, payload } = issueLicense(privateKey, { sub: 'buyer@example.com', plan: 'lifetime' });
  const res = verifyLicense(key, publicKeyHex);
  assert.equal(res.ok, true);
  assert.equal(res.payload.sub, 'buyer@example.com');
  assert.equal(res.payload.plan, 'lifetime');
  assert.equal(res.payload.exp, null);
  assert.equal(payload.product, 'traderunner');
});

test('a key from a different private key is rejected', () => {
  const a = freshKeys();
  const b = freshKeys();
  const { key } = issueLicense(a.privateKey, { sub: 'x' });
  assert.deepEqual(verifyLicense(key, b.publicKeyHex), { ok: false, reason: 'bad_signature' });
});

test('tampering with the payload invalidates the signature', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'trial user', plan: 'trial', days: 1 });
  const [prefix, payloadB64, sig] = key.split('.');

  // Rewrite the payload to a lifetime license and keep the original signature.
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  payload.plan = 'lifetime';
  payload.exp = null;
  const forged = `${prefix}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;

  assert.deepEqual(verifyLicense(forged, publicKeyHex), { ok: false, reason: 'bad_signature' });
});

test('an expired key is rejected', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'lapsed@example.com', plan: 'monthly' });
  const future = Math.floor(Date.now() / 1000) + 40 * 86400;
  assert.deepEqual(verifyLicense(key, publicKeyHex, future), { ok: false, reason: 'expired' });
  assert.equal(verifyLicense(key, publicKeyHex).ok, true, 'still valid today');
});

test('malformed input is rejected rather than throwing', () => {
  const { publicKeyHex } = freshKeys();
  for (const bad of ['', 'nonsense', 'TR1.only-two-parts', 'XX1.a.b', 'TR1..', 'TR1.!!!.???']) {
    const res = verifyLicense(bad, publicKeyHex);
    assert.equal(res.ok, false, `${JSON.stringify(bad)} should not verify`);
  }
});

test('plan defaults map to sensible durations', () => {
  assert.equal(defaultDaysFor('lifetime'), null);
  assert.equal(defaultDaysFor('annual'), 366);
  assert.equal(defaultDaysFor('monthly'), 31);
  assert.equal(defaultDaysFor('trial'), 14);
});

test('an explicit day count overrides the plan default', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'x', plan: 'trial', days: 3 });
  const res = verifyLicense(key, publicKeyHex);
  assert.equal(res.ok, true);
  const days = (res.payload.exp - res.payload.iat) / 86400;
  assert.equal(days, 3);
});

test('each issued key gets a distinct id', () => {
  const { privateKey } = freshKeys();
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(issueLicense(privateKey, { sub: 'x' }).payload.id);
  assert.equal(ids.size, 20);
});
