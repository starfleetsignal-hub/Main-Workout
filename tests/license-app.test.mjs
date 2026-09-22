/**
 * Cross-checks the app's own verifier (src/license/format.ts, the code that
 * actually gates the UI) against keys issued by the seller-side tooling.
 * If these two ever disagree, paying customers get locked out — so this is
 * the most important test in the suite.
 */
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateKeyPair, issueLicense } from '../tools/license/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { verifyLicenseKey, base64UrlDecode, normalizeKeyInput, describeLicenseFailure } = await import(
  path.join(root, 'dist-esm/format.js')
);

function freshKeys() {
  const kp = generateKeyPair();
  return { privateKey: createPrivateKey(kp.privateKeyPem), publicKeyHex: kp.publicKeyHex };
}

test('the app accepts a key issued by the seller tooling', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'buyer@example.com', plan: 'lifetime' });
  const res = verifyLicenseKey(key, publicKeyHex);
  assert.equal(res.ok, true);
  assert.equal(res.license.sub, 'buyer@example.com');
  assert.equal(res.license.plan, 'lifetime');
  assert.equal(res.license.key, key);
});

test('the app rejects a key signed by a different private key', () => {
  const a = freshKeys();
  const b = freshKeys();
  const { key } = issueLicense(a.privateKey, { sub: 'pirate' });
  assert.deepEqual(verifyLicenseKey(key, b.publicKeyHex), { ok: false, reason: 'bad_signature' });
});

test('the app rejects an edited payload even with a valid-looking structure', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'trial', plan: 'trial', days: 1 });
  const [prefix, payloadB64, sig] = key.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  payload.exp = null;
  payload.plan = 'lifetime';
  const forged = `${prefix}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;
  assert.deepEqual(verifyLicenseKey(forged, publicKeyHex), { ok: false, reason: 'bad_signature' });
});

test('the app rejects an expired key', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'lapsed', plan: 'monthly' });
  const future = Math.floor(Date.now() / 1000) + 40 * 86400;
  assert.deepEqual(verifyLicenseKey(key, publicKeyHex, future), { ok: false, reason: 'expired' });
});

test('a build with no public key cannot be activated by anything', () => {
  const { privateKey } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'buyer' });
  assert.deepEqual(verifyLicenseKey(key, ''), { ok: false, reason: 'no_public_key' });
  assert.deepEqual(verifyLicenseKey(key, 'abc'), { ok: false, reason: 'no_public_key' });
});

test('a key for a different product is rejected', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  // Issue with the right signature but a foreign product id.
  const iat = Math.floor(Date.now() / 1000);
  const payload = { v: 1, id: 'x', sub: 'buyer', plan: 'lifetime', iat, exp: null, product: 'someotherapp' };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(null, Buffer.from(`TR1.${payloadB64}`, 'utf8'), privateKey).toString('base64url');
  assert.deepEqual(verifyLicenseKey(`TR1.${payloadB64}.${sig}`, publicKeyHex), { ok: false, reason: 'wrong_product' });
});

test('garbage input is rejected without throwing', () => {
  const { publicKeyHex } = freshKeys();
  const inputs = [
    '',
    'hello',
    'TR1.abc',
    'TR2.abc.def',
    'TR1...',
    'TR1.$$$.%%%',
    'TR1.' + 'a'.repeat(200) + '.' + 'b'.repeat(90),
    null,
    undefined,
  ];
  for (const bad of inputs) {
    const res = verifyLicenseKey(String(bad ?? ''), publicKeyHex);
    assert.equal(res.ok, false, `${JSON.stringify(bad)} must not verify`);
    assert.equal(typeof describeLicenseFailure(res.reason), 'string');
  }
});

test('pasted keys survive stray whitespace and quotes', () => {
  const { privateKey, publicKeyHex } = freshKeys();
  const { key } = issueLicense(privateKey, { sub: 'buyer' });
  const messy = `  "${key.slice(0, 20)}\n${key.slice(20)}"  `;
  assert.equal(normalizeKeyInput(messy), key);
  assert.equal(verifyLicenseKey(messy, publicKeyHex).ok, true);
});

test('base64url decoding matches Node for random payloads', () => {
  for (let i = 0; i < 50; i++) {
    const len = 1 + Math.floor(Math.random() * 64);
    const bytes = Buffer.from(Array.from({ length: len }, () => Math.floor(Math.random() * 256)));
    const encoded = bytes.toString('base64url');
    assert.deepEqual(Buffer.from(base64UrlDecode(encoded)), bytes, `mismatch for ${encoded}`);
  }
});

test('base64url decoding rejects invalid characters', () => {
  assert.throws(() => base64UrlDecode('abc!def'));
});
