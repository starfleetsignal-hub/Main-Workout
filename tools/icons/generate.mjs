#!/usr/bin/env node
/**
 * Regenerates the app icons from inline SVG using the Chromium that Playwright
 * provides. Run it after changing the brand mark:
 *
 *   node tools/icons/generate.mjs
 *
 * It is a build-time helper, not part of the app bundle. If Playwright or its
 * Chromium is not installed, it exits cleanly and leaves the committed PNGs
 * alone.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const assets = path.join(root, 'assets');
mkdirSync(assets, { recursive: true });

const BG = '#0B0E14';
const ACCENT = '#3B82F6';
const ACCENT_DIM = '#1D4ED8';

/** The mark: a rising candle-chart arrow, drawn on a 1024 grid. */
function mark({ scale = 1, color = ACCENT, dim = ACCENT_DIM } = {}) {
  const s = scale;
  return `
    <g transform="translate(512 512) scale(${s}) translate(-512 -512)">
      <rect x="196" y="606" width="76" height="180" rx="16" fill="${dim}"/>
      <rect x="326" y="510" width="76" height="276" rx="16" fill="${dim}"/>
      <rect x="456" y="566" width="76" height="220" rx="16" fill="${dim}"/>
      <rect x="586" y="414" width="76" height="372" rx="16" fill="${dim}"/>
      <rect x="716" y="322" width="76" height="464" rx="16" fill="${dim}"/>
      <path d="M212 556 L364 428 L494 500 L723 265" fill="none" stroke="${color}"
            stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M800 186 L763 303 L684 227 Z" fill="${color}" stroke="${color}"
            stroke-width="24" stroke-linejoin="round"/>
    </g>`;
}

const svgs = {
  'icon.png': {
    size: 1024,
    svg: `<rect width="1024" height="1024" fill="${BG}"/>${mark({ scale: 0.82 })}`,
  },
  'android-icon-background.png': {
    size: 1024,
    svg: `<rect width="1024" height="1024" fill="${BG}"/>`,
  },
  'android-icon-foreground.png': {
    // Android masks the outer ~28%, so the mark is drawn smaller.
    size: 1024,
    svg: mark({ scale: 0.56 }),
  },
  'android-icon-monochrome.png': {
    size: 1024,
    svg: mark({ scale: 0.56, color: '#FFFFFF', dim: '#FFFFFF' }),
  },
  'splash-icon.png': {
    size: 512,
    svg: `<g transform="scale(0.5)">${mark({ scale: 0.86 })}</g>`,
  },
  'favicon.png': {
    size: 64,
    svg: `<g transform="scale(0.0625)"><rect width="1024" height="1024" fill="${BG}"/>${mark({ scale: 0.86 })}</g>`,
  },
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
  } catch {
    console.log('Playwright not available — keeping the existing icons.');
    process.exit(0);
  }
}

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();

for (const [file, { size, svg }] of Object.entries(svgs)) {
  const html = `<!doctype html><html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svg}</svg>
  </body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.locator('svg').screenshot({ path: path.join(assets, file), omitBackground: true });
  console.log(`wrote assets/${file} (${size}px)`);
}

await browser.close();
