import { describe, expect, it } from "vitest";
import { describeDataInterval, pickAxisIndices, formatAxisTick } from "./chartAxis";
import type { PricePoint } from "../types";

function series(count: number, stepMs: number, startT = 0): PricePoint[] {
  return Array.from({ length: count }, (_, i) => ({ t: startT + i * stepMs, price: 100 + i }));
}

describe("pickAxisIndices", () => {
  it("always includes the first and last index", () => {
    const indices = pickAxisIndices(50, 5);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(49);
  });

  it("returns a single index for a single-point series", () => {
    expect(pickAxisIndices(1, 5)).toEqual([0]);
  });

  it("returns nothing for an empty series", () => {
    expect(pickAxisIndices(0, 5)).toEqual([]);
  });

  it("never exceeds the requested count of distinct indices", () => {
    const indices = pickAxisIndices(1000, 6);
    expect(indices.length).toBeLessThanOrEqual(6);
  });
});

describe("describeDataInterval", () => {
  it("measures a 5-minute series as minute-based, not assumed from the range", () => {
    const result = describeDataInterval(series(20, 5 * 60_000));
    expect(result).toEqual({ key: "chart.intervalMinutes", vars: { minutes: 5 } });
  });

  it("measures an hourly series correctly", () => {
    const result = describeDataInterval(series(20, 60 * 60_000));
    expect(result).toEqual({ key: "chart.intervalHours", vars: { hours: 1 } });
  });

  it("measures a daily series correctly", () => {
    const result = describeDataInterval(series(20, 24 * 60 * 60_000));
    expect(result).toEqual({ key: "chart.intervalDaily" });
  });

  it("measures a weekly-spaced series correctly", () => {
    const result = describeDataInterval(series(20, 7 * 24 * 60 * 60_000));
    expect(result).toEqual({ key: "chart.intervalWeekly" });
  });

  it("measures a monthly-spaced series correctly", () => {
    const result = describeDataInterval(series(20, 30 * 24 * 60 * 60_000));
    expect(result).toEqual({ key: "chart.intervalMonthly" });
  });

  it("returns null when there's not enough data to measure a gap", () => {
    expect(describeDataInterval([])).toBeNull();
    expect(describeDataInterval(series(1, 60_000))).toBeNull();
  });

  it("is robust to one large gap (e.g. an overnight jump) via the median, not the mean", () => {
    // Mostly 5-minute gaps, with one huge 16-hour overnight gap thrown in —
    // the median should still read as 5-minute, not get dragged toward hours.
    const base = series(30, 5 * 60_000);
    const withGap = [...base, { t: base[base.length - 1].t + 16 * 60 * 60_000, price: 130 }];
    const result = describeDataInterval(withGap);
    expect(result).toEqual({ key: "chart.intervalMinutes", vars: { minutes: 5 } });
  });
});

describe("formatAxisTick", () => {
  const t = Date.UTC(2025, 5, 16, 14, 30); // arbitrary instant

  it("never throws for any supported range", () => {
    const ranges = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
    for (const r of ranges) {
      expect(() => formatAxisTick(r, t)).not.toThrow();
      expect(typeof formatAxisTick(r, t)).toBe("string");
    }
  });
});
