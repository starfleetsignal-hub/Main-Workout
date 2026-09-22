import type { AssetClass, Bar, StreamStatus } from '../engine/types';
import type { Broker, MarketStreams, StreamHandlers } from './types';
import { assetClassOf } from './alpaca/symbols';

/**
 * A stand-in for a push feed on venues that do not offer one.
 *
 * It polls the venue's latest-price endpoint and folds those prices into
 * one-minute bars locally, emitting the same ticks and bars the engine would
 * get from a WebSocket. The engine therefore needs no knowledge of which
 * venues stream and which do not.
 *
 * The tradeoff is real and worth stating: polled data is coarser than a live
 * tape, a fast move between two polls is invisible, and on a venue with no
 * candle history the indicators need a full warm-up before the engine will
 * trade at all.
 */
export interface PollingOptions {
  /** How often to ask for a price, in milliseconds. */
  intervalMs?: number;
  /** Bar size to aggregate into, in milliseconds. */
  barMs?: number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  now?: () => number;
}

interface Building {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  samples: number;
}

export class PollingStreams implements MarketStreams {
  private timer: ReturnType<typeof setInterval> | null = null;
  private symbols: string[] = [];
  private handlers: StreamHandlers | null = null;
  private building = new Map<string, Building>();
  private consecutiveFailures = 0;
  private inFlight = false;
  private readonly intervalMs: number;
  private readonly barMs: number;
  private readonly now: () => number;

  constructor(
    private readonly broker: Broker,
    private readonly opts: PollingOptions = {}
  ) {
    this.intervalMs = opts.intervalMs ?? 15_000;
    this.barMs = opts.barMs ?? 60_000;
    this.now = opts.now ?? (() => Date.now());
  }

  start(symbols: string[], handlers: StreamHandlers) {
    this.stop();
    this.symbols = [...symbols];
    this.handlers = handlers;
    // There is no news feed behind a polled venue.
    handlers.onStatus('news', 'off');
    this.setStatuses('connecting');
    void this.poll();
    this.timer = (this.opts.setInterval ?? setInterval)(() => {
      void this.poll();
    }, this.intervalMs);
  }

  updateSymbols(symbols: string[]) {
    this.symbols = [...symbols];
    for (const key of [...this.building.keys()]) {
      if (!symbols.includes(key)) this.building.delete(key);
    }
  }

  stop() {
    if (this.timer) (this.opts.clearInterval ?? clearInterval)(this.timer);
    this.timer = null;
    this.building.clear();
    if (this.handlers) this.setStatuses('off');
    this.handlers = null;
  }

  /** Exposed so tests can drive a poll without waiting on a timer. */
  async poll(): Promise<void> {
    const handlers = this.handlers;
    if (!handlers || this.inFlight) return;
    this.inFlight = true;
    try {
      const results = await Promise.allSettled(
        this.symbols.map(async (symbol) => {
          const price = await this.broker.getLatestPrice(symbol, assetClassOf(symbol) as AssetClass);
          return { symbol, price };
        })
      );

      let anyOk = false;
      for (const r of results) {
        if (r.status !== 'fulfilled' || r.value.price == null || !Number.isFinite(r.value.price)) continue;
        anyOk = true;
        const { symbol, price } = r.value;
        const t = this.now();
        handlers.onTick(symbol, price, 0, t);
        this.fold(symbol, price, t, handlers);
      }

      if (anyOk || this.symbols.length === 0) {
        this.consecutiveFailures = 0;
        this.setStatuses('connected');
      } else {
        this.consecutiveFailures += 1;
        this.setStatuses(this.consecutiveFailures > 2 ? 'error' : 'reconnecting');
      }
    } finally {
      this.inFlight = false;
    }
  }

  /** Folds a price sample into the bar currently being built for that symbol. */
  private fold(symbol: string, price: number, t: number, handlers: StreamHandlers) {
    const bucket = Math.floor(t / this.barMs) * this.barMs;
    const current = this.building.get(symbol);

    if (!current) {
      this.building.set(symbol, { t: bucket, o: price, h: price, l: price, c: price, v: 1, samples: 1 });
      return;
    }
    if (bucket > current.t) {
      // The previous bar is complete. Volume is a sample count, not real
      // traded volume, which is why polled venues use a lower volume bar.
      handlers.onBar(symbol, toBar(current));
      this.building.set(symbol, { t: bucket, o: price, h: price, l: price, c: price, v: 1, samples: 1 });
      return;
    }
    current.h = Math.max(current.h, price);
    current.l = Math.min(current.l, price);
    current.c = price;
    current.v += 1;
    current.samples += 1;
  }

  private setStatuses(status: StreamStatus) {
    const handlers = this.handlers;
    if (!handlers) return;
    const hasCrypto = this.symbols.some((s) => assetClassOf(s) === 'crypto');
    const hasStocks = this.symbols.some((s) => assetClassOf(s) === 'stock');
    handlers.onStatus('crypto', hasCrypto ? status : 'off');
    handlers.onStatus('stocks', hasStocks ? status : 'off');
  }
}

function toBar(b: Building): Bar {
  return { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
}

/**
 * Builds synthetic bars from a price series, used to seed indicators on venues
 * with no candle endpoint so the engine has something to work with sooner.
 */
export function barsFromPrices(prices: { t: number; p: number }[], barMs = 60_000): Bar[] {
  const byBucket = new Map<number, Building>();
  for (const { t, p } of prices) {
    const bucket = Math.floor(t / barMs) * barMs;
    const cur = byBucket.get(bucket);
    if (!cur) byBucket.set(bucket, { t: bucket, o: p, h: p, l: p, c: p, v: 1, samples: 1 });
    else {
      cur.h = Math.max(cur.h, p);
      cur.l = Math.min(cur.l, p);
      cur.c = p;
      cur.v += 1;
    }
  }
  return [...byBucket.values()].sort((a, b) => a.t - b.t).map(toBar);
}
