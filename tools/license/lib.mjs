// Shared helpers for the license tooling. Node 18+ only (uses built-in Ed25519).
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const PREFIX = 'TR1';
export const PRODUCT_ID = 'traderunner';
export const PRIVATE_KEY_FILE = path.resolve(process.cwd(), 'license-private.key');
export const ENV_FILE = path.resolve(process.cwd(), '.env');

export function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  return {
    publicKeyHex: Buffer.from(pubJwk.x, 'base64url').toString('hex'),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    privateSeedHex: Buffer.from(privJwk.d, 'base64url').toString('hex'),
  };
}

export function loadPrivateKey(file = PRIVATE_KEY_FILE) {
  const pem = process.env.LICENSE_PRIVATE_KEY_PEM || (existsSync(file) ? readFileSync(file, 'utf8') : null);
  if (!pem) {
    throw new Error(
      `No private key. Run "npm run license:keygen" first, or set LICENSE_PRIVATE_KEY_PEM. Looked for: ${file}`
    );
  }
  return createPrivateKey(pem);
}

export function publicKeyHexFromPrivate(privateKey) {
  const pub = createPublicKey(privateKey).export({ format: 'jwk' });
  return Buffer.from(pub.x, 'base64url').toString('hex');
}

export function loadPublicKeyHex() {
  if (process.env.EXPO_PUBLIC_LICENSE_PUBLIC_KEY) return process.env.EXPO_PUBLIC_LICENSE_PUBLIC_KEY.trim();
  if (existsSync(ENV_FILE)) {
    const m = readFileSync(ENV_FILE, 'utf8').match(/^EXPO_PUBLIC_LICENSE_PUBLIC_KEY=([0-9a-fA-F]{64})/m);
    if (m) return m[1];
  }
  return null;
}

/**
 * Issue a signed license key.
 * @param {import('node:crypto').KeyObject} privateKey
 * @param {{sub: string, plan?: string, days?: number|null, id?: string}} opts
 */
export function issueLicense(privateKey, opts) {
  const iat = Math.floor(Date.now() / 1000);
  const plan = opts.plan ?? 'lifetime';
  const days = opts.days === undefined ? defaultDaysFor(plan) : opts.days;
  const payload = {
    v: 1,
    id: opts.id ?? randomUUID(),
    sub: opts.sub,
    plan,
    iat,
    exp: days === null ? null : iat + Math.round(days * 86400),
    product: PRODUCT_ID,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(null, Buffer.from(`${PREFIX}.${payloadB64}`, 'utf8'), privateKey);
  return { key: `${PREFIX}.${payloadB64}.${b64url(sig)}`, payload };
}

export function defaultDaysFor(plan) {
  switch (plan) {
    case 'monthly':
      return 31;
    case 'annual':
      return 366;
    case 'trial':
      return 14;
    default:
      return null;
  }
}

/** Verify with a raw hex public key; mirrors src/license/format.ts. */
export function verifyLicense(key, publicKeyHex, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(key).trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'malformed' };
  const [, payloadB64, sigB64] = parts;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const pub = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKeyHex, 'hex').toString('base64url') },
    format: 'jwk',
  });
  const valid = verify(null, Buffer.from(`${PREFIX}.${payloadB64}`, 'utf8'), pub, Buffer.from(sigB64, 'base64url'));
  if (!valid) return { ok: false, reason: 'bad_signature' };
  if (payload.product && payload.product !== PRODUCT_ID) return { ok: false, reason: 'wrong_product' };
  if (payload.exp !== null && payload.exp <= nowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}
