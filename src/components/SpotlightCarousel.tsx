import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { getStock } from "../data/stocks";
import { getPriceHistory } from "../data/priceHistory";
import { useStock } from "../data/liveQuotes";
import { getAnalystInsight, ANALYST_COVERED_SYMBOLS } from "../data/analystInsights";
import { useCurrency } from "../context/CurrencyContext";
import { useLocale } from "../context/LocaleContext";
import { StockLogo } from "./StockLogo";
import { LiveDot } from "./LiveDot";
import { Sparkline } from "./Sparkline";
import { PriceChange } from "./PriceChange";
import { RatingMeter } from "./RatingMeter";

function SpotlightCard({ symbol }: { symbol: string }) {
  const baseStock = getStock(symbol);
  const stock = useStock(symbol) ?? baseStock;
  const insight = getAnalystInsight(symbol);
  const { formatDisplay } = useCurrency();

  if (!stock || !insight) return null;

  const change = stock.price - stock.prevClose;
  const percent = stock.prevClose !== 0 ? (change / stock.prevClose) * 100 : 0;
  const positive = change >= 0;
  const history = getPriceHistory(symbol, "1D", stock.price);

  return (
    <Link to={`/stock/${symbol}`} className="block shrink-0 snap-start">
      <motion.div
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        className="w-[188px] rounded-3xl border border-border-soft bg-surface-2/70 p-4 backdrop-blur-sm hover:bg-surface-2 cursor-pointer"
        style={{ boxShadow: `0 14px 34px -16px ${stock.color}77` }}
      >
        <div className="flex items-center justify-between gap-2">
          <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={30} />
          <RatingMeter rating={insight.rating} score={insight.score} />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-ink">{stock.symbol}</span>
          <LiveDot symbol={stock.symbol} />
        </div>
        <div className="truncate text-[11px] text-ink-faint">{stock.name}</div>

        <div className="mt-2 text-lg font-semibold tabular-nums text-ink">
          {formatDisplay(stock.price, { precise: true })}
        </div>
        <PriceChange amount={change} percent={percent} size="sm" formatAmount={formatDisplay} />

        <div className="-mx-1 mt-2">
          <Sparkline data={history} positive={positive} width={156} height={36} />
        </div>
      </motion.div>
    </Link>
  );
}

/** Luxurious horizontal spotlight for the 5 stocks with weekly analyst coverage — each card opens the stock's main page, which surfaces the confidence bar leading into the full outlook report. */
export function SpotlightCarousel() {
  const { t } = useLocale();

  return (
    <section className="mt-8">
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">{t("analyst.sectionTitle")}</h2>
        <p className="mt-0.5 text-[13px] text-ink-faint">{t("analyst.sectionSubtitle")}</p>
      </div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar px-4 pb-1 lg:px-6">
        {ANALYST_COVERED_SYMBOLS.map((symbol) => (
          <SpotlightCard key={symbol} symbol={symbol} />
        ))}
      </div>
    </section>
  );
}
