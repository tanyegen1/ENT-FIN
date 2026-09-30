import type {
  MassiveAggsResponse,
  MassiveSnapshotTicker,
  MassiveTickerDetails,
  MassiveTickerRef,
  MassiveTickersPage,
  NormalizedBar,
  NormalizedQuote,
  PriceType,
  QuoteFreshness,
} from "./types.ts";

/**
 * A thin, documented adapter over Massive's (formerly Polygon.io's) REST
 * API — every endpoint used here is a real, documented Polygon/Massive
 * endpoint (see README's "Data providers" section for the exact doc URLs
 * cited during implementation). Nothing here is invented, and nothing
 * assumes a plan includes every endpoint: every call goes through
 * `massiveFetch`, which turns a 401/403 into a typed "unauthorized" error
 * the caller can surface as an honest "credentials/plan required" state
 * rather than silently failing or fabricating data.
 */

export interface MassiveClientOptions {
  apiKey: string;
  /** Overridable for tests; defaults to Massive's production API host. */
  baseUrl?: string;
  /** Overridable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export type MassiveErrorKind = "unauthorized" | "rate_limited" | "not_found" | "server_error" | "network_error";

export class MassiveApiError extends Error {
  status: number;
  kind: MassiveErrorKind;
  constructor(message: string, status: number, kind: MassiveErrorKind) {
    super(message);
    this.name = "MassiveApiError";
    this.status = status;
    this.kind = kind;
  }
}

const DEFAULT_BASE_URL = "https://api.massive.com";

async function massiveFetch<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new MassiveApiError(`Network error calling Massive: ${err instanceof Error ? err.message : String(err)}`, 0, "network_error");
  }
  if (res.status === 401 || res.status === 403) {
    throw new MassiveApiError("Unauthorized — missing/invalid MASSIVE_API_KEY or the plan doesn't include this endpoint", res.status, "unauthorized");
  }
  if (res.status === 429) {
    throw new MassiveApiError("Rate limited by Massive", res.status, "rate_limited");
  }
  if (res.status === 404) {
    throw new MassiveApiError("Not found", res.status, "not_found");
  }
  if (!res.ok) {
    throw new MassiveApiError(`Massive API responded ${res.status}`, res.status, "server_error");
  }
  return (await res.json()) as T;
}

export interface TickersPageParams {
  market?: string; // "stocks"
  type?: string; // "CS" | "ADRC" | ...
  exchange?: string; // MIC, e.g. "XNAS"
  active?: boolean;
  limit?: number;
}

/** One page of GET /v3/reference/tickers — pass `cursor` (a page's own `next_url`) to follow pagination; omit it to start from the first page. */
export async function fetchTickersPage(
  opts: MassiveClientOptions,
  params: TickersPageParams,
  cursor?: string,
): Promise<MassiveTickersPage> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  let url: string;
  if (cursor) {
    // Massive's next_url already carries every query param except the key.
    url = `${cursor}${cursor.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(opts.apiKey)}`;
  } else {
    const qs = new URLSearchParams();
    if (params.market) qs.set("market", params.market);
    if (params.type) qs.set("type", params.type);
    if (params.exchange) qs.set("exchange", params.exchange);
    if (params.active !== undefined) qs.set("active", String(params.active));
    qs.set("limit", String(params.limit ?? 1000));
    qs.set("apiKey", opts.apiKey);
    url = `${baseUrl}/v3/reference/tickers?${qs.toString()}`;
  }
  return massiveFetch<MassiveTickersPage>(url, fetchImpl);
}

/**
 * Follows every pagination cursor until the provider stops returning one —
 * spec section 3's "follow every pagination cursor... do not stop after
 * the first page or a fixed number of symbols." `maxPages` is a pure safety
 * valve against an infinite loop from a misbehaving cursor, not a
 * deliberate cap on the catalogue (set generously above any realistic
 * Nasdaq+NYSE page count at limit=1000/page).
 */
export async function* iterateAllTickers(
  opts: MassiveClientOptions,
  params: TickersPageParams,
  maxPages = 50,
): AsyncGenerator<{ page: number; results: MassiveTickerRef[] }> {
  let cursor: string | undefined;
  let page = 0;
  do {
    const response: MassiveTickersPage = cursor
      ? await fetchTickersPage(opts, params, cursor)
      : await fetchTickersPage(opts, params);
    page++;
    yield { page, results: response.results };
    cursor = response.next_url;
  } while (cursor && page < maxPages);
}

/** GET /v3/reference/tickers/{ticker} — company details + branding. */
export async function fetchTickerDetails(opts: MassiveClientOptions, ticker: string): Promise<MassiveTickerDetails> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${baseUrl}/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(opts.apiKey)}`;
  const body = await massiveFetch<{ results: MassiveTickerDetails }>(url, fetchImpl);
  return body.results;
}

/**
 * GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=A,B,C —
 * batch snapshot for exactly the symbols asked for (never the whole
 * market), the basis for the "batch snapshots for visible lists" delivery
 * strategy in spec section 7.
 */
export async function fetchSnapshotTickers(opts: MassiveClientOptions, tickers: string[]): Promise<MassiveSnapshotTicker[]> {
  if (tickers.length === 0) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickers.join(","))}&apiKey=${encodeURIComponent(opts.apiKey)}`;
  const body = await massiveFetch<{ tickers: MassiveSnapshotTicker[] }>(url, fetchImpl);
  return body.tickers ?? [];
}

export interface AggregatesParams {
  ticker: string;
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week" | "month";
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  adjusted?: boolean;
  limit?: number;
}

/** GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to} — historical bars for the chart. */
export async function fetchAggregates(opts: MassiveClientOptions, params: AggregatesParams): Promise<MassiveAggsResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const qs = new URLSearchParams();
  qs.set("adjusted", String(params.adjusted ?? true));
  qs.set("sort", "asc");
  qs.set("limit", String(params.limit ?? 50000));
  qs.set("apiKey", opts.apiKey);
  const url = `${baseUrl}/v2/aggs/ticker/${encodeURIComponent(params.ticker)}/range/${params.multiplier}/${params.timespan}/${params.from}/${params.to}?${qs.toString()}`;
  return massiveFetch<MassiveAggsResponse>(url, fetchImpl);
}

// ---------------------------------------------------------------------------
// Pure normalization helpers — no network, fully unit-testable.
// ---------------------------------------------------------------------------

/**
 * Providers are inconsistent about whether a timestamp is seconds,
 * milliseconds, or nanoseconds since the epoch, and Massive/Polygon's own
 * docs are not perfectly uniform across every endpoint. Rather than assume
 * one unit and risk silently mislabeling a price's freshness by a factor of
 * 1000 or 1e6, this infers the unit from the value's magnitude — a value
 * this large can only plausibly be nanoseconds; this range, milliseconds;
 * smaller, seconds — and always returns milliseconds.
 */
export function normalizeEpochToMs(value: number): number {
  if (value > 1e14) return Math.round(value / 1e6); // nanoseconds
  if (value > 1e11) return Math.round(value); // already milliseconds
  return Math.round(value * 1000); // seconds
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes for a real-time-entitled feed
const DELAYED_STALE_GRACE_MS = 2 * 60 * 1000; // extra grace on top of the configured delay

/**
 * `configuredDelaySeconds` reflects the ACCOUNT's actual plan entitlement
 * (operator-set via the MASSIVE_QUOTE_DELAY_SECONDS env var — see README),
 * never inferred from the response itself: Massive's API does not
 * self-report which delay tier a given key is on, so guessing here would
 * risk exactly what spec section 6 forbids — labeling data "real-time"
 * data isn't entitled to be.
 */
export function computeFreshness(sourceTimestampMs: number, nowMs: number, configuredDelaySeconds: number): QuoteFreshness {
  const ageMs = nowMs - sourceTimestampMs;
  if (configuredDelaySeconds > 0) {
    return ageMs > configuredDelaySeconds * 1000 + DELAYED_STALE_GRACE_MS ? "stale" : "delayed";
  }
  return ageMs > STALE_THRESHOLD_MS ? "stale" : "real_time";
}

/**
 * The freshest available price for one snapshot entry — a real last trade
 * when present, otherwise the prior regular-session close, explicitly
 * labeled as such (never presented as a current trade). Returns null only
 * when the snapshot has neither, which the caller must render as "price
 * unavailable," never $0 and never a synthesized value.
 */
export function selectQuoteFromSnapshot(
  ticker: string,
  snap: MassiveSnapshotTicker,
  nowMs: number,
  configuredDelaySeconds: number,
): NormalizedQuote | null {
  const lastTrade = snap.lastTrade;
  if (lastTrade && typeof lastTrade.p === "number" && Number.isFinite(lastTrade.p) && lastTrade.p > 0 && typeof lastTrade.t === "number") {
    const sourceMs = normalizeEpochToMs(lastTrade.t);
    return {
      instrumentTicker: ticker,
      price: lastTrade.p,
      currency: "USD",
      priceType: "last_trade" satisfies PriceType,
      sourceTimestamp: new Date(sourceMs).toISOString(),
      source: "massive",
      freshness: computeFreshness(sourceMs, nowMs, configuredDelaySeconds),
    };
  }
  const prevClose = snap.prevDay?.c;
  if (typeof prevClose === "number" && Number.isFinite(prevClose) && prevClose > 0) {
    // prevDay carries no per-bar timestamp in the snapshot payload — `updated`
    // (when present) is the snapshot's own refresh time, the closest honest
    // stand-in; still labeled priceType "regular_close", never "last_trade".
    const sourceMs = typeof snap.updated === "number" ? normalizeEpochToMs(snap.updated) : nowMs;
    return {
      instrumentTicker: ticker,
      price: prevClose,
      currency: "USD",
      priceType: "regular_close" satisfies PriceType,
      sourceTimestamp: new Date(sourceMs).toISOString(),
      source: "massive",
      freshness: "end_of_day",
    };
  }
  return null;
}

/** Maps a raw aggregates response into the chart's bar shape — never fabricates a bar the provider didn't return. */
export function normalizeAggregates(response: MassiveAggsResponse): NormalizedBar[] {
  if (!response.results) return [];
  return response.results.map((bar) => ({
    t: normalizeEpochToMs(bar.t),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    adjusted: response.adjusted,
  }));
}
