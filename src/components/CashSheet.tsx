import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Keypad } from "./Keypad";
import { SuccessBurst } from "./SuccessBurst";
import { InfoTip } from "./InfoTip";
import { usePortfolio } from "../context/PortfolioContext";
import { useCurrency } from "../context/CurrencyContext";
import { useLocale } from "../context/LocaleContext";
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
  const { cash, reservedCash, spendableCash, deposit, withdraw } = usePortfolio();
  const { displayCurrency } = useCurrency();
  const { t } = useLocale();
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
  const overWithdraw = mode === "withdraw" && amount > spendableCash + 0.005;
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

  const handleMax = () => setRaw(spendableCash.toFixed(2));

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
                ? t("cashSheet.fundsAdded")
                : t("cashSheet.fundsWithdrawn")
              : mode === "deposit"
                ? t("cashSheet.addTitle")
                : t("cashSheet.withdrawTitle")}
          </span>
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
                <p className="px-4 pt-3 text-[13px] text-ink-faint">{t("cashSheet.simNote")}</p>
                {displayCurrency === "TRY" && (
                  <p className="px-4 pt-1 text-[12px] text-ink-faint">{t("cashSheet.usdNote")}</p>
                )}

                <div className="flex flex-col items-center gap-2 px-4 py-8">
                  <div className="text-5xl font-semibold tabular-nums text-ink">${raw}</div>
                  {overWithdraw && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium text-down">
                        {t("cashSheet.exceedsWithdrawDetail", { amount: formatCurrency(spendableCash) })}
                      </span>
                      <button
                        onClick={handleMax}
                        className="text-sm font-semibold text-brand-light underline decoration-dotted underline-offset-4 cursor-pointer"
                      >
                        {t("common.fixToAmount", { amount: `$${spendableCash.toFixed(2)}` })}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 pb-4 text-[13px] text-ink-faint">
                  <span className="flex items-center gap-1">
                    {t("cashSheet.buyingPower")}
                    {mode === "withdraw" && (
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
                            <p className="pt-1 text-ink-faint">{t("common.reservedExplanationZero")}</p>
                          </div>
                        }
                      />
                    )}
                  </span>
                  <span className="tabular-nums text-ink-dim">{formatCurrency(spendableCash)}</span>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                  {mode === "deposit"
                    ? DEPOSIT_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setRaw(String(preset))}
                          className="shrink-0 rounded-full bg-brand-soft px-4 py-2 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
                        >
                          +${preset.toLocaleString()}
                        </button>
                      ))
                    : (
                        <button
                          onClick={handleMax}
                          className="shrink-0 rounded-full bg-brand-soft px-4 py-2 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
                        >
                          {t("common.useMaximum")}
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
                      "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
                      canConfirm
                        ? "brand-gradient brand-glow text-white hover:brightness-110"
                        : "bg-surface-3 text-ink-faint cursor-not-allowed",
                    )}
                  >
                    {mode === "deposit" ? t("cashSheet.addFunds") : t("cashSheet.withdrawBtn")}
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
  const { t } = useLocale();
  const animated = useCountUp(amount, 650);
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <SuccessBurst />
      <div>
        <div className="text-sm font-medium text-ink-faint">
          {mode === "deposit" ? t("cashSheet.addedToBuyingPower") : t("cashSheet.withdrawnFromBuyingPower")}
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
        {t("common.done")}
      </motion.button>
    </div>
  );
}
