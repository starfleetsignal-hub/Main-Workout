import * as ed from '@noble/ed25519';
import { base64ToBytes, bytesToBase64, concatBytes } from '../signing';

/**
 * The minimum Solana plumbing needed to sign and submit a swap that Jupiter
 * has already built for us. Pulling in @solana/web3.js would drag a large
 * dependency (and Node polyfills) into a React Native bundle for what is, in
 * the end, one Ed25519 signature written into a byte array.
 */

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP: Record<string, number> = {};
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP[B58_ALPHABET[i]] = i;

export function base58Decode(s: string): Uint8Array {
  const input = s.trim();
  if (!input) throw new Error('empty base58 string');
  const bytes: number[] = [0];
  for (const ch of input) {
    const value = B58_MAP[ch];
    if (value === undefined) throw new Error(`invalid base58 character "${ch}"`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1' characters are leading zero bytes.
  for (let i = 0; i < input.length && input[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

export function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
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
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

export interface SolanaWallet {
  /** 32-byte Ed25519 seed. */
  secret: Uint8Array;
  /** 32-byte public key. */
  publicKey: Uint8Array;
  address: string;
}

/**
 * Accepts the formats wallets actually export: a base58 64-byte keypair
 * (Phantom, Solflare), a base58 32-byte seed, a JSON byte array (solana-keygen),
 * or base64.
 */
export function parseSolanaKey(input: string): SolanaWallet {
  const trimmed = input.trim();
  let raw: Uint8Array | null = null;

  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as number[];
      if (Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n < 256)) {
        raw = new Uint8Array(arr);
      }
    } catch {
      raw = null;
    }
  }
  if (!raw) {
    try {
      raw = base58Decode(trimmed);
    } catch {
      raw = null;
    }
  }
  if (!raw || (raw.length !== 32 && raw.length !== 64)) {
    try {
      const b64 = base64ToBytes(trimmed);
      if (b64.length === 32 || b64.length === 64) raw = b64;
    } catch {
      // fall through to the error below
    }
  }
  if (!raw || (raw.length !== 32 && raw.length !== 64)) {
    throw new Error('Unrecognised Solana key. Paste the base58 private key your wallet exports.');
  }

  const secret = raw.slice(0, 32);
  const publicKey = raw.length === 64 ? raw.slice(32) : ed.getPublicKey(secret);
  if (raw.length === 64) {
    // Guard against a corrupted paste: the embedded public key must match.
    const derived = ed.getPublicKey(secret);
    for (let i = 0; i < 32; i++) {
      if (derived[i] !== publicKey[i]) {
        throw new Error('This key pair is inconsistent. Re-copy the private key from your wallet.');
      }
    }
  }
  return { secret, publicKey, address: base58Encode(publicKey) };
}

/** Reads a compact-u16 (Solana's short vector length prefix). */
export function readCompactU16(bytes: Uint8Array, offset: number): { value: number; size: number } {
  let value = 0;
  let size = 0;
  for (;;) {
    if (offset + size >= bytes.length) throw new Error('truncated compact-u16');
    const byte = bytes[offset + size];
    value |= (byte & 0x7f) << (size * 7);
    size += 1;
    if ((byte & 0x80) === 0) break;
    if (size > 3) throw new Error('compact-u16 too long');
  }
  return { value, size };
}

/**
 * Signs a transaction that Jupiter returned, as base64.
 *
 * Layout: [compact-u16 signature count][64-byte signatures...][message].
 * Jupiter builds the transaction with the user as fee payer, so our signature
 * belongs in the first slot and the message is signed verbatim.
 */
export function signSerializedTransaction(base64Tx: string, wallet: SolanaWallet): string {
  const tx = base64ToBytes(base64Tx);
  const { value: sigCount, size: prefixSize } = readCompactU16(tx, 0);
  if (sigCount < 1) throw new Error('transaction expects no signatures');
  const sigStart = prefixSize;
  const messageStart = sigStart + sigCount * 64;
  if (messageStart > tx.length) throw new Error('transaction is truncated');

  const message = tx.slice(messageStart);
  const signature = ed.sign(message, wallet.secret);

  const out = new Uint8Array(tx);
  out.set(signature, sigStart);
  return bytesToBase64(out);
}

/** Returns the transaction's message bytes, for callers that want to inspect it. */
export function transactionMessage(base64Tx: string): Uint8Array {
  const tx = base64ToBytes(base64Tx);
  const { value: sigCount, size: prefixSize } = readCompactU16(tx, 0);
  return tx.slice(prefixSize + sigCount * 64);
}

export { concatBytes };
