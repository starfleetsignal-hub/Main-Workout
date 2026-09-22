import type { AccountSnapshot, AssetClass, Bar, MarketClock } from '../../engine/types';
import type { Broker, BrokerPosition, OrderRequest, OrderResult, RawNews } from '../types';
import { robinhoodSignature } from '../signing';
import { alwaysOpenClock, type VenueCapabilities, type VenueDescriptor } from '../venues';

const BASE = 'https://trading.robinhood.com';

export interface RobinhoodCredentials {
  apiKey: string;
  /** base64 Ed25519 private seed from the Robinhood key generator. */
  privateKey: string;
}

export const ROBINHOOD_CAPABILITIES: VenueCapabilities = {
  stocks: false,
  crypto: true,
  shorts: false,
  news: false,
  streaming: false,
  marketHours: false,
  brokerPositions: true,
  paper: false,
  custodial: true,
  historicalBars: false,
};

export const ROBINHOOD_DESCRIPTOR: VenueDescriptor = {
  id: 'robinhood',
  name: 'Robinhood Crypto',
  blurb: 'Crypto only. Robinhood publishes no API for stocks, so equities are unavailable here.',
  capabilities: ROBINHOOD_CAPABILITIES,
  credentialFields: [
    {
      key: 'apiKey',
      label: 'API key',
      placeholder: 'rh-api-…',
      secret: false,
      help: 'Created in your Robinhood crypto account settings on web.',
    },
    {
      key: 'privateKey',
      label: 'Private key (base64)',
      placeholder: 'base64 Ed25519 seed',
      secret: true,
      multiline: true,
      help: 'The base64 private key printed when you generated the key pair. Robinhood never shows it again.',
    },
  ],
  symbolHint: 'BTC-USD',
  quoteCurrencies: ['USD'],
  docsUrl: 'https://docs.robinhood.com/crypto/trading/',
  maturity: 'untested',
  warning:
    'Robinhood has no paper mode, so every order is real. It also offers no price history or streaming feed, so TradeRunner polls prices and needs a warm-up period before it will trade. The request signing is verified by unit tests but this adapter has not been run against a live account.',
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Robinhood writes pairs as BTC-USD; the app uses BTC/USD. */
export function toRhSymbol(symbol: string): string {
  return symbol.replace('/', '-').toUpperCase();
}
export function fromRhSymbol(symbol: string): string {
  return symbol.replace('-', '/').toUpperCase();
}

export class RobinhoodError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'RobinhoodError';
  }
}

/**
 * Robinhood Crypto.
 *
 * Signing covers the method, path and body, so the query string must be built
 * once and reused exactly. Robinhood exposes no candle endpoint, so the engine
 * runs on polled prices folded into bars locally.
 */
export class RobinhoodClient implements Broker {
  readonly label = 'Robinhood Crypto';
  readonly capabilities = ROBINHOOD_CAPABILITIES;

  constructor(private readonly creds: RobinhoodCredentials) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = robinhoodSignature(
      this.creds.privateKey,
      this.creds.apiKey,
      timestamp,
      path,
      method,
      payload
    );
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'x-api-key': this.creds.apiKey,
        'x-signature': signature,
        'x-timestamp': String(timestamp),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload === '' ? undefined : payload,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    if (!res.ok) {
      const record = parsed as Record<string, unknown> | null;
      const detail = Array.isArray(record?.errors)
        ? (record!.errors as Record<string, unknown>[]).map((e) => e.detail ?? e.message).join('; ')
        : null;
      throw new RobinhoodError(String(detail || record?.detail || `HTTP ${res.status}`), res.status, parsed);
    }
    return parsed as T;
  }

  async verify(): Promise<AccountSnapshot> {
    return this.getAccount();
  }

  async getAccount(): Promise<AccountSnapshot> {
    const acct = await this.request<Record<string, unknown>>('GET', '/api/v1/crypto/trading/accounts/');
    const cash = num(acct.buying_power);
    let equity = cash;
    for (const pos of await this.getPositions()) equity += pos.marketValue;
    return {
      equity,
      lastEquity: equity,
      cash,
      buyingPower: cash,
      currency: 'USD',
      status: String(acct.status ?? 'active'),
      at: Date.now(),
    };
  }

  async getClock(): Promise<MarketClock> {
    return alwaysOpenClock(Date.now());
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await this.request<{ results?: Record<string, unknown>[] }>(
      'GET',
      '/api/v1/crypto/trading/holdings/'
    );
    const out: BrokerPosition[] = [];
    for (const h of res.results ?? []) {
      const qty = num(h.total_quantity ?? h.quantity_available_for_trading);
      if (qty <= 0) continue;
      const code = String(h.asset_code ?? '').toUpperCase();
      if (!code || code === 'USD') continue;
      const symbol = `${code}/USD`;
      const price = await this.getLatestPrice(symbol).catch(() => null);
      const value = price ? qty * price : 0;
      if (value < 1) continue; // dust
      out.push({
        symbol,
        assetClass: 'crypto',
        qty,
        side: 'long',
        avgEntryPrice: 0, // Robinhood's holdings endpoint does not give a cost basis here
        marketValue: value,
        unrealizedPnl: 0,
      });
    }
    return out;
  }

  async submitMarketOrder(req: OrderRequest): Promise<OrderResult> {
    const clientOrderId = req.clientOrderId ?? uuidLike();
    const body = {
      client_order_id: clientOrderId,
      symbol: toRhSymbol(req.symbol),
      side: req.side,
      type: 'market',
      market_order_config: { asset_quantity: String(req.qty) },
    };
    const res = await this.request<Record<string, unknown>>('POST', '/api/v1/crypto/trading/orders/', body);
    return this.mapOrder(res, clientOrderId);
  }

  async getOrder(id: string): Promise<OrderResult> {
    const res = await this.request<Record<string, unknown>>(
      'GET',
      `/api/v1/crypto/trading/orders/${encodeURIComponent(id)}/`
    );
    return this.mapOrder(res);
  }

  async waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult> {
    if (!orderId) return { id: '', clientOrderId: '', status: 'rejected', filledQty: 0, filledAvgPrice: null };
    const deadline = Date.now() + timeoutMs;
    const terminal = new Set(['filled', 'canceled', 'cancelled', 'rejected', 'failed']);
    let last = await this.getOrder(orderId);
    while (!terminal.has(last.status) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      last = await this.getOrder(orderId);
    }
    return last;
  }

  async closePosition(symbol: string): Promise<OrderResult | null> {
    const pos = (await this.getPositions()).find((p) => p.symbol === symbol);
    if (!pos || pos.qty <= 0) return null;
    return this.submitMarketOrder({ symbol, assetClass: 'crypto', side: 'sell', qty: pos.qty });
  }

  async closeAllPositions(): Promise<void> {
    for (const pos of await this.getPositions()) {
      await this.closePosition(pos.symbol).catch(() => null);
    }
  }

  async getBars(): Promise<Bar[]> {
    // No candle endpoint. The engine folds polled prices into bars instead.
    return [];
  }

  async getLatestPrice(symbol: string, _assetClass?: AssetClass): Promise<number | null> {
    const rh = toRhSymbol(symbol);
    const res = await this.request<{ results?: Record<string, unknown>[] }>(
      'GET',
      `/api/v1/crypto/marketdata/best_bid_ask/?symbol=${encodeURIComponent(rh)}`
    );
    const row = res.results?.[0];
    if (!row) return null;
    const bid = num(row.bid_inclusive_of_sell_spread ?? row.price);
    const ask = num(row.ask_inclusive_of_buy_spread ?? row.price);
    if (bid > 0 && ask > 0) return (bid + ask) / 2;
    const price = num(row.price);
    return price > 0 ? price : null;
  }

  async getNews(): Promise<RawNews[]> {
    return [];
  }

  private mapOrder(o: Record<string, unknown>, fallbackClientId = ''): OrderResult {
    const executions = Array.isArray(o.executions) ? (o.executions as Record<string, unknown>[]) : [];
    let qty = 0;
    let notional = 0;
    for (const e of executions) {
      const q = num(e.quantity);
      qty += q;
      notional += q * num(e.effective_price);
    }
    const state = String(o.state ?? 'open').toLowerCase();
    return {
      id: String(o.id ?? ''),
      clientOrderId: String(o.client_order_id ?? fallbackClientId),
      status: state === 'open' || state === 'new' || state === 'partially_filled' ? 'accepted' : state,
      filledQty: qty || num(o.filled_asset_quantity),
      filledAvgPrice: qty > 0 ? notional / qty : null,
    };
  }
}

/** A UUID-shaped id without pulling in a crypto dependency for a non-secret value. */
function uuidLike(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-a${out.slice(17, 20)}-${out.slice(20, 32)}`;
}
