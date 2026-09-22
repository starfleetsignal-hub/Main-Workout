import type { Parameters } from './parameters';
import type { MarketClock, Side, Signal, SignalComponent, SymbolState } from './types';

/**
 * The entry model: a transparent additive score out of 100 built from
 * trend, momentum, volume and news components. Anything that makes an
 * entry unacceptable is a "blocker" (hard veto), independent of the score.
 *
 * This mirrors a discretionary day-trader's checklist:
 *   - is price above VWAP and the fast EMA above the slow EMA? (trend)
 *   - did the fast EMA just cross? (fresh momentum, not chasing)
 *   - is RSI healthy but not overbought?
 *   - is volume confirming?
 *   - is the news flow supportive, or at least not hostile?
 */
export function evaluateEntry(
  state: SymbolState,
  params: Parameters,
  clock: MarketClock | null,
  now: number
): Signal {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const ind = state.indicators;

  const base: Signal = {
    symbol: state.symbol,
    side: null,
    score: 0,
    components: [],
    reasons,
    blockers,
    at: now,
  };

  if (!ind) {
    blockers.push('Warming up: not enough bars for indicators');
    return base;
  }
  if (!Number.isFinite(state.lastPrice) || state.lastPrice <= 0) {
    blockers.push('No live price yet');
    return base;
  }
  if (state.assetClass === 'stock' && !params.tradeStocks) blockers.push('Stock trading disabled');
  if (state.assetClass === 'crypto' && !params.tradeCrypto) blockers.push('Crypto trading disabled');
  if (state.cooldownUntil > now) {
    blockers.push(`Cooling down for ${Math.ceil((state.cooldownUntil - now) / 60_000)}m`);
  }

  if (state.assetClass === 'stock' && params.stockSessionOnly) {
    if (!clock) blockers.push('Market clock unavailable');
    else if (!clock.isOpen) blockers.push('Market closed');
    else {
      const minsToClose = (clock.nextClose - now) / 60_000;
      if (minsToClose <= params.flattenBeforeCloseMinutes) blockers.push('Too close to market close');
      const sessionOpen = clock.nextClose - 6.5 * 60 * 60_000;
      const minsSinceOpen = (now - sessionOpen) / 60_000;
      if (minsSinceOpen >= 0 && minsSinceOpen < params.skipOpeningMinutes) {
        blockers.push('Skipping the opening minutes');
      }
    }
  }

  // Stale data guard: don't trade off a price that is more than 3 minutes old.
  if (state.lastTickAt && now - state.lastTickAt > 3 * 60_000) {
    blockers.push('Price feed stale');
  }

  const longScore = scoreSide('long', state, params);
  const shortScore =
    params.allowShorts && state.assetClass === 'stock' ? scoreSide('short', state, params) : null;

  let chosen: { side: Side; total: number; components: SignalComponent[] };
  if (shortScore && shortScore.total > longScore.total) chosen = { side: 'short', ...shortScore };
  else chosen = { side: 'long', ...longScore };

  // News veto and confirmation apply to the direction being considered.
  const directional = chosen.side === 'long' ? state.newsScore : -state.newsScore;
  if (directional < params.newsVetoSentiment) {
    blockers.push(`News sentiment ${fmt(state.newsScore)} is below the veto level`);
  }
  if (params.requireNewsConfirmation && state.news.length === 0) {
    blockers.push('No recent news to confirm the move');
  }
  if (directional < params.newsMinSentiment) {
    blockers.push(`News sentiment ${fmt(state.newsScore)} is below the minimum`);
  }

  for (const c of chosen.components) reasons.push(`${c.name}: ${c.detail} (+${c.points}/${c.max})`);

  return {
    ...base,
    side: blockers.length === 0 && chosen.total >= params.minSignalScore ? chosen.side : null,
    score: Math.round(chosen.total),
    components: chosen.components,
  };
}

function scoreSide(
  side: Side,
  state: SymbolState,
  params: Parameters
): { total: number; components: SignalComponent[] } {
  const ind = state.indicators!;
  const px = state.lastPrice;
  const dir = side === 'long' ? 1 : -1;
  const components: SignalComponent[] = [];

  // Trend vs VWAP (20)
  const vsVwap = ((px - ind.vwap) / ind.vwap) * dir;
  components.push({
    name: 'VWAP',
    max: 20,
    points: vsVwap > 0 ? Math.min(20, 12 + Math.round(vsVwap * 100 * 4)) : 0,
    detail: `price ${vsVwap >= 0 ? 'on the right side of' : 'on the wrong side of'} VWAP by ${(Math.abs(vsVwap) * 100).toFixed(2)}%`,
  });

  // EMA alignment (20)
  const emaSpread = ((ind.ema9 - ind.ema21) / ind.ema21) * dir;
  components.push({
    name: 'EMA 9/21',
    max: 20,
    points: emaSpread > 0 ? Math.min(20, 12 + Math.round(emaSpread * 100 * 6)) : 0,
    detail: emaSpread >= 0 ? 'fast EMA aligned with the trade direction' : 'fast EMA against the trade direction',
  });

  // Fresh cross (10)
  const crossed = ind.recentCross === dir;
  components.push({
    name: 'Fresh cross',
    max: 10,
    points: crossed ? 10 : 0,
    detail: crossed ? 'EMA crossover in the last 3 bars' : 'no recent crossover',
  });

  // RSI (15): long wants rsiMin..rsiMax; short mirrors around 50.
  const r = side === 'long' ? ind.rsi14 : 100 - ind.rsi14;
  const inBand = Number.isFinite(r) && r >= params.rsiMin && r <= params.rsiMax;
  components.push({
    name: 'RSI',
    max: 15,
    points: inBand ? 15 : Number.isFinite(r) && r > params.rsiMax ? 4 : 0,
    detail: `RSI ${Number.isFinite(ind.rsi14) ? ind.rsi14.toFixed(0) : 'n/a'} (want ${params.rsiMin}-${params.rsiMax}${side === 'short' ? ', mirrored' : ''})`,
  });

  // Volume (15)
  const volMult = ind.avgVolume20 > 0 ? ind.lastVolume / ind.avgVolume20 : 0;
  const volOk = volMult >= params.minVolumeMultiple;
  components.push({
    name: 'Volume',
    max: 15,
    points: volOk ? Math.min(15, 9 + Math.round((volMult - params.minVolumeMultiple) * 4)) : 0,
    detail: `${volMult.toFixed(2)}x 20-bar average (need ${params.minVolumeMultiple}x)`,
  });

  // News (20): maps directional sentiment -1..1 → 0..20, neutral = 10.
  const directional = state.newsScore * dir;
  components.push({
    name: 'News',
    max: 20,
    points: Math.round(10 + directional * 10),
    detail:
      state.news.length === 0
        ? 'no recent news (neutral)'
        : `${state.news.length} item${state.news.length === 1 ? '' : 's'}, sentiment ${fmt(state.newsScore)}`,
  });

  const total = components.reduce((a, c) => a + Math.max(0, Math.min(c.max, c.points)), 0);
  return { total, components };
}

export function fmt(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}
