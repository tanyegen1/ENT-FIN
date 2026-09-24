import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { getStock } from "../data/stocks";
import { StockLogo } from "./StockLogo";
import type { CustomList } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const MAX_PICK = 3;

interface ComparePickerSheetProps {
  list: CustomList;
  onClose: () => void;
}

export function ComparePickerSheet({ list, onClose }: ComparePickerSheetProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(list.symbols.slice(0, MAX_PICK));

  const toggle = (symbol: string) => {
    setSelected((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      if (prev.length >= MAX_PICK) return prev;
      return [...prev, symbol];
    });
  };

  const canCompare = selected.length >= 2;

  const handleCompare = () => {
    if (!canCompare) return;
    navigate(`/compare/${selected.join(",")}`);
    onClose();
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
        className="relative z-10 flex max-h-[85svh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">{t("lists.comparePickTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <p className="px-4 pt-3 text-[13px] text-ink-faint">{t("lists.comparePickHint")}</p>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {list.symbols.map((symbol) => {
            const stock = getStock(symbol);
            if (!stock) return null;
            const checked = selected.includes(symbol);
            return (
              <button
                key={symbol}
                onClick={() => toggle(symbol)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 cursor-pointer"
              >
                <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{stock.symbol}</div>
                  <div className="truncate text-[12px] text-ink-faint">{stock.name}</div>
                </div>
                <div
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    checked ? "border-brand bg-brand text-white" : "border-border text-transparent",
                  )}
                >
                  <Check size={13} strokeWidth={3} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-4">
          <motion.button
            disabled={!canCompare}
            onClick={handleCompare}
            whileTap={canCompare ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
              canCompare
                ? "brand-gradient brand-glow text-white hover:brightness-110"
                : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {t("lists.comparePickCta")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
