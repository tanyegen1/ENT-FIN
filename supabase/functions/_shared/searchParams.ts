export interface ParsedSearchParams {
  q: string;
  exchange: "XNAS" | "XNYS" | "XASE" | "ARCX" | null;
  limit: number;
  offset: number;
}

export interface ParsedSearchParamsError {
  error: string;
}

const VALID_EXCHANGES = new Set(["XNAS", "XNYS", "XASE", "ARCX"]);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * Validates and clamps catalogue-search's query params — server-side
 * debouncing/pagination inputs (spec section 4), never trusting the client
 * to send a sane limit.
 */
export function parseSearchParams(url: URL): ParsedSearchParams | ParsedSearchParamsError {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length === 0) return { error: "missing required 'q' query parameter" };

  const exchangeRaw = (url.searchParams.get("exchange") ?? "").toUpperCase();
  const exchange = VALID_EXCHANGES.has(exchangeRaw) ? (exchangeRaw as ParsedSearchParams["exchange"]) : null;

  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

  const offsetRaw = Number(url.searchParams.get("offset"));
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

  return { q, exchange, limit, offset };
}

export function isSearchParamsError(v: ParsedSearchParams | ParsedSearchParamsError): v is ParsedSearchParamsError {
  return "error" in v;
}
