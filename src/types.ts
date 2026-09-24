export type Range = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  color: string;
  sector: string;
  marketCap: number;
  peRatio: number | null;
  divYield: number | null;
  weekHigh52: number;
  weekLow52: number;
  volume: number;
  avgVolume: number;
  about: string;
}

export interface PricePoint {
  t: number;
  price: number;
}

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
}

export interface OrderRecord {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  timestamp: number;
}

export interface TransferRecord {
  id: string;
  type: "deposit" | "withdraw";
  amount: number;
  timestamp: number;
}

export type AccountMode = "empty" | "sample";
