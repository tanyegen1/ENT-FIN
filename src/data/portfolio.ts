import type { Holding } from "../types";

export const INITIAL_CASH = 4250.32;

export const INITIAL_HOLDINGS: Holding[] = [
  { symbol: "AAPL", shares: 12, avgCost: 189.42 },
  { symbol: "TSLA", shares: 8, avgCost: 221.1 },
  { symbol: "NVDA", shares: 25, avgCost: 98.6 },
  { symbol: "MSFT", shares: 5, avgCost: 402.15 },
  { symbol: "COIN", shares: 6, avgCost: 198.4 },
  { symbol: "BTC", shares: 0.042, avgCost: 71200 },
];

export const INITIAL_WATCHLIST: string[] = [
  "AMZN",
  "GOOGL",
  "META",
  "PLTR",
  "AMD",
  "SPY",
];
