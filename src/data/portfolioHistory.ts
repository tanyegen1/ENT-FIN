import type { Holding, PricePoint, Range } from "../types";
import { getPriceHistory } from "./priceHistory";
import { getLiveQuote, isLiveSymbol } from "./liveQuotes";

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
  const histories = holdings.map((h) => {
    const liveEndPrice = isLiveSymbol(h.symbol) ? getLiveQuote(h.symbol)?.price : undefined;
    return {
      shares: h.shares,
      points: getPriceHistory(h.symbol, range, liveEndPrice),
    };
  });
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
