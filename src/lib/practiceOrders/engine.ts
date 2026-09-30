import type { PriceRuleOrder, PriceRuleOrderType } from "../../types";
import type { SessionStatus } from "../marketSession";

export interface Quote {
  bid: number;
  ask: number;
}

// This app has no real order book, so a small fixed spread stands in for
// one. Deterministic (same price always yields the same quote) so the
// engine stays pure and testable, and documented here as the one and only
// place the spread is defined.
const SPREAD_RATIO = 0.0005;

/** Synthetic bid/ask derived from a single reference price. */
export function getQuote(price: number): Quote {
  const halfSpread = price * SPREAD_RATIO;
  return { bid: price - halfSpread, ask: price + halfSpread };
}

/**
 * Given a side and a target price relative to the current price, which of
 * the 4 beginner-facing scenarios does this describe? Returns null when
 * target === current — the caller must treat that as an explicit, immediate
 * choice rather than silently picking a type (see isImmediatelyActionable).
 */
export function classifyOrderType(
  side: "buy" | "sell",
  targetPrice: number,
  currentPrice: number,
): PriceRuleOrderType | null {
  if (targetPrice === currentPrice) return null;
  if (side === "buy") return targetPrice < currentPrice ? "buy-limit" : "buy-stop";
  return targetPrice > currentPrice ? "sell-limit" : "sell-stop";
}

/**
 * Is this order's condition already satisfied at the current price, i.e.
 * would it activate immediately if placed right now? Only meaningful for
 * the 4 beginner limit/stop scenarios `classifyOrderType` returns — a
 * queued market order is never built through that path, so "market" isn't
 * really reachable here, but is handled (as always-eligible) for type
 * completeness rather than left to fall through unhandled.
 */
export function isImmediatelyActionable(
  orderType: PriceRuleOrderType,
  targetPrice: number,
  currentPrice: number,
): boolean {
  const quote = getQuote(currentPrice);
  switch (orderType) {
    case "market":
      return true;
    case "buy-limit":
      return quote.ask <= targetPrice;
    case "sell-limit":
      return quote.bid >= targetPrice;
    case "buy-stop":
      return currentPrice >= targetPrice;
    case "sell-stop":
      return currentPrice <= targetPrice;
  }
}

/** Total cash held back by pending (waiting/triggered) buy rules — what PortfolioContext exposes as reservedCash. */
export function sumReservedCash(
  orders: Pick<PriceRuleOrder, "status" | "side" | "reservedCash">[],
): number {
  return orders
    .filter((o) => o.side === "buy" && (o.status === "waiting" || o.status === "triggered"))
    .reduce((sum, o) => sum + o.reservedCash, 0);
}

/** Shares of one symbol held back by pending (waiting/triggered) sell rules — so two pending sells can't both claim the same shares. */
export function sumReservedShares(
  orders: Pick<PriceRuleOrder, "status" | "side" | "symbol" | "reservedShares">[],
  symbol: string,
): number {
  return orders
    .filter((o) => o.side === "sell" && o.symbol === symbol && (o.status === "waiting" || o.status === "triggered"))
    .reduce((sum, o) => sum + o.reservedShares, 0);
}

export function computeReservation(order: {
  side: "buy" | "sell";
  targetPrice: number;
  quantity: number;
}): { reservedCash: number; reservedShares: number } {
  if (order.side === "buy") {
    // Reserve at the order's own price — the worst case a limit could fill
    // at, and the level a stop converts to a market order at. A stop that
    // gaps through its level can still cost more than this; fillAt() below
    // caps the actual fill so that can never push cash negative.
    return { reservedCash: order.targetPrice * order.quantity, reservedShares: 0 };
  }
  return { reservedCash: 0, reservedShares: order.quantity };
}

export type TickReason = "gap-insufficient-funds" | "liquidity" | undefined;

export type TickOutcome =
  | { kind: "no-change" }
  | { kind: "triggered" }
  | { kind: "filled"; fillPrice: number; filledShares: number; remainingShares: number; reason?: TickReason }
  | { kind: "partial"; fillPrice: number; filledShares: number; remainingShares: number; reason?: TickReason }
  | { kind: "rejected-remainder"; reason: TickReason }
  | { kind: "expired" };

export interface TickInput {
  order: PriceRuleOrder;
  /** The reference price used to check stop triggers and limit eligibility — the same live-or-demo price shown elsewhere in the app for this stock (see README/engine docs for why). */
  referencePrice: number;
  now: number;
  /** Shares available to fill this tick, default unlimited. Lets tests (and any future liquidity model) simulate a partial fill from constrained liquidity. */
  maxFillQuantity?: number;
  /**
   * The market session this order's instrument is currently in (from
   * lib/marketSession.ts). Defaults to "regular" so the many tests below
   * that aren't about session gating don't need to care about it. Real
   * callers (PortfolioContext) always pass the live value.
   */
  sessionStatus?: SessionStatus;
}

/**
 * Whether this order's type/scope is allowed to be evaluated at all under
 * the current session status — independent of price, this only answers
 * "is this order type awake right now", not "would it fill". A stop only
 * ever triggers during the regular session; once triggered (or for a
 * queued market order) it behaves as a market order, which this profile
 * never executes outside the regular session either. A limit order is
 * eligible in extended hours only when the user explicitly opted in.
 */
export function isExecutionEligible(
  order: Pick<PriceRuleOrder, "orderType" | "sessionScope" | "status">,
  sessionStatus: SessionStatus,
): boolean {
  if (sessionStatus === "halted" || sessionStatus === "unavailable") return false;
  if (sessionStatus === "open") return true; // crypto: no sessions, always eligible

  if (order.status === "triggered" || order.orderType === "market") {
    return sessionStatus === "regular";
  }
  if (order.orderType === "buy-stop" || order.orderType === "sell-stop") {
    return sessionStatus === "regular";
  }
  if (order.sessionScope === "extended") {
    return sessionStatus === "pre-market" || sessionStatus === "regular" || sessionStatus === "after-hours";
  }
  return sessionStatus === "regular";
}

function capByReservedCash(
  fillPrice: number,
  desiredShares: number,
  reservedCash: number,
): { shares: number; reason: TickReason } {
  if (fillPrice <= 0) return { shares: desiredShares, reason: undefined };
  const affordable = Math.floor((reservedCash + 1e-9) / fillPrice);
  if (affordable >= desiredShares) return { shares: desiredShares, reason: undefined };
  return { shares: Math.max(0, affordable), reason: "gap-insufficient-funds" };
}

function buildFillOutcome(
  fillPrice: number,
  remainingQty: number,
  maxFillQuantity: number,
  order: Pick<PriceRuleOrder, "side" | "reservedCash">,
): TickOutcome {
  let fillable = Math.min(remainingQty, Math.max(0, maxFillQuantity));
  let reason: TickReason;
  if (fillable > 0 && maxFillQuantity < remainingQty) reason = "liquidity";

  if (order.side === "buy") {
    const capped = capByReservedCash(fillPrice, fillable, order.reservedCash);
    if (capped.shares < fillable) reason = capped.reason;
    fillable = capped.shares;
  }

  if (fillable <= 0) {
    return reason === "gap-insufficient-funds" ? { kind: "rejected-remainder", reason } : { kind: "no-change" };
  }
  const remaining = remainingQty - fillable;
  return remaining > 0
    ? { kind: "partial", fillPrice, filledShares: fillable, remainingShares: remaining, reason }
    : { kind: "filled", fillPrice, filledShares: fillable, remainingShares: 0, reason };
}

/**
 * One deterministic evaluation step for a single order against one
 * reference price. Pure — plain data in, plain data out; never touches
 * React state, localStorage, or the live-quotes store. Called by
 * PortfolioContext's order processor once per live-quote tick, and
 * directly by tests with synthetic price sequences.
 *
 * A triggered stop is deliberately left in "triggered" (not filled) by
 * this single call — see processOrderTick, which chains a second
 * evaluation in the same pass so a normal trigger converts to a fill
 * immediately, while leaving room for a tick that can't fill (e.g. a
 * liquidity-constrained test) to genuinely observe the "triggered /
 * awaiting execution" status.
 */
export function evaluateTick({ order, referencePrice, now, maxFillQuantity = Infinity, sessionStatus = "regular" }: TickInput): TickOutcome {
  if (order.status !== "waiting" && order.status !== "triggered") return { kind: "no-change" };
  if (now >= order.expiresAt) return { kind: "expired" };
  if (!isExecutionEligible(order, sessionStatus)) return { kind: "no-change" };

  const quote = getQuote(referencePrice);
  const remainingQty = order.quantity - order.filledQuantity;

  // A queued market order (see "Queue for regular opening" / "Queue buy/sell
  // order") has no price condition to wait for — once isExecutionEligible
  // above says the regular session is under way, it fills immediately at
  // the fresh quote, same as a triggered stop below.
  if (order.orderType === "market") {
    const fillPrice = order.side === "buy" ? quote.ask : quote.bid;
    return buildFillOutcome(fillPrice, remainingQty, maxFillQuantity, order);
  }

  if (order.status === "waiting") {
    switch (order.orderType) {
      case "buy-limit":
        if (quote.ask > order.targetPrice) return { kind: "no-change" };
        return buildFillOutcome(quote.ask, remainingQty, maxFillQuantity, order);
      case "sell-limit":
        if (quote.bid < order.targetPrice) return { kind: "no-change" };
        return buildFillOutcome(quote.bid, remainingQty, maxFillQuantity, order);
      case "buy-stop":
        if (referencePrice < order.targetPrice) return { kind: "no-change" };
        return { kind: "triggered" };
      case "sell-stop":
        if (referencePrice > order.targetPrice) return { kind: "no-change" };
        return { kind: "triggered" };
    }
  }

  // status === "triggered" — unconditionally a market order now, regardless
  // of the original stop level or any price reversal since ("does not
  // revert to waiting if prices reverse").
  const fillPrice = order.side === "buy" ? quote.ask : quote.bid;
  return buildFillOutcome(fillPrice, remainingQty, maxFillQuantity, order);
}

export interface ProcessResult {
  outcome: TickOutcome;
  /** True if a "waiting" stop converted to "triggered" and then attempted (possibly succeeded at) a fill within this same pass. */
  wasTriggeredThisPass: boolean;
}

/**
 * Wraps evaluateTick so a stop that triggers this tick also gets an
 * immediate chance to fill in the same pass (matching real stop-to-market
 * conversion speed), without evaluateTick itself needing to know about
 * chaining. Still stops at "triggered" if that immediate fill attempt
 * can't complete (e.g. maxFillQuantity is constrained), so that state is
 * genuinely reachable and observable, not just theoretical.
 */
export function processOrderTick(input: TickInput): ProcessResult {
  const first = evaluateTick(input);
  if (first.kind !== "triggered") return { outcome: first, wasTriggeredThisPass: false };

  const second = evaluateTick({
    ...input,
    order: { ...input.order, status: "triggered", triggeredAt: input.now },
  });
  return { outcome: second, wasTriggeredThisPass: true };
}
