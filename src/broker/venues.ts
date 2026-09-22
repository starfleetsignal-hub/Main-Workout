import type { Broker, MarketStreams } from './types';

/**
 * TradeRunner talks to several venues. They differ enormously in what they can
 * do, so each one declares its capabilities and the engine adapts rather than
 * pretending they are all the same brokerage.
 */
export type VenueId = 'alpaca' | 'coinbase' | 'robinhood' | 'uphold' | 'jupiter';

export interface VenueCapabilities {
  /** Can trade US equities. */
  stocks: boolean;
  /** Can trade crypto. */
  crypto: boolean;
  /** Supports selling short. */
  shorts: boolean;
  /** Provides a news feed the engine can score. */
  news: boolean;
  /** Has a real-time push feed. When false the engine polls instead. */
  streaming: boolean;
  /** Has a market session clock. When false the venue is treated as 24/7. */
  marketHours: boolean;
  /**
   * Reports open positions with an average entry price. Exchanges report
   * balances instead, so the engine has to remember its own entry prices.
   */
  brokerPositions: boolean;
  /** Offers a paper or sandbox mode. */
  paper: boolean;
  /** Assets are held by the venue. False means a self-custody wallet. */
  custodial: boolean;
  /** Historical candles are available. When false the engine builds bars from polling. */
  historicalBars: boolean;
}

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  multiline?: boolean;
  help?: string;
  optional?: boolean;
}

export type VenueMaturity = 'verified' | 'untested' | 'experimental';

export interface VenueDescriptor {
  id: VenueId;
  name: string;
  /** One line for the venue picker. */
  blurb: string;
  capabilities: VenueCapabilities;
  credentialFields: CredentialField[];
  /** Example symbol, shown in the watchlist editor. */
  symbolHint: string;
  /** How the venue writes its symbols, for the engine's normaliser. */
  quoteCurrencies: string[];
  docsUrl: string;
  /**
   * How much this adapter has been exercised. `verified` means it has been run
   * against the live API; `untested` means it is written to the published spec
   * but has not been run against a real account; `experimental` additionally
   * carries material risk.
   */
  maturity: VenueMaturity;
  /** Shown prominently before the user can connect. */
  warning?: string;
}

export type VenueCredentials = Record<string, string> & { venue: VenueId; mode?: string };

export interface VenueFactory {
  descriptor: VenueDescriptor;
  createBroker(creds: VenueCredentials): Broker;
  /** Returns null when the venue has no push feed; the caller polls instead. */
  createStreams(creds: VenueCredentials): MarketStreams | null;
  /** Human-readable validation of a credential set before any network call. */
  validate(creds: VenueCredentials): string | null;
}

export const DEFAULT_CAPABILITIES: VenueCapabilities = {
  stocks: false,
  crypto: true,
  shorts: false,
  news: false,
  streaming: false,
  marketHours: false,
  brokerPositions: false,
  paper: false,
  custodial: true,
  historicalBars: false,
};

/** A venue with no session clock trades around the clock. */
export function alwaysOpenClock(now: number) {
  return { isOpen: true, nextOpen: now, nextClose: now + 365 * 24 * 60 * 60_000, at: now };
}
