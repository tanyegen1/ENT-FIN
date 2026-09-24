import { motion } from "motion/react";
import { X } from "lucide-react";
import { useLocale, type Locale } from "../context/LocaleContext";
import { useCurrency, type DisplayCurrency } from "../context/CurrencyContext";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface LocaleCurrencySheetProps {
  onClose: () => void;
}

export function LocaleCurrencySheet({ onClose }: LocaleCurrencySheetProps) {
  const { locale, setLocale, t } = useLocale();
  const { displayCurrency, setDisplayCurrency } = useCurrency();

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
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-5 rounded-t-3xl border border-border-soft bg-surface px-5 py-5 lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">{t("localeCurrency.title")}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-faint">{t("localeCurrency.languageLabel")}</div>
          <div className="relative flex rounded-full bg-surface-2 p-1">
            {(["en", "tr"] as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className="relative flex-1 rounded-full py-2.5 text-[14px] font-semibold cursor-pointer"
              >
                {locale === l && (
                  <motion.div
                    layoutId="locale-pill"
                    className="absolute inset-0 rounded-full bg-brand-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className={`relative z-10 ${locale === l ? "text-brand-light" : "text-ink-faint"}`}>
                  {l === "en" ? t("localeCurrency.english") : t("localeCurrency.turkish")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-faint">{t("localeCurrency.currencyLabel")}</div>
          <div className="relative flex rounded-full bg-surface-2 p-1">
            {(["USD", "TRY"] as DisplayCurrency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDisplayCurrency(c)}
                className="relative flex-1 rounded-full py-2.5 text-[14px] font-semibold cursor-pointer"
              >
                {displayCurrency === c && (
                  <motion.div
                    layoutId="currency-pill"
                    className="absolute inset-0 rounded-full bg-brand-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className={`relative z-10 ${displayCurrency === c ? "text-brand-light" : "text-ink-faint"}`}>
                  {c === "USD" ? t("localeCurrency.usd") : t("localeCurrency.try_")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[12px] leading-relaxed text-ink-faint">{t("localeCurrency.note")}</p>
      </motion.div>
    </div>
  );
}
