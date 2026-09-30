import type { AnalystFactor, AnalystInsight, AnalystRating, Stock } from "../types";

type T = (path: string, vars?: Record<string, string | number>) => string;

export function ratingLabelKey(rating: AnalystRating): string {
  switch (rating) {
    case "strong-sell":
      return "analyst.ratingStrongSell";
    case "sell":
      return "analyst.ratingSell";
    case "hold":
      return "analyst.ratingHold";
    case "buy":
      return "analyst.ratingBuy";
    case "strong-buy":
      return "analyst.ratingStrongBuy";
  }
}

/** Tailwind classes for the rating's colored badge/pill — shared by the meter and every card that shows a rating. */
export function ratingBadgeClass(rating: AnalystRating): string {
  if (rating === "strong-sell" || rating === "sell") return "bg-down-soft text-down";
  if (rating === "hold") return "bg-warn-soft text-warn";
  return "bg-up-soft text-up";
}

/** Same three-way split, for the meter's gradient dot / factor icons. */
export function ratingToneClass(direction: "positive" | "negative" | "neutral"): string {
  if (direction === "positive") return "text-up";
  if (direction === "negative") return "text-down";
  return "text-ink-faint";
}

function valuationFactor(stock: Stock, t: T): AnalystFactor | null {
  const pe = stock.peRatio;
  if (pe === null) return null;
  const direction = pe > 45 ? "negative" : pe < 20 ? "positive" : "neutral";
  const detailKey =
    pe > 45 ? "analyst.factorValuationHighDetail" : pe < 20 ? "analyst.factorValuationLowDetail" : "analyst.factorValuationFairDetail";
  return {
    label: t("analyst.factorValuation"),
    direction,
    detail: t(detailKey, { symbol: stock.symbol, pe: pe.toFixed(1) }),
  };
}

function momentumFactor(stock: Stock, t: T): AnalystFactor {
  const span = stock.weekHigh52 - stock.weekLow52;
  const position = span !== 0 ? ((stock.price - stock.weekLow52) / span) * 100 : 50;
  const direction = position >= 70 ? "positive" : position <= 30 ? "negative" : "neutral";
  const detailKey =
    position >= 70 ? "analyst.factorMomentumHighDetail" : position <= 30 ? "analyst.factorMomentumLowDetail" : "analyst.factorMomentumMidDetail";
  return {
    label: t("analyst.factorMomentum"),
    direction,
    detail: t(detailKey, { symbol: stock.symbol, position: position.toFixed(0) }),
  };
}

/**
 * Combines two factors computed live from the stock's own stats (valuation,
 * momentum — same inputs insights.ts already uses, so this scales to any
 * future symbol with no extra authoring) with the hand-authored macro/news
 * catalysts from analystInsights.ts (necessarily stock-specific).
 */
export function buildAnalystFactors(stock: Stock, insight: AnalystInsight, t: T): AnalystFactor[] {
  const factors: AnalystFactor[] = [];
  const valuation = valuationFactor(stock, t);
  if (valuation) factors.push(valuation);
  factors.push(momentumFactor(stock, t));
  for (const c of insight.catalysts) {
    factors.push({ label: t("analyst.factorMarketBackdrop"), direction: c.direction, detail: c.detail });
  }
  return factors;
}

export interface AnalystProjection {
  /** Percent move from current price to the average 12-month target — can be negative. */
  percent: number;
  /** cost scaled by the same ratio — what that position would be worth if the target holds. */
  projectedValue: number;
}

export function computeProjection(cost: number, stock: { price: number }, insight: AnalystInsight): AnalystProjection {
  const percent = stock.price > 0 ? ((insight.targetAverage - stock.price) / stock.price) * 100 : 0;
  const projectedValue = cost * (1 + percent / 100);
  return { percent, projectedValue };
}

/** "Updated the week of {date}" — floors to the most recent Monday so the label advances with real weeks without claiming a live backend refresh. */
export function updatedThisWeekLabel(locale: "en" | "tr"): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return monday.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
