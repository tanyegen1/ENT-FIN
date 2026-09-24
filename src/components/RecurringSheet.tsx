import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Keypad } from "./Keypad";
import { useLocale } from "../context/LocaleContext";
import { useRecurring, nextRunDate } from "../context/RecurringContext";
import type { RecurringPlan } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const DAY_OPTIONS = [1, 5, 10, 15, 20, 25];

interface RecurringSheetProps {
  symbol: string;
  existingPlan?: RecurringPlan;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

export function RecurringSheet({ symbol, existingPlan, onClose, onSaved }: RecurringSheetProps) {
  const { t, locale } = useLocale();
  const { createPlan, editPlan } = useRecurring();
  const [raw, setRaw] = useState(existingPlan ? String(existingPlan.amount) : "0");
  const [dayOfMonth, setDayOfMonth] = useState(existingPlan?.dayOfMonth ?? 1);

  const amount = Number(raw) || 0;
  const canSave = amount > 0;

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
  const handleDecimal = () => setRaw((prev) => (prev.includes(".") ? prev : `${prev}.`));
  const handleBackspace = () => setRaw((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));

  const handleSave = () => {
    if (!canSave) return;
    if (existingPlan) {
      editPlan(existingPlan.id, amount, dayOfMonth);
      onSaved?.(existingPlan.id);
    } else {
      const id = createPlan(symbol, amount, dayOfMonth);
      onSaved?.(id);
    }
    onClose();
  };

  const preview = nextRunDate(dayOfMonth).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, {
    month: "long",
    day: "numeric",
  });

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
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-y-auto rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">
            {existingPlan ? t("recurring.editTitle") : t("recurring.newTitle")}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {t("recurring.investingIn")}
            </div>
            <div className="mt-0.5 text-[14px] font-medium text-ink">{symbol}</div>
          </div>

          <div>
            <div className="mb-1 text-[13px] text-ink-faint">{t("recurring.amountLabel")}</div>
            <div className="text-4xl font-semibold tabular-nums text-ink">${raw}</div>
          </div>
          <Keypad onDigit={handleDigit} onDecimal={handleDecimal} onBackspace={handleBackspace} />

          <div>
            <div className="mb-2 text-[13px] text-ink-faint">{t("recurring.dayLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDayOfMonth(d)}
                  className={clsx(
                    "rounded-full px-3.5 py-2 text-[13px] font-semibold cursor-pointer",
                    dayOfMonth === d ? "bg-brand-soft text-brand-light" : "bg-surface-2 text-ink-dim hover:bg-surface-3",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">{t("recurring.dayHint")}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-ink-faint">{t("recurring.nextDate")}</span>
              <span className="font-medium text-ink">{preview}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">{t("recurring.fundingSourceLabel")}</span>
              <span className="font-medium text-ink">{t("recurring.fundingSourceValue")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">{t("recurring.expectedCostsLabel")}</span>
              <span className="font-medium text-ink">{t("recurring.expectedCostsValue")}</span>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            <span className="font-medium text-ink-dim">{t("recurring.insufficientFundsLabel")}: </span>
            {t("recurring.insufficientFundsNote")}
          </p>

          <motion.button
            disabled={!canSave}
            onClick={handleSave}
            whileTap={canSave ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
              canSave
                ? "brand-gradient brand-glow text-white hover:brightness-110"
                : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {existingPlan ? t("recurring.save") : t("recurring.create")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
