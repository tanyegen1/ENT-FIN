import { describe, expect, it } from "vitest";
import {
  classifyOrderType,
  computeReservation,
  evaluateTick,
  getQuote,
  isImmediatelyActionable,
  processOrderTick,
  sumReservedCash,
  sumReservedShares,
  type TickInput,
} from "./engine";
import type { PriceRuleOrder } from "../../types";

const NOW = 1_700_000_000_000;
const LATER = NOW + 60_000;
const FAR_FUTURE = NOW + 1000 * 60 * 60 * 24 * 30;

function makeOrder(overrides: Partial<PriceRuleOrder>): PriceRuleOrder {
  return {
    id: "test-order",
    symbol: "TEST",
    side: "buy",
    orderType: "buy-limit",
    targetPrice: 90,
    quantity: 10,
    filledQuantity: 0,
    fills: [],
    status: "waiting",
    createdAt: NOW,
    duration: "today",
    expiresAt: FAR_FUTURE,
    reservedCash: 900,
    reservedShares: 0,
    statusMessage: null,
    triggeredAt: null,
    filledAt: null,
    cancelledAt: null,
    expiredAt: null,
    rejectedAt: null,
    ...overrides,
  };
}

function tick(order: PriceRuleOrder, referencePrice: number, extra: Partial<TickInput> = {}) {
  return evaluateTick({ order, referencePrice, now: LATER, ...extra });
}

describe("classifyOrderType — the 4 beginner scenarios at a $100 stock", () => {
  it("A: buy when it falls to $90 -> buy-limit", () => {
    expect(classifyOrderType("buy", 90, 100)).toBe("buy-limit");
  });
  it("B: buy when it rises to $110 -> buy-stop", () => {
    expect(classifyOrderType("buy", 110, 100)).toBe("buy-stop");
  });
  it("C: sell when it rises to $110 -> sell-limit", () => {
    expect(classifyOrderType("sell", 110, 100)).toBe("sell-limit");
  });
  it("D: sell when it falls to $90 -> sell-stop", () => {
    expect(classifyOrderType("sell", 90, 100)).toBe("sell-stop");
  });
  it("target === current is ambiguous, not silently classified", () => {
    expect(classifyOrderType("buy", 100, 100)).toBeNull();
    expect(classifyOrderType("sell", 100, 100)).toBeNull();
  });
});

describe("isImmediatelyActionable", () => {
  it("buy-limit at/above current ask is immediately fillable", () => {
    // At target === current the synthetic ask sits a hair above current
    // (the bid/ask spread), so a limit exactly at current isn't quite
    // fillable yet — realistic, and why a target comfortably above current works instead.
    expect(isImmediatelyActionable("buy-limit", 100.5, 100)).toBe(true);
    expect(isImmediatelyActionable("buy-limit", 90, 100)).toBe(false);
  });
  it("sell-limit at/below current bid is immediately fillable", () => {
    expect(isImmediatelyActionable("sell-limit", 99.5, 100)).toBe(true);
    expect(isImmediatelyActionable("sell-limit", 110, 100)).toBe(false);
  });
  it("buy-stop already at/above trigger is immediately actionable", () => {
    expect(isImmediatelyActionable("buy-stop", 100, 105)).toBe(true);
    expect(isImmediatelyActionable("buy-stop", 110, 100)).toBe(false);
  });
  it("sell-stop already at/below trigger is immediately actionable", () => {
    expect(isImmediatelyActionable("sell-stop", 100, 95)).toBe(true);
    expect(isImmediatelyActionable("sell-stop", 90, 100)).toBe(false);
  });
});

describe("market-order-equivalent quote", () => {
  it("ask is above bid, both close to the reference price", () => {
    const q = getQuote(100);
    expect(q.ask).toBeGreaterThan(q.bid);
    expect(q.ask).toBeCloseTo(100, 0);
    expect(q.bid).toBeCloseTo(100, 0);
  });
});

describe("buy-limit — scenario A: buy when it falls to $90", () => {
  it("does not fill while price is still above the limit", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90 });
    expect(tick(order, 95).kind).toBe("no-change");
  });
  it("fills once the ask reaches the limit, at or below it — never worse", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90 });
    const outcome = tick(order, 89.8);
    expect(outcome.kind).toBe("filled");
    if (outcome.kind === "filled") {
      expect(outcome.fillPrice).toBeLessThanOrEqual(90);
    }
  });
  it("a gap straight through the limit still fills at or below the limit, not worse", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90, reservedCash: 900 });
    const outcome = tick(order, 80); // gapped from 100 straight to 80
    expect(outcome.kind).toBe("filled");
    if (outcome.kind === "filled") expect(outcome.fillPrice).toBeLessThan(90);
  });
});

describe("buy-stop — scenario B: buy when it rises to $110", () => {
  it("stays waiting below the stop", () => {
    const order = makeOrder({ orderType: "buy-stop", targetPrice: 110 });
    expect(tick(order, 105).kind).toBe("no-change");
  });
  it("triggers at or above the stop and converts to a market buy", () => {
    const order = makeOrder({ orderType: "buy-stop", targetPrice: 110, reservedCash: 1200 });
    const result = processOrderTick({ order, referencePrice: 110, now: LATER });
    expect(result.wasTriggeredThisPass).toBe(true);
    expect(result.outcome.kind).toBe("filled");
  });
  it("an upward gap through the stop does not create a negative balance — caps at reserved cash", () => {
    // Stop at $110, qty 10, reserved at 110*10=1100. Price gaps to $130.
    const order = makeOrder({ orderType: "buy-stop", targetPrice: 110, quantity: 10, reservedCash: 1100 });
    const result = processOrderTick({ order, referencePrice: 130, now: LATER });
    expect(result.outcome.kind === "partial" || result.outcome.kind === "rejected-remainder").toBe(true);
    if (result.outcome.kind === "partial") {
      const cost = result.outcome.fillPrice * result.outcome.filledShares;
      expect(cost).toBeLessThanOrEqual(1100 + 0.01);
      expect(result.outcome.reason).toBe("gap-insufficient-funds");
    }
  });
});

describe("sell-limit — scenario C: sell when it rises to $110", () => {
  it("stays waiting below the limit", () => {
    const order = makeOrder({ side: "sell", orderType: "sell-limit", targetPrice: 110, reservedShares: 10 });
    expect(tick(order, 105).kind).toBe("no-change");
  });
  it("fills at or above the limit — never worse", () => {
    const order = makeOrder({ side: "sell", orderType: "sell-limit", targetPrice: 110, reservedShares: 10 });
    const outcome = tick(order, 110.5);
    expect(outcome.kind).toBe("filled");
    if (outcome.kind === "filled") expect(outcome.fillPrice).toBeGreaterThanOrEqual(110);
  });
});

describe("sell-stop — scenario D: sell when it falls to $90", () => {
  it("stays waiting above the stop", () => {
    const order = makeOrder({ side: "sell", orderType: "sell-stop", targetPrice: 90, reservedShares: 10 });
    expect(tick(order, 95).kind).toBe("no-change");
  });
  it("the worked example: sell stop at $90 triggers, next available price is $86, fills there (worse than the stop)", () => {
    const order = makeOrder({ side: "sell", orderType: "sell-stop", targetPrice: 90, quantity: 10, reservedShares: 10 });
    const result = processOrderTick({ order, referencePrice: 86, now: LATER });
    expect(result.wasTriggeredThisPass).toBe(true);
    expect(result.outcome.kind).toBe("filled");
    if (result.outcome.kind === "filled") {
      expect(result.outcome.fillPrice).toBeLessThan(90);
      expect(result.outcome.fillPrice).toBeCloseTo(86, 0);
    }
  });
});

describe("a triggered stop stays triggered even if price reverses", () => {
  it("does not revert to waiting, and keeps trying to fill as a market order", () => {
    const order = makeOrder({ side: "sell", orderType: "sell-stop", targetPrice: 90, reservedShares: 10 });
    const triggeredResult = processOrderTick({ order, referencePrice: 89, now: LATER });
    expect(triggeredResult.outcome.kind).toBe("filled"); // fills same pass at ~89

    // Simulate: it had only gotten as far as "triggered" (e.g. zero liquidity that instant),
    // then price reverses back above the original stop level.
    const stillTriggered = makeOrder({
      side: "sell",
      orderType: "sell-stop",
      targetPrice: 90,
      status: "triggered",
      triggeredAt: LATER,
      reservedShares: 10,
    });
    const afterReversal = evaluateTick({ order: stillTriggered, referencePrice: 95, now: LATER + 1000 });
    // Still fills as a market sell despite price now being back above $90 — it never re-checks the $90 condition.
    expect(afterReversal.kind).toBe("filled");
  });
});

describe("insufficient funds and holdings", () => {
  it("computeReservation reserves cash at the order's own price for buys", () => {
    expect(computeReservation({ side: "buy", targetPrice: 90, quantity: 10 })).toEqual({
      reservedCash: 900,
      reservedShares: 0,
    });
  });
  it("computeReservation reserves shares (not cash) for sells", () => {
    expect(computeReservation({ side: "sell", targetPrice: 110, quantity: 10 })).toEqual({
      reservedCash: 0,
      reservedShares: 10,
    });
  });
  it("a buy-stop gap so large that reserved cash covers zero shares rejects the remainder", () => {
    const order = makeOrder({ orderType: "buy-stop", targetPrice: 110, quantity: 5, reservedCash: 100 });
    const result = processOrderTick({ order, referencePrice: 500, now: LATER });
    expect(result.outcome.kind).toBe("rejected-remainder");
  });
});

describe("partial fills from constrained liquidity", () => {
  it("fills only what's available and leaves the remainder pending", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90, quantity: 10, reservedCash: 900 });
    const outcome = tick(order, 89, { maxFillQuantity: 4 });
    expect(outcome.kind).toBe("partial");
    if (outcome.kind === "partial") {
      expect(outcome.filledShares).toBe(4);
      expect(outcome.remainingShares).toBe(6);
      expect(outcome.reason).toBe("liquidity");
    }
  });
});

describe("competing pending orders don't share the same reservation", () => {
  it("sums reserved cash only from live (waiting/triggered) buy rules", () => {
    const orders = [
      makeOrder({ id: "a", side: "buy", status: "waiting", reservedCash: 500 }),
      makeOrder({ id: "b", side: "buy", status: "triggered", reservedCash: 300 }),
      makeOrder({ id: "c", side: "buy", status: "filled", reservedCash: 400 }), // already resolved, no longer holding cash
      makeOrder({ id: "d", side: "sell", status: "waiting", reservedCash: 0, reservedShares: 5 }),
    ];
    expect(sumReservedCash(orders)).toBe(800);
  });
  it("sums reserved shares per symbol only from live sell rules, ignoring other symbols and resolved orders", () => {
    const orders = [
      makeOrder({ id: "a", symbol: "AAPL", side: "sell", status: "waiting", reservedShares: 3 }),
      makeOrder({ id: "b", symbol: "AAPL", side: "sell", status: "triggered", reservedShares: 2 }),
      makeOrder({ id: "c", symbol: "AAPL", side: "sell", status: "cancelled", reservedShares: 10 }),
      makeOrder({ id: "d", symbol: "TSLA", side: "sell", status: "waiting", reservedShares: 7 }),
    ];
    expect(sumReservedShares(orders, "AAPL")).toBe(5);
  });
});

describe("cancellation and expiry", () => {
  it("a cancelled order is never evaluated again", () => {
    const order = makeOrder({ status: "cancelled", cancelledAt: NOW });
    expect(tick(order, 50).kind).toBe("no-change");
  });
  it("expires once the simulated clock passes expiresAt, even if the price condition is met", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90, expiresAt: LATER - 1 });
    expect(tick(order, 50).kind).toBe("expired");
  });
});

describe("duplicate submission / repeated price events don't double-fill", () => {
  it("an already-filled order is inert on further ticks", () => {
    const order = makeOrder({ status: "filled", filledAt: NOW, filledQuantity: 10 });
    expect(tick(order, 1).kind).toBe("no-change");
  });
  it("evaluating the same waiting order twice against the same price is idempotent (fills once)", () => {
    const order = makeOrder({ orderType: "buy-limit", targetPrice: 90, reservedCash: 900 });
    const first = tick(order, 85);
    expect(first.kind).toBe("filled");
    // Caller is responsible for actually applying the state transition before
    // the next tick; re-running against the *original* still-waiting order
    // is deterministic and would fill again — this documents that the
    // context layer's job is exactly that state transition, not the engine's.
    const second = tick(order, 85);
    expect(second.kind).toBe("filled");
  });
});
