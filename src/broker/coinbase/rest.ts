import type { AccountSnapshot, AssetClass, Bar, MarketClock } from '../../engine/types';
import type { Broker, BrokerPosition, OrderRequest, OrderResult, RawNews } from '../types';
import { coinbaseJwt, parseCoinbaseSecret, type CoinbaseKey } from '../signing';
import { alwaysOpenClock, type VenueCapabilities, type VenueDescriptor } from '../venues';

const HOST = 'api.coinbase.com';
const BASE = `https://${HOST}`;

export interface CoinbaseCredentials {
  /** The full key name, e.g. organizations/{org}/apiKeys/{key}. */
  keyName: string;
  /** The EC private key PEM, or the base64 Ed25519 secret. */
  privateKey: string;
}

export const COINBASE_CAPABILITIES: VenueCapabilities = {
  stocks: false,
  crypto: true,
  shorts: false,
  news: false,
  streaming: true,
  marketHours: false,
  brokerPositions: false,
  paper: false,
  custodial: true,
  historicalBars: true,
};

export const COINBASE_DESCRIPTOR: VenueDescriptor = {
  id: 'coinbase',
  name: 'Coinbase',
  blurb: 'Spot crypto on Coinbase Advanced Trade, with a live order-book feed.',
  capabilities: COINBASE_CAPABILITIES,
  credentialFields: [
    {
      key: 'keyName',
      label: 'API key name',
      placeholder: 'organizations/…/apiKeys/…',
      secret: false,
      help: 'The full key name shown when you create a CDP API key.',
    },
    {
      key: 'privateKey',
      label: 'API private key',
      placeholder: '-----BEGIN EC PRIVATE KEY-----',
      secret: true,
      multiline: true,
      help: 'Paste the whole PEM, or the base64 Ed25519 secret for a newer key.',
    },
  ],
  symbolHint: 'BTC-USD',
  quoteCurrencies: ['USD', 'USDC', 'USDT'],
  docsUrl: 'https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/welcome',
  maturity: 'untested',
  warning:
    'Coinbase has no paper mode. Every order is real. The request signing is verified by unit tests but this adapter has not been run against a live Coinbase account.',
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Coinbase writes pairs as BTC-USD; the app uses BTC/USD everywhere. */
export function toCoinbaseProduct(symbol: string): string {
  return symbol.replace('/', '-').toUpperCase();
}
export function fromCoinbaseProduct(product: string): string {
  return product.replace('-', '/').toUpperCase();
}

export class CoinbaseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'CoinbaseError';
  }
}

/**
 * Coinbase Advanced Trade.
 *
 * Two things shape this adapter. Coinbase reports balances rather than
 * positions, so `getPositions` synthesises a position from any non-dust
 * balance and reports an entry price of zero for the engine to fill in from
 * its own record. And market buys are priced in quote currency (how many
 * dollars to spend) while sells are in base size (how much coin to sell).
 */
export class CoinbaseClient implements Broker {
  readonly label = 'Coinbase';
  readonly capabilities = COINBASE_CAPABILITIES;
  private readonly key: CoinbaseKey;
  /** Cached product metadata: increments and minimum sizes. */
  private products = new Map<string, { baseIncrement: number; quoteIncrement: number; minBase: number }>();

  constructor(private readonly creds: CoinbaseCredentials) {
    this.key = parseCoinbaseSecret(creds.privateKey);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const jwt = coinbaseJwt({
      keyName: this.creds.keyName,
      key: this.key,
      method,
      host: HOST,
      path,
    });
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep the raw text
    }
    if (!res.ok) {
      const record = parsed as Record<string, unknown> | null;
      const msg =
        (record && typeof record.message === 'string' && record.message) ||
        (record && typeof record.error_details === 'string' && record.error_details) ||
        (record && typeof record.error === 'string' && record.error) ||
        `HTTP ${res.status}`;
      throw new CoinbaseError(String(msg), res.status, parsed);
    }
    return parsed as T;
  }

  async verify(): Promise<AccountSnapshot> {
    return this.getAccount();
  }

  async getAccount(): Promise<AccountSnapshot> {
    const res = await this.request<{ accounts: Record<string, unknown>[] }>(
      'GET',
      '/api/v3/brokerage/accounts?limit=250'
    );
    let cash = 0;
    let equity = 0;
    for (const a of res.accounts ?? []) {
      const available = num((a.available_balance as Record<string, unknown> | undefined)?.value);
      const hold = num((a.hold as Record<string, unknown> | undefined)?.value);
      const currency = String(a.currency ?? '');
      const total = available + hold;
      if (currency === 'USD' || currency === 'USDC') {
        cash += total;
        equity += total;
      } else if (total > 0) {
        // Value non-cash balances at their last trade price.
        const price = await this.getLatestPrice(`${currency}/USD`, 'crypto').catch(() => null);
        if (price) equity += total * price;
      }
    }
    return {
      equity,
      // Coinbase does not publish a prior-day equity mark, so the daily-loss
      // breaker is measured from the equity seen when the engine started.
      lastEquity: equity,
      cash,
      buyingPower: cash,
      currency: 'USD',
      status: 'ACTIVE',
      at: Date.now(),
    };
  }

  async getClock(): Promise<MarketClock> {
    return alwaysOpenClock(Date.now());
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await this.request<{ accounts: Record<string, unknown>[] }>(
      'GET',
      '/api/v3/brokerage/accounts?limit=250'
    );
    const out: BrokerPosition[] = [];
    for (const a of res.accounts ?? []) {
      const currency = String(a.currency ?? '');
      if (currency === 'USD' || currency === 'USDC' || currency === 'USDT') continue;
      const available = num((a.available_balance as Record<string, unknown> | undefined)?.value);
      const hold = num((a.hold as Record<string, unknown> | undefined)?.value);
      const qty = available + hold;
      if (qty <= 0) continue;
      const symbol = `${currency}/USD`;
      const price = await this.getLatestPrice(symbol, 'crypto').catch(() => null);
      const value = price ? qty * price : 0;
      // Dust below a dollar is not a position worth managing.
      if (value < 1) continue;
      out.push({
        symbol,
        assetClass: 'crypto',
        qty,
        side: 'long',
        // Coinbase does not track an average entry price for a balance.
        avgEntryPrice: 0,
        marketValue: value,
        unrealizedPnl: 0,
      });
    }
    return out;
  }

  private async getProduct(symbol: string) {
    const product = toCoinbaseProduct(symbol);
    const cached = this.products.get(product);
    if (cached) return cached;
    const p = await this.request<Record<string, unknown>>(
      'GET',
      `/api/v3/brokerage/products/${encodeURIComponent(product)}`
    );
    const meta = {
      baseIncrement: num(p.base_increment, 0.00000001),
      quoteIncrement: num(p.quote_increment, 0.01),
      minBase: num(p.base_min_size, 0),
    };
    this.products.set(product, meta);
    return meta;
  }

  async submitMarketOrder(req: OrderRequest): Promise<OrderResult> {
    const product = toCoinbaseProduct(req.symbol);
    const meta = await this.getProduct(req.symbol).catch(() => ({
      baseIncrement: 0.00000001,
      quoteIncrement: 0.01,
      minBase: 0,
    }));

    let config: Record<string, unknown>;
    if (req.side === 'buy') {
      // A market buy is denominated in quote currency, so convert the
      // requested quantity using the latest price.
      const price = await this.getLatestPrice(req.symbol, 'crypto');
      if (!price) throw new CoinbaseError('No price available to size the order', 0);
      const quote = roundTo(req.qty * price, meta.quoteIncrement);
      config = { market_market_ioc: { quote_size: String(quote) } };
    } else {
      const base = roundTo(req.qty, meta.baseIncrement);
      config = { market_market_ioc: { base_size: String(base) } };
    }

    const body = {
      client_order_id: req.clientOrderId ?? `tr-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      product_id: product,
      side: req.side.toUpperCase(),
      order_configuration: config,
    };
    const res = await this.request<Record<string, unknown>>('POST', '/api/v3/brokerage/orders', body);
    if (res.success === false) {
      const err = res.error_response as Record<string, unknown> | undefined;
      throw new CoinbaseError(String(err?.message ?? err?.error ?? 'Order rejected'), 0, res);
    }
    const success = res.success_response as Record<string, unknown> | undefined;
    const id = String(success?.order_id ?? res.order_id ?? '');
    return {
      id,
      clientOrderId: String(success?.client_order_id ?? body.client_order_id),
      status: 'accepted',
      filledQty: 0,
      filledAvgPrice: null,
    };
  }

  async getOrder(id: string): Promise<OrderResult> {
    const res = await this.request<{ order: Record<string, unknown> }>(
      'GET',
      `/api/v3/brokerage/orders/historical/${encodeURIComponent(id)}`
    );
    const o = res.order ?? {};
    const status = String(o.status ?? 'UNKNOWN').toLowerCase();
    return {
      id: String(o.order_id ?? id),
      clientOrderId: String(o.client_order_id ?? ''),
      // Map Coinbase's vocabulary onto the engine's.
      status: status === 'open' || status === 'pending' ? 'accepted' : status,
      filledQty: num(o.filled_size),
      filledAvgPrice: o.average_filled_price == null ? null : num(o.average_filled_price) || null,
    };
  }

  async waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult> {
    if (!orderId) return { id: '', clientOrderId: '', status: 'rejected', filledQty: 0, filledAvgPrice: null };
    const deadline = Date.now() + timeoutMs;
    const terminal = new Set(['filled', 'cancelled', 'canceled', 'expired', 'failed', 'rejected']);
    let last = await this.getOrder(orderId);
    while (!terminal.has(last.status) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 600));
      last = await this.getOrder(orderId);
    }
    return last;
  }

  async closePosition(symbol: string): Promise<OrderResult | null> {
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos || pos.qty <= 0) return null;
    return this.submitMarketOrder({ symbol, assetClass: 'crypto', side: 'sell', qty: pos.qty });
  }

  async closeAllPositions(): Promise<void> {
    for (const pos of await this.getPositions()) {
      await this.closePosition(pos.symbol).catch(() => null);
    }
  }

  async getBars(symbol: string, _assetClass: AssetClass, limit: number): Promise<Bar[]> {
    const end = Math.floor(Date.now() / 1000);
    const capped = Math.min(limit, 350); // Coinbase caps a candles page at 350
    const start = end - capped * 60;
    const path =
      `/api/v3/brokerage/products/${encodeURIComponent(toCoinbaseProduct(symbol))}/candles` +
      `?start=${start}&end=${end}&granularity=ONE_MINUTE&limit=${capped}`;
    const res = await this.request<{ candles: Record<string, unknown>[] }>('GET', path);
    return (res.candles ?? [])
      .map((c) => ({
        t: num(c.start) * 1000,
        o: num(c.open),
        h: num(c.high),
        l: num(c.low),
        c: num(c.close),
        v: num(c.volume),
      }))
      .filter((b) => Number.isFinite(b.t) && b.c > 0)
      .sort((a, b) => a.t - b.t);
  }

  async getLatestPrice(symbol: string, _assetClass?: AssetClass): Promise<number | null> {
    const res = await this.request<{ trades?: Record<string, unknown>[]; best_bid?: string; best_ask?: string }>(
      'GET',
      `/api/v3/brokerage/products/${encodeURIComponent(toCoinbaseProduct(symbol))}/ticker?limit=1`
    );
    const trade = res.trades?.[0];
    if (trade) {
      const p = num(trade.price);
      if (p > 0) return p;
    }
    const bid = num(res.best_bid);
    const ask = num(res.best_ask);
    if (bid > 0 && ask > 0) return (bid + ask) / 2;
    return null;
  }

  async getNews(): Promise<RawNews[]> {
    return []; // Coinbase has no news feed.
  }
}

function roundTo(value: number, increment: number): number {
  if (!Number.isFinite(increment) || increment <= 0) return value;
  const decimals = Math.max(0, Math.min(18, Math.round(-Math.log10(increment))));
  return Number((Math.floor(value / increment) * increment).toFixed(decimals));
}
