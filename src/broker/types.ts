import type {
  AccountSnapshot,
  AssetClass,
  Bar,
  MarketClock,
  NewsItem,
  OrderSide,
  StreamStatus,
} from '../engine/types';

export interface BrokerPosition {
  symbol: string;
  assetClass: AssetClass;
  qty: number;
  side: 'long' | 'short';
  avgEntryPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface OrderRequest {
  symbol: string;
  assetClass: AssetClass;
  side: OrderSide;
  qty: number;
  clientOrderId?: string;
}

export interface OrderResult {
  id: string;
  clientOrderId: string;
  status: string;
  filledQty: number;
  filledAvgPrice: number | null;
}

export type RawNews = Omit<NewsItem, 'sentiment' | 'confidence'>;

export interface Broker {
  readonly label: string;
  /**
   * What this venue can do. The engine reads it rather than assuming every
   * venue behaves like a full brokerage. Omitted by test doubles, in which
   * case the engine falls back to its most permissive defaults.
   */
  readonly capabilities?: import('./venues').VenueCapabilities;
  getAccount(): Promise<AccountSnapshot>;
  getClock(): Promise<MarketClock>;
  getPositions(): Promise<BrokerPosition[]>;
  submitMarketOrder(req: OrderRequest): Promise<OrderResult>;
  /** Poll an order until it is filled or terminal. */
  waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult>;
  /** Close the whole position with a market order; returns the closing order when the broker provides one. */
  closePosition(symbol: string): Promise<OrderResult | null>;
  closeAllPositions(): Promise<void>;
  getBars(symbol: string, assetClass: AssetClass, limit: number): Promise<Bar[]>;
  getLatestPrice(symbol: string, assetClass: AssetClass): Promise<number | null>;
  getNews(symbols: string[], limit: number): Promise<RawNews[]>;
}

export type StreamName = 'stocks' | 'crypto' | 'news';

export interface StreamHandlers {
  onTick: (symbol: string, price: number, size: number, t: number) => void;
  onBar: (symbol: string, bar: Bar) => void;
  onNews: (item: RawNews) => void;
  onStatus: (stream: StreamName, status: StreamStatus, detail?: string) => void;
}

export interface MarketStreams {
  start(symbols: string[], handlers: StreamHandlers): void;
  updateSymbols(symbols: string[]): void;
  stop(): void;
}
