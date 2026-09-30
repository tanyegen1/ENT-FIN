import type {
  CatalogueBar,
  CatalogueCompanyInfo,
  CatalogueExchange,
  CatalogueInstrument,
  CatalogueQuote,
  CatalogueSecurityType,
  Range,
} from "../types";
import { isSupabaseConfigured } from "../lib/supabaseClient";

/**
 * The Nasdaq/NYSE catalogue backend (Supabase Edge Functions calling the
 * Massive/Polygon reference-data, quotes, and bars APIs — see
 * supabase/functions/ and README's "Data providers" section) reuses this
 * app's existing Supabase project config rather than introducing a second
 * one. When unset — no Supabase project configured, or one configured
 * without ever running supabase/schema.sql and deploying the functions —
 * every call below degrades to null/empty rather than throwing, and every
 * caller in this app falls back to the curated static stock list exactly
 * like it already falls back when a live quote fails (see liveQuotes.ts).
 */
export const isCatalogueConfigured = isSupabaseConfigured;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function functionUrl(name: string): string | null {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`;
}

async function callFunction<T>(name: string, params: Record<string, string>): Promise<T | null> {
  const base = functionUrl(name);
  if (!base || !SUPABASE_ANON_KEY) return null;
  try {
    const qs = new URLSearchParams(params);
    const res = await fetch(`${base}?${qs.toString()}`, {
      // The anon key is Supabase's public, RLS-protected key (already used
      // client-side throughout this app — see lib/supabaseClient.ts), never
      // the server-only Massive provider key, which these functions never
      // return to the client in any form.
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
    });
    const body = await res.json().catch(() => null);
    return (body as T) ?? null;
  } catch {
    return null;
  }
}

interface RawInstrumentRow {
  id: string;
  ticker: string;
  name: string;
  primary_exchange: string;
  security_type: string;
  is_adr: boolean;
  currency: string;
  active: boolean;
  logo_url: string | null;
  icon_url: string | null;
  branding_verified: boolean;
  trading_eligible: boolean;
  extended_hours_eligible: boolean;
}

function mapInstrument(row: RawInstrumentRow): CatalogueInstrument {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    primaryExchange: row.primary_exchange as CatalogueExchange,
    securityType: row.security_type as CatalogueSecurityType,
    isAdr: row.is_adr,
    currency: row.currency,
    active: row.active,
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    brandingVerified: row.branding_verified,
    tradingEligible: row.trading_eligible,
    extendedHoursEligible: row.extended_hours_eligible,
  };
}

export interface CatalogueSearchResult {
  instruments: CatalogueInstrument[];
  hasMore: boolean;
}

export type CatalogueExchangeFilter = CatalogueExchange | "ALL";

/** Server-side search across the whole catalogue (spec section 4) — ranked exact-ticker, then prefix, then name. Returns null on any failure (unconfigured, network, provider outage), distinct from an empty-but-successful search. */
export async function searchCatalogue(
  query: string,
  exchange: CatalogueExchangeFilter,
  limit: number,
  offset: number,
): Promise<CatalogueSearchResult | null> {
  const q = query.trim();
  if (!q) return { instruments: [], hasMore: false };
  const params: Record<string, string> = { q, limit: String(limit), offset: String(offset) };
  if (exchange !== "ALL" && exchange !== "OTHER") params.exchange = exchange;
  const body = await callFunction<{ ok: boolean; results: RawInstrumentRow[]; hasMore: boolean }>("catalogue-search", params);
  if (!body?.ok) return null;
  return { instruments: body.results.map(mapInstrument), hasMore: body.hasMore };
}

interface RawQuoteEntry {
  ticker: string;
  quote: CatalogueQuote | null;
  status: "ok" | "unavailable";
}

/** Batch snapshot for exactly the tickers a screen currently has visible (spec section 7) — never one request per instrument. Every entry is present in the result even when its quote is unavailable, so a caller can render "Price unavailable" rather than omit the row. */
export async function fetchCatalogueQuotes(tickers: string[]): Promise<Record<string, CatalogueQuote | null>> {
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const out: Record<string, CatalogueQuote | null> = {};
  for (const t of unique) out[t] = null;
  if (unique.length === 0) return out;
  const body = await callFunction<{ quotes?: RawQuoteEntry[] }>("quotes", { tickers: unique.join(",") });
  for (const entry of body?.quotes ?? []) out[entry.ticker] = entry.quote;
  return out;
}

export type CatalogueBarsStatus = "ok" | "unavailable" | "error";

export interface CatalogueBarsResult {
  bars: CatalogueBar[];
  status: CatalogueBarsStatus;
}

function toDateStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Maps this app's Range selector to the bars Edge Function's multiplier/timespan/from/to — mirrors historyApi.ts's lookback windows for the existing Finnhub-backed chart, so switching between a curated stock and a catalogue instrument doesn't change what range of history "1M" etc. means. */
function rangeToBarsParams(range: Range): { multiplier: number; timespan: "minute" | "hour" | "day" | "week" | "month"; from: string; to: string } {
  const now = new Date();
  const to = toDateStamp(now);
  const from = new Date(now);
  switch (range) {
    case "1D":
      from.setDate(from.getDate() - 5);
      return { multiplier: 5, timespan: "minute", from: toDateStamp(from), to };
    case "1W":
      from.setDate(from.getDate() - 9);
      return { multiplier: 30, timespan: "minute", from: toDateStamp(from), to };
    case "1M":
      from.setDate(from.getDate() - 33);
      return { multiplier: 1, timespan: "hour", from: toDateStamp(from), to };
    case "3M":
      from.setDate(from.getDate() - 95);
      return { multiplier: 1, timespan: "day", from: toDateStamp(from), to };
    case "YTD": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { multiplier: 1, timespan: "day", from: toDateStamp(start), to };
    }
    case "1Y":
      from.setDate(from.getDate() - 370);
      return { multiplier: 1, timespan: "day", from: toDateStamp(from), to };
    case "5Y":
      from.setDate(from.getDate() - 5 * 370);
      return { multiplier: 1, timespan: "week", from: toDateStamp(from), to };
    case "ALL":
      from.setDate(from.getDate() - 20 * 365);
      return { multiplier: 1, timespan: "month", from: toDateStamp(from), to };
  }
}

/** On-demand historical bars for one instrument+range (spec section 8) — real data only. `status: "unavailable"` means the provider had no data for this exact instrument/range (never another instrument's data substituted, never synthesized). */
export async function fetchCatalogueBars(ticker: string, range: Range): Promise<CatalogueBarsResult> {
  const { multiplier, timespan, from, to } = rangeToBarsParams(range);
  const body = await callFunction<{ ok: boolean; bars?: CatalogueBar[]; status?: string }>("bars", {
    ticker: ticker.toUpperCase(),
    multiplier: String(multiplier),
    timespan,
    from,
    to,
    adjusted: "true",
  });
  if (!body) return { bars: [], status: "error" };
  if (!body.ok) return { bars: [], status: "error" };
  let bars = body.bars ?? [];
  if (range === "1D" && bars.length > 0) {
    // rangeToBarsParams pads "1D" out to a 5-day lookback so a weekend/
    // holiday still lands on the most recent real session — trim back down
    // to that single most-recent calendar day, exactly like
    // historyApi.ts's fetchFinnhubHistory does for curated stocks, so "1D"
    // means the same thing on both a curated and a catalogue stock page.
    const lastDay = new Date(bars[bars.length - 1].t).toDateString();
    bars = bars.filter((b) => new Date(b.t).toDateString() === lastDay);
  }
  return { bars, status: bars.length > 0 ? ((body.status as CatalogueBarsStatus) ?? "unavailable") : "unavailable" };
}

export interface CatalogueInstrumentDetails {
  instrument: CatalogueInstrument;
  companyInfo: CatalogueCompanyInfo | null;
}

/** Full details for one instrument, used when a user opens its stock page — also triggers the server's lazy branding-enrichment check (see supabase/functions/instrument-details), so a first-ever view of a ticker may take slightly longer than a cached one. */
export async function fetchInstrumentDetails(ticker: string): Promise<CatalogueInstrumentDetails | null> {
  const body = await callFunction<{ ok: boolean; instrument?: RawInstrumentRow; companyInfo?: CatalogueCompanyInfo }>(
    "instrument-details",
    { ticker: ticker.toUpperCase() },
  );
  if (!body?.ok || !body.instrument) return null;
  return { instrument: mapInstrument(body.instrument), companyInfo: body.companyInfo ?? null };
}

/**
 * The secure branding proxy's URL (spec section 5) — safe to use directly as
 * an <img src> because logo-proxy is deployed with JWT verification
 * disabled (supabase/config.toml): it serves only pre-verified public
 * branding assets, performs no write or user-data access, and never
 * receives or returns the Massive provider key (that stays server-side —
 * see supabase/functions/logo-proxy/index.ts). Returns null when no
 * Supabase project is configured at all.
 */
export function catalogueLogoUrl(ticker: string, kind: "logo" | "icon" = "logo"): string | null {
  const base = functionUrl("logo-proxy");
  if (!base) return null;
  return `${base}?ticker=${encodeURIComponent(ticker.toUpperCase())}&kind=${kind}`;
}
