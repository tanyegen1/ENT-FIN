import { useState } from "react";
import { motion } from "motion/react";
import { X, Minus, Plus } from "lucide-react";
import clsx from "clsx";
import type { PriceRuleOrder, Stock } from "../types";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { PriceTargetSelector } from "./PriceTargetSelector";
import { formatShares } from "../lib/format";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

const ERROR_KEY: Record<string, string> = {
  "invalid-quantity": "priceRules.errorInvalidQuantity",
  "invalid-price": "priceRules.errorInvalidPrice",
  "insufficient-funds": "priceRules.errorInsufficientFunds",
  "insufficient-shares": "priceRules.errorInsufficientShares",
};

interface EditPriceRuleSheetProps {
  order: PriceRuleOrder;
  stock: Stock;
  onClose: () => void;
}

/**
 * Only ever opened for a "waiting" rule (the page below gates this), so
 * filledQuantity is always 0 here — editing simply replaces the whole
 * remaining order after re-validating funds/shares, matching the
 * cancel-and-replace semantics in PortfolioContext.editPriceRule.
 */
export function EditPriceRuleSheet({ order, stock, onClose }: EditPriceRuleSheetProps) {
  const { editPriceRule } = usePortfolio();
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const [target, setTarget] = useState(order.targetPrice);
  const [quantity, setQuantity] = useState(order.quantity);
  const [error, setError] = useState<string | null>(null);

  const quantityValid = Number.isInteger(quantity) && quantity > 0;

  const handleSave = () => {
    if (!quantityValid) {
      setError(t(ERROR_KEY["invalid-quantity"]));
      return;
    }
    const result = editPriceRule(order.id, { targetPrice: target, quantity });
    if (!result.ok) {
      setError(t(ERROR_KEY[result.error]));
      return;
    }
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
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-y-auto rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">{t("priceRules.editTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <PriceTargetSelector
            symbol={stock.symbol}
            side={order.side}
            currentPrice={stock.price}
            value={target}
            onChange={setTarget}
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
          </div>

          <div className="flex justify-between text-[12px] text-ink-faint">
            <span>{t("priceRules.estimatedCostLabel")}</span>
            <span className="tabular-nums text-ink">{formatDisplay(target * quantity)}</span>
          </div>

          <p className="text-[11px] leading-relaxed text-ink-faint">{t("priceRules.editNote")}</p>

          {error && <p className="text-[12px] font-medium text-down">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!quantityValid}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
              quantityValid ? "bg-up text-black hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {t("priceRules.editSaveButton")} ({formatShares(quantity)} {t("common.shares")})
          </button>
        </div>
      </motion.div>
    </div>
  );
}
