#!/usr/bin/env node
/**
 * Generate the Ed25519 signing key pair that your license keys are built on.
 *
 *   npm run license:keygen
 *
 * Writes:
 *   license-private.key  — YOUR SECRET. Never commit it, never ship it.
 *   .env                 — EXPO_PUBLIC_LICENSE_PUBLIC_KEY=<hex>, baked into builds.
 *
 * If you lose the private key you can no longer issue keys that existing
 * builds accept, so back it up somewhere safe (a password manager works).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ENV_FILE, PRIVATE_KEY_FILE, generateKeyPair, parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));

if (existsSync(PRIVATE_KEY_FILE) && !args.force) {
  console.error(`Refusing to overwrite ${PRIVATE_KEY_FILE}.`);
  console.error('Existing license keys would stop working. Pass --force if you really mean it.');
  process.exit(1);
}

const { publicKeyHex, privateKeyPem } = generateKeyPair();

writeFileSync(PRIVATE_KEY_FILE, privateKeyPem, { mode: 0o600 });

let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
const line = `EXPO_PUBLIC_LICENSE_PUBLIC_KEY=${publicKeyHex}`;
env = /^EXPO_PUBLIC_LICENSE_PUBLIC_KEY=.*$/m.test(env)
  ? env.replace(/^EXPO_PUBLIC_LICENSE_PUBLIC_KEY=.*$/m, line)
  : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`;
writeFileSync(ENV_FILE, env);

console.log('Key pair generated.\n');
console.log(`  Private key  ${PRIVATE_KEY_FILE}   (secret — back it up, never commit)`);
console.log(`  Public key   ${publicKeyHex}`);
console.log(`\nWrote ${line} to ${ENV_FILE}.`);
console.log('\nNext: issue a key with');
console.log('  npm run license:issue -- --sub "buyer@example.com" --plan lifetime');
