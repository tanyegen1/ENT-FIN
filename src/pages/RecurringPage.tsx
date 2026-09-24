import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Repeat, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "../components/PageHeader";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { RecurringSheet } from "../components/RecurringSheet";
import { useLocale } from "../context/LocaleContext";
import { useRecurring, nextRunDate } from "../context/RecurringContext";
import { formatCurrency } from "../lib/format";
import type { RecurringPlan } from "../types";

export function RecurringPage() {
  const { t, locale } = useLocale();
  const { plans, pausePlan, resumePlan, cancelPlan, simulateRun } = useRecurring();
  const [editingPlan, setEditingPlan] = useState<RecurringPlan | null>(null);
  const [cancelingPlan, setCancelingPlan] = useState<RecurringPlan | null>(null);

  const dateLabel = (d: Date) =>
    d.toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, { month: "long", day: "numeric" });

  return (
    <div className="pb-10">
      <PageHeader title={t("recurring.title")} back />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("recurring.subtitle")}</p>

      {plans.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
            <Repeat size={22} />
          </div>
          <p className="text-sm text-ink-faint">{t("recurring.empty")}</p>
          <p className="text-[12px] text-ink-faint">{t("recurring.emptyCta")}</p>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3 px-4 lg:px-6">
        {plans.map((plan) => {
          const next = dateLabel(nextRunDate(plan.dayOfMonth));
          return (
            <div key={plan.id} className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-dim">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-ink">{plan.symbol}</div>
                    <div className="text-[12px] text-ink-faint">
                      {formatCurrency(plan.amount)} · {t("recurring.title")}
                    </div>
                  </div>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    plan.status === "active" ? "bg-up-soft text-up" : "bg-surface-3 text-ink-faint",
                  )}
                >
                  {plan.status === "active" ? t("recurring.statusActive") : t("recurring.statusPaused")}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-y-2 text-[13px]">
                <span className="text-ink-faint">{t("recurring.nextDate")}</span>
                <span className="text-right font-medium text-ink">
                  {plan.status === "active" ? next : "—"}
                </span>
                <span className="text-ink-faint">{t("recurring.fundingSourceLabel")}</span>
                <span className="text-right font-medium text-ink">{t("recurring.fundingSourceValue")}</span>
                <span className="text-ink-faint">{t("recurring.expectedCostsLabel")}</span>
                <span className="text-right font-medium text-ink">{t("recurring.expectedCostsValue")}</span>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                {t("recurring.insufficientFundsNote")}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => (plan.status === "active" ? pausePlan(plan.id) : resumePlan(plan.id))}
                  className="flex-1 rounded-full border border-border py-2 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                >
                  {plan.status === "active" ? t("recurring.pause") : t("recurring.resume")}
                </button>
                <button
                  onClick={() => setEditingPlan(plan)}
                  className="flex-1 rounded-full border border-border py-2 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                >
                  {t("recurring.edit")}
                </button>
                <button
                  onClick={() => setCancelingPlan(plan)}
                  className="flex-1 rounded-full border border-border py-2 text-[13px] font-semibold text-down hover:bg-down-soft cursor-pointer"
                >
                  {t("recurring.cancel")}
                </button>
              </div>

              <button
                onClick={() => simulateRun(plan.id)}
                className="mt-3 w-full rounded-full bg-surface-3 py-2 text-[12px] font-semibold text-ink-dim hover:brightness-110 cursor-pointer"
              >
                {t("recurring.simulateRun")}
              </button>
              <p className="mt-1.5 text-center text-[11px] text-ink-faint">{t("recurring.simulateNote")}</p>

              {plan.history.length > 0 && (
                <div className="mt-3 border-t border-border-soft pt-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    {t("recurring.historyHeading")}
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {plan.history.slice(0, 3).map((run) => (
                      <div key={run.id} className="flex items-center justify-between text-[12px]">
                        <span className={run.status === "success" ? "text-ink-dim" : "text-down"}>
                          {run.status === "success"
                            ? t("recurring.historySuccess", { amount: formatCurrency(run.amount) })
                            : t("recurring.historySkipped")}
                        </span>
                        <span className="text-ink-faint">{dateLabel(new Date(run.timestamp))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 px-4 text-[12px] leading-relaxed text-ink-faint lg:px-6">{t("recurring.habitNote")}</p>

      <AnimatePresence>
        {editingPlan && (
          <RecurringSheet
            symbol={editingPlan.symbol}
            existingPlan={editingPlan}
            onClose={() => setEditingPlan(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cancelingPlan && (
          <ConfirmSheet
            title={t("recurring.cancelConfirmTitle")}
            description={t("recurring.cancelConfirmDesc", { symbol: cancelingPlan.symbol })}
            confirmLabel={t("recurring.cancelConfirmBtn")}
            danger
            onConfirm={() => {
              cancelPlan(cancelingPlan.id);
              setCancelingPlan(null);
            }}
            onClose={() => setCancelingPlan(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
