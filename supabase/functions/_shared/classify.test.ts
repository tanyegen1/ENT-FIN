import { describe, expect, it } from "vitest";
import { classifySecurityType, isCommonStockCatalogueEntry, isTestSecurity, mapExchange, normalizeTickerRef } from "./classify.ts";
import type { MassiveTickerRef } from "./types.ts";

describe("mapExchange", () => {
  it("maps the 4 known MIC codes through as-is", () => {
    expect(mapExchange("XNAS")).toBe("XNAS");
    expect(mapExchange("XNYS")).toBe("XNYS");
    expect(mapExchange("XASE")).toBe("XASE");
    expect(mapExchange("ARCX")).toBe("ARCX");
  });

  it("is case-insensitive", () => {
    expect(mapExchange("xnas")).toBe("XNAS");
  });

  it("never invents a mapping for an unknown or missing code", () => {
    expect(mapExchange("BATS")).toBe("OTHER");
    expect(mapExchange(undefined)).toBe("OTHER");
    expect(mapExchange(null)).toBe("OTHER");
    expect(mapExchange("")).toBe("OTHER");
  });
});

describe("classifySecurityType", () => {
  it("classifies plain common stock", () => {
    expect(classifySecurityType("CS")).toEqual({ securityType: "common_stock", isAdr: false });
  });

  it("classifies an ADR common share as common_stock with isAdr true", () => {
    expect(classifySecurityType("ADRC")).toEqual({ securityType: "common_stock", isAdr: true });
  });

  it("never classifies ADR preferred/rights/warrants as plain common stock", () => {
    expect(classifySecurityType("ADRP")).toEqual({ securityType: "preferred", isAdr: true });
    expect(classifySecurityType("ADRR")).toEqual({ securityType: "right", isAdr: true });
    expect(classifySecurityType("ADRW")).toEqual({ securityType: "warrant", isAdr: true });
  });

  it("keeps ETFs in their own category, never common_stock", () => {
    expect(classifySecurityType("ETF").securityType).toBe("etf");
    expect(classifySecurityType("ETN").securityType).toBe("etf");
    expect(classifySecurityType("FUND").securityType).toBe("etf");
  });

  it("classifies preferred shares, warrants, units, and rights", () => {
    expect(classifySecurityType("PFD").securityType).toBe("preferred");
    expect(classifySecurityType("WARRANT").securityType).toBe("warrant");
    expect(classifySecurityType("UNIT").securityType).toBe("unit");
    expect(classifySecurityType("RIGHT").securityType).toBe("right");
  });

  it("falls back to 'other' for anything unrecognized, never guesses common_stock", () => {
    expect(classifySecurityType("SP").securityType).toBe("other");
    expect(classifySecurityType(undefined).securityType).toBe("other");
    expect(classifySecurityType(null).securityType).toBe("other");
  });
});

describe("isTestSecurity", () => {
  it("flags known Nasdaq/NYSE test tickers", () => {
    expect(isTestSecurity("ZXZZT", "NASDAQ TEST STOCK")).toBe(true);
    expect(isTestSecurity("ZVZZT", "Some Name")).toBe(true);
  });

  it("flags by name pattern even for an unlisted ticker", () => {
    expect(isTestSecurity("ABCD", "NASDAQ TEST SYMBOL")).toBe(true);
  });

  it("does not flag an ordinary company", () => {
    expect(isTestSecurity("AAPL", "Apple Inc.")).toBe(false);
  });
});

function ref(overrides: Partial<MassiveTickerRef> = {}): MassiveTickerRef {
  return {
    ticker: "AAPL",
    name: "Apple Inc.",
    market: "stocks",
    locale: "us",
    primary_exchange: "XNAS",
    type: "CS",
    active: true,
    currency_name: "usd",
    composite_figi: "BBG000B9XRY4",
    ...overrides,
  };
}

describe("normalizeTickerRef", () => {
  it("normalizes a plain common stock", () => {
    const result = normalizeTickerRef(ref());
    expect(result).toMatchObject({
      providerId: "BBG000B9XRY4",
      ticker: "AAPL",
      name: "Apple Inc.",
      primaryExchange: "XNAS",
      securityType: "common_stock",
      isAdr: false,
      currency: "USD",
      active: true,
    });
  });

  it("falls back to ticker as providerId when no FIGI/CIK is present", () => {
    const result = normalizeTickerRef(ref({ composite_figi: undefined, share_class_figi: undefined, cik: undefined }));
    expect(result?.providerId).toBe("AAPL");
  });

  it("returns null for a non-stocks-market row", () => {
    expect(normalizeTickerRef(ref({ market: "crypto" }))).toBeNull();
  });

  it("returns null for a known test security", () => {
    expect(normalizeTickerRef(ref({ ticker: "ZXZZT", name: "NASDAQ TEST STOCK" }))).toBeNull();
  });
});

describe("isCommonStockCatalogueEntry", () => {
  it("accepts an active common stock on a known exchange", () => {
    const instrument = normalizeTickerRef(ref())!;
    expect(isCommonStockCatalogueEntry(instrument)).toBe(true);
  });

  it("rejects an ETF even though it was classified successfully", () => {
    const instrument = normalizeTickerRef(ref({ type: "ETF", ticker: "SPY", name: "SPDR S&P 500" }))!;
    expect(isCommonStockCatalogueEntry(instrument)).toBe(false);
  });

  it("rejects an inactive (delisted) instrument", () => {
    const instrument = normalizeTickerRef(ref({ active: false }))!;
    expect(isCommonStockCatalogueEntry(instrument)).toBe(false);
  });

  it("rejects an instrument on an unmodeled exchange", () => {
    const instrument = normalizeTickerRef(ref({ primary_exchange: "XBRU" }))!;
    expect(isCommonStockCatalogueEntry(instrument)).toBe(false);
  });

  it("accepts an ADR common share exactly like a plain common stock", () => {
    const instrument = normalizeTickerRef(ref({ type: "ADRC", ticker: "BABA", name: "Alibaba Group Holding Ltd" }))!;
    expect(isCommonStockCatalogueEntry(instrument)).toBe(true);
  });
});
