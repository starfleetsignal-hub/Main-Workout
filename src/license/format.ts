import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// @noble/ed25519 v2 needs a synchronous SHA-512 to run outside WebCrypto (Hermes, older browsers).
ed.etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(ed.etc.concatBytes(...msgs));

/**
 * License key format (version 1):
 *
 *   TR1.<payload>.<signature>
 *
 *   payload   = base64url(JSON.stringify(LicensePayload))
 *   signature = base64url(Ed25519(privateKey, utf8("TR1." + payload)))
 *
 * The app embeds only the PUBLIC key, so a key can be verified fully offline
 * but can only be created by whoever holds the private key (you).
 */
export const LICENSE_PREFIX = 'TR1';

export type LicensePlan = 'lifetime' | 'annual' | 'monthly' | 'trial';

export interface LicensePayload {
  /** format version */
  v: 1;
  /** unique license id (e.g. a Stripe checkout session id or a UUID) */
  id: string;
  /** who it was issued to (email or name); shown in Settings */
  sub: string;
  plan: LicensePlan;
  /** issued-at, unix seconds */
  iat: number;
  /** expiry, unix seconds; null = never */
  exp: number | null;
  /** optional: which product/app this key is for (defence against key reuse across your products) */
  product?: string;
}

export interface VerifiedLicense extends LicensePayload {
  key: string;
}

export type LicenseCheck =
  | { ok: true; license: VerifiedLicense }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_product' | 'no_public_key' };

export const PRODUCT_ID = 'traderunner';

const B64URL = /^[A-Za-z0-9_-]+$/;

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET[i]] = i;

/**
 * Decodes base64url without `atob`, which is not guaranteed on every JS engine
 * this app runs on (Hermes, older web views). Throws on invalid input.
 */
export function base64UrlDecode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const remainder = clean.length % 4;
  if (remainder === 1) throw new Error('bad base64url length');
  const byteLength = Math.floor((clean.length * 6) / 8);
  const out = new Uint8Array(byteLength);
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_LOOKUP[clean[i]];
    if (v === undefined) throw new Error('bad base64url character');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) throw new Error('bad hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Normalize what a user might paste: whitespace, surrounding quotes, mixed case prefix. */
export function normalizeKeyInput(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
}

export function verifyLicenseKey(
  rawKey: string,
  publicKeyHex: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): LicenseCheck {
  if (!publicKeyHex || publicKeyHex.length !== 64) return { ok: false, reason: 'no_public_key' };
  const key = normalizeKeyInput(rawKey);
  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) return { ok: false, reason: 'malformed' };
  const [, payloadB64, sigB64] = parts;
  if (!B64URL.test(payloadB64) || !B64URL.test(sigB64)) return { ok: false, reason: 'malformed' };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    !payload ||
    payload.v !== 1 ||
    typeof payload.id !== 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.iat !== 'number' ||
    !(payload.exp === null || typeof payload.exp === 'number')
  ) {
    return { ok: false, reason: 'malformed' };
  }

  let valid = false;
  try {
    const sig = base64UrlDecode(sigB64);
    const msg = utf8Bytes(`${LICENSE_PREFIX}.${payloadB64}`);
    valid = ed.verify(sig, msg, hexToBytes(publicKeyHex));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };
  if (payload.product && payload.product !== PRODUCT_ID) return { ok: false, reason: 'wrong_product' };
  if (payload.exp !== null && payload.exp <= nowSeconds) return { ok: false, reason: 'expired' };

  return { ok: true, license: { ...payload, key } };
}

export function describeLicenseFailure(reason: Extract<LicenseCheck, { ok: false }>['reason']): string {
  switch (reason) {
    case 'malformed':
      return 'That does not look like a valid license key. Check for missing characters.';
    case 'bad_signature':
      return 'This license key was not issued for this app.';
    case 'expired':
      return 'This license has expired. Renew it to keep trading.';
    case 'wrong_product':
      return 'This key belongs to a different product.';
    case 'no_public_key':
      return 'This build has no license public key configured (EXPO_PUBLIC_LICENSE_PUBLIC_KEY).';
  }
}
