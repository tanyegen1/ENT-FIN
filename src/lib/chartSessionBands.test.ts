import { afterEach, describe, expect, it } from "vitest";
import { computeSessionRuns } from "./chartSessionBands";
import { US_EQUITY_TIME_ZONE, clearSymbolHalt, setSymbolHalt, zonedTimeToUtc } from "./marketSession";
import type { PricePoint } from "../types";

function et(y: number, m: number, d: number, hour: number, minute: number): number {
  return zonedTimeToUtc(y, m, d, hour, minute, US_EQUITY_TIME_ZONE).getTime();
}

/** One point every 5 minutes from `startMs` through (and including) `endMs`. */
function fivMinuteSeries(startMs: number, endMs: number): PricePoint[] {
  const points: PricePoint[] = [];
  for (let t = startMs; t <= endMs; t += 5 * 60_000) points.push({ t, price: 100 });
  return points;
}

describe("computeSessionRuns", () => {
  it("groups a plain trading day's full extended window into 3 runs in order", () => {
    const data = fivMinuteSeries(et(2025, 6, 16, 4, 0), et(2025, 6, 16, 19, 55));
    const runs = computeSessionRuns(data, "stock");
    expect(runs.map((r) => r.status)).toEqual(["pre-market", "regular", "after-hours"]);
    // Runs must be contiguous and cover every index with no gaps or overlaps.
    expect(runs[0].startIndex).toBe(0);
    expect(runs[runs.length - 1].endIndex).toBe(data.length - 1);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].startIndex).toBe(runs[i - 1].endIndex + 1);
    }
  });

  it("places the pre-market/regular boundary at exactly 9:30 ET across a DST transition", () => {
    // 2025-03-09 is the US spring-forward date; the day after (03-10) is a
    // plain trading Monday already in EDT — verifying the boundary lands
    // at the correct index confirms zonedTimeToUtc's DST correction is
    // actually being used to classify chart points, not a fixed UTC offset.
    const data = fivMinuteSeries(et(2025, 3, 10, 9, 0), et(2025, 3, 10, 10, 0));
    const runs = computeSessionRuns(data, "stock");
    const preMarketRun = runs.find((r) => r.status === "pre-market")!;
    const regularRun = runs.find((r) => r.status === "regular")!;
    expect(data[preMarketRun.endIndex].t).toBe(et(2025, 3, 10, 9, 25));
    expect(data[regularRun.startIndex].t).toBe(et(2025, 3, 10, 9, 30));
  });

  it("uses the early-close schedule on the day after Thanksgiving, not the normal 4pm close", () => {
    const data = fivMinuteSeries(et(2025, 11, 28, 12, 30), et(2025, 11, 28, 13, 30));
    const runs = computeSessionRuns(data, "stock");
    expect(runs.map((r) => r.status)).toEqual(["regular", "after-hours"]);
    const regularRun = runs[0];
    // Early close is 1:00 PM ET, not the normal 4:00 PM.
    expect(data[regularRun.endIndex].t).toBe(et(2025, 11, 28, 12, 55));
  });

  it("never draws a session run for crypto (always 'open', no bands)", () => {
    const data = fivMinuteSeries(et(2025, 6, 16, 4, 0), et(2025, 6, 16, 20, 0));
    const runs = computeSessionRuns(data, "crypto");
    expect(runs.every((r) => r.status === "open")).toBe(true);
    expect(runs).toHaveLength(1);
  });

  it("returns nothing for an empty series", () => {
    expect(computeSessionRuns([], "stock")).toEqual([]);
  });

  describe("with a symbol-specific halt", () => {
    afterEach(() => clearSymbolHalt("BANDTEST"));

    it("marks the entire series 'halted' once the symbol is halted", () => {
      const data = fivMinuteSeries(et(2025, 6, 16, 9, 0), et(2025, 6, 16, 10, 0));
      setSymbolHalt("BANDTEST", "test halt");
      const runs = computeSessionRuns(data, "stock", "BANDTEST");
      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe("halted");
    });

    it("leaves an unrelated symbol's runs unaffected", () => {
      const data = fivMinuteSeries(et(2025, 6, 16, 9, 0), et(2025, 6, 16, 10, 0));
      setSymbolHalt("BANDTEST", "test halt");
      const runs = computeSessionRuns(data, "stock", "OTHERSYMBOL");
      expect(runs.some((r) => r.status === "halted")).toBe(false);
    });
  });
});
