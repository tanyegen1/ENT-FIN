import { useSyncExternalStore } from "react";
import type { CatalogueInstrument, CatalogueQuote } from "../types";

/**
 * A small in-memory, synchronous cache bridging the catalogue backend's
 * async instrument/quote fetches (see catalogService.ts) into the
 * synchronous lookups PortfolioContext's order engine needs
 * (referencePriceFor/instantExecutionEligible/equityValue) — mirrors how
 * data/liveQuotes.ts already does exactly this for curated stocks.
 *
 * Populated opportunistically whenever a screen actually fetches a
 * catalogue instrument's quote (a stock page, a search result row) — never
 * fetched eagerly for the whole catalogue, consistent with spec section 7's
 * "on-demand" delivery rule. A symbol the user hasn't recently viewed
 * simply isn't in here yet; PortfolioContext treats that exactly like "no
 * quote available," never as $0 or an executable price.
 */
interface CatalogueEntry {
  instrument: CatalogueInstrument;
  quote: CatalogueQuote | null;
}

const registry = new Map<string, CatalogueEntry>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

export function registerCatalogueQuote(instrument: CatalogueInstrument, quote: CatalogueQuote | null) {
  registry.set(instrument.ticker.toUpperCase(), { instrument, quote });
  emit();
}

export function getCatalogueEntry(symbol: string): CatalogueEntry | undefined {
  return registry.get(symbol.toUpperCase());
}

/** The instrument's last known display price, or null when never fetched or genuinely unavailable — never $0, never a placeholder. */
export function getCatalogueDisplayPrice(symbol: string): number | null {
  return registry.get(symbol.toUpperCase())?.quote?.price ?? null;
}

/**
 * Whether the order engine may treat this symbol as a real, executable
 * instrument right now — requires a registered, non-stale quote AND the
 * catalogue backend's own trading_eligible flag (never inferred from mere
 * catalogue presence — spec section 4: "Catalogue presence must not
 * automatically imply trading eligibility"). Returns null (never a
 * fabricated price) whenever any of that isn't true.
 */
export function getCatalogueExecutionPrice(symbol: string): number | null {
  const entry = registry.get(symbol.toUpperCase());
  if (!entry || !entry.instrument.tradingEligible || !entry.quote) return null;
  if (entry.quote.freshness === "stale") return null;
  return entry.quote.price;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders/recomputes whenever any catalogue quote is (re)registered — e.g. so PortfolioContext's equityValue memo picks up a freshly-fetched catalogue holding price. */
export function useCatalogueRegistryVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
