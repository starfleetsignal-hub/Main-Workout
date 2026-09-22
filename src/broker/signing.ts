import * as ed from '@noble/ed25519';
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64UrlDecode } from '../license/format';

/**
 * Request signing shared by the exchange adapters. Each venue authenticates
 * differently, and all of it has to work on Hermes, so everything here is
 * pure JS with no WebCrypto and no Node built-ins.
 *
 *   Robinhood Crypto  Ed25519 over api_key + timestamp + path + method + body
 *   Coinbase          a short-lived ES256 (or EdDSA) JWT per request
 *   Uphold            a bearer token, no signing at all
 *   Jupiter           no auth; the Solana transaction itself is signed
 */

const B64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const c = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64_STD[a >> 2];
    out += B64_STD[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64_STD[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64_STD[c & 63];
  }
  return out;
}

/** Accepts either the standard or the URL-safe base64 alphabet. */
export function base64ToBytes(s: string): Uint8Array {
  const cleaned = s.replace(/\s+/g, '').replace(/=+$/, '');
  return base64UrlDecode(cleaned.replace(/\+/g, '-').replace(/\//g, '_'));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Robinhood Crypto
// ---------------------------------------------------------------------------

/**
 * Robinhood signs `apiKey + timestamp + path + method + body` with Ed25519.
 * The stored private key is a base64 32-byte seed, not a PKCS#8 blob.
 */
export function robinhoodSignature(
  privateKeyBase64: string,
  apiKey: string,
  timestampSeconds: number,
  path: string,
  method: string,
  body: string
): string {
  const seed = base64ToBytes(privateKeyBase64);
  if (seed.length !== 32) {
    // Some exports include the 32-byte public key appended; take the seed half.
    if (seed.length === 64) return robinhoodSignature(bytesToBase64(seed.slice(0, 32)), apiKey, timestampSeconds, path, method, body);
    throw new Error(`Robinhood private key must decode to 32 bytes, got ${seed.length}`);
  }
  const message = utf8(`${apiKey}${timestampSeconds}${path}${method.toUpperCase()}${body}`);
  return bytesToBase64(ed.sign(message, seed));
}

// ---------------------------------------------------------------------------
// Coinbase Advanced Trade
// ---------------------------------------------------------------------------

export type CoinbaseKeyKind = 'ec' | 'ed25519';

export interface CoinbaseKey {
  kind: CoinbaseKeyKind;
  /** 32-byte private scalar (EC) or Ed25519 seed. */
  secret: Uint8Array;
}

/**
 * Coinbase hands out two shapes of API secret:
 *   - a PEM "EC PRIVATE KEY" (SEC1) for the original ES256 scheme
 *   - a base64 64-byte Ed25519 keypair for the newer EdDSA scheme
 */
export function parseCoinbaseSecret(secret: string): CoinbaseKey {
  const trimmed = secret.trim().replace(/\\n/g, '\n');
  if (trimmed.includes('BEGIN EC PRIVATE KEY')) {
    return { kind: 'ec', secret: sec1PrivateScalar(pemBody(trimmed)) };
  }
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    // PKCS#8. For P-256 the SEC1 structure is nested inside an OCTET STRING.
    return { kind: 'ec', secret: sec1PrivateScalar(pemBody(trimmed), true) };
  }
  let raw: Uint8Array | null = null;
  try {
    raw = base64ToBytes(trimmed);
  } catch {
    raw = null;
  }
  if (raw && raw.length === 64) return { kind: 'ed25519', secret: raw.slice(0, 32) };
  if (raw && raw.length === 32) return { kind: 'ed25519', secret: raw };
  throw new Error('Unrecognised Coinbase API secret. Paste the EC private key PEM or the base64 Ed25519 secret.');
}

function pemBody(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return base64ToBytes(body);
}

/**
 * Pulls the 32-byte private scalar out of a SEC1 (or PKCS#8-wrapped SEC1)
 * P-256 key. Deliberately minimal: it walks for the first OCTET STRING of
 * length 32 that sits inside the key structure rather than pulling in a
 * full ASN.1 parser.
 */
export function sec1PrivateScalar(der: Uint8Array, pkcs8 = false): Uint8Array {
  // SEC1: SEQUENCE { INTEGER 1, OCTET STRING(32) privateKey, ... }
  // PKCS#8: SEQUENCE { INTEGER 0, SEQUENCE {..}, OCTET STRING { SEC1 } }
  for (let i = 0; i + 34 <= der.length; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
      // Guard against matching the 0x04 uncompressed-point marker of the
      // public key, which is preceded by a BIT STRING tag (0x03).
      const prev = der[i - 1];
      if (prev === 0x03 || prev === 0x00) continue;
      return der.slice(i + 2, i + 34);
    }
  }
  throw new Error(`Could not read the private key from this ${pkcs8 ? 'PKCS#8' : 'SEC1'} PEM.`);
}

/** Random hex nonce for the JWT header, using Math.random only as a last resort. */
function nonceHex(getRandom?: (n: number) => Uint8Array): string {
  const bytes = getRandom
    ? getRandom(16)
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CoinbaseJwtOptions {
  keyName: string;
  key: CoinbaseKey;
  method: string;
  host: string;
  path: string;
  nowSeconds?: number;
  getRandom?: (n: number) => Uint8Array;
}

/** Builds the per-request JWT Coinbase expects in the Authorization header. */
export function coinbaseJwt(opts: CoinbaseJwtOptions): string {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const alg = opts.key.kind === 'ec' ? 'ES256' : 'EdDSA';
  const header = {
    alg,
    typ: 'JWT',
    kid: opts.keyName,
    nonce: nonceHex(opts.getRandom),
  };
  const payload = {
    iss: 'cdp',
    sub: opts.keyName,
    nbf: now,
    exp: now + 120,
    uri: `${opts.method.toUpperCase()} ${opts.host}${opts.path}`,
  };
  const signingInput = `${bytesToBase64Url(utf8(JSON.stringify(header)))}.${bytesToBase64Url(
    utf8(JSON.stringify(payload))
  )}`;

  let signature: Uint8Array;
  if (opts.key.kind === 'ec') {
    const digest = sha256(utf8(signingInput));
    // JWS wants the raw r||s pair, which is what noble returns by default.
    signature = p256.sign(digest, opts.key.secret, { prehash: false });
  } else {
    signature = ed.sign(utf8(signingInput), opts.key.secret);
  }
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}
