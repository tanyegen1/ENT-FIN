import type { PricePoint, Range } from "../types";
import { getStock } from "./stocks";

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANGE_POINTS: Record<Range, number> = {
  "1D": 78,
  "1W": 5 * 26,
  "1M": 30,
  "3M": 90,
  YTD: 200,
  "1Y": 252,
  "5Y": 260,
  ALL: 400,
};

const RANGE_MS: Record<Range, number> = {
  "1D": 6.5 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  YTD: 265 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  "5Y": 5 * 365 * 24 * 60 * 60 * 1000,
  ALL: 8 * 365 * 24 * 60 * 60 * 1000,
};

const cache = new Map<string, PricePoint[]>();

/**
 * `liveEndPrice`, when passed, anchors the generated walk to a real fetched
 * quote instead of the static mock price — used for the handful of tickers
 * with live data wired up. Those calls skip the cache (the price moves
 * every poll) since regenerating a ~250-point walk is cheap.
 */
export function getPriceHistory(
  symbol: string,
  range: Range,
  liveEndPrice?: number,
): PricePoint[] {
  const key = `${symbol}:${range}`;
  if (liveEndPrice === undefined) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const endPrice = liveEndPrice ?? getStock(symbol)?.price ?? 100;
  const volatility = range === "1D" ? 0.0009 : 0.014;
  const points = RANGE_POINTS[range];
  const span = RANGE_MS[range];
  const now = Date.now();
  const rand = mulberry32(hashSeed(key));

  // Random walk generated backwards from the known current/end price so
  // every render for a given symbol+range is stable and ends at the right value.
  const walk: number[] = [endPrice];
  for (let i = 1; i < points; i++) {
    const prev = walk[i - 1];
    const drift = (rand() - 0.5) * 2 * volatility * prev;
    const meanReversion = range === "1D" ? 0 : (endPrice - prev) * 0.01;
    walk.push(Math.max(prev - drift + meanReversion, endPrice * 0.05));
  }
  walk.reverse();

  const result: PricePoint[] = walk.map((price, i) => ({
    t: now - span + (span * i) / (points - 1),
    price: Math.round(price * 100) / 100,
  }));
  result[result.length - 1] = { t: now, price: endPrice };

  if (liveEndPrice === undefined) cache.set(key, result);
  return result;
}
