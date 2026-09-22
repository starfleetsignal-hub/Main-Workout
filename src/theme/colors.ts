/**
 * The CosmoPlan palette: a deep-space gradient, warm gold as the primary
 * accent, and cyan/green/coral for state. Carried over so TradeRunner reads
 * as part of the same family of apps.
 */
export const colors = {
  // Background gradient stops, painted from top to bottom.
  bgTop: '#160B2E',
  bgMid: '#0A0E27',
  bgBottom: '#05070F',
  /** Flat fallback where a gradient is not practical. */
  bg: '#0A0E27',

  card: '#1B2140',
  cardRaised: '#232A4E',
  cardLine: 'rgba(255,255,255,0.08)',
  cardLineStrong: 'rgba(255,255,255,0.16)',

  text: '#EDEFFA',
  textMuted: '#9AA3C4',
  textFaint: '#6B7599',

  gold: '#F5C542',
  goldGlow: 'rgba(245,197,66,0.55)',
  goldSoft: 'rgba(245,197,66,0.14)',
  goldLine: 'rgba(245,197,66,0.40)',

  cyan: '#4FD1E8',
  cyanSoft: 'rgba(79,209,232,0.14)',
  cyanLine: 'rgba(79,209,232,0.35)',

  up: '#57D68D',
  upSoft: 'rgba(87,214,141,0.14)',
  down: '#FF6B5E',
  downSoft: 'rgba(255,107,94,0.14)',
  pink: '#E85D8A',
  lock: '#4B5279',

  onGold: '#1A1405',
  onAccent: '#04220F',
  shadow: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(5,7,15,0.88)',

  // Aliases kept so older call sites read naturally.
  get accent() {
    return this.gold;
  },
  get accentSoft() {
    return this.goldSoft;
  },
  get divider() {
    return this.cardLine;
  },
  get bgElevated() {
    return this.cardRaised;
  },
  get cardBorder() {
    return this.cardLine;
  },
  get warn() {
    return this.gold;
  },
  get warnSoft() {
    return this.goldSoft;
  },
};

export const BG_GRADIENT = [colors.bgTop, colors.bgMid, colors.bgBottom] as const;

export function pnlColor(n: number): string {
  if (n > 0) return colors.up;
  if (n < 0) return colors.down;
  return colors.textMuted;
}

export const statusColors: Record<string, string> = {
  stopped: colors.lock,
  starting: colors.gold,
  running: colors.up,
  halted: colors.down,
  error: colors.down,
  off: colors.lock,
  connecting: colors.gold,
  connected: colors.up,
  reconnecting: colors.gold,
};

/** Per-asset brand colours for the coin marks, so they read at a glance. */
export const ASSET_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  BTC: { base: '#F7931A', light: '#FFC46B', dark: '#A65B00' },
  ETH: { base: '#7B8CFF', light: '#B3BEFF', dark: '#3C4CA8' },
  SOL: { base: '#14F195', light: '#8FFFD2', dark: '#0B8F58' },
  USDC: { base: '#2775CA', light: '#79ADEA', dark: '#134476' },
  USDT: { base: '#26A17B', light: '#7FD3BA', dark: '#125A44' },
  DOGE: { base: '#C3A634', light: '#E6D68A', dark: '#7A6718' },
  LINK: { base: '#2A5ADA', light: '#7E9BF0', dark: '#16317A' },
  JUP: { base: '#C7F284', light: '#E4FFC0', dark: '#7EA83F' },
  BONK: { base: '#FFAA2C', light: '#FFD08A', dark: '#A66500' },
  AVAX: { base: '#E84142', light: '#F79192', dark: '#8E1F20' },
  XRP: { base: '#8DA1B9', light: '#C3CFDD', dark: '#4E5C6E' },
  ADA: { base: '#0033AD', light: '#5C82D6', dark: '#001C61' },
  MATIC: { base: '#8247E5', light: '#B78FF2', dark: '#4A238C' },
  DOT: { base: '#E6007A', light: '#FF74B8', dark: '#8A0049' },
  LTC: { base: '#A6A9AA', light: '#D3D5D6', dark: '#5F6162' },
};

export const DEFAULT_ASSET_COLOR = { base: '#6E7BB8', light: '#A6B0DC', dark: '#3A4370' };

export function assetColor(symbol: string) {
  const base = symbol.split('/')[0].toUpperCase();
  return ASSET_COLORS[base] ?? DEFAULT_ASSET_COLOR;
}
