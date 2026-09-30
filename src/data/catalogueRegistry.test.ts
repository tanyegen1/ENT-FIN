import { describe, expect, it } from "vitest";
import { getCatalogueDisplayPrice, getCatalogueEntry, getCatalogueExecutionPrice, registerCatalogueQuote } from "./catalogueRegistry";
import type { CatalogueInstrument, CatalogueQuote } from "../types";

function makeInstrument(overrides: Partial<CatalogueInstrument> = {}): CatalogueInstrument {
  return {
    id: "id-1",
    ticker: "XYZ",
    name: "Example Corp",
    primaryExchange: "XNAS",
    securityType: "common_stock",
    isAdr: false,
    currency: "USD",
    active: true,
    logoUrl: null,
    iconUrl: null,
    brandingVerified: false,
    tradingEligible: false,
    extendedHoursEligible: false,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<CatalogueQuote> = {}): CatalogueQuote {
  return {
    instrumentTicker: "XYZ",
    price: 42.5,
    currency: "USD",
    priceType: "last_trade",
    sourceTimestamp: new Date().toISOString(),
    source: "massive",
    freshness: "real_time",
    ...overrides,
  };
}

describe("catalogueRegistry", () => {
  it("returns undefined/null for a symbol never registered", () => {
    expect(getCatalogueEntry("NEVERSEEN")).toBeUndefined();
    expect(getCatalogueDisplayPrice("NEVERSEEN")).toBeNull();
    expect(getCatalogueExecutionPrice("NEVERSEEN")).toBeNull();
  });

  it("round-trips a registered instrument+quote, case-insensitively", () => {
    const instrument = makeInstrument({ ticker: "abcd" });
    const quote = makeQuote({ instrumentTicker: "ABCD", price: 10 });
    registerCatalogueQuote(instrument, quote);
    expect(getCatalogueEntry("ABCD")?.quote?.price).toBe(10);
    expect(getCatalogueDisplayPrice("abcd")).toBe(10);
  });

  it("display price is available even when not trading-eligible", () => {
    const instrument = makeInstrument({ ticker: "DISP1", tradingEligible: false });
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "DISP1", price: 7 }));
    expect(getCatalogueDisplayPrice("DISP1")).toBe(7);
  });

  it("execution price is null when the instrument isn't marked trading_eligible — catalogue presence never implies eligibility", () => {
    const instrument = makeInstrument({ ticker: "NOTELIG", tradingEligible: false });
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "NOTELIG" }));
    expect(getCatalogueExecutionPrice("NOTELIG")).toBeNull();
  });

  it("execution price is null when there is no quote on file", () => {
    const instrument = makeInstrument({ ticker: "NOQUOTE", tradingEligible: true });
    registerCatalogueQuote(instrument, null);
    expect(getCatalogueExecutionPrice("NOQUOTE")).toBeNull();
  });

  it("execution price is null when the quote is stale, even if trading_eligible", () => {
    const instrument = makeInstrument({ ticker: "STALEQ", tradingEligible: true });
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "STALEQ", freshness: "stale", price: 99 }));
    expect(getCatalogueExecutionPrice("STALEQ")).toBeNull();
  });

  it("execution price is the quote price when trading_eligible and fresh", () => {
    const instrument = makeInstrument({ ticker: "GOODONE", tradingEligible: true });
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "GOODONE", freshness: "delayed", price: 55.25 }));
    expect(getCatalogueExecutionPrice("GOODONE")).toBe(55.25);
  });

  it("a later registration overwrites the earlier one for the same ticker", () => {
    const instrument = makeInstrument({ ticker: "OVERWR", tradingEligible: true });
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "OVERWR", price: 1 }));
    registerCatalogueQuote(instrument, makeQuote({ instrumentTicker: "OVERWR", price: 2 }));
    expect(getCatalogueExecutionPrice("OVERWR")).toBe(2);
  });
});
