import { afterEach, describe, expect, it, vi } from "vitest";
import { getPriceHistory } from "./priceHistory";
import { getStock, STOCKS } from "./stocks";
import { US_EQUITY_TIME_ZONE, zonedTimeToUtc } from "../lib/marketSession";

describe("getPriceHistory 1D anchoring", () => {
  it("starts exactly at the stock's previous close and ends exactly at its current price", () => {
    for (const stock of STOCKS) {
      const history = getPriceHistory(stock.symbol, "1D");
      expect(history[0].price).toBe(stock.prevClose);
      expect(history[history.length - 1].price).toBe(stock.price);
    }
  });

  it("still ends at a passed-in live price even when it differs from the mock price", () => {
    const stock = getStock("AAPL")!;
    const history = getPriceHistory("AAPL", "1D", 12345.67);
    expect(history[history.length - 1].price).toBe(12345.67);
    // The anchor point (start of day) is unaffected by a live override — it's
    // still the stock's own real previous close, not derived from the live price.
    expect(history[0].price).toBe(stock.prevClose);
  });

  it("keeps every point within a sane band around the day's start/end so the walk never spikes off-scale", () => {
    for (const stock of STOCKS) {
      const history = getPriceHistory(stock.symbol, "1D");
      const lo = Math.min(stock.prevClose, stock.price) * 0.9;
      const hi = Math.max(stock.prevClose, stock.price) * 1.1 + 1;
      for (const point of history) {
        expect(point.price).toBeGreaterThanOrEqual(lo);
        expect(point.price).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe("getPriceHistory timestamps", () => {
  it("produces a strictly increasing, chronologically ordered series ending near now", () => {
    const history = getPriceHistory("AAPL", "1M");
    for (let i = 1; i < history.length; i++) {
      expect(history[i].t).toBeGreaterThan(history[i - 1].t);
    }
    expect(Math.abs(history[history.length - 1].t - Date.now())).toBeLessThan(1000);
  });

  it("YTD's span reflects real elapsed days this year, not a fixed guess", () => {
    const history = getPriceHistory("AAPL", "YTD");
    const spanMs = history[history.length - 1].t - history[0].t;
    const spanDays = spanMs / (24 * 60 * 60 * 1000);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysThisYear = (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(0);
    expect(spanDays).toBeLessThanOrEqual(daysThisYear + 1);
  });
});

describe("getPriceHistory 1D session window", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spans real pre-market-to-now bounds on a trading day, not a fixed 6.5h lookback", async () => {
    vi.resetModules();
    const tradingDayNoon = zonedTimeToUtc(2025, 6, 16, 12, 0, US_EQUITY_TIME_ZONE); // Monday, EDT
    vi.useFakeTimers();
    vi.setSystemTime(tradingDayNoon);
    const { getPriceHistory: freshGetPriceHistory } = await import("./priceHistory");
    const history = freshGetPriceHistory("AAPL", "1D");
    const preMarketStart = zonedTimeToUtc(2025, 6, 16, 4, 0, US_EQUITY_TIME_ZONE).getTime();
    expect(history[0].t).toBe(preMarketStart);
    expect(history[history.length - 1].t).toBe(tradingDayNoon.getTime());
  });

  it("falls back to the prior trading day's full session on a weekend, rather than a fixed 6.5h lookback from Saturday", async () => {
    vi.resetModules();
    const saturdayAfternoon = zonedTimeToUtc(2025, 6, 14, 15, 0, US_EQUITY_TIME_ZONE);
    vi.useFakeTimers();
    vi.setSystemTime(saturdayAfternoon);
    const { getPriceHistory: freshGetPriceHistory } = await import("./priceHistory");
    const history = freshGetPriceHistory("AAPL", "1D");
    const fridayPreMarket = zonedTimeToUtc(2025, 6, 13, 4, 0, US_EQUITY_TIME_ZONE).getTime();
    const fridayAfterHoursEnd = zonedTimeToUtc(2025, 6, 13, 20, 0, US_EQUITY_TIME_ZONE).getTime();
    expect(history[0].t).toBe(fridayPreMarket);
    expect(history[history.length - 1].t).toBe(fridayAfterHoursEnd);
  });
});
