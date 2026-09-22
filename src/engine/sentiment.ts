/**
 * A small, deterministic, offline financial-news sentiment scorer.
 *
 * It is intentionally simple (weighted lexicon + negation + intensifiers)
 * so it runs instantly on-device with no API key. The engine only uses it
 * as one input among several, and negative news acts as a veto rather than
 * a stand-alone signal.
 */

const POSITIVE: Record<string, number> = {
  beat: 2, beats: 2, surge: 2.5, surges: 2.5, soar: 2.5, soars: 2.5, rally: 2, rallies: 2,
  jump: 2, jumps: 2, record: 1.5, upgrade: 2.5, upgrades: 2.5, upgraded: 2.5, outperform: 2,
  buy: 1, bullish: 2, strong: 1.5, growth: 1.5, profit: 1.5, profits: 1.5, gain: 1.5, gains: 1.5,
  raises: 1.5, raised: 1.5, boost: 1.5, boosts: 1.5, approval: 2, approved: 2, approves: 2,
  partnership: 1.5, expands: 1, expansion: 1, wins: 1.5, win: 1.5, contract: 1, breakout: 2,
  tops: 1.5, exceeds: 2, exceeded: 2, momentum: 1, optimistic: 1.5, optimism: 1.5, rebound: 1.5,
  rebounds: 1.5, recovery: 1, recovers: 1, higher: 1, up: 0.5, dividend: 1,
  buyback: 1.5, accelerates: 1.5, milestone: 1, launch: 1, launches: 1, demand: 1, adoption: 1.5,
  inflows: 1.5, halving: 1, institutional: 1, positive: 1.5, best: 1, success: 1.5,
  successful: 1.5, overweight: 2, 'all-time': 1, ath: 1.5,
};

const NEGATIVE: Record<string, number> = {
  miss: -2, misses: -2, missed: -2, plunge: -2.5, plunges: -2.5, plummet: -2.5, plummets: -2.5,
  crash: -2.5, crashes: -2.5, tumble: -2, tumbles: -2, slump: -2, slumps: -2, fall: -1.5, falls: -1.5,
  drop: -1.5, drops: -1.5, downgrade: -2.5, downgrades: -2.5, downgraded: -2.5, underperform: -2,
  sell: -1, bearish: -2, weak: -1.5, loss: -1.5, losses: -1.5, decline: -1.5, declines: -1.5,
  cuts: -1.5, cut: -1, lowers: -1.5, lowered: -1.5, warning: -2, warns: -2, warned: -2,
  lawsuit: -2, sued: -2, probe: -2, investigation: -2, investigates: -2, recall: -2, recalls: -2,
  delay: -1.5, delays: -1.5, delayed: -1.5, halt: -2, halted: -2, bankruptcy: -3, bankrupt: -3,
  insolvent: -3, fraud: -3, breach: -2, outage: -1.5, layoffs: -1.5,
  layoff: -1.5, resigns: -1.5, resignation: -1.5, fined: -1.5, penalty: -1.5, ban: -2,
  banned: -2, regulatory: -0.5, subpoena: -2, outflows: -1.5, liquidation: -2,
  liquidations: -2, selloff: -2, 'sell-off': -2, dilution: -1.5, offering: -1,
  lower: -1, down: -0.5, negative: -1.5, worst: -1.5, concern: -1, concerns: -1, risk: -0.5,
  risks: -0.5, fear: -1.5, fears: -1.5, panic: -2, volatile: -0.5, underweight: -2,
  shortfall: -2, disappoints: -2, disappointing: -2, weaker: -1.5, slowdown: -1.5, slows: -1,
};

const NEGATORS = new Set(['not', 'no', 'never', 'without', 'fails', 'failed', 'fail']);
const INTENSIFIERS: Record<string, number> = {
  sharply: 1.5, strongly: 1.4, significantly: 1.4, massive: 1.5, massively: 1.5, huge: 1.4,
  very: 1.2, extremely: 1.5, slightly: 0.6, modestly: 0.6, marginally: 0.5,
};

const TOKEN_RE = /[a-z][a-z'\-]*|\d+(?:\.\d+)?%?/g;

export interface SentimentResult {
  /** -1 .. 1 */
  score: number;
  /** 0 .. 1, how much lexicon evidence was found */
  confidence: number;
  hits: { term: string; weight: number }[];
}

export function scoreSentiment(text: string): SentimentResult {
  const tokens = (text.toLowerCase().match(TOKEN_RE) ?? []) as string[];
  let total = 0;
  let hitsWeight = 0;
  const hits: { term: string; weight: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let w = POSITIVE[tok] ?? NEGATIVE[tok] ?? 0;
    if (w === 0) continue;

    // Look back up to 3 tokens for negation / intensifiers.
    let mult = 1;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const prev = tokens[j];
      if (NEGATORS.has(prev) || prev.endsWith("n't")) mult *= -0.8;
      else if (INTENSIFIERS[prev]) mult *= INTENSIFIERS[prev];
    }
    // "% up/down" patterns: "shares up 5%", "down 12%"
    const next = tokens[i + 1];
    if ((tok === 'up' || tok === 'down' || tok === 'higher' || tok === 'lower') && next && /%$/.test(next)) {
      const pct = parseFloat(next);
      if (Number.isFinite(pct)) mult *= Math.min(3, 1 + pct / 5);
    }

    w *= mult;
    total += w;
    hitsWeight += Math.abs(w);
    hits.push({ term: tok, weight: w });
  }

  if (hits.length === 0) return { score: 0, confidence: 0, hits };
  // Squash: tanh keeps the score bounded and robust to long articles.
  const score = Math.tanh(total / 4);
  const confidence = Math.min(1, hitsWeight / 6);
  return { score: round3(score), confidence: round3(confidence), hits };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Aggregate a symbol's recent news into one score. Newer items weigh more;
 * items outside the lookback window are ignored.
 */
export function aggregateNews(
  items: { createdAt: number; sentiment: number; confidence: number }[],
  now: number,
  lookbackMinutes: number
): number {
  const cutoff = now - lookbackMinutes * 60_000;
  let num = 0;
  let den = 0;
  for (const it of items) {
    if (it.createdAt < cutoff) continue;
    const age = Math.max(0, now - it.createdAt) / (lookbackMinutes * 60_000);
    const recency = 1 - 0.7 * age; // 1.0 for brand-new, 0.3 at the window edge
    const w = recency * (0.35 + 0.65 * it.confidence);
    num += w * it.sentiment;
    den += w;
  }
  if (den === 0) return 0;
  return round3(num / den);
}
