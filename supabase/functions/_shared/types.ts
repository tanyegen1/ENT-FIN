// Shared types for the Massive (formerly Polygon.io) provider adapter and
// the catalogue Edge Functions. Plain TS, no Deno-only or Node-only APIs —
// this file (and its siblings classify.ts / massiveClient.ts) is imported
// both by the Deno Edge Functions at runtime and by Vitest for unit tests.

/** The 4 primary-listing venues this catalogue models today — see README's "Data providers" section for NYSE American / NYSE Arca coverage notes. */
export type InstrumentExchange = "XNAS" | "XNYS" | "XASE" | "ARCX" | "OTHER";

/**
 * Common stock covers ordinary shares AND listed ADRs — an ADR settles and
 * trades exactly like a common stock, so it isn't a separate enum value;
 * `isAdr` on the normalized instrument carries that distinction instead.
 * Every other Massive/Polygon `type` value that isn't a plain common-stock
 * equivalent is excluded from the tradeable common-stock catalogue and
 * either dropped or (for ETFs) kept in a clearly separate category.
 */
export type SecurityType = "common_stock" | "etf" | "preferred" | "warrant" | "unit" | "right" | "other";

/** Raw shape of one entry from Massive/Polygon's GET /v3/reference/tickers. */
export interface MassiveTickerRef {
  ticker: string;
  name: string;
  market: string; // "stocks" | "otc" | "crypto" | "fx" | "indices"
  locale: string;
  primary_exchange?: string; // MIC code, e.g. "XNAS", "XNYS"
  type?: string; // "CS" | "ADRC" | "ADRR" | "ADRP" | "ETF" | "PFD" | "WARRANT" | "UNIT" | "RIGHT" | ...
  active: boolean;
  currency_name?: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  last_updated_utc?: string;
}

export interface MassiveTickersPage {
  results: MassiveTickerRef[];
  status: string;
  request_id: string;
  count?: number;
  next_url?: string;
}

/** GET /v3/reference/tickers/{ticker} */
export interface MassiveTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string;
  active: boolean;
  currency_name?: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  homepage_url?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
  list_date?: string;
  market_cap?: number;
}

/** GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to} */
export interface MassiveAggBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  t: number; // unix ms
  n?: number;
}

export interface MassiveAggsResponse {
  ticker: string;
  results?: MassiveAggBar[];
  resultsCount?: number;
  status: string;
  adjusted: boolean;
  next_url?: string;
}

/** One ticker's entry from GET /v2/snapshot/locale/us/markets/stocks/tickers. */
export interface MassiveSnapshotTicker {
  ticker: string;
  day?: { o: number; h: number; l: number; c: number; v: number; vw?: number };
  prevDay?: { o: number; h: number; l: number; c: number; v: number; vw?: number };
  lastTrade?: { p: number; s: number; t: number; x?: number };
  lastQuote?: { P?: number; p?: number; S?: number; s?: number; t: number };
  min?: { o: number; h: number; l: number; c: number; v: number; t?: number };
  updated?: number;
}

// ---------------------------------------------------------------------------
// Normalized shapes — what the rest of this app actually stores/consumes,
// decoupled from Massive's exact wire format.
// ---------------------------------------------------------------------------

export interface NormalizedInstrument {
  providerId: string;
  ticker: string;
  name: string;
  primaryExchange: InstrumentExchange;
  securityType: SecurityType;
  isAdr: boolean;
  currency: string;
  active: boolean;
  cik: string | null;
  compositeFigi: string | null;
  shareClassFigi: string | null;
}

/** Price-type/session vocabulary the client uses to label every displayed price honestly — see spec section 6. */
export type PriceType = "last_trade" | "regular_close" | "bid" | "ask" | "extended_hours_trade";
export type QuoteFreshness = "real_time" | "delayed" | "end_of_day" | "stale";

export interface NormalizedQuote {
  instrumentTicker: string;
  price: number;
  currency: string;
  priceType: PriceType;
  /** ISO-8601 — the source timestamp attached to this specific price, not "now". */
  sourceTimestamp: string;
  source: "massive";
  freshness: QuoteFreshness;
  // No `session` field here on purpose — the client already owns session
  // classification (src/lib/marketSession.ts, the app's single source of
  // truth for pre-market/regular/after-hours). It derives the session this
  // quote belongs to from `sourceTimestamp` itself, exactly like it already
  // does for chart points, rather than this adapter re-deriving it
  // server-side and risking the two ever disagreeing.
}

export interface NormalizedBar {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True when this bar has been split/dividend-adjusted by the provider — kept distinct from raw execution prices (spec section 8). */
  adjusted: boolean;
}
