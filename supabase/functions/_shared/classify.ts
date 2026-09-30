import type { InstrumentExchange, MassiveTickerRef, NormalizedInstrument, SecurityType } from "./types.ts";

const KNOWN_EXCHANGES = new Set<InstrumentExchange>(["XNAS", "XNYS", "XASE", "ARCX"]);

/** Massive/Polygon's `primary_exchange` is already a MIC code — Nasdaq/NYSE/NYSE American/NYSE Arca map through as-is; anything else (or missing) is "OTHER", never silently coerced into one of the four. */
export function mapExchange(mic: string | undefined | null): InstrumentExchange {
  const code = (mic ?? "").toUpperCase();
  return KNOWN_EXCHANGES.has(code as InstrumentExchange) ? (code as InstrumentExchange) : "OTHER";
}

/**
 * Massive/Polygon's `type` field on a stocks-market ticker. CS (common
 * stock) and ADRC (ADR — common) are the only two that behave like an
 * ordinary tradeable common share; every other value is excluded from the
 * common-stock catalogue (ETFs get their own securityType so existing ETF
 * handling can filter on it; everything else — preferred, warrants, units,
 * rights, and their ADR variants — is classified but never treated as a
 * common stock).
 */
export function classifySecurityType(providerType: string | undefined | null): { securityType: SecurityType; isAdr: boolean } {
  switch ((providerType ?? "").toUpperCase()) {
    case "CS":
      return { securityType: "common_stock", isAdr: false };
    case "ADRC":
      return { securityType: "common_stock", isAdr: true };
    case "ETF":
    case "ETN":
    case "ETS":
    case "FUND":
      return { securityType: "etf", isAdr: false };
    case "PFD":
      return { securityType: "preferred", isAdr: false };
    case "ADRP":
      return { securityType: "preferred", isAdr: true };
    case "WARRANT":
      return { securityType: "warrant", isAdr: false };
    case "ADRW":
      return { securityType: "warrant", isAdr: true };
    case "UNIT":
      return { securityType: "unit", isAdr: false };
    case "RIGHT":
      return { securityType: "right", isAdr: false };
    case "ADRR":
      return { securityType: "right", isAdr: true };
    default:
      return { securityType: "other", isAdr: false };
  }
}

// Documented, best-effort denylist of known exchange test/placeholder
// symbols (e.g. Nasdaq's published test issues). Neither Massive nor
// Polygon's reference-data response exposes a clean "is_test" boolean, so
// this is pattern matching, not a verified exhaustive list — it should be
// reviewed against the provider's current test-symbol documentation once
// real API access is available, per spec section 3 ("exclude test
// securities").
const KNOWN_TEST_TICKERS = new Set(["ZXZZT", "ZVZZT", "ZWZZT", "ZBZX", "ZVV", "ZTEST", "NTEST"]);

export function isTestSecurity(ticker: string, name: string): boolean {
  const t = ticker.toUpperCase();
  const n = name.toUpperCase();
  if (KNOWN_TEST_TICKERS.has(t)) return true;
  if (n.includes("TEST STOCK") || n.includes("NASDAQ TEST") || n.includes("NYSE TEST") || n.includes("TEST SYMBOL")) return true;
  return false;
}

/** Raw Massive ticker-reference row -> our normalized shape, or null when it's outside this catalogue's scope entirely (wrong market, or a test security). Callers still get non-common-stock types back (ETF/preferred/etc.) — filtering those OUT of the "common stock" list is the caller's job, so ETF data stays available for existing ETF features, just tagged separately. */
export function normalizeTickerRef(raw: MassiveTickerRef): NormalizedInstrument | null {
  if (raw.market !== "stocks") return null;
  if (isTestSecurity(raw.ticker, raw.name)) return null;

  const { securityType, isAdr } = classifySecurityType(raw.type);
  const providerId = raw.composite_figi || raw.share_class_figi || raw.cik || raw.ticker;

  return {
    providerId,
    ticker: raw.ticker,
    name: raw.name,
    primaryExchange: mapExchange(raw.primary_exchange),
    securityType,
    isAdr,
    currency: (raw.currency_name || "usd").toUpperCase(),
    active: raw.active,
    cik: raw.cik ?? null,
    compositeFigi: raw.composite_figi ?? null,
    shareClassFigi: raw.share_class_figi ?? null,
  };
}

/** Whether a normalized instrument belongs in the primary "common stock" catalogue this feature is about — common stock or ADR, currently active, on one of the 4 modeled exchanges. ETFs and everything else are excluded here even though they were successfully classified above, per spec section 1 ("do not silently mix ETFs... into the common-stock list"). */
export function isCommonStockCatalogueEntry(instrument: NormalizedInstrument): boolean {
  return instrument.securityType === "common_stock" && instrument.active && instrument.primaryExchange !== "OTHER";
}
