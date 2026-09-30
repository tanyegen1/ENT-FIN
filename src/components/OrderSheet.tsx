import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, TrendingUp, X } from "lucide-react";
import clsx from "clsx";
import type { OrderableStock } from "../types";
import { Keypad } from "./Keypad";
import { SuccessBurst } from "./SuccessBurst";
import { InfoTip } from "./InfoTip";
import { GetHelpButton } from "./GetHelpButton";
import { MarketStatusPill } from "./MarketStatusPill";
import { ExplainRuleButton } from "./ExplainRuleButton";
import { usePortfolio } from "../context/PortfolioContext";
import { useCurrency } from "../context/CurrencyContext";
import { useLocale } from "../context/LocaleContext";
import { useCountUp } from "../hooks/useCountUp";
import { useDraftAmount } from "../hooks/useDraftAmount";
import { useMarketSessionState } from "../hooks/useMarketSessionState";
import { getAnalystInsight } from "../data/analystInsights";
import { computeProjection } from "../lib/analystRating";
import { formatCurrency, formatCurrencyPrecise, formatPercent, formatShares } from "../lib/format";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const STEP_TRANSITION = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};

type Side = "buy" | "sell";
type Mode = "dollars" | "shares";
type Step = "entry" | "review" | "sessionChoice" | "queued" | "success";

// A queued market order is created via the same price-rule machinery as a
// limit/stop order (see types.ts's PriceRuleOrderType "market"), so it can
// fail for the same reasons — reused here rather than duplicating the
// validation logic itself.
const QUEUE_ERROR_KEY: Record<string, string> = {
  "invalid-quantity": "priceRules.errorInvalidQuantity",
  "invalid-price": "priceRules.errorInvalidPrice",
  "insufficient-funds": "priceRules.errorInsufficientFunds",
  "insufficient-shares": "priceRules.errorInsufficientShares",
  "session-unavailable": "priceRules.errorSessionUnavailable",
  "instrument-halted": "priceRules.errorInstrumentHalted",
};

interface OrderSheetProps {
  stock: OrderableStock;
  initialSide: Side;
  onClose: () => void;
  /** Lets the user escape from a closed/extended-hours instant order into the fuller "Set a price rule" builder — e.g. to pick a limit price the queued-market flow here doesn't ask for. */
  onSwitchToPriceRule?: (side: Side, opts?: { extendedHours?: boolean }) => void;
}

export function OrderSheet({ stock, initialSide, onClose, onSwitchToPriceRule }: OrderSheetProps) {
  const { cash, reservedCash, spendableCash, getHolding, buy, sell, createPriceRule, priceRules } = usePortfolio();
  const { displayCurrency, formatDisplay } = useCurrency();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>(initialSide);
  const [mode, setMode] = useState<Mode>("dollars");
  const [raw, setRaw, clearDraft] = useDraftAmount(`order.${stock.symbol}.${initialSide}`);
  const [step, setStep] = useState<Step>("entry");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedOrderId, setQueuedOrderId] = useState<string | null>(null);
  const session = useMarketSessionState(stock.category, stock.symbol);
  const dateLocale = locale === "tr" ? "tr-TR" : undefined;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const holding = getHolding(stock.symbol);
  const ownedShares = holding?.shares ?? 0;

  const amount = Number(raw) || 0;
  const shares = mode === "dollars" ? amount / stock.price : amount;
  const cost = mode === "dollars" ? amount : amount * stock.price;

  const analystInsight = getAnalystInsight(stock.symbol);
  const projection =
    side === "buy" && analystInsight && cost > 0 ? computeProjection(cost, stock, analystInsight) : null;

  const overBuy = side === "buy" && amount > 0 && cost > spendableCash + 0.005;
  const overSell = side === "sell" && amount > 0 && shares > ownedShares + 0.000001;
  // Deliberately doesn't gate canReview: a closed/extended-hours market
  // still lets the user reach Review (where the pill + subtext above
  // already explain immediate execution isn't available) — handleSubmit's
  // check is what actually blocks the ineligible instant execution.
  const canReview = amount > 0 && !overBuy && !overSell;

  // Crypto has no sessions ("open" == always tradeable); equities/funds only
  // execute an instant order during their regular session.
  const canExecuteNow = session.status === "regular" || session.status === "open";
  // A queued order reuses the price-rule engine, which only ever holds whole
  // shares (see PriceRuleOrder.quantity) — a fractional dollar amount is
  // floored down to the nearest whole share it can actually queue.
  const queueShares = Math.floor(shares);
  const canQueue = Number.isFinite(queueShares) && queueShares >= 1;
  const queuedOrder = queuedOrderId ? priceRules.find((r) => r.id === queuedOrderId) ?? null : null;

  const formatSessionTime = (ms: number) =>
    new Date(ms).toLocaleString(dateLocale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

  const maxRaw =
    side === "buy"
      ? mode === "dollars"
        ? spendableCash.toFixed(2)
        : formatShares(spendableCash / stock.price)
      : mode === "shares"
        ? formatShares(ownedShares)
        : (ownedShares * stock.price).toFixed(2);
  const handleMax = () => setRaw(maxRaw);
  const maxDisplay = mode === "dollars" ? `$${maxRaw}` : `${maxRaw} ${t("orderSheet.shares")}`;

  const errorMessage = overBuy
    ? t("orderSheet.needMoreFunds", { amount: formatCurrency(cost - spendableCash) })
    : overSell
      ? t("orderSheet.onlyOwnShares", { shares: formatShares(ownedShares), symbol: stock.symbol })
      : null;

  const handleDigit = (d: string) => {
    setRaw((prev) => {
      if (prev === "0") return d;
      if (prev.includes(".")) {
        const decimals = prev.split(".")[1];
        if (decimals.length >= 2) return prev;
      }
      if (prev.replace(".", "").length >= 9) return prev;
      return prev + d;
    });
  };
  const handleDecimal = () =>
    setRaw((prev) => (prev.includes(".") ? prev : `${prev}.`));
  const handleBackspace = () =>
    setRaw((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));

  const handleSubmit = () => {
    if (!canReview) return;
    const executed = side === "buy" ? buy(stock.symbol, shares, stock.price) : sell(stock.symbol, shares, stock.price);
    if (!executed) {
      // Reaching "review" already implies canExecuteNow was true — this only
      // fires if the session flipped (e.g. regular close) in the moments
      // between opening Review and tapping Submit.
      setSubmitError(t("orderSheet.notEligibleNow"));
      return;
    }
    setStep("success");
    clearDraft();
  };

  const handleQueue = () => {
    if (!canQueue) return;
    const result = createPriceRule({
      symbol: stock.symbol,
      side,
      orderType: "market",
      targetPrice: stock.price,
      quantity: queueShares,
      duration: "today",
      sessionScope: "regular",
    });
    if (!result.ok) {
      setSubmitError(t(QUEUE_ERROR_KEY[result.error]));
      return;
    }
    setSubmitError(null);
    setQueuedOrderId(result.id);
    setStep("queued");
    clearDraft();
  };

  const displayValue = useMemo(() => {
    if (mode === "dollars") return `$${raw}`;
    return raw;
  }, [mode, raw]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-ink">
              {step === "success"
                ? t("orderSheet.orderSubmitted")
                : step === "queued"
                  ? t("orderSheet.orderQueuedTitle")
                  : `${stock.symbol} · ${stock.name}`}
            </span>
            {step !== "success" && step !== "queued" && step !== "sessionChoice" && (
              <MarketStatusPill category={stock.category} symbol={stock.symbol} compact />
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...STEP_TRANSITION}>

        {step === "entry" && (
          <div className="flex flex-col overflow-y-auto">
            <div className="relative flex px-4 pt-3">
              {(["buy", "sell"] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={clsx(
                    "relative flex-1 pb-2 text-center text-[15px] font-semibold capitalize cursor-pointer transition-colors",
                    side === s ? "text-ink" : "text-ink-faint",
                  )}
                >
                  {s === "buy" ? t("stockDetail.buy") : t("stockDetail.sell")}
                  {side === s && (
                    <motion.div
                      layoutId="order-side-underline"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-brand"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-2 px-4 py-8">
              <div className="text-[13px] font-medium text-ink-faint">
                {t(
                  side === "buy"
                    ? mode === "dollars"
                      ? "orderSheet.promptBuyDollars"
                      : "orderSheet.promptBuyShares"
                    : mode === "dollars"
                      ? "orderSheet.promptSellDollars"
                      : "orderSheet.promptSellShares",
                )}
              </div>
              <div className="text-5xl font-semibold tabular-nums text-ink">
                {displayValue}
              </div>
              <button
                onClick={() => {
                  setMode((m) => (m === "dollars" ? "shares" : "dollars"));
                  setRaw("0");
                }}
                className="text-sm font-medium text-ink-faint underline decoration-dotted underline-offset-4 cursor-pointer"
              >
                {mode === "dollars"
                  ? `${formatShares(shares)} ${t("orderSheet.shares")}`
                  : `≈ ${formatCurrency(cost)}`}
                &nbsp;· {mode === "dollars" ? t("orderSheet.switchToShares") : t("orderSheet.switchToDollars")}
              </button>
              <button
                onClick={handleMax}
                className="text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
              >
                {t("common.useMaximum")}
              </button>
              {errorMessage && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-down">{errorMessage}</span>
                  <button
                    onClick={handleMax}
                    className="text-sm font-semibold text-brand-light underline decoration-dotted underline-offset-4 cursor-pointer"
                  >
                    {t("common.fixToAmount", { amount: maxDisplay })}
                  </button>
                </div>
              )}
              {displayCurrency === "TRY" && (
                <span className="text-center text-[12px] text-ink-faint">{t("orderSheet.usdNote")}</span>
              )}
            </div>

            <div className="flex items-center justify-between px-4 pb-2 text-[13px] text-ink-faint">
              <span>{t("orderSheet.marketPrice")}</span>
              <span className="tabular-nums text-ink-dim">
                {formatCurrencyPrecise(stock.price)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 pb-4 text-[13px] text-ink-faint">
              <span className="flex items-center gap-1">
                {side === "buy" ? t("orderSheet.buyingPower") : t("orderSheet.sharesOwned")}
                {side === "buy" && (
                  <InfoTip
                    width={240}
                    definition={
                      <div className="flex flex-col gap-1.5">
                        <div className="font-semibold text-ink">{t("orderSheet.cashBreakdownTitle")}</div>
                        <div className="flex justify-between gap-3">
                          <span>{t("common.totalCash")}</span>
                          <span className="tabular-nums text-ink">{formatCurrency(cash)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>{t("common.reservedCash")}</span>
                          <span className="tabular-nums text-ink">{formatCurrency(reservedCash)}</span>
                        </div>
                        <div className="flex justify-between gap-3 font-medium text-ink">
                          <span>{t("common.spendableCash")}</span>
                          <span className="tabular-nums">{formatCurrency(spendableCash)}</span>
                        </div>
                        <p className="pt-1 text-ink-faint">
                          {t(reservedCash > 0.005 ? "common.reservedExplanation" : "common.reservedExplanationZero")}
                        </p>
                      </div>
                    }
                  />
                )}
              </span>
              <span className="tabular-nums text-ink-dim">
                {side === "buy"
                  ? formatCurrency(spendableCash)
                  : `${formatShares(ownedShares)} sh`}
              </span>
            </div>

            <AnimatePresence>
              {projection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden px-4"
                >
                  <div className="mb-4 rounded-2xl bg-surface-2 px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-dim">
                      <TrendingUp size={13} className="text-up" />
                      {t("analyst.buyProjectionHeading")}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                      {t("analyst.buyProjectionBody", {
                        percent: formatPercent(projection.percent),
                        months: analystInsight!.horizonMonths,
                        amount: formatCurrency(cost),
                        projected: formatCurrency(projection.projectedValue),
                      })}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                      {t("analyst.buyProjectionDisclaimer")}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-4 pb-4">
              <Keypad
                onDigit={handleDigit}
                onDecimal={handleDecimal}
                onBackspace={handleBackspace}
              />
            </div>

            <div className="px-4 pb-6">
              <button
                disabled={!canReview}
                onClick={() => setStep(canExecuteNow ? "review" : "sessionChoice")}
                className={clsx(
                  "w-full rounded-full py-3.5 text-[15px] font-semibold transition-colors cursor-pointer",
                  canReview
                    ? "bg-up text-black hover:brightness-110"
                    : "bg-surface-3 text-ink-faint cursor-not-allowed",
                )}
              >
                {t("orderSheet.reviewOrder")}
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col overflow-y-auto px-4 pb-6 pt-4">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm text-ink-faint">
                {side === "buy" ? t("orderSheet.buy") : t("orderSheet.sell")} · {t("orderSheet.marketOrder")}
              </span>
            </div>
            {displayCurrency === "TRY" && (
              <p className="mb-4 text-[12px] text-ink-faint">{t("orderSheet.usdNote")}</p>
            )}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-3xl font-semibold text-ink">{stock.symbol}</span>
              <span className="text-3xl font-semibold tabular-nums text-ink">
                {formatCurrency(cost)}
              </span>
            </div>
            <dl className="flex flex-col gap-3 border-t border-border-soft pt-4 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-faint">{t("orderSheet.investmentAmount")}</dt>
                <dd className="tabular-nums text-ink">{formatCurrency(cost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">{t("orderSheet.estimatedQuantity")}</dt>
                <dd className="tabular-nums text-ink">
                  {formatShares(shares)} {t("orderSheet.shares")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">{t("orderSheet.fees")}</dt>
                <dd className="tabular-nums text-ink">{formatCurrency(0)}</dd>
              </div>
              {projection && (
                <div className="flex justify-between gap-4">
                  <dt className="flex shrink-0 items-center gap-1 text-ink-faint">
                    {t("analyst.buyProjectionReviewLine")}
                    <InfoTip width={230} definition={t("analyst.buyProjectionDisclaimer")} />
                  </dt>
                  <dd className="text-right tabular-nums text-ink">
                    {formatCurrency(projection.projectedValue)}{" "}
                    <span className={projection.percent >= 0 ? "text-up" : "text-down"}>
                      ({formatPercent(projection.percent)})
                    </span>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-faint">{t("orderSheet.currencyConversion")}</dt>
                <dd className="text-right text-ink">
                  {displayCurrency === "TRY"
                    ? t("orderSheet.conversionRate", { rate: formatDisplay(1) })
                    : t("orderSheet.conversionNotApplicable")}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border-soft pt-3">
                <dt className="font-medium text-ink">
                  {side === "buy" ? t("orderSheet.totalPayment") : t("orderSheet.totalProceeds")}
                </dt>
                <dd className="font-medium tabular-nums text-ink">{formatCurrency(cost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">{t("orderSheet.remainingCash")}</dt>
                <dd className="tabular-nums text-ink">
                  {formatCurrency(side === "buy" ? spendableCash - cost : spendableCash + cost)}
                </dd>
              </div>
            </dl>
            {submitError && <p className="mt-3 text-[13px] font-medium text-down">{submitError}</p>}
            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                className="w-full rounded-full bg-up py-3.5 text-[15px] font-semibold text-black transition-colors hover:brightness-110 cursor-pointer"
              >
                {side === "buy" ? t("orderSheet.submitBuy") : t("orderSheet.submitSell")}
              </button>
              <button
                onClick={() => setStep("entry")}
                className="w-full rounded-full py-3.5 text-[15px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
              >
                {t("orderSheet.editAmount")}
              </button>
            </div>
          </div>
        )}

        {step === "sessionChoice" && (
          <div className="flex flex-col gap-4 px-4 py-4">
            <MarketStatusPill category={stock.category} symbol={stock.symbol} />

            <div className="text-[16px] font-semibold text-ink">
              {t(
                session.status === "halted"
                  ? "orderSheet.sessionChoiceHeadingHalted"
                  : session.status === "unavailable"
                    ? "orderSheet.sessionChoiceHeadingUnavailable"
                    : session.status === "pre-market" || session.status === "after-hours"
                      ? "orderSheet.sessionChoiceHeadingExtended"
                      : "orderSheet.sessionChoiceHeadingClosed",
              )}
            </div>

            {(session.status === "halted" || session.status === "unavailable") && (
              <p className="text-[13px] leading-relaxed text-ink-dim">
                {t(
                  session.status === "halted" ? "orderSheet.sessionChoiceBodyHalted" : "orderSheet.sessionChoiceBodyUnavailable",
                  { symbol: stock.symbol, reason: session.haltedReason ?? "" },
                )}
              </p>
            )}

            {(session.status === "pre-market" || session.status === "after-hours") && (
              <>
                <p className="text-[13px] leading-relaxed text-ink-dim">{t("orderSheet.sessionChoiceBodyExtended")}</p>
                <p className="text-[12px] leading-relaxed text-ink-faint">{t("orderSheet.sessionChoiceRiskNote")}</p>

                <button
                  onClick={() => {
                    onSwitchToPriceRule?.(side, { extendedHours: true });
                    onClose();
                  }}
                  className="w-full rounded-full bg-up py-3.5 text-[15px] font-semibold text-black hover:brightness-110 cursor-pointer"
                >
                  {t("orderSheet.setLimitPriceButton")}
                </button>

                <div className="flex flex-col gap-1.5 rounded-2xl border border-border-soft px-4 py-3.5">
                  <button
                    disabled={!canQueue}
                    onClick={handleQueue}
                    className={clsx(
                      "w-full rounded-full py-3 text-[14px] font-semibold cursor-pointer",
                      canQueue ? "bg-surface-2 text-ink hover:bg-surface-3" : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {t("orderSheet.queueForOpeningButton")}
                  </button>
                  {canQueue ? (
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      {t("orderSheet.queueWholeShareNote", { quantity: queueShares, amount: formatCurrency(queueShares * stock.price) })}
                    </p>
                  ) : (
                    <p className="text-[11px] font-medium text-down">{t("orderSheet.queueNeedsMoreForOneShare")}</p>
                  )}
                  {canQueue && session.nextRegularOpen !== null && (
                    <p className="text-[11px] text-ink-faint">
                      {t("orderSheet.nextEligibleSessionLabel", { when: formatSessionTime(session.nextRegularOpen) })}
                    </p>
                  )}
                </div>
              </>
            )}

            {(session.status === "closed" || session.status === "holiday") && (
              <>
                <p className="text-[13px] leading-relaxed text-ink-dim">
                  {t(
                    session.status === "holiday" ? "orderSheet.sessionChoiceBodyClosedHoliday" : "orderSheet.sessionChoiceBodyClosed",
                    { name: session.holidayName ?? "" },
                  )}
                </p>
                {session.nextRegularOpen !== null && (
                  <p className="text-[13px] font-medium text-ink">
                    {t("orderSheet.nextEligibleSessionLabel", { when: formatSessionTime(session.nextRegularOpen) })}
                  </p>
                )}
                <p className="text-[11px] leading-relaxed text-ink-faint">{t("orderSheet.notAFillPromise")}</p>

                <button
                  disabled={!canQueue}
                  onClick={handleQueue}
                  className={clsx(
                    "w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
                    canQueue ? "bg-up text-black hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
                  )}
                >
                  {t(side === "buy" ? "orderSheet.queueBuyButton" : "orderSheet.queueSellButton")}
                </button>
                {canQueue ? (
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    {t("orderSheet.queueWholeShareNote", { quantity: queueShares, amount: formatCurrency(queueShares * stock.price) })}
                  </p>
                ) : (
                  <p className="text-[11px] font-medium text-down">{t("orderSheet.queueNeedsMoreForOneShare")}</p>
                )}
              </>
            )}

            {session.status !== "halted" && session.status !== "unavailable" && (
              <button
                onClick={() => {
                  onSwitchToPriceRule?.(side);
                  onClose();
                }}
                className="self-start text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
              >
                {t("orderSheet.useDifferentPriceOrDate")}
              </button>
            )}

            {submitError && <p className="text-[12px] font-medium text-down">{submitError}</p>}

            <button
              onClick={() => setStep("entry")}
              className="w-full rounded-full py-3 text-[14px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
            >
              {t("common.back")}
            </button>
          </div>
        )}

        {step === "queued" && (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-up-soft">
              <FlaskConical size={26} className="text-up" />
            </div>
            <div>
              <div className="text-lg font-semibold text-ink">{t("orderSheet.orderQueuedTitle")}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
                {t(side === "buy" ? "orderSheet.orderQueuedBodyBuy" : "orderSheet.orderQueuedBodySell", {
                  quantity: queueShares,
                  symbol: stock.symbol,
                })}
              </p>
            </div>
            {queuedOrder && <ExplainRuleButton order={queuedOrder} />}
            <button
              onClick={() => {
                onClose();
                navigate("/price-rules");
              }}
              className="text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
            >
              {t("priceRules.viewMyRules")}
            </button>
            <button
              onClick={onClose}
              className="mt-1 w-full rounded-full bg-surface-2 py-3.5 text-[15px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
            >
              {t("common.done")}
            </button>
          </div>
        )}

        {step === "success" && <SuccessStep side={side} shares={shares} cost={cost} stock={stock} onClose={onClose} />}

        </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface SuccessStepProps {
  side: Side;
  shares: number;
  cost: number;
  stock: OrderableStock;
  onClose: () => void;
}

function SuccessStep({ side, shares, cost, stock, onClose }: SuccessStepProps) {
  const { t } = useLocale();
  const animatedCost = useCountUp(cost, 650);

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <SuccessBurst />

      <div>
        <div className="text-sm font-medium text-ink-faint">
          {side === "buy" ? t("orderSheet.bought") : t("orderSheet.sold")} · {stock.symbol}
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-ink">
          {formatCurrency(animatedCost)}
        </div>
      </div>

      <div className="text-ink-faint">
        {formatShares(shares)} {t("orderSheet.sharesAt")} {formatCurrencyPrecise(stock.price)}
      </div>

      <GetHelpButton
        refType="order"
        refLabel={`${side === "buy" ? t("orderSheet.bought") : t("orderSheet.sold")} ${stock.symbol} · ${formatCurrency(cost)}`}
      />

      <motion.button
        onClick={onClose}
        className="mt-1 w-full rounded-full bg-surface-2 py-3.5 text-[15px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
      >
        {t("common.done")}
      </motion.button>
    </div>
  );
}
