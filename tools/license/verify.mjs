#!/usr/bin/env node
/**
 * Check a license key the same way the app does — useful for support tickets.
 *
 *   npm run license:verify -- "TR1.xxxx.yyyy"
 */
import { loadPublicKeyHex, parseArgs, verifyLicense } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const key = args.key ?? args._[0];

if (!key) {
  console.error('Usage: npm run license:verify -- "TR1.<payload>.<signature>"');
  process.exit(1);
}

const publicKeyHex = args.pub ? String(args.pub) : loadPublicKeyHex();
if (!publicKeyHex) {
  console.error('No public key found. Set EXPO_PUBLIC_LICENSE_PUBLIC_KEY, add it to .env, or pass --pub <hex>.');
  process.exit(1);
}

const res = verifyLicense(String(key), publicKeyHex);
if (!res.ok) {
  console.log(`INVALID (${res.reason})`);
  process.exit(2);
}

console.log('VALID');
console.log(`  Licensed to : ${res.payload.sub}`);
console.log(`  Plan        : ${res.payload.plan}`);
console.log(`  Issued      : ${new Date(res.payload.iat * 1000).toISOString()}`);
console.log(`  Expires     : ${res.payload.exp === null ? 'never' : new Date(res.payload.exp * 1000).toISOString()}`);
console.log(`  License id  : ${res.payload.id}`);
