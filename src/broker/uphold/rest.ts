import type { AccountSnapshot, AssetClass, Bar, MarketClock } from '../../engine/types';
import type { Broker, BrokerPosition, OrderRequest, OrderResult, RawNews } from '../types';
import { alwaysOpenClock, type VenueCapabilities, type VenueDescriptor } from '../venues';

export interface UpholdCredentials {
  /** Personal Access Token or OAuth bearer token. */
  token: string;
  /** 'live' or 'sandbox'. */
  mode?: string;
}

export const UPHOLD_CAPABILITIES: VenueCapabilities = {
  stocks: false,
  crypto: true,
  shorts: false,
  news: false,
  streaming: false,
  marketHours: false,
  brokerPositions: true,
  paper: true,
  custodial: true,
  historicalBars: false,
};

export const UPHOLD_DESCRIPTOR: VenueDescriptor = {
  id: 'uphold',
  name: 'Uphold',
  blurb: 'Converts between currency cards. A sandbox is available for testing without real funds.',
  capabilities: UPHOLD_CAPABILITIES,
  credentialFields: [
    {
      key: 'token',
      label: 'Access token',
      placeholder: 'Personal Access Token',
      secret: true,
      multiline: true,
      help: 'Create a Personal Access Token in your Uphold account settings.',
    },
  ],
  symbolHint: 'BTC-USD',
  quoteCurrencies: ['USD', 'USDC'],
  docsUrl: 'https://developer.uphold.com/',
  maturity: 'untested',
  warning:
    'Uphold is a conversion service, not an order book. It has no order types, no candle history and no streaming feed, so TradeRunner polls prices, builds its own bars and exits by converting back. Spreads are wider than an exchange and that materially changes short-horizon results. This adapter has not been run against a live Uphold account.',
};

const HOSTS: Record<string, string> = {
  live: 'https://api.uphold.com',
  sandbox: 'https://api-sandbox.uphold.com',
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export class UpholdError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'UpholdError';
  }
}

interface UpholdCard {
  id: string;
  currency: string;
  balance: number;
  available: number;
}

/**
 * Uphold.
 *
 * The model is "cards": one balance per currency. Buying BTC means creating a
 * transaction from the USD card to the BTC card and committing it, so a
 * "market order" here is a conversion, and the engine's notion of a fill price
 * is derived from the amounts on either side of that conversion.
 */
export class UpholdClient implements Broker {
  readonly label = 'Uphold';
  readonly capabilities = UPHOLD_CAPABILITIES;
  private readonly base: string;
  private cards: UpholdCard[] = [];
  private cardsAt = 0;

  constructor(private readonly creds: UpholdCredentials) {
    this.base = HOSTS[creds.mode === 'sandbox' ? 'sandbox' : 'live'];
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.token}`,
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
      // keep raw text
    }
    if (!res.ok) {
      const record = parsed as Record<string, unknown> | null;
      throw new UpholdError(String(record?.error ?? record?.message ?? `HTTP ${res.status}`), res.status, parsed);
    }
    return parsed as T;
  }

  async verify(): Promise<AccountSnapshot> {
    return this.getAccount();
  }

  private async getCards(force = false): Promise<UpholdCard[]> {
    if (!force && Date.now() - this.cardsAt < 10_000 && this.cards.length) return this.cards;
    const raw = await this.request<Record<string, unknown>[]>('GET', '/v0/me/cards');
    this.cards = raw.map((c) => ({
      id: String(c.id),
      currency: String(c.currency ?? '').toUpperCase(),
      balance: num(c.balance),
      available: num(c.available),
    }));
    this.cardsAt = Date.now();
    return this.cards;
  }

  private async cardFor(currency: string): Promise<UpholdCard | null> {
    const cards = await this.getCards();
    return cards.find((c) => c.currency === currency.toUpperCase()) ?? null;
  }

  async getAccount(): Promise<AccountSnapshot> {
    const cards = await this.getCards(true);
    let cash = 0;
    let equity = 0;
    for (const card of cards) {
      if (card.balance <= 0) continue;
      if (card.currency === 'USD' || card.currency === 'USDC') {
        cash += card.available;
        equity += card.balance;
      } else {
        const price = await this.getLatestPrice(`${card.currency}/USD`).catch(() => null);
        if (price) equity += card.balance * price;
      }
    }
    return {
      equity,
      lastEquity: equity,
      cash,
      buyingPower: cash,
      currency: 'USD',
      status: 'active',
      at: Date.now(),
    };
  }

  async getClock(): Promise<MarketClock> {
    return alwaysOpenClock(Date.now());
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const cards = await this.getCards(true);
    const out: BrokerPosition[] = [];
    for (const card of cards) {
      if (card.currency === 'USD' || card.currency === 'USDC' || card.balance <= 0) continue;
      const symbol = `${card.currency}/USD`;
      const price = await this.getLatestPrice(symbol).catch(() => null);
      const value = price ? card.balance * price : 0;
      if (value < 1) continue;
      out.push({
        symbol,
        assetClass: 'crypto',
        qty: card.balance,
        side: 'long',
        avgEntryPrice: 0,
        marketValue: value,
        unrealizedPnl: 0,
      });
    }
    return out;
  }

  /**
   * A conversion, created then committed. Buying moves value from the USD card
   * into the asset card; selling does the reverse.
   */
  async submitMarketOrder(req: OrderRequest): Promise<OrderResult> {
    const [base, quote] = req.symbol.split('/');
    if (!base || !quote) throw new UpholdError(`Cannot read the pair "${req.symbol}"`, 0);

    const fromCurrency = req.side === 'buy' ? quote : base;
    const toCurrency = req.side === 'buy' ? base : quote;
    const fromCard = await this.cardFor(fromCurrency);
    if (!fromCard) throw new UpholdError(`No ${fromCurrency} card on this account`, 0);
    const toCard = await this.cardFor(toCurrency);
    if (!toCard) throw new UpholdError(`No ${toCurrency} card on this account. Create one in Uphold first.`, 0);

    // Denominate in the base asset either way, so the requested quantity is
    // what actually moves.
    const created = await this.request<Record<string, unknown>>(
      'POST',
      `/v0/me/cards/${encodeURIComponent(fromCard.id)}/transactions`,
      {
        denomination: { amount: String(req.qty), currency: base },
        destination: toCard.id,
      }
    );

    const id = String(created.id ?? '');
    if (!id) throw new UpholdError('Uphold did not return a transaction id', 0, created);
    const committed = await this.request<Record<string, unknown>>(
      'POST',
      `/v0/me/cards/${encodeURIComponent(fromCard.id)}/transactions/${encodeURIComponent(id)}/commit`
    );
    this.cardsAt = 0; // balances changed
    return this.mapTransaction(committed, req.clientOrderId ?? id);
  }

  async waitForFill(orderId: string): Promise<OrderResult> {
    // Commit is synchronous, so by the time an id exists the conversion is done.
    const tx = await this.request<Record<string, unknown>>(
      'GET',
      `/v0/me/transactions/${encodeURIComponent(orderId)}`
    ).catch(() => null);
    if (!tx) return { id: orderId, clientOrderId: orderId, status: 'filled', filledQty: 0, filledAvgPrice: null };
    return this.mapTransaction(tx, orderId);
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
    return []; // No candle history; the engine polls and folds its own bars.
  }

  async getLatestPrice(symbol: string, _assetClass?: AssetClass): Promise<number | null> {
    const pair = symbol.replace('/', '').toUpperCase();
    const res = await this.request<Record<string, unknown> | Record<string, unknown>[]>(
      'GET',
      `/v0/ticker/${encodeURIComponent(pair)}`
    );
    const row = Array.isArray(res) ? res[0] : res;
    if (!row) return null;
    const bid = num(row.bid);
    const ask = num(row.ask);
    if (bid > 0 && ask > 0) return (bid + ask) / 2;
    return null;
  }

  async getNews(): Promise<RawNews[]> {
    return [];
  }

  private mapTransaction(tx: Record<string, unknown>, clientOrderId: string): OrderResult {
    const origin = (tx.origin ?? {}) as Record<string, unknown>;
    const destination = (tx.destination ?? {}) as Record<string, unknown>;
    const status = String(tx.status ?? 'completed').toLowerCase();
    const baseAmount = num(destination.amount);
    const quoteAmount = num(origin.amount);
    const rate = num(tx.rate);
    return {
      id: String(tx.id ?? ''),
      clientOrderId,
      status: status === 'completed' ? 'filled' : status === 'pending' ? 'accepted' : status,
      filledQty: baseAmount,
      filledAvgPrice: rate > 0 ? rate : baseAmount > 0 ? quoteAmount / baseAmount : null,
    };
  }
}
