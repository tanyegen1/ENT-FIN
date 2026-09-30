import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Minus, Plus, FlaskConical } from "lucide-react";
import clsx from "clsx";
import type { OrderableStock, PriceRuleDuration, PriceRuleOrder, PriceRuleOrderType, PriceRuleSessionScope } from "../types";
import { usePortfolio } from "../context/PortfolioContext";
import { usePriceAlerts } from "../context/PriceAlertsContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { classifyOrderType, isImmediatelyActionable } from "../lib/practiceOrders/engine";
import { useMarketSessionState } from "../hooks/useMarketSessionState";
import { formatShares } from "../lib/format";
import { PriceTargetSelector } from "./PriceTargetSelector";
import { RulePreview } from "./RulePreview";
import { ExplainRuleButton } from "./ExplainRuleButton";
import { MarketStatusPill } from "./MarketStatusPill";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const STEP_TRANSITION = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};

type Side = "buy" | "sell";
type Step = "timing" | "target" | "choice" | "duration" | "review" | "success";

// "market" here covers a queued market order (see "Queue for regular
// opening"/"Queue buy/sell order" in the instant Buy/Sell sheet) — the
// beginner price-rule builder itself never produces one via
// classifyOrderType, but shared components like ExplainRuleButton render
// whatever order type is actually stored, so these maps stay complete.
const REVIEW_NEXT_KEY: Record<PriceRuleOrderType, string> = {
  "buy-limit": "priceRules.reviewWhatHappensNextBuyLimit",
  "buy-stop": "priceRules.reviewWhatHappensNextBuyStop",
  "sell-limit": "priceRules.reviewWhatHappensNextSellLimit",
  "sell-stop": "priceRules.reviewWhatHappensNextSellStop",
  market: "priceRules.reviewWhatHappensNextMarket",
};
const TECHNICAL_KEY: Record<PriceRuleOrderType, string> = {
  "buy-limit": "priceRules.technicalBuyLimit",
  "buy-stop": "priceRules.technicalBuyStop",
  "sell-limit": "priceRules.technicalSellLimit",
  "sell-stop": "priceRules.technicalSellStop",
  market: "priceRules.technicalMarket",
};
const ERROR_KEY: Record<string, string> = {
  "invalid-quantity": "priceRules.errorInvalidQuantity",
  "invalid-price": "priceRules.errorInvalidPrice",
  "insufficient-funds": "priceRules.errorInsufficientFunds",
  "insufficient-shares": "priceRules.errorInsufficientShares",
  "session-unavailable": "priceRules.errorSessionUnavailable",
  "instrument-halted": "priceRules.errorInstrumentHalted",
};
const SENTENCE_ACTION_WORD: Record<Side, string> = { buy: "priceRules.sentenceBuy", sell: "priceRules.sentenceSell" };

function makeDraftOrder(base: {
  symbol: string;
  side: Side;
  orderType: PriceRuleOrderType;
  targetPrice: number;
  quantity: number;
  sessionScope?: PriceRuleSessionScope;
}): PriceRuleOrder {
  return {
    id: "draft",
    symbol: base.symbol,
    side: base.side,
    orderType: base.orderType,
    targetPrice: base.targetPrice,
    quantity: base.quantity,
    filledQuantity: 0,
    fills: [],
    status: "waiting",
    createdAt: Date.now(),
    duration: "today",
    sessionScope: base.sessionScope ?? "regular",
    expiresAt: Date.now(),
    reservedCash: 0,
    reservedShares: 0,
    statusMessage: null,
    triggeredAt: null,
    filledAt: null,
    cancelledAt: null,
    expiredAt: null,
    rejectedAt: null,
  };
}

interface PriceRuleSheetProps {
  stock: OrderableStock;
  initialSide: Side;
  onClose: () => void;
  /** "Now" always reuses the existing instant market order flow — this sheet never duplicates it. */
  onOpenMarketOrder: (side: Side) => void;
  /** Set when arriving here from OrderSheet's "Set a limit price" during pre-market/after-hours — skips straight to the target step with extended hours already opted in (never silently defaulted otherwise). */
  initialExtendedHours?: boolean;
}

export function PriceRuleSheet({ stock, initialSide, onClose, onOpenMarketOrder, initialExtendedHours }: PriceRuleSheetProps) {
  const { spendableCash, availableShares, createPriceRule, priceRules } = usePortfolio();
  const { createAlert } = usePriceAlerts();
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(initialExtendedHours !== undefined ? "target" : "timing");
  const [side, setSide] = useState<Side>(initialSide);
  const [target, setTarget] = useState(stock.price);
  const [quantity, setQuantity] = useState(1);
  const [immediateAcknowledged, setImmediateAcknowledged] = useState(false);
  const [alertOrOrder, setAlertOrOrder] = useState<"notify" | "order" | null>(null);
  const [duration, setDuration] = useState<PriceRuleDuration>("today");
  const [untilDate, setUntilDate] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdKind, setCreatedKind] = useState<"order" | "alert">("order");
  // Only ever "extended" for a buy-limit/sell-limit — see the toggle below,
  // shown only for those two order types. Stops and queued market orders
  // are always "regular" in this profile (see lib/marketSession.ts).
  const [sessionScope, setSessionScope] = useState<PriceRuleSessionScope>(initialExtendedHours ? "extended" : "regular");

  const orderType = classifyOrderType(side, target, stock.price);
  const isLimitOrder = orderType === "buy-limit" || orderType === "sell-limit";
  const isEqual = Math.abs(target - stock.price) < 0.005;
  const immediate = orderType ? isImmediatelyActionable(orderType, target, stock.price) : false;
  const needsExplicitChoice = (isEqual || immediate) && !immediateAcknowledged;

  const available = side === "buy" ? spendableCash : availableShares(stock.symbol);
  const estimatedValue = quantity * target;
  const maxQuantity = side === "buy" ? Math.floor(spendableCash / (target || 1)) : Math.floor(availableShares(stock.symbol));
  const quantityValid = Number.isInteger(quantity) && quantity > 0;
  const affordable = side === "buy" ? estimatedValue <= spendableCash + 0.005 : quantity <= availableShares(stock.symbol) + 0.000001;

  const session = useMarketSessionState(stock.category, stock.symbol);
  const marketOpen = session.status === "regular" || session.status === "open";
  const nextOpenLabel = useMemo(() => {
    if (session.nextRegularOpen === null) return t("priceRules.sessionUnavailable");
    return new Date(session.nextRegularOpen).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed each render anyway since `session` is derived fresh every render; this memo only avoids reformatting on unrelated re-renders within the same tick
  }, [session.nextRegularOpen, t]);

  const createdOrder = createdId ? priceRules.find((r) => r.id === createdId) ?? null : null;

  const handleContinueFromTarget = () => {
    if (needsExplicitChoice) return; // the explicit-choice panel below handles this instead
    setStep("choice");
  };

  const handleNotify = () => {
    const direction = target >= stock.price ? "above" : "below";
    const id = createAlert(stock.symbol, direction, target);
    setCreatedId(id);
    setCreatedKind("alert");
    setStep("success");
  };

  const handleSubmit = () => {
    if (!orderType) return;
    const result = createPriceRule({
      symbol: stock.symbol,
      side,
      orderType,
      targetPrice: target,
      quantity,
      duration,
      untilDate: duration === "date" && untilDate ? new Date(untilDate) : undefined,
      sessionScope,
    });
    if (!result.ok) {
      setSubmitError(t(ERROR_KEY[result.error]));
      return;
    }
    setSubmitError(null);
    setCreatedId(result.id);
    setCreatedKind("order");
    setStep("success");
  };

  const draftOrder = orderType ? makeDraftOrder({ symbol: stock.symbol, side, orderType, targetPrice: target, quantity }) : null;

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
            <span className="text-[15px] font-semibold text-ink">{t("priceRules.sheetTitle")}</span>
            <span className="inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
              <FlaskConical size={10} />
              {t("priceRules.practiceModeBadge")} · {t("priceRules.practiceModeVirtualMoney")}
            </span>
            <MarketStatusPill category={stock.category} symbol={stock.symbol} compact />
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        {(session.status === "halted" || session.status === "unavailable") && (
          <div className="mx-4 mt-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3.5">
            <p className="text-[13px] font-semibold text-warn">
              {t(session.status === "halted" ? "priceRules.errorInstrumentHalted" : "priceRules.errorSessionUnavailable")}
            </p>
          </div>
        )}

        <div className={clsx("overflow-y-auto", (session.status === "halted" || session.status === "unavailable") && "pointer-events-none opacity-40")}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...STEP_TRANSITION}>
              {step === "timing" && (
                <div className="flex flex-col gap-4 px-4 py-4">
                  <div className="flex gap-2">
                    {(["buy", "sell"] as Side[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSide(s)}
                        className={clsx(
                          "flex-1 rounded-full py-2.5 text-[14px] font-semibold capitalize cursor-pointer",
                          side === s ? "bg-brand-soft text-brand-light" : "bg-surface-2 text-ink-dim hover:bg-surface-3",
                        )}
                      >
                        {s === "buy" ? t("stockDetail.buy") : t("stockDetail.sell")}
                      </button>
                    ))}
                  </div>

                  <div className="text-[13px] font-semibold text-ink-faint">{t("priceRules.timingHeading")}</div>
                  <button
                    onClick={() => onOpenMarketOrder(side)}
                    className="flex flex-col gap-0.5 rounded-2xl border border-border-soft px-4 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
                  >
                    <span className="text-[14px] font-semibold text-ink">{t("priceRules.timingNow")}</span>
                    <span className="text-[12px] text-ink-faint">{t("priceRules.timingNowDetail")}</span>
                  </button>
                  <button
                    onClick={() => setStep("target")}
                    className="flex flex-col gap-0.5 rounded-2xl border border-brand/40 bg-brand-soft px-4 py-3.5 text-left cursor-pointer"
                  >
                    <span className="text-[14px] font-semibold text-brand-light">{t("priceRules.timingLater")}</span>
                    <span className="text-[12px] text-ink-dim">{t("priceRules.timingLaterDetail")}</span>
                    <span className="mt-1 text-[11px] text-ink-faint">{t("priceRules.technicalNote")}</span>
                  </button>
                  <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceRules.neverReal")}</p>
                </div>
              )}

              {step === "target" && (
                <div className="flex flex-col gap-4 px-4 py-4">
                  {orderType && !needsExplicitChoice && (
                    <div className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-ink">
                      {t("priceRules.sentenceTemplate", {
                        symbol: stock.symbol,
                        condition: t(target < stock.price ? "priceRules.sentenceFallsTo" : "priceRules.sentenceRisesTo"),
                        price: formatDisplay(target, { precise: true }),
                        quantity,
                        action: t(SENTENCE_ACTION_WORD[side]),
                        sharesWord: t("priceRules.sentenceSharesWord"),
                      })}
                    </div>
                  )}

                  <PriceTargetSelector
                    symbol={stock.symbol}
                    side={side}
                    currentPrice={stock.price}
                    value={target}
                    onChange={(v) => {
                      setTarget(v);
                      setImmediateAcknowledged(false);
                    }}
                  />

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-ink-faint">{t("priceRules.quantityLabel")}</span>
                      <span className="text-[11px] text-ink-faint">{t("priceRules.wholeSharesHint")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 cursor-pointer"
                        aria-label="-1"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-center text-[16px] font-semibold tabular-nums text-ink focus:border-brand focus:outline-none"
                      />
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 cursor-pointer"
                        aria-label="+1"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {maxQuantity >= 1 && (
                      <button
                        onClick={() => setQuantity(Math.max(1, maxQuantity))}
                        className="mt-1.5 text-[12px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
                      >
                        {t("common.useMaximum")} ({formatShares(maxQuantity)})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-ink-faint">
                        {side === "buy" ? t("priceRules.availableCashLabel") : t("priceRules.availableSharesLabel")}
                      </span>
                      <span className="tabular-nums text-ink">
                        {side === "buy" ? formatDisplay(available) : `${formatShares(available)} ${t("common.shares")}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-faint">
                        {side === "buy" ? t("priceRules.estimatedCostLabel") : t("priceRules.estimatedProceedsLabel")}
                      </span>
                      <span className="tabular-nums text-ink">{formatDisplay(estimatedValue)}</span>
                    </div>
                  </div>

                  {isLimitOrder && session.profile === "us_equity" && (
                    <label className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
                      <input
                        type="checkbox"
                        checked={sessionScope === "extended"}
                        onChange={(e) => setSessionScope(e.target.checked ? "extended" : "regular")}
                        className="mt-0.5 h-4 w-4 accent-brand"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium text-ink">{t("priceRules.includeExtendedHours")}</span>
                        <span className="text-[12px] leading-relaxed text-ink-faint">{t("priceRules.includeExtendedHoursDetail")}</span>
                      </span>
                    </label>
                  )}

                  {!quantityValid && (
                    <p className="text-[12px] font-medium text-down">{t("priceRules.errorInvalidQuantity")}</p>
                  )}
                  {quantityValid && !affordable && (
                    <p className="text-[12px] font-medium text-down">
                      {t(side === "buy" ? "priceRules.errorInsufficientFunds" : "priceRules.errorInsufficientShares")}
                    </p>
                  )}

                  {needsExplicitChoice && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-brand/40 bg-brand-soft px-4 py-3.5">
                      <div className="text-[13px] font-semibold text-ink">{t("priceRules.immediateTitle")}</div>
                      <p className="text-[12px] leading-relaxed text-ink-dim">
                        {t("priceRules.immediateBody", { symbol: stock.symbol })}
                      </p>
                      <button
                        onClick={() => onOpenMarketOrder(side)}
                        className="w-full rounded-full bg-up py-2.5 text-[13px] font-semibold text-black hover:brightness-110 cursor-pointer"
                      >
                        {t("priceRules.immediateActNow")}
                      </button>
                      {!isEqual && (
                        <button
                          onClick={() => setImmediateAcknowledged(true)}
                          className="w-full rounded-full bg-surface-2 py-2.5 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                        >
                          {t("priceRules.immediateProceedAnyway")}
                        </button>
                      )}
                    </div>
                  )}

                  {draftOrder && <ExplainRuleButton order={draftOrder} className="self-start text-[12px] font-medium text-ink-faint underline decoration-dotted underline-offset-4 hover:text-brand-light cursor-pointer" />}

                  <button
                    disabled={needsExplicitChoice || !quantityValid || !affordable}
                    onClick={handleContinueFromTarget}
                    className={clsx(
                      "w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
                      !needsExplicitChoice && quantityValid && affordable
                        ? "bg-up text-black hover:brightness-110"
                        : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {t("priceRules.continueButton")}
                  </button>
                </div>
              )}

              {step === "choice" && (
                <div className="flex flex-col gap-3 px-4 py-4">
                  <div className="text-[15px] font-semibold text-ink">{t("priceRules.choiceHeading")}</div>
                  <button
                    onClick={() => setAlertOrOrder("notify")}
                    className={clsx(
                      "flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left cursor-pointer",
                      alertOrOrder === "notify" ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-surface-2",
                    )}
                  >
                    <span className="text-[14px] font-semibold text-ink">{t("priceRules.notifyTitle")}</span>
                    <span className="text-[12px] text-ink-faint">{t("priceRules.notifyDetail")}</span>
                  </button>
                  <button
                    onClick={() => setAlertOrOrder("order")}
                    className={clsx(
                      "flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left cursor-pointer",
                      alertOrOrder === "order" ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-surface-2",
                    )}
                  >
                    <span className="text-[14px] font-semibold text-ink">{t("priceRules.orderTitle")}</span>
                    <span className="text-[12px] text-ink-faint">{t("priceRules.orderDetail")}</span>
                  </button>
                  <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceRules.notifyOnlyWhileOpenNote")}</p>

                  <button
                    disabled={!alertOrOrder}
                    onClick={() => (alertOrOrder === "notify" ? handleNotify() : setStep("duration"))}
                    className={clsx(
                      "mt-2 w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
                      alertOrOrder ? "bg-up text-black hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {alertOrOrder === "notify" ? t("priceRules.notifySubmitButton") : t("priceRules.continueButton")}
                  </button>
                </div>
              )}

              {step === "duration" && (
                <div className="flex flex-col gap-3 px-4 py-4">
                  <div className="text-[15px] font-semibold text-ink">{t("priceRules.durationHeading")}</div>
                  <button
                    onClick={() => setDuration("today")}
                    className={clsx(
                      "flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left cursor-pointer",
                      duration === "today" ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-surface-2",
                    )}
                  >
                    <span className="text-[14px] font-semibold text-ink">{t("priceRules.durationToday")}</span>
                    <span className="text-[12px] text-ink-faint">{t("priceRules.durationTodayDetail")}</span>
                  </button>
                  <button
                    onClick={() => setDuration("date")}
                    className={clsx(
                      "flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left cursor-pointer",
                      duration === "date" ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-surface-2",
                    )}
                  >
                    <span className="text-[14px] font-semibold text-ink">{t("priceRules.durationDate")}</span>
                    <span className="text-[12px] text-ink-faint">{t("priceRules.durationDateDetail")}</span>
                  </button>
                  {duration === "date" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] text-ink-faint">{t("priceRules.pickDateLabel")}</label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={untilDate}
                        onChange={(e) => setUntilDate(e.target.value)}
                        className="rounded-xl border border-border bg-surface px-3 py-2.5 text-[14px] text-ink focus:border-brand focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[12px]">
                    <span className={clsx("h-2 w-2 shrink-0 rounded-full", marketOpen ? "bg-up" : "bg-ink-faint")} />
                    <span className="text-ink">{t(marketOpen ? "priceRules.marketOpenLabel" : "priceRules.marketClosedLabel")}</span>
                  </div>
                  {!marketOpen && (
                    <p className="text-[11px] text-ink-faint">{t("priceRules.marketClosedNextOpen", { time: nextOpenLabel })}</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceRules.simulatedClockNote")}</p>
                  <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceRules.evaluatedWhileOpenNote")}</p>

                  <button
                    disabled={duration === "date" && !untilDate}
                    onClick={() => setStep("review")}
                    className={clsx(
                      "mt-1 w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
                      duration === "today" || untilDate
                        ? "bg-up text-black hover:brightness-110"
                        : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {t("priceRules.continueButton")}
                  </button>
                </div>
              )}

              {step === "review" && orderType && (
                <div className="flex flex-col gap-3 px-4 py-4">
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-dim">
                    <FlaskConical size={11} />
                    {t("priceRules.reviewPracticeLabel")}
                  </span>
                  <div className="text-[20px] font-semibold text-ink">{t("priceRules.reviewTitle")}</div>

                  <dl className="flex flex-col gap-2.5 rounded-2xl bg-surface-2 px-4 py-3.5 text-[13px]">
                    {[
                      [t("priceRules.reviewCompany"), `${stock.symbol} · ${stock.name}`],
                      [t("priceRules.reviewAction"), side === "buy" ? t("stockDetail.buy") : t("stockDetail.sell")],
                      [t("priceRules.reviewOrderType"), t(TECHNICAL_KEY[orderType])],
                      [t("priceRules.reviewPrice"), formatDisplay(target, { precise: true })],
                      [t("priceRules.reviewQuantity"), `${formatShares(quantity)} ${t("common.shares")}`],
                      [t("priceRules.reviewEstimatedValue"), formatDisplay(estimatedValue)],
                      [t("priceRules.reviewFees"), formatDisplay(0)],
                      [
                        t("priceRules.reviewExpiry"),
                        duration === "today"
                          ? t("priceRules.durationToday")
                          : untilDate
                            ? new Date(`${untilDate}T00:00:00`).toLocaleDateString()
                            : "",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <dt className="text-ink-faint">{label}</dt>
                        <dd className="text-right tabular-nums text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-[11px] text-ink-faint">{t("priceRules.estimateDisclaimer")}</p>

                  <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
                    <div className="text-[12px] font-semibold text-ink">{t("priceRules.reviewWhatHappensNextHeading")}</div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
                      {t(REVIEW_NEXT_KEY[orderType], {
                        symbol: stock.symbol,
                        price: formatDisplay(target, { precise: true }),
                        quantity,
                      })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewOpen(true)}
                      className="flex-1 rounded-full border border-dashed border-border py-2.5 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
                    >
                      {t("priceRules.previewButton")}
                    </button>
                    {draftOrder && (
                      <ExplainRuleButton
                        order={draftOrder}
                        className="flex-1 rounded-full border border-dashed border-border py-2.5 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
                      />
                    )}
                  </div>

                  {submitError && <p className="text-[12px] font-medium text-down">{submitError}</p>}

                  <button
                    onClick={handleSubmit}
                    className="mt-1 w-full rounded-full bg-up py-3.5 text-[15px] font-semibold text-black hover:brightness-110 cursor-pointer"
                  >
                    {t("priceRules.submitButton")}
                  </button>
                  <button
                    onClick={() => setStep("target")}
                    className="w-full rounded-full py-3 text-[14px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
                  >
                    {t("orderSheet.editAmount")}
                  </button>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-up-soft">
                    <FlaskConical size={26} className="text-up" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-ink">
                      {t(createdKind === "alert" ? "priceRules.alertCreatedTitle" : "priceRules.ruleCreatedTitle")}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
                      {createdKind === "alert"
                        ? t("priceRules.notifyDetail")
                        : orderType
                          ? t(REVIEW_NEXT_KEY[orderType], {
                              symbol: stock.symbol,
                              price: formatDisplay(target, { precise: true }),
                              quantity,
                            })
                          : null}
                    </p>
                  </div>
                  {createdOrder && <ExplainRuleButton order={createdOrder} />}
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
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {previewOpen && orderType && (
          <RulePreview
            symbol={stock.symbol}
            orderType={orderType}
            targetPrice={target}
            currentPrice={stock.price}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
