import type { Stock } from "../types";
import { formatCompactNumber, formatCurrencyPrecise } from "./format";

export interface InsightItem {
  key: string;
  label: string;
  value: string;
  badge: string;
  text: string;
}

function marketCapInsight(stock: Stock): InsightItem {
  const cap = stock.marketCap;
  const isCrypto = stock.sector === "Crypto";
  const isETF = stock.sector === "ETF";
  const entity = isCrypto ? "cryptocurrency" : isETF ? "fund" : "company";
  const totalValueSentence = isCrypto
    ? `The total value of every ${stock.symbol} coin in circulation — like a price tag for the entire supply.`
    : isETF
      ? `The total value of every outstanding ${stock.symbol} share — like a price tag for the whole fund.`
      : `The total value of every outstanding ${stock.symbol} share — like a price tag for the whole company.`;

  let size: string;
  let detail: string;
  if (cap >= 200e9) {
    size = "Mega-cap";
    detail = isCrypto
      ? "one of the largest cryptocurrencies by total value"
      : `one of the largest, most established ${entity}s on the market`;
  } else if (cap >= 10e9) {
    size = "Large-cap";
    detail = `a well-established, large ${entity}`;
  } else if (cap >= 2e9) {
    size = "Mid-cap";
    detail = `a mid-sized ${entity} — bigger swings than mega-caps, more stability than small caps`;
  } else {
    size = "Small-cap";
    detail = `a smaller ${entity} — often more volatile, with more room to grow or fall`;
  }
  return {
    key: "marketCap",
    label: "Market cap",
    value: `$${formatCompactNumber(cap)}`,
    badge: size,
    text: `${totalValueSentence} That makes it ${detail}.`,
  };
}

function peInsight(stock: Stock): InsightItem {
  const pe = stock.peRatio;
  if (pe === null) {
    return {
      key: "pe",
      label: "P/E ratio",
      value: "—",
      badge: "N/A",
      text: `${stock.symbol} isn't consistently profitable (or doesn't report standard earnings), so this metric doesn't apply.`,
    };
  }
  let badge: string;
  let detail: string;
  if (pe < 15) {
    badge = "Cheap";
    detail = "cheaper than the broader market average (roughly 20–25x) — worth asking why the market's pricing it low";
  } else if (pe <= 30) {
    badge = "Fair";
    detail = "in line with the broader market average";
  } else {
    badge = "Expensive";
    detail = "pricier than the market average — often means investors expect strong future growth to justify it";
  }
  return {
    key: "pe",
    label: "P/E ratio",
    value: pe.toFixed(1),
    badge,
    text: `You're paying about ${pe.toFixed(0)} years of ${stock.symbol}'s current profit for one share. That's ${detail}.`,
  };
}

function dividendInsight(stock: Stock): InsightItem {
  const yld = stock.divYield;
  const isCrypto = stock.sector === "Crypto";
  if (!yld) {
    return {
      key: "dividend",
      label: "Dividend yield",
      value: "—",
      badge: "None",
      text: isCrypto
        ? `${stock.symbol} doesn't pay a dividend — cryptocurrencies generally don't, since there's no company issuing them.`
        : `${stock.symbol} doesn't pay a dividend — profits are being reinvested into growth rather than paid out to investors.`,
    };
  }
  let badge: string;
  let detail: string;
  if (yld < 1) {
    badge = "Modest";
    detail = "a small payout on top of any price gains";
  } else if (yld <= 3) {
    badge = "Typical";
    detail = "a fairly typical payout for a dividend-paying stock";
  } else {
    badge = "Generous";
    detail = "a high payout — worth double-checking it's sustainable, since very high yields can sometimes signal the market expects a cut";
  }
  return {
    key: "dividend",
    label: "Dividend yield",
    value: `${yld.toFixed(2)}%`,
    badge,
    text: `${stock.symbol} pays out ${yld.toFixed(2)}% of its share price back to you each year just for holding it — ${detail}.`,
  };
}

function rangeInsight(stock: Stock): InsightItem {
  const { weekLow52, weekHigh52, price } = stock;
  const span = weekHigh52 - weekLow52;
  const position = span !== 0 ? ((price - weekLow52) / span) * 100 : 50;
  let badge: string;
  let detail: string;
  if (position >= 90) {
    badge = "Near high";
    detail = "close to its 52-week high — the stock's been in favor lately";
  } else if (position <= 10) {
    badge = "Near low";
    detail = "close to its 52-week low — it's cooled off from where it's traded over the past year";
  } else {
    badge = "Mid-range";
    detail = "roughly in the middle of that range";
  }
  return {
    key: "range",
    label: "52-week range",
    value: `${formatCurrencyPrecise(weekLow52)} – ${formatCurrencyPrecise(weekHigh52)}`,
    badge,
    text: `Over the past year ${stock.symbol} has traded between ${formatCurrencyPrecise(weekLow52)} and ${formatCurrencyPrecise(weekHigh52)}. At ${formatCurrencyPrecise(price)}, it's ${position.toFixed(0)}% of the way through that range — ${detail}.`,
  };
}

function volumeInsight(stock: Stock): InsightItem | null {
  if (!stock.volume || !stock.avgVolume) return null;
  const ratio = stock.volume / stock.avgVolume;
  let badge: string;
  let detail: string;
  if (ratio >= 1.3) {
    badge = "Above average";
    detail = "more shares are changing hands than usual — often happens around news or earnings";
  } else if (ratio <= 0.7) {
    badge = "Below average";
    detail = "trading is quieter than usual right now";
  } else {
    badge = "Typical";
    detail = "trading is in line with a normal day";
  }
  return {
    key: "volume",
    label: "Trading volume",
    value: formatCompactNumber(stock.volume),
    badge,
    text: `About ${formatCompactNumber(stock.volume)} shares have traded today, versus a ${formatCompactNumber(stock.avgVolume)} average — ${detail}.`,
  };
}

export function buildInsights(stock: Stock): InsightItem[] {
  return [marketCapInsight(stock), peInsight(stock), dividendInsight(stock), rangeInsight(stock), volumeInsight(stock)].filter(
    (x): x is InsightItem => x !== null,
  );
}
