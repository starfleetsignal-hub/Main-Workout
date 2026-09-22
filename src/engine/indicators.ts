import type { Bar, Indicators } from './types';

/** Exponential moving average of the closes. Returns the last value. */
export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI over closes. Returns NaN until enough data exists. */
export function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Session VWAP. For stocks the "session" resets at the first bar of the
 * current UTC day; for 24/7 crypto we use a rolling window instead.
 */
export function vwap(bars: Bar[], sessionStartMs: number | null, rollingBars = 120): number {
  let pv = 0;
  let vol = 0;
  const start = sessionStartMs === null ? Math.max(0, bars.length - rollingBars) : 0;
  for (let i = start; i < bars.length; i++) {
    const b = bars[i];
    if (sessionStartMs !== null && b.t < sessionStartMs) continue;
    const typical = b.vw ?? (b.h + b.l + b.c) / 3;
    pv += typical * b.v;
    vol += b.v;
  }
  if (vol === 0) return bars.length ? bars[bars.length - 1].c : NaN;
  return pv / vol;
}

/** Average true range (simple average of true ranges). */
export function atr(bars: Bar[], period = 14): number {
  if (bars.length < 2) return NaN;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const pc = bars[i - 1].c;
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function averageVolume(bars: Bar[], period = 20, excludeLast = true): number {
  const end = excludeLast ? bars.length - 1 : bars.length;
  const slice = bars.slice(Math.max(0, end - period), end);
  if (slice.length === 0) return NaN;
  return slice.reduce((a, b) => a + b.v, 0) / slice.length;
}

/** Start of the US regular session (13:30 UTC or 14:30 UTC depending on DST) for a timestamp. */
export function sessionStartFor(t: number, isCrypto: boolean): number | null {
  if (isCrypto) return null;
  const d = new Date(t);
  // Regular session opens 09:30 America/New_York. Approximate DST: 2nd Sunday of March → 1st Sunday of November.
  const year = d.getUTCFullYear();
  const dstStart = nthSundayUtc(year, 2, 2, 7); // March, 2nd Sunday, 07:00 UTC (2am EST)
  const dstEnd = nthSundayUtc(year, 10, 1, 6); // November, 1st Sunday, 06:00 UTC (2am EDT)
  const inDst = t >= dstStart && t < dstEnd;
  const openHourUtc = inDst ? 13 : 14;
  const open = Date.UTC(year, d.getUTCMonth(), d.getUTCDate(), openHourUtc, 30, 0, 0);
  return open;
}

function nthSundayUtc(year: number, monthIndex: number, n: number, hourUtc: number): number {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (7 - first.getUTCDay()) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return Date.UTC(year, monthIndex, day, hourUtc, 0, 0, 0);
}

export const MIN_BARS_FOR_INDICATORS = 30;

export function computeIndicators(bars: Bar[], isCrypto: boolean): Indicators | null {
  if (bars.length < MIN_BARS_FOR_INDICATORS) return null;
  const closes = bars.map((b) => b.c);
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const n = closes.length - 1;

  let recentCross: -1 | 0 | 1 = 0;
  for (let i = n; i > n - 3 && i > 0; i--) {
    const nowAbove = e9[i] > e21[i];
    const prevAbove = e9[i - 1] > e21[i - 1];
    if (nowAbove && !prevAbove) {
      recentCross = 1;
      break;
    }
    if (!nowAbove && prevAbove) {
      recentCross = -1;
      break;
    }
  }

  const last = bars[n];
  return {
    ema9: e9[n],
    ema21: e21[n],
    rsi14: rsi(closes, 14),
    vwap: vwap(bars, sessionStartFor(last.t, isCrypto)),
    atr14: atr(bars, 14),
    avgVolume20: averageVolume(bars, 20, true),
    lastVolume: last.v,
    recentCross,
  };
}
