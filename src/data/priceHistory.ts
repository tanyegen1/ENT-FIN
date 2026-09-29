import { useEffect, useState } from "react";
import type { PricePoint, Range } from "../types";
import { getStock } from "./stocks";
import { getLiveStock } from "./liveQuotes";
import { fetchRealHistory } from "./historyApi";

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

function daysSinceYearStart(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
}

function rangeMs(range: Range): number {
  const day = 24 * 60 * 60 * 1000;
  if (range === "YTD") return daysSinceYearStart() * day;
  const table: Record<Exclude<Range, "YTD">, number> = {
    "1D": 6.5 * 60 * 60 * 1000,
    "1W": 7 * day,
    "1M": 30 * day,
    "3M": 90 * day,
    "1Y": 365 * day,
    "5Y": 5 * 365 * day,
    ALL: 8 * 365 * day,
  };
  return table[range];
}

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
  const span = rangeMs(range);
  const now = Date.now();
  const rand = mulberry32(hashSeed(key));

  let walk: number[];
  if (range === "1D") {
    // A day's worth of noise interpolated between the real previous close
    // and the current price — a plain random walk had no reason to end up
    // anywhere near prevClose, so the chart's own start point could
    // silently disagree with the "+X% today" figure shown next to it. The
    // sine envelope is 0 at both ends, so those two anchors stay exact.
    const prevClose = getLiveStock(symbol)?.prevClose ?? getStock(symbol)?.prevClose ?? endPrice;
    walk = Array.from({ length: points }, (_, i) => {
      const frac = i / (points - 1);
      const base = prevClose + (endPrice - prevClose) * frac;
      const noise = (rand() - 0.5) * 2 * volatility * endPrice * Math.sin(Math.PI * frac) * 4;
      return Math.max(base + noise, endPrice * 0.05);
    });
    walk[0] = prevClose;
  } else {
    // Random walk generated backwards from the known current/end price so
    // every render for a given symbol+range is stable and ends at the right value.
    walk = [endPrice];
    for (let i = 1; i < points; i++) {
      const prev = walk[i - 1];
      const drift = (rand() - 0.5) * 2 * volatility * prev;
      const meanReversion = (endPrice - prev) * 0.01;
      walk.push(Math.max(prev - drift + meanReversion, endPrice * 0.05));
    }
    walk.reverse();
  }

  const result: PricePoint[] = walk.map((price, i) => ({
    t: now - span + (span * i) / (points - 1),
    price: Math.round(price * 100) / 100,
  }));
  result[result.length - 1] = { t: now, price: endPrice };

  if (liveEndPrice === undefined) cache.set(key, result);
  return result;
}

// Real history fetches, once they land, are cached for the rest of the
// session per symbol+range — a chart doesn't need to re-fetch just because
// the component holding it remounted (e.g. navigating away and back).
const realHistoryCache = new Map<string, PricePoint[]>();

/**
 * The synchronous synthetic walk above, upgraded with real historical
 * prices when a free data source has them (CoinGecko for crypto, Finnhub
 * candles for stocks/funds if the configured key's plan includes them).
 * Renders the synthetic fallback immediately — so the chart is never
 * empty — then swaps in real data if the fetch succeeds. Never refetches
 * just because the live quote ticked; only a symbol or range change does.
 */
export function usePriceHistory(symbol: string, range: Range, liveEndPrice?: number): PricePoint[] {
  const [history, setHistory] = useState<PricePoint[]>(() => {
    const cached = realHistoryCache.get(`${symbol}:${range}`);
    return cached ?? getPriceHistory(symbol, range, liveEndPrice);
  });

  useEffect(() => {
    const key = `${symbol}:${range}`;
    const cached = realHistoryCache.get(key);
    if (cached) {
      setHistory(cached);
      return;
    }

    setHistory(getPriceHistory(symbol, range, liveEndPrice));
    let cancelled = false;
    fetchRealHistory(symbol, range).then((real) => {
      if (cancelled || !real || real.length < 2) return;
      // Anchor the endpoint to the live quote (fresher than a candle's
      // close) for visual consistency with the big price number shown
      // elsewhere on the page — same anchoring the synthetic walk does.
      const patched = liveEndPrice !== undefined ? [...real.slice(0, -1), { t: Date.now(), price: liveEndPrice }] : real;
      realHistoryCache.set(key, patched);
      setHistory(patched);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveEndPrice intentionally excluded: it ticks every ~45s and shouldn't trigger a full history refetch, only a symbol/range change should
  }, [symbol, range]);

  return history;
}
