import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Keypad } from "./Keypad";
import { SuccessBurst } from "./SuccessBurst";
import { usePortfolio } from "../context/PortfolioContext";
import { useCountUp } from "../hooks/useCountUp";
import { formatCurrency } from "../lib/format";

type Mode = "deposit" | "withdraw";
type Step = "entry" | "success";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const DEPOSIT_PRESETS = [100, 500, 1000, 5000];

interface CashSheetProps {
  mode: Mode;
  onClose: () => void;
}

export function CashSheet({ mode, onClose }: CashSheetProps) {
  const { cash, deposit, withdraw } = usePortfolio();
  const [raw, setRaw] = useState("0");
  const [step, setStep] = useState<Step>("entry");
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const amount = Number(raw) || 0;
  const overWithdraw = mode === "withdraw" && amount > cash + 0.005;
  const canConfirm = amount > 0 && !overWithdraw;

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
    if (mode === "deposit") {
      deposit(amount);
      setConfirmedAmount(amount);
      setStep("success");
    } else {
      const ok = withdraw(amount);
      if (ok) {
        setConfirmedAmount(amount);
        setStep("success");
      }
    }
  };

  const withdrawAll = () => setRaw(cash.toFixed(2));

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
          <span className="text-[15px] font-semibold text-ink">
            {step === "success"
              ? mode === "deposit"
                ? "Funds added"
                : "Funds withdrawn"
              : mode === "deposit"
                ? "Add practice cash"
                : "Withdraw cash"}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label="Close"
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
                <p className="px-4 pt-3 text-[13px] text-ink-faint">
                  Simulated cash for practice trading — not real money.
                </p>

                <div className="flex flex-col items-center gap-2 px-4 py-8">
                  <div className="text-5xl font-semibold tabular-nums text-ink">${raw}</div>
                  {overWithdraw && (
                    <span className="text-sm font-medium text-down">Exceeds available cash</span>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 pb-4 text-[13px] text-ink-faint">
                  <span>Buying power</span>
                  <span className="tabular-nums text-ink-dim">{formatCurrency(cash)}</span>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                  {mode === "deposit"
                    ? DEPOSIT_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setRaw(String(preset))}
                          className="shrink-0 rounded-full bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                        >
                          +${preset.toLocaleString()}
                        </button>
                      ))
                    : (
                        <button
                          onClick={withdrawAll}
                          className="shrink-0 rounded-full bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                        >
                          Withdraw all
                        </button>
                      )}
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
                      "w-full rounded-full py-3.5 text-[15px] font-semibold transition-colors cursor-pointer",
                      canConfirm
                        ? "bg-up text-black hover:brightness-110"
                        : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {mode === "deposit" ? "Add funds" : "Withdraw"}
                  </motion.button>
                </div>
              </div>
            )}

            {step === "success" && (
              <CashSuccess mode={mode} amount={confirmedAmount} onClose={onClose} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function CashSuccess({ mode, amount, onClose }: { mode: Mode; amount: number; onClose: () => void }) {
  const animated = useCountUp(amount, 650);
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <SuccessBurst />
      <div>
        <div className="text-sm font-medium text-ink-faint">
          {mode === "deposit" ? "Added to buying power" : "Withdrawn from buying power"}
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-ink">
          {mode === "deposit" ? "+" : "-"}
          {formatCurrency(animated)}
        </div>
      </div>
      <motion.button
        onClick={onClose}
        className="mt-4 w-full rounded-full bg-surface-2 py-3.5 text-[15px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
      >
        Done
      </motion.button>
    </div>
  );
}
