#!/usr/bin/env node
/**
 * Compiles the parts of the app that run outside Metro — the engine, the
 * broker adapters and the license verifier — into `dist-esm/`, which the
 * headless runner and the test suite import.
 *
 * The output is ES modules because several dependencies (@noble/ed25519,
 * @noble/curves, @noble/hashes) ship ESM only. It is a build artifact and is
 * not committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const outDir = path.join(root, 'dist-esm');

rmSync(outDir, { recursive: true, force: true });
process.stdout.write('tsc -p tsconfig.node.json\n');
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.node.json')], { stdio: 'inherit' });

// Node needs this marker to read dist-esm/*.js as ES modules.
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`);

/**
 * The source uses extensionless relative imports because that is what Metro
 * expects. Node's ES module resolver requires the extension, so add it to the
 * emitted output rather than contorting the source for the sake of the tests.
 */
function addExtensions(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      addExtensions(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    const src = readFileSync(full, 'utf8');
    const out = src.replace(
      /(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.[^'"]*?)\2/g,
      (match, prefix, quote, spec) => (/\.[a-z]+$/i.test(spec) ? match : `${prefix}${quote}${spec}.js${quote}`)
    );
    if (out !== src) writeFileSync(full, out);
  }
}

addExtensions(outDir);
process.stdout.write(`built ${path.relative(root, outDir)}\n`);
