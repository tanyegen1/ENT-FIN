import { describe, expect, it } from "vitest";
import { computeHighLow, computeRsi, computeSma } from "./indicators";
import type { PricePoint } from "../types";

function series(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ t: i * 60_000, price }));
}

describe("computeHighLow", () => {
  it("finds the exact high/low and which point they came from", () => {
    const result = computeHighLow(series([10, 5, 20, 3, 15]));
    expect(result).toEqual({ high: 20, low: 3, highIndex: 2, lowIndex: 3 });
  });

  it("returns null for an empty series", () => {
    expect(computeHighLow([])).toBeNull();
  });
});

describe("computeSma", () => {
  it("matches hand-computed 3-period averages", () => {
    const data = series([1, 2, 3, 4, 5]);
    const result = computeSma(data, 3);
    expect(result).toEqual([
      { t: data[2].t, value: 2 },
      { t: data[3].t, value: 3 },
      { t: data[4].t, value: 4 },
    ]);
  });

  it("returns nothing before enough warm-up data exists", () => {
    expect(computeSma(series([1, 2]), 5)).toEqual([]);
  });
});

describe("computeRsi (Wilder's 14-period, verified against a hand-worked 4-period example)", () => {
  // prices: 10, 12, 11, 13, 12, 14 -> changes: +2, -1, +2, -1, +2
  // Seed (first 4 changes): avgGain = (2+0+2+0)/4 = 1, avgLoss = (0+1+0+1)/4 = 0.5
  //   RSI = 100 - 100/(1 + 1/0.5) = 66.666...
  // Next step (5th change, +2): avgGain = (1*3 + 2)/4 = 1.25, avgLoss = (0.5*3 + 0)/4 = 0.375
  //   RSI = 100 - 100/(1 + 1.25/0.375) = 76.923...
  it("matches a hand-worked example step by step", () => {
    const data = series([10, 12, 11, 13, 12, 14]);
    const result = computeRsi(data, 4);
    expect(result).toHaveLength(2);
    expect(result[0].t).toBe(data[4].t);
    expect(result[0].value).toBeCloseTo(66.6667, 3);
    expect(result[1].t).toBe(data[5].t);
    expect(result[1].value).toBeCloseTo(76.9231, 3);
  });

  it("pins at 100 when every change in the warm-up window is a gain (never divides by zero)", () => {
    const data = series([10, 11, 12, 13, 14, 15]);
    const result = computeRsi(data, 4);
    for (const p of result) expect(p.value).toBe(100);
  });

  it("pins at 0 when every change is a loss", () => {
    const data = series([15, 14, 13, 12, 11, 10]);
    const result = computeRsi(data, 4);
    for (const p of result) expect(p.value).toBe(0);
  });

  it("reads 50 (neither overbought nor oversold) when prices never move", () => {
    const data = series([10, 10, 10, 10, 10, 10]);
    const result = computeRsi(data, 4);
    for (const p of result) expect(p.value).toBe(50);
  });

  it("returns nothing before period+1 points exist", () => {
    expect(computeRsi(series([1, 2, 3]), 14)).toEqual([]);
  });
});
