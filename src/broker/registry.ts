import { AlpacaClient, type AlpacaCredentials, type AlpacaFeed, type AlpacaMode } from './alpaca/rest';
import { AlpacaStreams } from './alpaca/stream';
import { CoinbaseClient, COINBASE_DESCRIPTOR } from './coinbase/rest';
import { CoinbaseStreams } from './coinbase/stream';
import { JupiterClient, JUPITER_DESCRIPTOR, KNOWN_MINTS } from './jupiter/rest';
import { PollingStreams } from './polling';
import { RobinhoodClient, ROBINHOOD_DESCRIPTOR } from './robinhood/rest';
import { UpholdClient, UPHOLD_DESCRIPTOR } from './uphold/rest';
import type { Broker, MarketStreams } from './types';
import type { VenueCapabilities, VenueCredentials, VenueDescriptor, VenueFactory, VenueId } from './venues';

export const ALPACA_CAPABILITIES: VenueCapabilities = {
  stocks: true,
  crypto: true,
  shorts: true,
  news: true,
  streaming: true,
  marketHours: true,
  brokerPositions: true,
  paper: true,
  custodial: true,
  historicalBars: true,
};

export const ALPACA_DESCRIPTOR: VenueDescriptor = {
  id: 'alpaca',
  name: 'Alpaca',
  blurb: 'Stocks and crypto, live streaming, real-time news and a full paper-trading mode.',
  capabilities: ALPACA_CAPABILITIES,
  credentialFields: [
    { key: 'keyId', label: 'API key ID', placeholder: 'PK…', secret: false },
    { key: 'secretKey', label: 'API secret key', placeholder: 'Secret', secret: true },
  ],
  symbolHint: 'AAPL or BTC/USD',
  quoteCurrencies: ['USD', 'USDT', 'USDC'],
  docsUrl: 'https://docs.alpaca.markets/',
  maturity: 'verified',
};

function missing(creds: VenueCredentials, descriptor: VenueDescriptor): string | null {
  for (const field of descriptor.credentialFields) {
    if (field.optional) continue;
    if (!String(creds[field.key] ?? '').trim()) return `${field.label} is required.`;
  }
  return null;
}

const alpaca: VenueFactory = {
  descriptor: ALPACA_DESCRIPTOR,
  createBroker: (creds) => new AlpacaClient(toAlpacaCreds(creds)),
  createStreams: (creds) => new AlpacaStreams(toAlpacaCreds(creds)),
  validate: (creds) => missing(creds, ALPACA_DESCRIPTOR),
};

function toAlpacaCreds(creds: VenueCredentials): AlpacaCredentials {
  return {
    keyId: String(creds.keyId ?? '').trim(),
    secretKey: String(creds.secretKey ?? '').trim(),
    mode: (creds.mode === 'live' ? 'live' : 'paper') as AlpacaMode,
    feed: (creds.feed === 'sip' ? 'sip' : 'iex') as AlpacaFeed,
  };
}

const coinbase: VenueFactory = {
  descriptor: COINBASE_DESCRIPTOR,
  createBroker: (creds) =>
    new CoinbaseClient({
      keyName: String(creds.keyName ?? '').trim(),
      privateKey: String(creds.privateKey ?? '').trim(),
    }),
  createStreams: (creds) =>
    new CoinbaseStreams({
      keyName: String(creds.keyName ?? '').trim(),
      privateKey: String(creds.privateKey ?? '').trim(),
    }),
  validate: (creds) => {
    const base = missing(creds, COINBASE_DESCRIPTOR);
    if (base) return base;
    const key = String(creds.privateKey ?? '');
    if (!key.includes('PRIVATE KEY') && key.replace(/\s+/g, '').length < 40) {
      return 'That does not look like a Coinbase private key. Paste the whole PEM, or the base64 secret.';
    }
    return null;
  },
};

const robinhood: VenueFactory = {
  descriptor: ROBINHOOD_DESCRIPTOR,
  createBroker: (creds) =>
    new RobinhoodClient({
      apiKey: String(creds.apiKey ?? '').trim(),
      privateKey: String(creds.privateKey ?? '').trim(),
    }),
  createStreams: () => null, // no push feed; the engine polls
  validate: (creds) => missing(creds, ROBINHOOD_DESCRIPTOR),
};

const uphold: VenueFactory = {
  descriptor: UPHOLD_DESCRIPTOR,
  createBroker: (creds) =>
    new UpholdClient({ token: String(creds.token ?? '').trim(), mode: creds.mode === 'live' ? 'live' : 'sandbox' }),
  createStreams: () => null,
  validate: (creds) => missing(creds, UPHOLD_DESCRIPTOR),
};

const jupiter: VenueFactory = {
  descriptor: JUPITER_DESCRIPTOR,
  createBroker: (creds) =>
    new JupiterClient({
      privateKey: String(creds.privateKey ?? '').trim(),
      rpcUrl: String(creds.rpcUrl ?? '').trim() || undefined,
      slippageBps: creds.slippageBps,
    }),
  createStreams: () => null,
  validate: (creds) => {
    const base = missing(creds, JUPITER_DESCRIPTOR);
    if (base) return base;
    const bps = Number(creds.slippageBps ?? 50);
    if (creds.slippageBps && (!Number.isFinite(bps) || bps <= 0 || bps > 1000)) {
      return 'Slippage must be between 1 and 1000 basis points.';
    }
    return null;
  },
};

export const VENUES: Record<VenueId, VenueFactory> = { alpaca, coinbase, robinhood, uphold, jupiter };

export const VENUE_LIST: VenueDescriptor[] = [
  ALPACA_DESCRIPTOR,
  COINBASE_DESCRIPTOR,
  ROBINHOOD_DESCRIPTOR,
  UPHOLD_DESCRIPTOR,
  JUPITER_DESCRIPTOR,
];

export function getVenue(id: VenueId): VenueFactory {
  const venue = VENUES[id];
  if (!venue) throw new Error(`Unknown venue "${id}"`);
  return venue;
}

export function describeVenue(id: VenueId): VenueDescriptor {
  return getVenue(id).descriptor;
}

/**
 * Builds the broker and its feed. Venues without a push feed get a poller,
 * so the engine never has to know the difference.
 */
export function createConnection(creds: VenueCredentials): { broker: Broker; streams: MarketStreams } {
  const venue = getVenue(creds.venue);
  const broker = venue.createBroker(creds);
  const streams = venue.createStreams(creds) ?? new PollingStreams(broker);
  return { broker, streams };
}

/**
 * Rewrites a symbol into the form a venue expects, so a watchlist can be
 * carried between venues without being retyped.
 */
export function normalizeForVenue(symbol: string, id: VenueId): string {
  const raw = symbol.trim().toUpperCase();
  const descriptor = describeVenue(id);
  if (!raw) return raw;

  const parts = raw.split(/[/-]/);
  if (parts.length === 2) return `${parts[0]}/${parts[1]}`;

  // A bare ticker on a crypto-only venue is a base asset; pair it with the
  // venue's first quote currency.
  if (!descriptor.capabilities.stocks) return `${raw}/${descriptor.quoteCurrencies[0]}`;
  return raw;
}

/** Symbols a venue can actually trade, used to warn before the engine starts. */
export function unsupportedSymbols(symbols: string[], id: VenueId): string[] {
  const caps = describeVenue(id).capabilities;
  const out: string[] = [];
  for (const s of symbols) {
    const isCrypto = s.includes('/');
    if (isCrypto && !caps.crypto) out.push(s);
    if (!isCrypto && !caps.stocks) out.push(s);
    if (isCrypto && id === 'jupiter') {
      const base = s.split('/')[0];
      if (!KNOWN_MINTS[base]) out.push(s);
    }
  }
  return Array.from(new Set(out));
}

/** The default watchlist for a venue, so switching venues leaves a usable state. */
export function defaultWatchlistFor(id: VenueId): string[] {
  switch (id) {
    case 'alpaca':
      return ['AAPL', 'NVDA', 'TSLA', 'AMD', 'SPY', 'BTC/USD', 'ETH/USD', 'SOL/USD'];
    case 'coinbase':
      return ['BTC/USD', 'ETH/USD', 'SOL/USD', 'LINK/USD'];
    case 'robinhood':
      return ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD'];
    case 'uphold':
      return ['BTC/USD', 'ETH/USD', 'SOL/USD'];
    case 'jupiter':
      return ['SOL/USDC', 'JUP/USDC', 'BONK/USDC'];
    default:
      return [];
  }
}
