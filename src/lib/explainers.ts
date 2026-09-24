import type { Stock } from "../types";

type T = (path: string, vars?: Record<string, string | number>) => string;

/** Two-sentence plain-English explanation of what the security is. */
export function whatIsIt(stock: Stock, t: T): string {
  const intro =
    stock.category === "crypto"
      ? t("explainers.whatIsItCrypto", { name: stock.name })
      : stock.category === "fund"
        ? t("explainers.whatIsItFund", { name: stock.name })
        : t("explainers.whatIsItStock", { name: stock.name, sector: t(`sectors.${stock.sector}`) });
  return `${intro} ${stock.about}`;
}

/** Explains the ownership mechanics — what you actually hold when you buy this. */
export function whatAmIInvestingIn(stock: Stock, t: T): string {
  if (stock.category === "crypto") return t("explainers.investingCrypto", { symbol: stock.symbol });
  if (stock.category === "fund") return t("explainers.investingFund", { symbol: stock.symbol });
  return t("explainers.investingStock", { symbol: stock.symbol, name: stock.name });
}

/** Plain-language risk factors, 3-5 bullets depending on category and stats. */
export function riskFactors(stock: Stock, t: T): string[] {
  const entity =
    stock.category === "crypto"
      ? t("insights.entityCrypto")
      : stock.category === "fund"
        ? t("insights.entityFund")
        : t("insights.entityCompany");

  const bullets: string[] = [];

  if (stock.category === "stock") {
    bullets.push(t("explainers.riskCompanySpecific", { sector: t(`sectors.${stock.sector}`) }));
    if (stock.peRatio && stock.peRatio > 30) {
      bullets.push(t("explainers.riskHighValuation"));
    }
  } else if (stock.category === "fund") {
    bullets.push(t("explainers.riskFundTracksIndex"));
    if (stock.symbol === "QQQ") {
      bullets.push(t("explainers.riskFundConcentration"));
    }
  } else {
    bullets.push(t("explainers.riskCryptoVolatility"));
    bullets.push(t("explainers.riskCryptoNoBacking"));
    bullets.push(t("explainers.riskCryptoRegulation"));
  }

  bullets.push(t("explainers.riskMarketWide", { entity }));
  bullets.push(t("explainers.riskPastPerformance"));
  return bullets;
}
