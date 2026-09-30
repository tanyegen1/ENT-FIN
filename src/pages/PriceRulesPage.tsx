import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ListOrdered } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "../components/PageHeader";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { EditPriceRuleSheet } from "../components/EditPriceRuleSheet";
import { ExplainRuleButton } from "../components/ExplainRuleButton";
import { StockLogo } from "../components/StockLogo";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { getLiveStock, useLiveQuotes } from "../data/liveQuotes";
import { getStock } from "../data/stocks";
import { formatShares } from "../lib/format";
import type { PriceRuleOrder, PriceRuleStatus } from "../types";

const STATUS_LABEL_KEY: Record<PriceRuleStatus, string> = {
  waiting: "priceRules.statusWaiting",
  triggered: "priceRules.statusTriggered",
  partial: "priceRules.statusPartial",
  filled: "priceRules.statusFilled",
  cancelled: "priceRules.statusCancelled",
  expired: "priceRules.statusExpired",
  rejected: "priceRules.statusRejected",
};
const STATUS_DETAIL_KEY: Record<PriceRuleStatus, string> = {
  waiting: "priceRules.statusWaitingDetail",
  triggered: "priceRules.statusTriggeredDetail",
  partial: "priceRules.statusPartialDetail",
  filled: "priceRules.statusFilledDetail",
  cancelled: "priceRules.statusCancelledDetail",
  expired: "priceRules.statusExpiredDetail",
  rejected: "priceRules.statusRejectedDetail",
};
const STATUS_STYLE: Record<PriceRuleStatus, string> = {
  waiting: "bg-surface-3 text-ink-dim",
  triggered: "bg-brand-soft text-brand-light",
  partial: "bg-brand-soft text-brand-light",
  filled: "bg-up-soft text-up",
  cancelled: "bg-surface-3 text-ink-faint",
  expired: "bg-surface-3 text-ink-faint",
  rejected: "bg-down-soft text-down",
};

export function PriceRulesPage() {
  const { priceRules, cancelPriceRule } = usePortfolio();
  const { t, locale } = useLocale();
  const { formatDisplay } = useCurrency();
  useLiveQuotes();
  const [editing, setEditing] = useState<PriceRuleOrder | null>(null);
  const [cancelling, setCancelling] = useState<PriceRuleOrder | null>(null);

  const dateLabel = (ts: number) =>
    new Date(ts).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const sorted = [...priceRules].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="pb-10">
      <PageHeader title={t("priceRules.pageTitle")} back />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("priceRules.pageSubtitle")}</p>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
            <ListOrdered size={22} />
          </div>
          <p className="text-sm font-medium text-ink">{t("priceRules.emptyTitle")}</p>
          <p className="max-w-xs text-[12px] text-ink-faint">{t("priceRules.emptyBody")}</p>
          <Link
            to="/search"
            className="mt-2 rounded-full bg-brand-soft px-4 py-2 text-[13px] font-semibold text-brand-light hover:brightness-125"
          >
            {t("priceRules.browseStocks")}
          </Link>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3 px-4 lg:px-6">
        {sorted.map((order) => {
          const stock = getLiveStock(order.symbol) ?? getStock(order.symbol);
          const remaining = order.quantity - order.filledQuantity;
          // A queued market order has no user-chosen price to edit (its
          // targetPrice is just a reservation snapshot) — offering "Edit"
          // here would look like setting a limit price, which this profile
          // never silently creates. Cancel is still available below.
          const canEdit = order.status === "waiting" && order.orderType !== "market";
          const canCancel = order.status === "waiting" || order.status === "triggered";
          const rejectionReason = order.statusMessage === "gap-insufficient-funds" ? t("priceRules.rejectionReasonGap") : order.statusMessage ?? "";

          return (
            <div key={order.id} className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {stock && <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={32} />}
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{order.symbol}</div>
                    <div className="truncate text-[12px] text-ink-faint">
                      {order.orderType === "market"
                        ? t(order.side === "buy" ? "priceRules.marketBuySummary" : "priceRules.marketSellSummary", {
                            symbol: order.symbol,
                            quantity: order.quantity,
                            sharesWord: t("priceRules.sentenceSharesWord"),
                          })
                        : t("priceRules.sentenceTemplate", {
                            symbol: order.symbol,
                            condition: t(
                              order.orderType === "buy-limit" || order.orderType === "sell-stop"
                                ? "priceRules.sentenceFallsTo"
                                : "priceRules.sentenceRisesTo",
                            ),
                            price: formatDisplay(order.targetPrice, { precise: true }),
                            quantity: order.quantity,
                            action: t(order.side === "buy" ? "priceRules.sentenceBuy" : "priceRules.sentenceSell"),
                            sharesWord: t("priceRules.sentenceSharesWord"),
                          })}
                    </div>
                  </div>
                </div>
                <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[order.status])}>
                  {t(order.orderType === "market" && order.status === "waiting" ? "priceRules.statusWaitingMarket" : STATUS_LABEL_KEY[order.status])}
                </span>
              </div>

              <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">
                {t(
                  order.orderType === "market" && order.status === "waiting"
                    ? "priceRules.statusWaitingDetailMarket"
                    : order.orderType === "market" && order.status === "expired"
                      ? "priceRules.statusExpiredDetailMarket"
                      : STATUS_DETAIL_KEY[order.status],
                  {
                    symbol: order.symbol,
                    price: formatDisplay(order.targetPrice, { precise: true }),
                    filled: formatShares(order.filledQuantity),
                    quantity: order.quantity,
                    reason: rejectionReason,
                  },
                )}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
                <span className="text-ink-faint">{t("priceRules.remainingLabel")}</span>
                <span className="text-right font-medium tabular-nums text-ink">
                  {formatShares(remaining)} / {formatShares(order.quantity)}
                </span>
                {order.reservedCash > 0 && (order.status === "waiting" || order.status === "triggered") && (
                  <>
                    <span className="text-ink-faint">{t("priceRules.reservedFundsLabel")}</span>
                    <span className="text-right font-medium tabular-nums text-ink">{formatDisplay(order.reservedCash)}</span>
                  </>
                )}
                {order.reservedShares > 0 && (order.status === "waiting" || order.status === "triggered") && (
                  <>
                    <span className="text-ink-faint">{t("priceRules.reservedSharesLabel")}</span>
                    <span className="text-right font-medium tabular-nums text-ink">{formatShares(order.reservedShares)}</span>
                  </>
                )}
                <span className="text-ink-faint">{t("priceRules.createdLabel")}</span>
                <span className="text-right font-medium text-ink">{dateLabel(order.createdAt)}</span>
                {(order.status === "waiting" || order.status === "triggered") && (
                  <>
                    <span className="text-ink-faint">{t("priceRules.expiresLabel")}</span>
                    <span className="text-right font-medium text-ink">{dateLabel(order.expiresAt)}</span>
                  </>
                )}
              </div>

              {(canEdit || canCancel) && (
                <div className="mt-3 flex gap-2">
                  {canEdit && (
                    <button
                      onClick={() => setEditing(order)}
                      className="flex-1 rounded-full border border-border py-2 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                    >
                      {t("priceRules.editAction")}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => setCancelling(order)}
                      className="flex-1 rounded-full border border-border py-2 text-[13px] font-semibold text-down hover:bg-down-soft cursor-pointer"
                    >
                      {t("priceRules.cancelAction")}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3">
                <ExplainRuleButton order={order} />
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {editing &&
          (() => {
            const stock = getLiveStock(editing.symbol) ?? getStock(editing.symbol);
            if (!stock) return null;
            return <EditPriceRuleSheet order={editing} stock={stock} onClose={() => setEditing(null)} />;
          })()}
      </AnimatePresence>
      <AnimatePresence>
        {cancelling && (
          <ConfirmSheet
            title={t("priceRules.cancelConfirmTitle")}
            description={t("priceRules.cancelConfirmDesc")}
            confirmLabel={t("priceRules.cancelConfirmBtn")}
            danger
            onConfirm={() => {
              cancelPriceRule(cancelling.id);
              setCancelling(null);
            }}
            onClose={() => setCancelling(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
