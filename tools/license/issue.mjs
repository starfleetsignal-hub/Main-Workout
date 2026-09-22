#!/usr/bin/env node
/**
 * Issue a signed license key for a buyer.
 *
 *   npm run license:issue -- --sub "buyer@example.com" --plan lifetime
 *   npm run license:issue -- --sub "buyer@example.com" --plan annual
 *   npm run license:issue -- --sub "Trial user" --plan trial --days 7
 *   npm run license:issue -- --sub "buyer@example.com" --plan lifetime --count 5 --json
 *
 * Plans: lifetime (no expiry), annual (366d), monthly (31d), trial (14d).
 * --days overrides the plan's default; --days 0 means never expires.
 */
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { issueLicense, loadPrivateKey, parseArgs, publicKeyHexFromPrivate, verifyLicense } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.sub) {
  console.log('Usage: npm run license:issue -- --sub "buyer@example.com" [--plan lifetime|annual|monthly|trial]');
  console.log('                                 [--days N] [--count N] [--json] [--log licenses.csv]');
  process.exit(args.sub ? 0 : 1);
}

const plan = String(args.plan ?? 'lifetime');
if (!['lifetime', 'annual', 'monthly', 'trial'].includes(plan)) {
  console.error(`Unknown plan "${plan}". Use lifetime, annual, monthly or trial.`);
  process.exit(1);
}

const days = args.days === undefined ? undefined : Number(args.days) === 0 ? null : Number(args.days);
const count = Math.max(1, Number(args.count ?? 1));

const privateKey = loadPrivateKey();
const publicKeyHex = publicKeyHexFromPrivate(privateKey);

const issued = [];
for (let i = 0; i < count; i++) {
  const { key, payload } = issueLicense(privateKey, { sub: String(args.sub), plan, days });
  const check = verifyLicense(key, publicKeyHex);
  if (!check.ok) {
    console.error(`Self-check failed (${check.reason}) — not emitting this key.`);
    process.exit(1);
  }
  issued.push({ key, ...payload });
}

if (args.json) {
  console.log(JSON.stringify(count === 1 ? issued[0] : issued, null, 2));
} else {
  for (const it of issued) {
    console.log('');
    console.log(`  Licensed to : ${it.sub}`);
    console.log(`  Plan        : ${it.plan}`);
    console.log(`  Expires     : ${it.exp === null ? 'never' : new Date(it.exp * 1000).toISOString()}`);
    console.log(`  License id  : ${it.id}`);
    console.log('');
    console.log(it.key);
    console.log('');
  }
  console.log(`Verified against public key ${publicKeyHex}`);
}

if (args.log) {
  const file = path.resolve(process.cwd(), String(args.log));
  for (const it of issued) {
    appendFileSync(file, `${new Date().toISOString()},${it.id},${JSON.stringify(it.sub)},${it.plan},${it.exp ?? ''},${it.key}\n`);
  }
  console.error(`Appended ${issued.length} row(s) to ${file}`);
}
