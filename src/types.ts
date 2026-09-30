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

export interface DeviceSession {
  id: string;
  device: string;
  location: string;
  lastActiveAt: number;
  current: boolean;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  targetPrice: number;
  createdAt: number;
  triggeredAt: number | null;
}

export type AnalystRating = "strong-sell" | "sell" | "hold" | "buy" | "strong-buy";

export type FactorDirection = "positive" | "negative" | "neutral";

export interface AnalystCatalyst {
  direction: FactorDirection;
  /** Authored prose, English only — same convention as Stock.about. */
  detail: string;
}

/** A weekly, per-stock mock "analyst consensus" — simulated for this practice app, never real research. */
export interface AnalystInsight {
  symbol: string;
  rating: AnalystRating;
  /** 0-100 position on the Strong Sell -> Strong Buy meter. */
  score: number;
  targetLow: number;
  targetAverage: number;
  targetHigh: number;
  horizonMonths: number;
  summary: string;
  catalysts: AnalystCatalyst[];
}

export interface AnalystFactor {
  label: string;
  direction: FactorDirection;
  detail: string;
}

// ---- Practice price rules (limit/stop orders) ----
// Beginner-facing name is "price rule"; these are the technical order types
// it maps to. "market" here is a *queued* market order — created only when
// the user chooses "Queue for regular opening" / "Queue buy/sell order"
// from the instant Buy/Sell sheet while the market isn't in its regular
// session; an ordinary immediate-execution buy/sell during the regular
// session still goes through the existing OrderRecord path unchanged.
export type PriceRuleOrderType = "buy-limit" | "buy-stop" | "sell-limit" | "sell-stop" | "market";

export type PriceRuleStatus =
  | "waiting" // Waiting for price (or, for a queued market order, waiting for the next eligible session)
  | "triggered" // Stop activated, converted to a market order, awaiting execution
  | "partial" // Partially filled
  | "filled"
  | "cancelled"
  | "expired"
  | "rejected";

export type PriceRuleDuration = "today" | "date";

/**
 * Which sessions this order is eligible to act in. "regular" is the only
 * scope available to stop orders and queued market orders (this profile
 * never triggers a stop or executes a market order outside the regular
 * session). "extended" is offered only for whole-share limit orders, and
 * only when the user explicitly opts in — it's eligible during pre-market,
 * regular, and after-hours, never silently upgraded or downgraded.
 */
export type PriceRuleSessionScope = "regular" | "extended";

export interface PriceRuleFill {
  id: string;
  shares: number;
  price: number;
  timestamp: number;
}

export interface PriceRuleOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  orderType: PriceRuleOrderType;
  /** The limit or stop price the user set. */
  targetPrice: number;
  /** Whole shares requested. */
  quantity: number;
  filledQuantity: number;
  fills: PriceRuleFill[];
  status: PriceRuleStatus;
  createdAt: number;
  duration: PriceRuleDuration;
  sessionScope: PriceRuleSessionScope;
  /** Resolved expiry timestamp — session-close-aware: the target trading day's regular close for "regular" scope, or its after-hours close for "extended" scope (see lib/marketSession.ts). */
  expiresAt: number;
  /** Cash held back from spendable cash while this buy rule is pending (0 for sell rules). */
  reservedCash: number;
  /** Shares held back from sellable shares while this sell rule is pending (0 for buy rules). */
  reservedShares: number;
  /** Short, plain-language note about the current or final status (e.g. a rejection or fill explanation). */
  statusMessage: string | null;
  triggeredAt: number | null;
  filledAt: number | null;
  cancelledAt: number | null;
  expiredAt: number | null;
  rejectedAt: number | null;
}
