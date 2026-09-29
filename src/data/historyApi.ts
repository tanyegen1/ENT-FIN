import type { PricePoint, Range } from "../types";
import { getStock } from "./stocks";

// Real historical prices for the ranges/symbols we have a free, keyless-or-
// cheap data source for. Every function here returns null on any failure
// (missing key, plan restriction, network error, malformed response) —
// callers fall back to the synthetic walk in priceHistory.ts, exactly like
// this app already falls back to the mock price when a live quote fails.
// Never throws.

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;

// CoinGecko identifies coins by slug — mirrors the map in liveQuotes.ts.
const COINGECKO_IDS: Partial<Record<string, string>> = {
  BTC: "bitcoin",
};

function daysSinceYearStart(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
}

const COINGECKO_DAYS: Partial<Record<Range, number | "max">> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  "5Y": 1825,
  ALL: "max",
};

async function fetchCoinGeckoHistory(coinId: string, range: Range): Promise<PricePoint[] | null> {
  const days = range === "YTD" ? daysSinceYearStart() : COINGECKO_DAYS[range];
  if (days === undefined) return null;
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const prices = data?.prices;
  if (!Array.isArray(prices) || prices.length < 2) return null;
  return prices
    .filter((p: unknown): p is [number, number] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
    .map(([t, price]) => ({ t, price }));
}

// Finnhub candle resolutions: minutes as a string, or D/W/M.
const FINNHUB_RESOLUTION: Record<Range, string> = {
  "1D": "5",
  "1W": "30",
  "1M": "60",
  "3M": "D",
  YTD: "D",
  "1Y": "D",
  "5Y": "W",
  ALL: "M",
};

function lookbackSeconds(range: Range): number {
  const day = 24 * 60 * 60;
  switch (range) {
    case "1D":
      // Padded well past 24h so a weekend/holiday still lands on the most
      // recent real session — trimmed down to that single day below.
      return 5 * day;
    case "1W":
      return 9 * day;
    case "1M":
      return 33 * day;
    case "3M":
      return 95 * day;
    case "YTD":
      return daysSinceYearStart() * day;
    case "1Y":
      return 370 * day;
    case "5Y":
      return 5 * 370 * day;
    case "ALL":
      return 20 * 365 * day; // Finnhub's free plan only has a few years of daily history anyway; asking for more just returns what exists
  }
}

async function fetchFinnhubHistory(symbol: string, range: Range): Promise<PricePoint[] | null> {
  if (!FINNHUB_KEY) return null;
  const now = Math.floor(Date.now() / 1000);
  const from = now - lookbackSeconds(range);
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${FINNHUB_RESOLUTION[range]}&from=${from}&to=${now}&token=${FINNHUB_KEY}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Finnhub's free tier doesn't include candles for US stocks on every plan —
  // a plan without access responds with {"s":"no_data"} (or similar), not an
  // HTTP error, so this check is the real gate, not res.ok above.
  if (data?.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c) || data.t.length < 2) return null;

  let points: PricePoint[] = data.t.map((t: number, i: number) => ({ t: t * 1000, price: data.c[i] }));

  if (range === "1D") {
    // Keep only the most recent calendar day present, so a weekend/holiday
    // lookback doesn't draw a multi-day chart under a "1D" label.
    const lastDay = new Date(points[points.length - 1].t).toDateString();
    points = points.filter((p) => new Date(p.t).toDateString() === lastDay);
  }

  return points.length >= 2 ? points : null;
}

/** Real historical prices for one symbol+range, or null if unavailable — never throws. */
export async function fetchRealHistory(symbol: string, range: Range): Promise<PricePoint[] | null> {
  try {
    const stock = getStock(symbol);
    if (!stock) return null;
    if (stock.category === "crypto") {
      const coinId = COINGECKO_IDS[symbol];
      return coinId ? await fetchCoinGeckoHistory(coinId, range) : null;
    }
    return await fetchFinnhubHistory(symbol, range);
  } catch {
    return null;
  }
}
