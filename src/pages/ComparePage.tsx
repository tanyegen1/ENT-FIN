import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StockLogo } from "../components/StockLogo";
import { useLocale } from "../context/LocaleContext";
import { getStock } from "../data/stocks";
import { getPriceHistory } from "../data/priceHistory";
import { getLiveQuote, isLiveSymbol } from "../data/liveQuotes";
import { riskFactors } from "../lib/explainers";
import type { AssetCategory, Stock } from "../types";

function oneYearReturn(symbol: string): number | null {
  const liveEnd = isLiveSymbol(symbol) ? getLiveQuote(symbol)?.price : undefined;
  const history = getPriceHistory(symbol, "1Y", liveEnd);
  if (history.length === 0) return null;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function categoryLabel(category: AssetCategory, t: (path: string) => string): string {
  if (category === "fund") return t("search.categoryFund");
  if (category === "crypto") return t("search.categoryCrypto");
  return t("search.categoryStock");
}

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start border-t border-border-soft px-2 py-3 text-[12px] font-medium text-ink-faint">
      {children}
    </div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start border-t border-border-soft px-2 py-3 text-[12px] leading-relaxed text-ink">
      {children}
    </div>
  );
}

export function ComparePage() {
  const { symbols = "" } = useParams();
  const { t } = useLocale();

  const requested = [...new Set(symbols.split(",").filter(Boolean))].slice(0, 3);
  const stocks = requested.map((sym) => getStock(sym)).filter((s): s is Stock => !!s);

  if (stocks.length < 2) {
    return (
      <div className="pb-10">
        <PageHeader title={t("compare.title")} back />
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <p className="text-[15px] font-semibold text-ink">{t("compare.notEnoughTitle")}</p>
          <p className="text-[13px] text-ink-faint">{t("compare.notEnoughBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title={t("compare.title")} back />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("compare.subtitle")}</p>

      <div className="mt-4 overflow-x-auto px-4 lg:px-6">
        <div className="min-w-[520px]">
          <div className="grid" style={{ gridTemplateColumns: `130px repeat(${stocks.length}, minmax(150px, 1fr))` }}>
            <div />
            {stocks.map((s) => (
              <Link
                key={s.symbol}
                to={`/stock/${s.symbol}`}
                className="flex flex-col items-center gap-1.5 px-2 pb-3 hover:opacity-80"
              >
                <StockLogo symbol={s.symbol} name={s.name} fallbackColor={s.color} size={36} />
                <span className="text-[13px] font-semibold text-ink">{s.symbol}</span>
              </Link>
            ))}

            <RowLabel>{t("compare.rowWhatItIs")}</RowLabel>
            {stocks.map((s) => <Cell key={s.symbol}>{s.about}</Cell>)}

            <RowLabel>{t("compare.rowCategory")}</RowLabel>
            {stocks.map((s) => (
              <Cell key={s.symbol}>{categoryLabel(s.category, t)}</Cell>
            ))}

            <RowLabel>{t("compare.rowCosts")}</RowLabel>
            {stocks.map((s) => (
              <Cell key={s.symbol}>{s.category === "fund" ? t("compare.costsFund") : t("compare.costsTrading")}</Cell>
            ))}

            <RowLabel>{t("compare.rowPerformance")}</RowLabel>
            {stocks.map((s) => {
              const ret = oneYearReturn(s.symbol);
              return (
                <Cell key={s.symbol}>
                  <span className={ret !== null && ret < 0 ? "font-medium tabular-nums text-down" : "font-medium tabular-nums text-up"}>
                    {ret === null ? "—" : `${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%`}
                  </span>
                </Cell>
              );
            })}

            <RowLabel>{t("compare.rowRisks")}</RowLabel>
            {stocks.map((s) => (
              <Cell key={s.symbol}>
                <ul className="flex flex-col gap-1.5">
                  {riskFactors(s, t)
                    .slice(0, 3)
                    .map((risk) => (
                      <li key={risk} className="flex gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        <span>{risk}</span>
                      </li>
                    ))}
                </ul>
              </Cell>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
