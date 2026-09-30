import { describe, expect, it } from "vitest";
import { isBarsParamsError, parseBarsParams } from "./barsParams.ts";

function url(qs: string): URL {
  return new URL(`https://example.com/bars?${qs}`);
}

describe("parseBarsParams", () => {
  it("parses a valid full set of params", () => {
    const result = parseBarsParams(url("ticker=aapl&multiplier=5&timespan=minute&from=2025-06-16&to=2025-06-16&adjusted=false"));
    expect(isBarsParamsError(result)).toBe(false);
    expect(result).toEqual({ ticker: "AAPL", multiplier: 5, timespan: "minute", from: "2025-06-16", to: "2025-06-16", adjusted: false });
  });

  it("requires a ticker", () => {
    expect(isBarsParamsError(parseBarsParams(url("from=2025-06-16&to=2025-06-16")))).toBe(true);
  });

  it("requires valid from/to dates", () => {
    expect(isBarsParamsError(parseBarsParams(url("ticker=AAPL&from=not-a-date&to=2025-06-16")))).toBe(true);
    expect(isBarsParamsError(parseBarsParams(url("ticker=AAPL&from=2025-06-16&to=not-a-date")))).toBe(true);
    expect(isBarsParamsError(parseBarsParams(url("ticker=AAPL&from=2025-06-16")))).toBe(true);
  });

  it("rejects a from date after the to date", () => {
    expect(isBarsParamsError(parseBarsParams(url("ticker=AAPL&from=2025-06-20&to=2025-06-16")))).toBe(true);
  });

  it("rejects an invalid timespan", () => {
    expect(isBarsParamsError(parseBarsParams(url("ticker=AAPL&from=2025-06-16&to=2025-06-16&timespan=fortnight")))).toBe(true);
  });

  it("defaults timespan to day, multiplier to 1, adjusted to true", () => {
    const result = parseBarsParams(url("ticker=AAPL&from=2025-06-16&to=2025-06-16"));
    if (!isBarsParamsError(result)) {
      expect(result.timespan).toBe("day");
      expect(result.multiplier).toBe(1);
      expect(result.adjusted).toBe(true);
    }
  });

  it("falls back to multiplier 1 for a non-integer or non-positive value", () => {
    const a = parseBarsParams(url("ticker=AAPL&from=2025-06-16&to=2025-06-16&multiplier=abc"));
    const b = parseBarsParams(url("ticker=AAPL&from=2025-06-16&to=2025-06-16&multiplier=-3"));
    if (!isBarsParamsError(a)) expect(a.multiplier).toBe(1);
    if (!isBarsParamsError(b)) expect(b.multiplier).toBe(1);
  });
});
