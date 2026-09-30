import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, Star } from "lucide-react";
import type {
  CatalogueBar,
  CatalogueCompanyInfo,
  CatalogueInstrument,
  CatalogueQuote,
  Range,
} from "../types";
import {
  catalogueLogoUrl,
  fetchCatalogueBars,
  fetchCatalogueQuotes,
  fetchInstrumentDetails,
} from "../data/catalogService";
import { registerCatalogueQuote, getCatalogueExecutionPrice } from "../data/catalogueRegistry";
import { PageHeader } from "../components/PageHeader";
import { StockLogo } from "../components/StockLogo";
import { InteractiveChart } from "../components/InteractiveChart";
import { RangeTabs } from "../components/RangeTabs";
import { PriceChange } from "../components/PriceChange";
import { MarketStatusPill } from "../components/MarketStatusPill";
import { PendingOrdersSection } from "../components/PendingOrdersSection";
import { OrderSheet } from "../components/OrderSheet";
import { PriceRuleSheet } from "../components/PriceRuleSheet";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatTooltipDateTime } from "../lib/chartAxis";
import { formatShares } from "../lib/format";
import { getMarketSession } from "../lib/marketSession";

const EXCHANGE_LABEL: Record<CatalogueInstrument["primaryExchange"], string> = {
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  XASE: "NYSE American",
  ARCX: "NYSE Arca",
  OTHER: "",
};

const SOURCE_LABEL_KEY: Record<CatalogueQuote["priceType"], string> = {
  last_trade: "catalogueStock.sourceLastTrade",
  regular_close: "catalogueStock.sourceRegularClose",
  bid: "catalogueStock.sourceBid",
  ask: "catalogueStock.sourceAsk",
  extended_hours_trade: "catalogueStock.sourceExtendedHoursTrade",
};

const FRESHNESS_LABEL_KEY: Record<CatalogueQuote["freshness"], string> = {
  real_time: "catalogueStock.freshnessRealTime",
  delayed: "catalogueStock.freshnessDelayed",
  end_of_day: "catalogueStock.freshnessEndOfDay",
  stale: "catalogueStock.freshnessStale",
};

/**
 * Stock page for an instrument from the full Nasdaq/NYSE catalogue that
 * isn't in Arvo's curated STOCKS list — see src/pages/StockDetail.tsx,
 * which renders this instead of redirecting to /search when a ticker is
 * only known to the catalogue backend. Deliberately simpler than the
 * curated page: no authored "about"/risk copy, no analyst outlook, no
 * comparisons — every section here only ever shows data the catalogue
 * backend actually returned, honestly labeled, never a substitute.
 *
 * Buy/Sell and "Set a price rule" reuse the exact same OrderSheet/
 * PriceRuleSheet/PortfolioContext flow curated stocks use (see
 * types.ts's OrderableStock and data/catalogueRegistry.ts) — but stay
 * disabled until the catalogue backend has both a fresh quote AND this
 * specific instrument marked trading_eligible. Catalogue presence alone
 * never implies trading eligibility (spec section 4).
 */
export function CatalogueStockDetail({ symbol }: { symbol: string }) {
  const { t, locale } = useLocale();
  const { formatDisplay } = useCurrency();
  const { getHolding, isWatched, toggleWatchlist } = usePortfolio();
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading");
  const [instrument, setInstrument] = useState<CatalogueInstrument | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CatalogueCompanyInfo | null>(null);
  const [quote, setQuote] = useState<CatalogueQuote | null>(null);
  const [range, setRange] = useState<Range>("1D");
  const [bars, setBars] = useState<CatalogueBar[]>([]);
  const [barsStatus, setBarsStatus] = useState<"loading" | "ok" | "unavailable">("loading");
  const [showExtendedHours, setShowExtendedHours] = useState(false);
  const [order, setOrder] = useState<"buy" | "sell" | null>(null);
  const [priceRuleSide, setPriceRuleSide] = useState<"buy" | "sell" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchInstrumentDetails(symbol).then((details) => {
      if (cancelled) return;
      if (!details) {
        setStatus("not_found");
        return;
      }
      setInstrument(details.instrument);
      setCompanyInfo(details.companyInfo);
      setStatus("found");
    });
    fetchCatalogueQuotes([symbol]).then((quotes) => {
      if (cancelled) return;
      const q = quotes[symbol.toUpperCase()] ?? null;
      setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Registers into the shared, synchronous catalogue registry the moment
  // both pieces are known — lets PortfolioContext's order engine (and its
  // own portfolio-value calculation) see this instrument the same way it
  // already sees every curated one, without polling anything.
  useEffect(() => {
    if (instrument) registerCatalogueQuote(instrument, quote);
  }, [instrument, quote]);

  useEffect(() => {
    let cancelled = false;
    setBarsStatus("loading");
    fetchCatalogueBars(symbol, range).then((result) => {
      if (cancelled) return;
      setBars(result.bars);
      setBarsStatus(result.status === "ok" && result.bars.length > 0 ? "ok" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  if (status === "not_found") return <Navigate to="/search" replace />;

  if (status === "loading" || !instrument) {
    return (
      <div className="pb-10">
        <PageHeader title={symbol.toUpperCase()} back />
        <div className="px-4 pt-6 lg:px-6">
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface-2" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    );
  }

  const exchangeLabel = EXCHANGE_LABEL[instrument.primaryExchange];
  const rawHistory = bars.map((b) => ({ t: b.t, price: b.close }));
  // Extended-hours points are only shown when explicitly toggled on — same
  // default-off convention as the curated stock page (lib/marketSession.ts
  // is the single source of truth for what counts as "regular" here too).
  const canToggleExtendedHours = range === "1D";
  const regularOnlyHistory =
    canToggleExtendedHours && !showExtendedHours
      ? rawHistory.filter((p) => getMarketSession("stock", { now: new Date(p.t), symbol: instrument.ticker }).status === "regular")
      : rawHistory;
  const priceHistory = regularOnlyHistory.length >= 2 ? regularOnlyHistory : rawHistory;
  const baseline = priceHistory[0]?.price ?? quote?.price ?? 0;
  const displayPrice = quote?.price ?? null;
  const diff = displayPrice !== null ? displayPrice - baseline : 0;
  const diffPercent = baseline !== 0 && displayPrice !== null ? (diff / baseline) * 100 : 0;
  const positive = diff >= 0;

  const holding = getHolding(instrument.ticker);
  const watched = isWatched(instrument.ticker);
  const executablePrice = getCatalogueExecutionPrice(instrument.ticker);
  const canTrade = executablePrice !== null;
  const orderableStock = canTrade ? { symbol: instrument.ticker, name: instrument.name, price: executablePrice!, category: "stock" as const } : null;

  return (
    <div className="pb-10">
      <PageHeader title={instrument.ticker} back />

      <div className="flex items-start gap-3 px-4 pt-4 lg:px-6">
        <StockLogo
          symbol={instrument.ticker}
          name={instrument.name}
          fallbackColor="#6b7280"
          size={40}
          logoUrl={instrument.brandingVerified ? catalogueLogoUrl(instrument.ticker) : null}
        />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-ink">{instrument.name}</div>
          <div className="flex items-center gap-1.5 text-[13px] text-ink-faint">
            <span>{instrument.ticker}</span>
            {exchangeLabel && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                {exchangeLabel}
              </span>
            )}
            {instrument.isAdr && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                {t("catalogueStock.adrBadge")}
              </span>
            )}
          </div>
          <MarketStatusPill category="stock" symbol={instrument.ticker} compact className="mt-1.5" />
        </div>
      </div>

      <div className="mx-4 mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-faint lg:mx-6">
        {t("catalogueStock.limitedInfoNote")}
      </div>

      <section className="mt-6 px-4 lg:px-6">
        {displayPrice !== null ? (
          <>
            <div className="text-3xl font-semibold tabular-nums text-ink">
              {formatDisplay(displayPrice, { precise: true })}
            </div>
            {priceHistory.length > 0 && (
              <div className="mt-1.5">
                <PriceChange amount={diff} percent={diffPercent} size="md" formatAmount={formatDisplay} />
              </div>
            )}
            {quote && (
              <div className="mt-1.5 text-[12px] text-ink-faint">
                {t(SOURCE_LABEL_KEY[quote.priceType])} · {t(FRESHNESS_LABEL_KEY[quote.freshness])} ·{" "}
                {t("catalogueStock.asOf", { time: formatTooltipDateTime(new Date(quote.sourceTimestamp).getTime(), locale === "tr" ? "tr-TR" : undefined) })}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-surface-2 px-4 py-4">
            <div className="text-[15px] font-semibold text-ink">{t("catalogueStock.priceUnavailable")}</div>
            <p className="mt-1 text-[12px] text-ink-faint">{t("catalogueStock.priceUnavailableHint")}</p>
          </div>
        )}

        <div className="-mx-4 mt-4 lg:-mx-6">
          {barsStatus === "ok" ? (
            <InteractiveChart
              data={priceHistory}
              positive={positive}
              height={220}
              range={range}
              sessionCategory="stock"
              sessionSymbol={instrument.ticker}
            />
          ) : (
            <div className="mx-4 flex h-[220px] flex-col items-center justify-center rounded-xl bg-surface-2 text-center lg:mx-6">
              <div className="text-[14px] font-semibold text-ink">{t("catalogueStock.historyUnavailable")}</div>
              <p className="mt-1 px-6 text-[12px] text-ink-faint">{t("catalogueStock.historyUnavailableHint")}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <RangeTabs value={range} onChange={setRange} positive={positive} />
        </div>

        {canToggleExtendedHours && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
              <input
                type="checkbox"
                checked={showExtendedHours}
                onChange={(e) => setShowExtendedHours(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand"
              />
              {t("chart.showExtendedHours")}
            </label>
          </div>
        )}

        {holding && (
          <div className="mt-6 rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="text-[13px] text-ink-faint">{t("stockDetail.yourPosition")}</div>
            <div className="mt-2 grid grid-cols-2 gap-y-2 text-[14px]">
              <span className="text-ink-faint">{t("stockDetail.sharesOwned")}</span>
              <span className="text-right tabular-nums text-ink">{formatShares(holding.shares)}</span>
              <span className="text-ink-faint">{t("stockDetail.avgCost")}</span>
              <span className="text-right tabular-nums text-ink">{formatDisplay(holding.avgCost, { precise: true })}</span>
            </div>
          </div>
        )}
      </section>

      {companyInfo?.marketCap && (
        <section className="mt-6 px-4 lg:px-6">
          <div className="text-[13px] text-ink-faint">{t("stockDetail.marketCap")}</div>
          <div className="text-[17px] font-medium tabular-nums text-ink">
            {formatDisplay(companyInfo.marketCap, { compact: true })}
          </div>
        </section>
      )}

      <section className="mt-8 px-4 lg:px-6">
        {canTrade ? (
          <>
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
                onClick={() => toggleWatchlist(instrument.ticker)}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-3 text-[15px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
                whileTap={{ scale: 0.96 }}
                animate={watched ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <Star size={17} className={watched ? "fill-up text-up" : ""} />
              </motion.button>
            </div>

            <motion.button
              onClick={() => setPriceRuleSide("buy")}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border py-2.5 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.12 }}
            >
              <SlidersHorizontal size={14} />
              {t("priceRules.entryButton")}
            </motion.button>

            <PendingOrdersSection symbol={instrument.ticker} className="mt-6" noPadding />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-3.5 text-[13px] text-ink-dim">
            <div className="flex items-center justify-between gap-2">
              <span>{t("catalogueStock.notEligibleForTrading")}</span>
              <button
                onClick={() => toggleWatchlist(instrument.ticker)}
                className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ink-faint hover:text-ink-dim cursor-pointer"
              >
                <Star size={14} className={watched ? "fill-up text-up" : ""} />
                {watched ? t("stockDetail.saved") : t("stockDetail.save")}
              </button>
            </div>
            <p className="mt-1 text-[12px] text-ink-faint">{t("catalogueStock.notEligibleForTradingHint")}</p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {order && orderableStock && (
          <OrderSheet
            stock={orderableStock}
            initialSide={order}
            onClose={() => setOrder(null)}
            onSwitchToPriceRule={(side) => {
              setOrder(null);
              setPriceRuleSide(side);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {priceRuleSide && orderableStock && (
          <PriceRuleSheet
            stock={orderableStock}
            initialSide={priceRuleSide}
            onClose={() => setPriceRuleSide(null)}
            onOpenMarketOrder={(side) => {
              setPriceRuleSide(null);
              setOrder(side);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
