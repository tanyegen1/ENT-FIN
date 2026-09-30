import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { CatalogueInstrument, CatalogueQuote } from "../types";
import { StockLogo } from "./StockLogo";
import { catalogueLogoUrl } from "../data/catalogService";
import { useCurrency } from "../context/CurrencyContext";
import { useLocale } from "../context/LocaleContext";

interface CatalogueStockRowProps {
  instrument: CatalogueInstrument;
  /** Undefined = not fetched yet for this row; null = fetched and genuinely unavailable — two distinct states so a caller never shows "unavailable" before it's actually checked. */
  quote?: CatalogueQuote | null;
  onClick?: () => void;
}

const EXCHANGE_LABEL: Record<CatalogueInstrument["primaryExchange"], string> = {
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  XASE: "NYSE American",
  ARCX: "NYSE Arca",
  OTHER: "",
};

/**
 * A search row for a catalogue (Nasdaq/NYSE) instrument — deliberately
 * lighter than StockRow: no sparkline (no cheap per-row chart data source
 * for thousands of instruments) and no synthetic price change, since a
 * catalogue instrument's quote may genuinely be unavailable (spec section
 * 6 — never show $0 or a fabricated value). Price renders only when a real
 * quote was supplied; otherwise it honestly reads "Price unavailable."
 */
export function CatalogueStockRow({ instrument, quote, onClick }: CatalogueStockRowProps) {
  const { formatDisplay } = useCurrency();
  const { t } = useLocale();
  const exchangeLabel = EXCHANGE_LABEL[instrument.primaryExchange];

  return (
    <Link to={`/stock/${instrument.ticker}`} onClick={onClick} className="block rounded-xl">
      <motion.div
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors rounded-xl"
        whileTap={{ scale: 0.98, backgroundColor: "var(--color-surface-2)" }}
        transition={{ duration: 0.12 }}
      >
        <StockLogo
          symbol={instrument.ticker}
          name={instrument.name}
          fallbackColor="#6b7280"
          logoUrl={instrument.brandingVerified ? catalogueLogoUrl(instrument.ticker) : null}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
            <span className="truncate">{instrument.ticker}</span>
            {instrument.isAdr && (
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                {t("search.catalogueAdrBadge")}
              </span>
            )}
            {exchangeLabel && (
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                {exchangeLabel}
              </span>
            )}
          </div>
          <div className="truncate text-[13px] text-ink-faint">{instrument.name}</div>
        </div>
        <div className="w-24 shrink-0 text-right">
          {quote ? (
            <div className="text-[15px] font-medium tabular-nums text-ink">
              {formatDisplay(quote.price, { precise: true })}
            </div>
          ) : (
            <div className="text-[12px] font-medium text-ink-faint">{t("search.cataloguePriceUnavailable")}</div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
