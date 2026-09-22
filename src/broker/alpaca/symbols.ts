import type { AssetClass } from '../../engine/types';

/** Crypto pairs are written with a slash: "BTC/USD". Everything else is a stock. */
export function assetClassOf(symbol: string): AssetClass {
  return symbol.includes('/') ? 'crypto' : 'stock';
}

/** Alpaca positions come back as "BTCUSD"; map them to the slash form. */
export function normalizeSymbol(raw: string, assetClass?: AssetClass): string {
  const s = raw.trim().toUpperCase();
  if (s.includes('/')) return s;
  if (assetClass === 'crypto' && /^[A-Z]{2,6}(USDT|USDC|USD|BTC)$/.test(s)) {
    const quote = ['USDT', 'USDC', 'USD', 'BTC'].find((q) => s.endsWith(q))!;
    return `${s.slice(0, -quote.length)}/${quote}`;
  }
  return s;
}

export function splitByClass(symbols: string[]): { stocks: string[]; crypto: string[] } {
  const stocks: string[] = [];
  const crypto: string[] = [];
  for (const s of symbols) (assetClassOf(s) === 'crypto' ? crypto : stocks).push(s);
  return { stocks, crypto };
}
