import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Search as SearchIcon, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useLists } from "../context/ListsContext";
import { searchStocks } from "../data/stocks";
import { StockLogo } from "./StockLogo";
import type { CustomList } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface AddToListSheetProps {
  list: CustomList;
  onClose: () => void;
}

export function AddToListSheet({ list, onClose }: AddToListSheetProps) {
  const { t } = useLocale();
  const { addSymbol } = useLists();
  const [query, setQuery] = useState("");

  const results = useMemo(() => (query.trim() ? searchStocks(query) : []), [query]);

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
          <span className="text-[15px] font-semibold text-ink">{t("lists.addInvestmentTitle", { name: list.name })}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-transparent bg-surface-2 px-3 py-2.5 transition-colors has-[input:focus]:border-brand">
            <SearchIcon size={17} className="text-ink-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("lists.addSearchPlaceholder")}
              className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {results.map((stock) => {
            const inList = list.symbols.includes(stock.symbol);
            return (
              <button
                key={stock.symbol}
                onClick={() => !inList && addSymbol(list.id, stock.symbol)}
                disabled={inList}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2 disabled:cursor-default cursor-pointer"
              >
                <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{stock.symbol}</div>
                  <div className="truncate text-[12px] text-ink-faint">{stock.name}</div>
                </div>
                {inList ? (
                  <span className="flex items-center gap-1 text-[12px] font-medium text-up">
                    <Check size={14} /> {t("lists.added")}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold text-brand-light">{t("lists.add")}</span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
