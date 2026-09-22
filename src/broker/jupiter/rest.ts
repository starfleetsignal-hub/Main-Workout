import type { AccountSnapshot, AssetClass, Bar, MarketClock } from '../../engine/types';
import type { Broker, BrokerPosition, OrderRequest, OrderResult, RawNews } from '../types';
import { alwaysOpenClock, type VenueCapabilities, type VenueDescriptor } from '../venues';
import { parseSolanaKey, signSerializedTransaction, type SolanaWallet } from './solana';

// quote-api.jup.ag/v6 (what this adapter originally targeted) has been
// retired — it no longer resolves at all. lite-api.jup.ag/swap/v1 is
// Jupiter's current free-tier endpoint, confirmed live and returning real
// quotes; the relative paths below (/quote, /swap) are unchanged.
const QUOTE_API = 'https://lite-api.jup.ag/swap/v1';
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

export interface JupiterCredentials {
  /** base58 private key exported from a Solana wallet. */
  privateKey: string;
  /** Optional custom RPC endpoint; the public one is heavily rate limited. */
  rpcUrl?: string;
  /** Max slippage in basis points. */
  slippageBps?: string | number;
}

export const JUPITER_CAPABILITIES: VenueCapabilities = {
  stocks: false,
  crypto: true,
  shorts: false,
  news: false,
  streaming: false,
  marketHours: false,
  brokerPositions: true,
  paper: false,
  custodial: false,
  historicalBars: false,
};

export const JUPITER_DESCRIPTOR: VenueDescriptor = {
  id: 'jupiter',
  name: 'Jupiter (Solana)',
  blurb: 'On-chain swaps through the Jupiter aggregator, from a wallet you control.',
  capabilities: JUPITER_CAPABILITIES,
  credentialFields: [
    {
      key: 'privateKey',
      label: 'Wallet private key',
      placeholder: 'base58 private key',
      secret: true,
      multiline: true,
      help: 'Use a dedicated trading wallet funded with only what you are willing to lose.',
    },
    {
      key: 'rpcUrl',
      label: 'RPC endpoint',
      placeholder: DEFAULT_RPC,
      secret: false,
      optional: true,
      help: 'The public endpoint is rate limited. A private RPC is strongly recommended.',
    },
    {
      key: 'slippageBps',
      label: 'Max slippage (bps)',
      placeholder: '50',
      secret: false,
      optional: true,
      help: '50 means 0.5%. Swaps that would exceed this are rejected rather than filled badly.',
    },
  ],
  symbolHint: 'SOL-USDC',
  quoteCurrencies: ['USDC'],
  docsUrl: 'https://dev.jup.ag/docs/swap',
  maturity: 'experimental',
  warning:
    'This is self-custody. The app holds your wallet private key on this device, swaps are irreversible, and there is no broker to call if something goes wrong. On-chain execution also means slippage, failed transactions that still cost fees, and sandwich risk. Use a dedicated wallet holding only what you can afford to lose. This adapter has not been run against mainnet.',
};

/** Mints for the tokens the app supports out of the box. */
export const KNOWN_MINTS: Record<string, { mint: string; decimals: number }> = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  JUP: { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  BONK: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  JTO: { mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', decimals: 9 },
  WIF: { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  PYTH: { mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6 },
  RAY: { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
};

export class JupiterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'JupiterError';
  }
}

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  [key: string]: unknown;
}

/**
 * Jupiter.
 *
 * There is no account and no order book: a "position" is simply a token
 * balance in the wallet, and a "market order" is a swap routed by Jupiter and
 * submitted to the chain. Prices come from quoting a real trade size, which is
 * the only honest price on an AMM because it includes the impact of the trade.
 */
export class JupiterClient implements Broker {
  readonly label = 'Jupiter';
  readonly capabilities = JUPITER_CAPABILITIES;
  readonly wallet: SolanaWallet;
  private readonly rpcUrl: string;
  private readonly slippageBps: number;
  private balanceCache: { at: number; balances: Record<string, number> } | null = null;

  constructor(creds: JupiterCredentials) {
    this.wallet = parseSolanaKey(creds.privateKey);
    this.rpcUrl = (creds.rpcUrl && creds.rpcUrl.trim()) || DEFAULT_RPC;
    const bps = Number(creds.slippageBps ?? 50);
    this.slippageBps = Number.isFinite(bps) && bps > 0 ? Math.min(1000, bps) : 50;
  }

  get address(): string {
    return this.wallet.address;
  }

  // --- RPC ---------------------------------------------------------------

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = (await res.json()) as { result?: T; error?: { message?: string } };
    if (!res.ok || body.error) {
      throw new JupiterError(body.error?.message ?? `RPC ${method} failed (${res.status})`, res.status, body);
    }
    return body.result as T;
  }

  private async jup<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(QUOTE_API + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw
    }
    if (!res.ok) {
      const record = parsed as Record<string, unknown> | null;
      throw new JupiterError(String(record?.error ?? record?.message ?? `HTTP ${res.status}`), res.status, parsed);
    }
    return parsed as T;
  }

  // --- Symbols -----------------------------------------------------------

  /** "SOL/USDC" -> the two mints. */
  private resolvePair(symbol: string): { base: { mint: string; decimals: number; code: string }; quote: { mint: string; decimals: number; code: string } } {
    const [baseCode, quoteCodeRaw] = symbol.toUpperCase().split(/[/-]/);
    const quoteCode = quoteCodeRaw || 'USDC';
    const base = KNOWN_MINTS[baseCode];
    const quote = KNOWN_MINTS[quoteCode];
    if (!base) throw new JupiterError(`${baseCode} is not in the built-in token list`, 0);
    if (!quote) throw new JupiterError(`${quoteCode} is not in the built-in token list`, 0);
    return { base: { ...base, code: baseCode }, quote: { ...quote, code: quoteCode } };
  }

  // --- Broker interface --------------------------------------------------

  async verify(): Promise<AccountSnapshot> {
    return this.getAccount();
  }

  private async getBalances(force = false): Promise<Record<string, number>> {
    if (!force && this.balanceCache && Date.now() - this.balanceCache.at < 8000) {
      return this.balanceCache.balances;
    }
    const balances: Record<string, number> = {};

    const lamports = await this.rpc<{ value: number }>('getBalance', [this.wallet.address]);
    balances.SOL = (lamports?.value ?? 0) / 1e9;

    const accounts = await this.rpc<{ value: Record<string, unknown>[] }>('getTokenAccountsByOwner', [
      this.wallet.address,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]);
    const byMint = new Map<string, string>();
    for (const [code, meta] of Object.entries(KNOWN_MINTS)) byMint.set(meta.mint, code);

    for (const acc of accounts?.value ?? []) {
      const parsed = (((acc.account as Record<string, unknown>)?.data as Record<string, unknown>)?.parsed ??
        {}) as Record<string, unknown>;
      const info = (parsed.info ?? {}) as Record<string, unknown>;
      const mint = String(info.mint ?? '');
      const code = byMint.get(mint);
      if (!code) continue;
      const amount = (info.tokenAmount ?? {}) as Record<string, unknown>;
      const ui = Number(amount.uiAmount ?? 0);
      if (Number.isFinite(ui) && ui > 0) balances[code] = (balances[code] ?? 0) + ui;
    }

    this.balanceCache = { at: Date.now(), balances };
    return balances;
  }

  async getAccount(): Promise<AccountSnapshot> {
    const balances = await this.getBalances(true);
    const cash = (balances.USDC ?? 0) + (balances.USDT ?? 0);
    let equity = cash;
    for (const [code, amount] of Object.entries(balances)) {
      if (code === 'USDC' || code === 'USDT' || amount <= 0) continue;
      const price = await this.getLatestPrice(`${code}/USDC`).catch(() => null);
      if (price) equity += amount * price;
    }
    return {
      equity,
      lastEquity: equity,
      cash,
      buyingPower: cash,
      currency: 'USDC',
      status: 'wallet',
      at: Date.now(),
    };
  }

  async getClock(): Promise<MarketClock> {
    return alwaysOpenClock(Date.now());
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const balances = await this.getBalances(true);
    const out: BrokerPosition[] = [];
    for (const [code, amount] of Object.entries(balances)) {
      if (code === 'USDC' || code === 'USDT' || amount <= 0) continue;
      // Leave enough SOL behind to pay transaction fees.
      const tradable = code === 'SOL' ? Math.max(0, amount - 0.02) : amount;
      if (tradable <= 0) continue;
      const price = await this.getLatestPrice(`${code}/USDC`).catch(() => null);
      const value = price ? tradable * price : 0;
      if (value < 1) continue;
      out.push({
        symbol: `${code}/USDC`,
        assetClass: 'crypto',
        qty: tradable,
        side: 'long',
        avgEntryPrice: 0,
        marketValue: value,
        unrealizedPnl: 0,
      });
    }
    return out;
  }

  private async quote(symbol: string, side: 'buy' | 'sell', qty: number): Promise<QuoteResponse> {
    const { base, quote } = this.resolvePair(symbol);
    // Always express the trade in base units, so the quote reflects the real size.
    const amount = Math.round(qty * 10 ** base.decimals);
    if (amount <= 0) throw new JupiterError('Quantity rounds to zero at this token precision', 0);
    const params = new URLSearchParams({
      inputMint: side === 'buy' ? quote.mint : base.mint,
      outputMint: side === 'buy' ? base.mint : quote.mint,
      amount: String(amount),
      slippageBps: String(this.slippageBps),
      swapMode: side === 'buy' ? 'ExactOut' : 'ExactIn',
    });
    return this.jup<QuoteResponse>(`/quote?${params.toString()}`);
  }

  async submitMarketOrder(req: OrderRequest): Promise<OrderResult> {
    const { base, quote } = this.resolvePair(req.symbol);
    const q = await this.quote(req.symbol, req.side, req.qty);

    const swap = await this.jup<{ swapTransaction?: string; error?: string }>('/swap', {
      method: 'POST',
      body: JSON.stringify({
        quoteResponse: q,
        userPublicKey: this.wallet.address,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    if (!swap.swapTransaction) {
      throw new JupiterError(swap.error ?? 'Jupiter did not return a transaction', 0, swap);
    }

    const signed = signSerializedTransaction(swap.swapTransaction, this.wallet);
    const signature = await this.rpc<string>('sendTransaction', [
      signed,
      { encoding: 'base64', skipPreflight: false, maxRetries: 3 },
    ]);

    this.balanceCache = null;

    const inAmount = Number(q.inAmount) / 10 ** (req.side === 'buy' ? quote.decimals : base.decimals);
    const outAmount = Number(q.outAmount) / 10 ** (req.side === 'buy' ? base.decimals : quote.decimals);
    const filledQty = req.side === 'buy' ? outAmount : inAmount;
    const notional = req.side === 'buy' ? inAmount : outAmount;

    return {
      id: signature,
      clientOrderId: req.clientOrderId ?? signature,
      status: 'accepted',
      filledQty,
      filledAvgPrice: filledQty > 0 ? notional / filledQty : null,
    };
  }

  /** Polls the chain until the swap transaction is confirmed or the deadline passes. */
  async waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await this.rpc<{ value: ({ confirmationStatus?: string; err?: unknown } | null)[] }>(
        'getSignatureStatuses',
        [[orderId], { searchTransactionHistory: true }]
      ).catch(() => null);
      const status = res?.value?.[0];
      if (status) {
        if (status.err) {
          return { id: orderId, clientOrderId: orderId, status: 'rejected', filledQty: 0, filledAvgPrice: null };
        }
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return { id: orderId, clientOrderId: orderId, status: 'filled', filledQty: 0, filledAvgPrice: null };
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { id: orderId, clientOrderId: orderId, status: 'accepted', filledQty: 0, filledAvgPrice: null };
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
    return []; // No candles on-chain; the engine polls and folds its own bars.
  }

  /**
   * Prices a real one-unit trade rather than reading a mid, because on an AMM
   * the only meaningful price is the one you would actually get.
   */
  async getLatestPrice(symbol: string, _assetClass?: AssetClass): Promise<number | null> {
    try {
      const { base, quote } = this.resolvePair(symbol);
      const params = new URLSearchParams({
        inputMint: base.mint,
        outputMint: quote.mint,
        amount: String(10 ** base.decimals),
        slippageBps: String(this.slippageBps),
      });
      const q = await this.jup<QuoteResponse>(`/quote?${params.toString()}`);
      const out = Number(q.outAmount) / 10 ** quote.decimals;
      return Number.isFinite(out) && out > 0 ? out : null;
    } catch {
      return null;
    }
  }

  async getNews(): Promise<RawNews[]> {
    return [];
  }
}
