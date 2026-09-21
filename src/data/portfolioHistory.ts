import type { Holding, PricePoint, Range } from "../types";
import { getPriceHistory } from "./priceHistory";

export function getPortfolioHistory(
  holdings: Holding[],
  cash: number,
  range: Range,
): PricePoint[] {
  if (holdings.length === 0) {
    const now = Date.now();
    return [
      { t: now - 1, price: cash },
      { t: now, price: cash },
    ];
  }
  const histories = holdings.map((h) => ({
    shares: h.shares,
    points: getPriceHistory(h.symbol, range),
  }));
  const length = histories[0].points.length;
  const result: PricePoint[] = [];
  for (let i = 0; i < length; i++) {
    let value = cash;
    for (const h of histories) {
      value += (h.points[i]?.price ?? 0) * h.shares;
    }
    result.push({ t: histories[0].points[i].t, price: value });
  }
  return result;
}
