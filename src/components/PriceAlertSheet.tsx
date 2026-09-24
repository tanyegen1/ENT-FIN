import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Keypad } from "./Keypad";
import { useLocale } from "../context/LocaleContext";
import { usePriceAlerts } from "../context/PriceAlertsContext";
import { formatCurrencyPrecise } from "../lib/format";
import type { Stock } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface PriceAlertSheetProps {
  stock: Stock;
  onClose: () => void;
}

export function PriceAlertSheet({ stock, onClose }: PriceAlertSheetProps) {
  const { t } = useLocale();
  const { alertsFor, createAlert, deleteAlert } = usePriceAlerts();
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [raw, setRaw] = useState(stock.price.toFixed(2));

  const target = Number(raw) || 0;
  const canCreate = target > 0;
  const activeAlerts = alertsFor(stock.symbol).filter((a) => !a.triggeredAt);

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

  const handleCreate = () => {
    if (!canCreate) return;
    createAlert(stock.symbol, direction, target);
    setRaw(stock.price.toFixed(2));
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
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-y-auto rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">{t("priceAlerts.newTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <span className="text-ink-faint">{t("priceAlerts.currentPrice")}</span>
            <span className="font-semibold tabular-nums text-ink">{formatCurrencyPrecise(stock.price)}</span>
          </div>

          <div>
            <div className="mb-2 text-[13px] text-ink-faint">{t("priceAlerts.targetLabel")}</div>
            <div className="flex gap-2">
              {(["above", "below"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={clsx(
                    "flex-1 rounded-full py-2 text-[13px] font-semibold cursor-pointer",
                    direction === d ? "bg-brand-soft text-brand-light" : "bg-surface-2 text-ink-dim hover:bg-surface-3",
                  )}
                >
                  {d === "above" ? t("priceAlerts.directionAbove") : t("priceAlerts.directionBelow")}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-4xl font-semibold tabular-nums text-ink">${raw}</div>
          <Keypad onDigit={handleDigit} onDecimal={handleDecimal} onBackspace={handleBackspace} />

          <motion.button
            disabled={!canCreate}
            onClick={handleCreate}
            whileTap={canCreate ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
              canCreate
                ? "brand-gradient brand-glow text-white hover:brightness-110"
                : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {t("priceAlerts.create")}
          </motion.button>
          <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceAlerts.liveNote")}</p>

          {activeAlerts.length > 0 && (
            <div className="border-t border-border-soft pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {t("priceAlerts.activeHeading")}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {activeAlerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                    <span className="text-ink">
                      {a.direction === "above" ? t("priceAlerts.directionAbove") : t("priceAlerts.directionBelow")}{" "}
                      {formatCurrencyPrecise(a.targetPrice)}
                    </span>
                    <button
                      onClick={() => deleteAlert(a.id)}
                      className="text-[12px] font-medium text-down hover:brightness-125 cursor-pointer"
                    >
                      {t("priceAlerts.cancel")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
