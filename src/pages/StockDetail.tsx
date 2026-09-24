import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Star } from "lucide-react";
import { getPriceHistory } from "../data/priceHistory";
import { isLiveSymbol, useStock } from "../data/liveQuotes";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { InteractiveChart } from "../components/InteractiveChart";
import { RangeTabs } from "../components/RangeTabs";
import { PriceChange } from "../components/PriceChange";
import { PageHeader } from "../components/PageHeader";
import { OrderSheet } from "../components/OrderSheet";
import { LiveDot } from "../components/LiveDot";
import { StockLogo } from "../components/StockLogo";
import { InfoTip } from "../components/InfoTip";
import { InsightGlossary } from "../components/InsightGlossary";
import { ComparisonSection } from "../components/ComparisonSection";
import { whatAmIInvestingIn, whatIsIt, riskFactors } from "../lib/explainers";
import { formatCompactNumber, formatShares } from "../lib/format";
import type { PricePoint, Range } from "../types";

export function StockDetail() {
  const { symbol = "" } = useParams();
  const stock = useStock(symbol.toUpperCase());
  const { getHolding, isWatched, toggleWatchlist } = usePortfolio();
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const [range, setRange] = useState<Range>("1D");
  const [scrub, setScrub] = useState<PricePoint | null>(null);
  const [order, setOrder] = useState<"buy" | "sell" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const history = useMemo(
    () =>
      stock
        ? getPriceHistory(stock.symbol, range, isLiveSymbol(stock.symbol) ? stock.price : undefined)
        : [],
    [stock, range],
  );

  if (!stock) return <Navigate to="/search" replace />;

  const holding = getHolding(stock.symbol);
  const watched = isWatched(stock.symbol);

  const baseline = range === "1D" ? stock.prevClose : history[0]?.price ?? stock.price;
  const displayPrice = scrub ? scrub.price : stock.price;
  const diff = displayPrice - baseline;
  const diffPercent = baseline !== 0 ? (diff / baseline) * 100 : 0;
  const positive = diff >= 0;

  const stats: { label: string; value: string; definition: string }[] = [
    { label: t("stockDetail.marketCap"), value: formatDisplay(stock.marketCap, { compact: true }), definition: t("glossary.marketCap") },
    { label: t("stockDetail.peRatio"), value: stock.peRatio ? stock.peRatio.toFixed(1) : "—", definition: t("glossary.peRatio") },
    {
      label: t("stockDetail.dividendYield"),
      value: stock.divYield ? `${stock.divYield.toFixed(2)}%` : "—",
      definition: t("glossary.dividendYield"),
    },
    { label: t("stockDetail.weekHigh"), value: formatDisplay(stock.weekHigh52, { precise: true }), definition: t("glossary.weekHigh") },
    { label: t("stockDetail.weekLow"), value: formatDisplay(stock.weekLow52, { precise: true }), definition: t("glossary.weekLow") },
    {
      label: t("stockDetail.volume"),
      value: stock.volume ? formatCompactNumber(stock.volume) : "—",
      definition: t("glossary.volume"),
    },
    {
      label: t("stockDetail.avgVolume"),
      value: stock.avgVolume ? formatCompactNumber(stock.avgVolume) : "—",
      definition: t("glossary.avgVolume"),
    },
    { label: t("stockDetail.sector"), value: t(`sectors.${stock.sector}`), definition: t("glossary.sector") },
  ];

  return (
    <div className="pb-10">
      <PageHeader title={stock.symbol} back />

      <div className="flex items-center gap-3 px-4 pt-4 lg:px-6">
        <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={40} />
        <div>
          <div className="text-lg font-semibold text-ink">{stock.name}</div>
          <div className="text-[13px] text-ink-faint">{stock.symbol}</div>
        </div>
      </div>

      {/* 1. What is it? */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("stockDetail.whatIsItHeading")}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{whatIsIt(stock, t)}</p>
      </section>

      {/* 2. What am I investing in? */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("stockDetail.whatAmIInvestingHeading")}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{whatAmIInvestingIn(stock, t)}</p>
      </section>

      {/* 3. What could affect its value? */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("stockDetail.risksHeading")}</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {riskFactors(stock, t).map((risk) => (
            <li key={risk} className="flex gap-2 text-[14px] leading-relaxed text-ink-dim">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Price and performance */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("stockDetail.priceHeading")}</h2>

        <div className="relative mt-3">
          <div
            className="pointer-events-none absolute -top-6 left-1/2 h-40 w-[120%] -translate-x-1/2 rounded-full blur-3xl"
            style={{ backgroundColor: "var(--color-brand)", opacity: 0.07 }}
          />
          <div className="flex items-center gap-1.5 text-sm text-ink-faint">
            <LiveDot symbol={stock.symbol} showLabel />
          </div>
          <div className="text-3xl font-semibold tabular-nums text-ink">
            {formatDisplay(displayPrice, { precise: true })}
          </div>
          <div className="mt-1.5">
            <PriceChange amount={diff} percent={diffPercent} size="md" formatAmount={formatDisplay} />
          </div>
        </div>

        <div className="-mx-4 mt-4 lg:-mx-6">
          <InteractiveChart data={history} positive={positive} height={220} onScrub={(p) => setScrub(p)} />
        </div>

        <div className="mt-4">
          <RangeTabs value={range} onChange={setRange} positive={positive} />
        </div>

        {holding && (
          <div className="mt-6 rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="text-[13px] text-ink-faint">{t("stockDetail.yourPosition")}</div>
            <div className="mt-2 grid grid-cols-2 gap-y-2 text-[14px]">
              <span className="text-ink-faint">{t("stockDetail.sharesOwned")}</span>
              <span className="text-right tabular-nums text-ink">{formatShares(holding.shares)}</span>
              <span className="text-ink-faint">{t("stockDetail.avgCost")}</span>
              <span className="text-right tabular-nums text-ink">
                {formatDisplay(holding.avgCost, { precise: true })}
              </span>
              <span className="text-ink-faint">{t("stockDetail.marketValue")}</span>
              <span className="text-right tabular-nums text-ink">
                {formatDisplay(holding.shares * stock.price)}
              </span>
              <span className="text-ink-faint">{t("stockDetail.totalReturn")}</span>
              <PriceChange
                amount={(stock.price - holding.avgCost) * holding.shares}
                percent={((stock.price - holding.avgCost) / holding.avgCost) * 100}
                size="sm"
                className="justify-end"
                formatAmount={formatDisplay}
              />
            </div>
          </div>
        )}
      </section>

      {/* 5. Buy, save, or compare */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("stockDetail.actionsHeading")}</h2>
        <div className="mt-3 flex gap-2">
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
          <motion.button
            onClick={() => toggleWatchlist(stock.symbol)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-3 text-[15px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
            whileTap={{ scale: 0.96 }}
            animate={watched ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <Star size={17} className={watched ? "fill-up text-up" : ""} />
            <span className="hidden sm:inline">{watched ? t("stockDetail.saved") : t("stockDetail.save")}</span>
          </motion.button>
        </div>

        <div className="mt-8">
          <ComparisonSection stock={stock} range={range} />
        </div>
      </section>

      {/* 6. Detailed financial statistics, collapsed by default */}
      <section className="mt-8 px-4 lg:px-6">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl py-2 text-left cursor-pointer"
        >
          <h2 className="text-lg font-semibold text-ink">
            {detailsOpen ? t("stockDetail.hideDetails") : t("stockDetail.moreDetails")}
          </h2>
          <motion.span animate={{ rotate: detailsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={20} className="text-ink-faint" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {detailsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <h3 className="text-[15px] font-semibold text-ink">{t("stockDetail.stats")}</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
                  {stats.map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center gap-1 text-[13px] text-ink-faint">
                        <span>{s.label}</span>
                        <InfoTip definition={s.definition} />
                      </div>
                      <div className="text-[15px] font-medium tabular-nums text-ink">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <InsightGlossary stock={stock} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {order && <OrderSheet stock={stock} initialSide={order} onClose={() => setOrder(null)} />}
      </AnimatePresence>
    </div>
  );
}
