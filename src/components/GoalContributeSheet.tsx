import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Keypad } from "./Keypad";
import { SuccessBurst } from "./SuccessBurst";
import { useLocale } from "../context/LocaleContext";
import { useGoals } from "../context/GoalsContext";
import { useCountUp } from "../hooks/useCountUp";
import { formatCurrency } from "../lib/format";
import type { Goal } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const PRESETS = [25, 50, 100, 250];

type Step = "entry" | "success";

interface GoalContributeSheetProps {
  goal: Goal;
  onClose: () => void;
}

export function GoalContributeSheet({ goal, onClose }: GoalContributeSheetProps) {
  const { t } = useLocale();
  const { contribute } = useGoals();
  const [raw, setRaw] = useState("0");
  const [step, setStep] = useState<Step>("entry");
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  const amount = Number(raw) || 0;
  const canConfirm = amount > 0;

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

  const handleConfirm = () => {
    if (!canConfirm) return;
    contribute(goal.id, amount);
    setConfirmedAmount(amount);
    setStep("success");
  };

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
          <span className="text-[15px] font-semibold text-ink">{t("goals.contributeTitle", { name: goal.name })}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "entry" && (
              <div className="flex flex-col overflow-y-auto">
                <p className="px-4 pt-3 text-[13px] text-ink-faint">{t("goals.contributeNote")}</p>
                <div className="flex flex-col items-center gap-2 px-4 py-8">
                  <div className="text-5xl font-semibold tabular-nums text-ink">${raw}</div>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setRaw(String(preset))}
                      className="shrink-0 rounded-full bg-brand-soft px-4 py-2 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
                    >
                      +${preset}
                    </button>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <Keypad onDigit={handleDigit} onDecimal={handleDecimal} onBackspace={handleBackspace} />
                </div>
                <div className="px-4 pb-6">
                  <motion.button
                    disabled={!canConfirm}
                    onClick={handleConfirm}
                    whileTap={canConfirm ? { scale: 0.97 } : undefined}
                    transition={{ duration: 0.12 }}
                    className={clsx(
                      "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
                      canConfirm
                        ? "brand-gradient brand-glow text-white hover:brightness-110"
                        : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {t("goals.contribute")}
                  </motion.button>
                </div>
              </div>
            )}

            {step === "success" && <GoalContributeSuccess amount={confirmedAmount} onClose={onClose} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function GoalContributeSuccess({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { t } = useLocale();
  const animated = useCountUp(amount, 650);
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <SuccessBurst />
      <div className="text-4xl font-semibold tabular-nums text-ink">+{formatCurrency(animated)}</div>
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
