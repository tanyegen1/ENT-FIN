import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ShieldAlert, TrendingDown, TrendingUp, Minus } from "lucide-react";
import clsx from "clsx";
import { useStock } from "../data/liveQuotes";
import { getAnalystInsight } from "../data/analystInsights";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { PageHeader } from "../components/PageHeader";
import { StockLogo } from "../components/StockLogo";
import { RatingMeter } from "../components/RatingMeter";
import { OrderSheet } from "../components/OrderSheet";
import { buildAnalystFactors, ratingToneClass, updatedThisWeekLabel } from "../lib/analystRating";
import { formatPercent } from "../lib/format";
import type { FactorDirection } from "../types";

function FactorIcon({ direction }: { direction: FactorDirection }) {
  const cls = clsx("mt-0.5 h-4 w-4 shrink-0", ratingToneClass(direction));
  if (direction === "positive") return <TrendingUp className={cls} />;
  if (direction === "negative") return <TrendingDown className={cls} />;
  return <Minus className={cls} />;
}

export function AnalystOutlookPage() {
  const { symbol = "" } = useParams();
  const stock = useStock(symbol.toUpperCase());
  const insight = getAnalystInsight(symbol.toUpperCase());
  const { t, locale } = useLocale();
  const { formatDisplay } = useCurrency();
  const [order, setOrder] = useState<"buy" | "sell" | null>(null);

  if (!stock || !insight) return <Navigate to={`/stock/${symbol}`} replace />;

  const factors = buildAnalystFactors(stock, insight, t);
  const upside = stock.price > 0 ? ((insight.targetAverage - stock.price) / stock.price) * 100 : 0;
  const upsideLabel = upside >= 0 ? t("analyst.upside") : t("analyst.downside");

  return (
    <div className="pb-10">
      <PageHeader title={t("analyst.outlookTitle", { symbol: stock.symbol })} back />

      <div className="flex items-center gap-3 px-4 pt-4 lg:px-6">
        <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={40} />
        <div>
          <div className="text-lg font-semibold text-ink">{stock.name}</div>
          <div className="text-[13px] text-ink-faint">
            {stock.symbol} · {formatDisplay(stock.price, { precise: true })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 text-[12px] text-ink-faint lg:px-6">
        {t("analyst.updatedLabel", { date: updatedThisWeekLabel(locale) })} ·{" "}
        {t("analyst.horizonLabel", { months: insight.horizonMonths })}
      </div>

      <section className="mt-6 px-4 lg:px-6">
        <RatingMeter rating={insight.rating} score={insight.score} variant="gauge" />
      </section>

      <section className="mt-6 px-4 lg:px-6">
        <p className="text-[14px] leading-relaxed text-ink-dim">{insight.summary}</p>
      </section>

      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("analyst.priceTargetHeading")}</h2>
        <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-faint">{t("analyst.currentPriceLabel")}</span>
            <span className="tabular-nums text-[15px] font-medium text-ink">
              {formatDisplay(stock.price, { precise: true })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[13px] text-ink-faint">{t("analyst.targetAverageLabel")}</span>
            <span className="tabular-nums text-[15px] font-semibold text-ink">
              {formatDisplay(insight.targetAverage, { precise: true })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <span className={clsx("text-[13px] font-semibold tabular-nums", upside >= 0 ? "text-up" : "text-down")}>
              {formatPercent(upside)}
            </span>
            <span className="text-[13px] text-ink-faint">{upsideLabel}</span>
          </div>
          <div className="mt-3 border-t border-border-soft pt-3 text-[12px] text-ink-faint">
            {t("analyst.targetRangeTemplate", {
              low: formatDisplay(insight.targetLow, { precise: true }),
              high: formatDisplay(insight.targetHigh, { precise: true }),
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("analyst.factorsHeading")}</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {factors.map((f, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
              <FactorIcon direction={f.direction} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{f.label}</div>
                <div className="mt-0.5 text-[14px] leading-relaxed text-ink">{f.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 px-4 lg:px-6">
        <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <ShieldAlert size={15} className="text-warn" />
            {t("analyst.disclaimerTitle")}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-faint">{t("analyst.disclaimerBody")}</p>
        </div>
      </section>

      <section className="mt-8 px-4 lg:px-6">
        <div className="flex gap-2">
          <motion.button
            onClick={() => setOrder("sell")}
            className="flex-1 rounded-full border border-border py-3 text-[15px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12 }}
          >
            {t("stockDetail.sell")}
          </motion.button>
          <motion.button
            onClick={() => setOrder("buy")}
            className="flex-1 rounded-full bg-up py-3 text-[15px] font-semibold text-black hover:brightness-110 cursor-pointer"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.12 }}
          >
            {t("stockDetail.buy")}
          </motion.button>
        </div>
        <Link
          to={`/stock/${stock.symbol}`}
          className="mt-3 block text-center text-[13px] font-medium text-brand-light hover:brightness-125"
        >
          {t("analyst.seeFullPage")}
        </Link>
      </section>

      <AnimatePresence>
        {order && <OrderSheet stock={stock} initialSide={order} onClose={() => setOrder(null)} />}
      </AnimatePresence>
    </div>
  );
}
