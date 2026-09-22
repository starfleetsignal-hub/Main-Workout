import type { AccountSnapshot, AssetClass, Bar, MarketClock } from '../../engine/types';
import type { Broker, BrokerPosition, OrderRequest, OrderResult, RawNews } from '../types';
import { normalizeSymbol } from './symbols';

export type AlpacaMode = 'paper' | 'live';
export type AlpacaFeed = 'iex' | 'sip';

export interface AlpacaCredentials {
  keyId: string;
  secretKey: string;
  mode: AlpacaMode;
  /** IEX is included with every account; SIP requires a paid market-data plan. */
  feed: AlpacaFeed;
}

export const ALPACA_TRADING_URL: Record<AlpacaMode, string> = {
  paper: 'https://paper-api.alpaca.markets',
  live: 'https://api.alpaca.markets',
};
export const ALPACA_DATA_URL = 'https://data.alpaca.markets';

export class AlpacaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'AlpacaError';
  }
}

interface RawOrder {
  id: string;
  client_order_id: string;
  status: string;
  filled_qty: string | null;
  filled_avg_price: string | null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function toBar(raw: { t: string; o: number; h: number; l: number; c: number; v: number; vw?: number }): Bar {
  return { t: Date.parse(raw.t), o: raw.o, h: raw.h, l: raw.l, c: raw.c, v: raw.v, vw: raw.vw };
}

/** Alpaca's REST trading + market-data API, written against the global `fetch`. */
export class AlpacaClient implements Broker {
  readonly label: string;

  constructor(private readonly creds: AlpacaCredentials) {
    this.label = `Alpaca (${creds.mode})`;
  }

  get mode(): AlpacaMode {
    return this.creds.mode;
  }

  private headers(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': this.creds.keyId,
      'APCA-API-SECRET-KEY': this.creds.secretKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(base + path, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    if (!res.ok) {
      const msg =
        body && typeof body === 'object' && 'message' in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).message)
          : `HTTP ${res.status}`;
      throw new AlpacaError(msg, res.status, body);
    }
    return body as T;
  }

  private trading<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(ALPACA_TRADING_URL[this.creds.mode], path, init);
  }

  private data<T>(path: string): Promise<T> {
    return this.request<T>(ALPACA_DATA_URL, path);
  }

  /** Cheap connectivity/credential check. */
  async verify(): Promise<AccountSnapshot> {
    return this.getAccount();
  }

  async getAccount(): Promise<AccountSnapshot> {
    const a = await this.trading<Record<string, unknown>>('/v2/account');
    return {
      equity: num(a.equity),
      lastEquity: num(a.last_equity, num(a.equity)),
      cash: num(a.cash),
      buyingPower: num(a.buying_power),
      currency: String(a.currency ?? 'USD'),
      status: String(a.status ?? 'unknown'),
      at: Date.now(),
    };
  }

  async getClock(): Promise<MarketClock> {
    const c = await this.trading<{ is_open: boolean; next_open: string; next_close: string }>('/v2/clock');
    return {
      isOpen: !!c.is_open,
      nextOpen: Date.parse(c.next_open),
      nextClose: Date.parse(c.next_close),
      at: Date.now(),
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const raw = await this.trading<Record<string, unknown>[]>('/v2/positions');
    return raw.map((p) => {
      const assetClass: AssetClass = p.asset_class === 'crypto' ? 'crypto' : 'stock';
      const qty = Math.abs(num(p.qty));
      return {
        symbol: normalizeSymbol(String(p.symbol), assetClass),
        assetClass,
        qty,
        side: p.side === 'short' ? 'short' : 'long',
        avgEntryPrice: num(p.avg_entry_price),
        marketValue: num(p.market_value),
        unrealizedPnl: num(p.unrealized_pl),
      };
    });
  }

  async submitMarketOrder(req: OrderRequest): Promise<OrderResult> {
    const body = {
      symbol: req.symbol,
      qty: String(req.qty),
      side: req.side,
      type: 'market',
      // Crypto orders on Alpaca must be GTC; fractional stock orders must be DAY.
      time_in_force: req.assetClass === 'crypto' ? 'gtc' : 'day',
      client_order_id: req.clientOrderId,
    };
    const o = await this.trading<RawOrder>('/v2/orders', { method: 'POST', body: JSON.stringify(body) });
    return this.mapOrder(o);
  }

  async getOrder(id: string): Promise<OrderResult> {
    return this.mapOrder(await this.trading<RawOrder>(`/v2/orders/${encodeURIComponent(id)}`));
  }

  async waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult> {
    const deadline = Date.now() + timeoutMs;
    let last = await this.getOrder(orderId);
    const terminal = new Set(['filled', 'canceled', 'expired', 'rejected', 'done_for_day', 'replaced']);
    while (!terminal.has(last.status) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 600));
      last = await this.getOrder(orderId);
    }
    return last;
  }

  async closePosition(symbol: string): Promise<OrderResult | null> {
    try {
      const o = await this.trading<RawOrder>(`/v2/positions/${encodeURIComponent(symbol.replace('/', ''))}`, {
        method: 'DELETE',
      });
      return o && o.id ? this.mapOrder(o) : null;
    } catch (e) {
      if (e instanceof AlpacaError && e.status === 404) return null; // already flat
      throw e;
    }
  }

  async closeAllPositions(): Promise<void> {
    await this.trading('/v2/positions?cancel_orders=true', { method: 'DELETE' });
  }

  async getBars(symbol: string, assetClass: AssetClass, limit: number): Promise<Bar[]> {
    // Ask for a generous window; the API only returns bars that exist.
    const start = new Date(Date.now() - (assetClass === 'crypto' ? 1 : 5) * 24 * 60 * 60_000).toISOString();
    const path =
      assetClass === 'crypto'
        ? `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=1Min&start=${start}&limit=${limit}&sort=desc`
        : `/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}&timeframe=1Min&start=${start}&limit=${limit}&sort=desc&feed=${this.creds.feed}`;
    const res = await this.data<{ bars: Record<string, { t: string; o: number; h: number; l: number; c: number; v: number; vw?: number }[]> }>(path);
    const list = res.bars?.[symbol] ?? [];
    return list.map(toBar).sort((a, b) => a.t - b.t);
  }

  async getLatestPrice(symbol: string, assetClass: AssetClass): Promise<number | null> {
    const path =
      assetClass === 'crypto'
        ? `/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`
        : `/v2/stocks/trades/latest?symbols=${encodeURIComponent(symbol)}&feed=${this.creds.feed}`;
    const res = await this.data<{ trades: Record<string, { p: number }> }>(path);
    const t = res.trades?.[symbol];
    return t ? num(t.p, 0) || null : null;
  }

  async getNews(symbols: string[], limit: number): Promise<RawNews[]> {
    const qs = symbols.length ? `&symbols=${encodeURIComponent(symbols.join(','))}` : '';
    const res = await this.data<{ news: Record<string, unknown>[] }>(
      `/v1beta1/news?limit=${Math.min(50, limit)}&sort=desc&include_content=false${qs}`
    );
    return (res.news ?? []).map(mapNews);
  }

  private mapOrder(o: RawOrder): OrderResult {
    return {
      id: o.id,
      clientOrderId: o.client_order_id,
      status: o.status,
      filledQty: num(o.filled_qty),
      filledAvgPrice: o.filled_avg_price == null ? null : num(o.filled_avg_price),
    };
  }
}

export function mapNews(n: Record<string, unknown>): RawNews {
  return {
    id: String(n.id),
    headline: String(n.headline ?? ''),
    summary: String(n.summary ?? ''),
    source: String(n.source ?? ''),
    url: n.url ? String(n.url) : undefined,
    symbols: Array.isArray(n.symbols) ? n.symbols.map((s) => normalizeSymbol(String(s))) : [],
    createdAt: Date.parse(String(n.created_at ?? n.updated_at ?? '')) || Date.now(),
  };
}
