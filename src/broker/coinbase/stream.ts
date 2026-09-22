import type { Bar, StreamStatus } from '../../engine/types';
import type { MarketStreams, StreamHandlers } from '../types';
import { coinbaseJwt, parseCoinbaseSecret, type CoinbaseKey } from '../signing';
import { fromCoinbaseProduct, toCoinbaseProduct, type CoinbaseCredentials } from './rest';

const WS_URL = 'wss://advanced-trade-ws.coinbase.com';

type Msg = Record<string, unknown>;

/**
 * Coinbase's Advanced Trade WebSocket. Each subscribe frame carries its own
 * JWT, and the socket drops the connection when that JWT expires, so the
 * subscription is refreshed on a timer well inside the two-minute window.
 */
export class CoinbaseStreams implements MarketStreams {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private symbols: string[] = [];
  private handlers: StreamHandlers | null = null;
  private readonly key: CoinbaseKey;

  constructor(private readonly creds: CoinbaseCredentials) {
    this.key = parseCoinbaseSecret(creds.privateKey);
  }

  start(symbols: string[], handlers: StreamHandlers) {
    this.stop();
    this.stopped = false;
    this.symbols = symbols.filter((s) => s.includes('/'));
    this.handlers = handlers;
    handlers.onStatus('stocks', 'off');
    handlers.onStatus('news', 'off');
    if (this.symbols.length === 0) {
      handlers.onStatus('crypto', 'off');
      return;
    }
    this.connect();
  }

  updateSymbols(symbols: string[]) {
    const next = symbols.filter((s) => s.includes('/'));
    const added = next.filter((s) => !this.symbols.includes(s));
    const removed = this.symbols.filter((s) => !next.includes(s));
    this.symbols = next;
    if (!this.ws || this.ws.readyState !== 1) return;
    if (removed.length) this.send('unsubscribe', removed);
    if (added.length) {
      this.send('subscribe', added, 'ticker');
      this.send('subscribe', added, 'candles');
    }
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.reconnectTimer = null;
    this.refreshTimer = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.handlers?.onStatus('crypto', 'off');
    this.handlers = null;
  }

  private status(s: StreamStatus, detail?: string) {
    this.handlers?.onStatus('crypto', s, detail);
  }

  private send(type: 'subscribe' | 'unsubscribe', productIds: string[], channel?: string) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const channels = channel ? [channel] : ['ticker', 'candles'];
    for (const ch of channels) {
      this.ws.send(
        JSON.stringify({
          type,
          product_ids: productIds.map(toCoinbaseProduct),
          channel: ch,
          jwt: coinbaseJwt({
            keyName: this.creds.keyName,
            key: this.key,
            method: 'GET',
            host: 'advanced-trade-ws.coinbase.com',
            path: '/',
          }),
        })
      );
    }
  }

  private connect() {
    if (this.stopped) return;
    this.status(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      this.status('error', String(e));
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.status('connected');
      this.send('subscribe', this.symbols, 'ticker');
      this.send('subscribe', this.symbols, 'candles');
      // Re-authenticate before the JWT lapses.
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      this.refreshTimer = setInterval(() => this.send('subscribe', this.symbols, 'ticker'), 90_000);
    };
    ws.onmessage = (ev: MessageEvent) => {
      let msg: Msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onerror = () => this.status('error', 'socket error');
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private handle(msg: Msg) {
    const handlers = this.handlers;
    if (!handlers) return;
    const channel = String(msg.channel ?? '');
    if (channel === 'subscriptions') return;
    const events = Array.isArray(msg.events) ? (msg.events as Msg[]) : [];

    if (channel === 'ticker') {
      for (const ev of events) {
        for (const t of (ev.tickers as Msg[] | undefined) ?? []) {
          const symbol = fromCoinbaseProduct(String(t.product_id ?? ''));
          const price = Number(t.price);
          if (symbol && Number.isFinite(price)) {
            handlers.onTick(symbol, price, Number(t.last_size ?? 0), Date.parse(String(msg.timestamp)) || Date.now());
          }
        }
      }
      return;
    }

    if (channel === 'candles') {
      for (const ev of events) {
        for (const c of (ev.candles as Msg[] | undefined) ?? []) {
          const symbol = fromCoinbaseProduct(String(c.product_id ?? ''));
          const bar: Bar = {
            t: Number(c.start) * 1000,
            o: Number(c.open),
            h: Number(c.high),
            l: Number(c.low),
            c: Number(c.close),
            v: Number(c.volume),
          };
          if (symbol && Number.isFinite(bar.t) && bar.c > 0) handlers.onBar(symbol, bar);
        }
      }
      return;
    }

    if (msg.type === 'error') this.status('error', String(msg.message ?? 'stream error'));
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(this.attempts, 6));
    this.status('reconnecting', `retry in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
