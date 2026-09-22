#!/usr/bin/env node
/**
 * Compiles the parts of the app that run outside Metro:
 *
 *   dist-node/  CommonJS — the engine and broker core, used by the headless
 *               runner and the tests.
 *   dist-esm/   ES modules — the license verifier, which depends on the
 *               ESM-only @noble/ed25519 and so cannot be emitted as CommonJS.
 *
 * Both are build artifacts and are not committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

for (const project of ['tsconfig.node.json', 'tsconfig.license.json']) {
  process.stdout.write(`tsc -p ${project}\n`);
  execFileSync(process.execPath, [tsc, '-p', path.join(root, project)], { stdio: 'inherit' });
}

// Node needs this marker to read dist-esm/*.js as ES modules.
const esmDir = path.join(root, 'dist-esm');
mkdirSync(esmDir, { recursive: true });
writeFileSync(path.join(esmDir, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`);
