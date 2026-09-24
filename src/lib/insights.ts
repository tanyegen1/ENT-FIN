import type { Stock } from "../types";
import { formatCompactNumber } from "./format";

export interface InsightItem {
  key: string;
  label: string;
  value: string;
  badge: string;
  text: string;
}

type T = (path: string, vars?: Record<string, string | number>) => string;
type FormatAmount = (usd: number, opts?: { compact?: boolean; precise?: boolean }) => string;

function marketCapInsight(stock: Stock, t: T, formatAmount: FormatAmount): InsightItem {
  const cap = stock.marketCap;
  const isCrypto = stock.sector === "Crypto";
  const isETF = stock.sector === "ETF";
  const entity = isCrypto ? t("insights.entityCrypto") : isETF ? t("insights.entityFund") : t("insights.entityCompany");
  const totalValueSentence = isCrypto
    ? t("insights.marketCapTotalValueCrypto", { symbol: stock.symbol })
    : isETF
      ? t("insights.marketCapTotalValueFund", { symbol: stock.symbol })
      : t("insights.marketCapTotalValueCompany", { symbol: stock.symbol });

  let size: string;
  let detail: string;
  if (cap >= 200e9) {
    size = t("insights.marketCapSizeMega");
    detail = isCrypto
      ? t("insights.marketCapDetailMegaCrypto")
      : t("insights.marketCapDetailMegaGeneric", { entity });
  } else if (cap >= 10e9) {
    size = t("insights.marketCapSizeLarge");
    detail = t("insights.marketCapDetailLarge", { entity });
  } else if (cap >= 2e9) {
    size = t("insights.marketCapSizeMid");
    detail = t("insights.marketCapDetailMid", { entity });
  } else {
    size = t("insights.marketCapSizeSmall");
    detail = t("insights.marketCapDetailSmall", { entity });
  }
  return {
    key: "marketCap",
    label: t("insights.marketCapLabel"),
    value: formatAmount(cap, { compact: true }),
    badge: size,
    text: `${totalValueSentence} ${t("insights.marketCapDetailSentence", { detail })}`,
  };
}

function peInsight(stock: Stock, t: T): InsightItem {
  const pe = stock.peRatio;
  if (pe === null) {
    return {
      key: "pe",
      label: t("insights.peLabel"),
      value: "—",
      badge: t("insights.peBadgeNA"),
      text: t("insights.peNotApplicable", { symbol: stock.symbol }),
    };
  }
  let badge: string;
  let detail: string;
  if (pe < 15) {
    badge = t("insights.peBadgeCheap");
    detail = t("insights.peDetailCheap");
  } else if (pe <= 30) {
    badge = t("insights.peBadgeFair");
    detail = t("insights.peDetailFair");
  } else {
    badge = t("insights.peBadgeExpensive");
    detail = t("insights.peDetailExpensive");
  }
  return {
    key: "pe",
    label: t("insights.peLabel"),
    value: pe.toFixed(1),
    badge,
    text: t("insights.peSentence", { years: pe.toFixed(0), symbol: stock.symbol, detail }),
  };
}

function dividendInsight(stock: Stock, t: T): InsightItem {
  const yld = stock.divYield;
  const isCrypto = stock.sector === "Crypto";
  if (!yld) {
    return {
      key: "dividend",
      label: t("insights.dividendLabel"),
      value: "—",
      badge: t("insights.dividendBadgeNone"),
      text: isCrypto
        ? t("insights.dividendNoneCrypto", { symbol: stock.symbol })
        : t("insights.dividendNoneGeneric", { symbol: stock.symbol }),
    };
  }
  let badge: string;
  let detail: string;
  if (yld < 1) {
    badge = t("insights.dividendBadgeModest");
    detail = t("insights.dividendDetailModest");
  } else if (yld <= 3) {
    badge = t("insights.dividendBadgeTypical");
    detail = t("insights.dividendDetailTypical");
  } else {
    badge = t("insights.dividendBadgeGenerous");
    detail = t("insights.dividendDetailGenerous");
  }
  return {
    key: "dividend",
    label: t("insights.dividendLabel"),
    value: `${yld.toFixed(2)}%`,
    badge,
    text: t("insights.dividendSentence", { symbol: stock.symbol, yield: `${yld.toFixed(2)}%`, detail }),
  };
}

function rangeInsight(stock: Stock, t: T, formatAmount: FormatAmount): InsightItem {
  const { weekLow52, weekHigh52, price } = stock;
  const span = weekHigh52 - weekLow52;
  const position = span !== 0 ? ((price - weekLow52) / span) * 100 : 50;
  let badge: string;
  let detail: string;
  if (position >= 90) {
    badge = t("insights.rangeBadgeNearHigh");
    detail = t("insights.rangeDetailNearHigh");
  } else if (position <= 10) {
    badge = t("insights.rangeBadgeNearLow");
    detail = t("insights.rangeDetailNearLow");
  } else {
    badge = t("insights.rangeBadgeMid");
    detail = t("insights.rangeDetailMid");
  }
  return {
    key: "range",
    label: t("insights.rangeLabel"),
    value: `${formatAmount(weekLow52, { precise: true })} – ${formatAmount(weekHigh52, { precise: true })}`,
    badge,
    text: t("insights.rangeSentence", {
      symbol: stock.symbol,
      low: formatAmount(weekLow52, { precise: true }),
      high: formatAmount(weekHigh52, { precise: true }),
      price: formatAmount(price, { precise: true }),
      position: position.toFixed(0),
      detail,
    }),
  };
}

function volumeInsight(stock: Stock, t: T): InsightItem | null {
  if (!stock.volume || !stock.avgVolume) return null;
  const ratio = stock.volume / stock.avgVolume;
  let badge: string;
  let detail: string;
  if (ratio >= 1.3) {
    badge = t("insights.volumeBadgeAbove");
    detail = t("insights.volumeDetailAbove");
  } else if (ratio <= 0.7) {
    badge = t("insights.volumeBadgeBelow");
    detail = t("insights.volumeDetailBelow");
  } else {
    badge = t("insights.volumeBadgeTypical");
    detail = t("insights.volumeDetailTypical");
  }
  return {
    key: "volume",
    label: t("insights.volumeLabel"),
    value: formatCompactNumber(stock.volume),
    badge,
    text: t("insights.volumeSentence", {
      volume: formatCompactNumber(stock.volume),
      avg: formatCompactNumber(stock.avgVolume),
      detail,
    }),
  };
}

export function buildInsights(stock: Stock, t: T, formatAmount: FormatAmount): InsightItem[] {
  return [
    marketCapInsight(stock, t, formatAmount),
    peInsight(stock, t),
    dividendInsight(stock, t),
    rangeInsight(stock, t, formatAmount),
    volumeInsight(stock, t),
  ].filter((x): x is InsightItem => x !== null);
}
