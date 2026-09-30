import type { PriceRuleOrder } from "../types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type FormatDisplay = (value: number, opts?: { precise?: boolean }) => string;

/**
 * The one-line, beginner-facing summary of what a price rule will do —
 * shared by the full "My price rules" list and the compact "Pending
 * orders" sections on the dashboard and stock page, so a queued market
 * order and a limit/stop rule are always described the same way wherever
 * they appear.
 */
export function describeRuleSummary(order: PriceRuleOrder, t: Translate, formatDisplay: FormatDisplay): string {
  if (order.orderType === "market") {
    return t(order.side === "buy" ? "priceRules.marketBuySummary" : "priceRules.marketSellSummary", {
      symbol: order.symbol,
      quantity: order.quantity,
      sharesWord: t("priceRules.sentenceSharesWord"),
    });
  }
  return t("priceRules.sentenceTemplate", {
    symbol: order.symbol,
    condition: t(
      order.orderType === "buy-limit" || order.orderType === "sell-stop"
        ? "priceRules.sentenceFallsTo"
        : "priceRules.sentenceRisesTo",
    ),
    price: formatDisplay(order.targetPrice, { precise: true }),
    quantity: order.quantity,
    action: t(order.side === "buy" ? "priceRules.sentenceBuy" : "priceRules.sentenceSell"),
    sharesWord: t("priceRules.sentenceSharesWord"),
  });
}

/** "2 of 5 shares purchased • 3 remaining" (or "sold" for a sell rule) — only meaningful once at least one share has filled. */
export function describeFillProgress(order: PriceRuleOrder, t: Translate): string {
  const remaining = order.quantity - order.filledQuantity;
  return t(order.side === "buy" ? "pendingOrders.progressBuy" : "pendingOrders.progressSell", {
    filled: order.filledQuantity,
    quantity: order.quantity,
    remaining,
  });
}
