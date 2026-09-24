export type Range = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";

export type AssetCategory = "stock" | "fund" | "crypto";

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  color: string;
  sector: string;
  category: AssetCategory;
  /** Everyday-language search terms (in English and Turkish) so a beginner can find a stock without knowing its ticker. */
  aliases: string[];
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

export interface SupportMessage {
  id: string;
  sender: "user" | "support";
  text: string;
  timestamp: number;
}

export type SupportRefType = "order" | "transfer" | "document";

export interface SupportTicket {
  id: string;
  refType: SupportRefType;
  refLabel: string;
  status: "open" | "answered" | "closed";
  createdAt: number;
  messages: SupportMessage[];
}

export interface RecurringRun {
  id: string;
  timestamp: number;
  status: "success" | "skipped";
  amount: number;
}

export interface RecurringPlan {
  id: string;
  symbol: string;
  amount: number;
  dayOfMonth: number;
  status: "active" | "paused";
  createdAt: number;
  history: RecurringRun[];
}

export interface GoalContribution {
  id: string;
  amount: number;
  timestamp: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  createdAt: number;
  contributions: GoalContribution[];
}

export interface CustomList {
  id: string;
  name: string;
  symbols: string[];
  notes: Record<string, string>;
  createdAt: number;
}

export type NotificationCategory = "money" | "orders" | "recurring" | "documents" | "support" | "priceAlerts";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  linkTo: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  targetPrice: number;
  createdAt: number;
  triggeredAt: number | null;
}
