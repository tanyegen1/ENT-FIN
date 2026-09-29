import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { formatCurrency } from "../lib/format";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const PRESETS = [1000, 10000, 100000];

interface ResetPortfolioSheetProps {
  onConfirm: (startingCash: number) => void;
  onClose: () => void;
}

/** The one place a practice starting balance is configurable — replaces the old plain confirm-only reset flow. */
export function ResetPortfolioSheet({ onConfirm, onClose }: ResetPortfolioSheetProps) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<number>(PRESETS[0]);
  const [custom, setCustom] = useState("");

  const amount = custom.trim() ? Number(custom) : selected;
  const valid = Number.isFinite(amount) && amount >= 0;

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
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-t-3xl border border-border-soft bg-surface px-6 py-6 lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-ink">{t("resetSheet.title")}</span>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-faint">{t("resetSheet.description")}</p>

        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-ink-faint">{t("resetSheet.presetLabel")}</div>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setSelected(p);
                  setCustom("");
                }}
                className={clsx(
                  "flex-1 rounded-full py-2.5 text-[13px] font-semibold cursor-pointer",
                  !custom.trim() && selected === p ? "bg-brand-soft text-brand-light" : "bg-surface-2 text-ink-dim hover:bg-surface-3",
                )}
              >
                {formatCurrency(p, { compact: true })}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-ink-faint">{t("resetSheet.customLabel")}</label>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
            <span className="text-ink-faint">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={selected.toString()}
              className="w-full bg-transparent text-[15px] font-semibold tabular-nums text-ink focus:outline-none"
            />
          </div>
        </div>

        <motion.button
          onClick={() => valid && onConfirm(amount)}
          disabled={!valid}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className={clsx(
            "w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
            valid ? "bg-down text-white hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
          )}
        >
          {t("resetSheet.confirmButton", { amount: formatCurrency(valid ? amount : 0) })}
        </motion.button>
        <button
          onClick={onClose}
          className="w-full rounded-full py-3 text-[14px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
        >
          {t("common.cancel")}
        </button>
      </motion.div>
    </div>
  );
}
