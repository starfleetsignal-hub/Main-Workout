import type { Bar, StreamStatus } from '../../engine/types';
import type { MarketStreams, StreamHandlers, StreamName } from '../types';
import { mapNews, type AlpacaCredentials } from './rest';
import { splitByClass } from './symbols';

const STREAM_URLS = {
  stocks: (feed: string) => `wss://stream.data.alpaca.markets/v2/${feed}`,
  crypto: () => 'wss://stream.data.alpaca.markets/v1beta3/crypto/us',
  news: () => 'wss://stream.data.alpaca.markets/v1beta1/news',
};

type Msg = Record<string, unknown> & { T: string };

/**
 * One auto-reconnecting Alpaca data socket. Alpaca's protocol: the server
 * greets with {"T":"success","msg":"connected"}, the client sends an auth
 * frame, the server replies {"T":"success","msg":"authenticated"}, then the
 * client subscribes. Every frame is a JSON array of messages.
 */
class AlpacaSocket {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;
  private subscription: Record<string, string[]> = {};

  constructor(
    readonly name: StreamName,
    private readonly url: string,
    private readonly creds: AlpacaCredentials,
    private readonly onMessage: (m: Msg) => void,
    private readonly onStatus: (s: StreamStatus, detail?: string) => void
  ) {}

  setSubscription(sub: Record<string, string[]>) {
    const prev = this.subscription;
    this.subscription = sub;
    if (this.ws && this.authenticated) {
      // Unsubscribe from what was dropped, subscribe to what is new.
      const unsub: Record<string, string[]> = {};
      for (const k of Object.keys(prev)) {
        const gone = prev[k].filter((s) => !(sub[k] ?? []).includes(s));
        if (gone.length) unsub[k] = gone;
      }
      if (Object.keys(unsub).length) this.send({ action: 'unsubscribe', ...unsub });
      this.send({ action: 'subscribe', ...sub });
    }
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.authenticated = false;
    this.onStatus('off');
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  private connect() {
    if (this.stopped) return;
    this.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.onStatus('error', String(e));
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.authenticated = false;

    ws.onopen = () => {
      // Some servers skip the "connected" greeting; authenticating right away is safe.
      this.send({ action: 'auth', key: this.creds.keyId, secret: this.creds.secretKey });
    };
    ws.onmessage = (ev: MessageEvent) => {
      let frames: Msg[];
      try {
        const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
        frames = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return;
      }
      for (const m of frames) this.handle(m);
    };
    ws.onerror = () => {
      this.onStatus('error', 'socket error');
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.authenticated = false;
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private handle(m: Msg) {
    if (m.T === 'success') {
      if (m.msg === 'authenticated') {
        this.authenticated = true;
        this.attempts = 0;
        this.onStatus('connected');
        if (Object.keys(this.subscription).length) this.send({ action: 'subscribe', ...this.subscription });
      }
      return;
    }
    if (m.T === 'error') {
      const code = Number(m.code);
      const detail = `${m.code}: ${m.msg}`;
      this.onStatus('error', detail);
      // 401/402 (auth) and 406 (connection limit) won't fix themselves quickly; back off hard.
      if (code === 402 || code === 401) {
        this.attempts = Math.max(this.attempts, 6);
      }
      return;
    }
    if (m.T === 'subscription') return;
    this.onMessage(m);
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(this.attempts, 6));
    this.onStatus('reconnecting', `retry in ${Math.round(delay / 1000)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export class AlpacaStreams implements MarketStreams {
  private sockets: Partial<Record<StreamName, AlpacaSocket>> = {};
  private handlers: StreamHandlers | null = null;

  constructor(private readonly creds: AlpacaCredentials) {}

  start(symbols: string[], handlers: StreamHandlers) {
    this.stop();
    this.handlers = handlers;
    const { stocks, crypto } = splitByClass(symbols);

    const priceHandler = (m: Msg) => {
      const symbol = String(m.S ?? '');
      if (!symbol) return;
      if (m.T === 't') {
        handlers.onTick(symbol, Number(m.p), Number(m.s ?? 0), Date.parse(String(m.t)) || Date.now());
      } else if (m.T === 'b') {
        const bar: Bar = {
          t: Date.parse(String(m.t)),
          o: Number(m.o),
          h: Number(m.h),
          l: Number(m.l),
          c: Number(m.c),
          v: Number(m.v),
          vw: m.vw == null ? undefined : Number(m.vw),
        };
        handlers.onBar(symbol, bar);
      }
    };

    if (stocks.length) {
      const s = new AlpacaSocket('stocks', STREAM_URLS.stocks(this.creds.feed), this.creds, priceHandler, (st, d) =>
        handlers.onStatus('stocks', st, d)
      );
      s.setSubscription({ trades: stocks, bars: stocks });
      this.sockets.stocks = s;
      s.start();
    } else handlers.onStatus('stocks', 'off');

    if (crypto.length) {
      const c = new AlpacaSocket('crypto', STREAM_URLS.crypto(), this.creds, priceHandler, (st, d) =>
        handlers.onStatus('crypto', st, d)
      );
      c.setSubscription({ trades: crypto, bars: crypto });
      this.sockets.crypto = c;
      c.start();
    } else handlers.onStatus('crypto', 'off');

    const n = new AlpacaSocket(
      'news',
      STREAM_URLS.news(),
      this.creds,
      (m) => {
        if (m.T === 'n') handlers.onNews(mapNews(m));
      },
      (st, d) => handlers.onStatus('news', st, d)
    );
    n.setSubscription({ news: ['*'] });
    this.sockets.news = n;
    n.start();
  }

  updateSymbols(symbols: string[]) {
    if (!this.handlers) return;
    const { stocks, crypto } = splitByClass(symbols);
    if (this.sockets.stocks) this.sockets.stocks.setSubscription({ trades: stocks, bars: stocks });
    if (this.sockets.crypto) this.sockets.crypto.setSubscription({ trades: crypto, bars: crypto });
    // A stream that didn't exist at start (e.g. crypto added later) needs a restart.
    if ((stocks.length && !this.sockets.stocks) || (crypto.length && !this.sockets.crypto)) {
      this.start(symbols, this.handlers);
    }
  }

  stop() {
    for (const s of Object.values(this.sockets)) s?.stop();
    this.sockets = {};
  }
}
