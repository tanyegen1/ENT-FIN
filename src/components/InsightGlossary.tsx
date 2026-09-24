import { useMemo } from "react";
import type { Stock } from "../types";
import { buildInsights } from "../lib/insights";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";

interface InsightGlossaryProps {
  stock: Stock;
}

/** Plain-English "what does this number mean" cards for a stock's key stats. */
export function InsightGlossary({ stock }: InsightGlossaryProps) {
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const insights = useMemo(() => buildInsights(stock, t, formatDisplay), [stock, t, formatDisplay]);

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-ink">{t("insights.heading")}</h3>
      <p className="mt-1 text-[13px] text-ink-faint">{t("insights.subtitle", { symbol: stock.symbol })}</p>
      <div className="mt-4 flex flex-col gap-3">
        {insights.map((item) => (
          <div key={item.key} className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-ink-faint">{item.label}</span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-dim">
                {item.badge}
              </span>
            </div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{item.value}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
