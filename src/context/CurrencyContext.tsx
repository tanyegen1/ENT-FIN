import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DisplayCurrency = "USD" | "TRY";

const STORAGE_KEY = "arvo.displayCurrency";

/**
 * Approximate, display-only conversion rate. Trades, deposits, and withdrawals
 * always execute in USD regardless of this setting — see cashSheet.usdNote /
 * orderSheet.usdNote in the translation dictionaries.
 */
const USD_TRY_RATE = 34.5;

function loadStored(): DisplayCurrency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "USD" || stored === "TRY") return stored;
  } catch {
    // ignore
  }
  return "USD";
}

interface FormatOptions {
  compact?: boolean;
  precise?: boolean;
}

function formatIn(usd: number, currency: DisplayCurrency, opts?: FormatOptions): string {
  if (currency === "USD") {
    if (opts?.compact) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(usd);
    }
    const digits = opts?.precise ? (usd < 1 ? 4 : usd < 10 ? 3 : 2) : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(usd);
  }

  const amount = usd * USD_TRY_RATE;
  if (opts?.compact) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(amount);
  }
  const digits = opts?.precise ? (amount < 1 ? 4 : amount < 10 ? 3 : 2) : 2;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

interface CurrencyContextValue {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  /** Browsing/portfolio figures — respects the user's display currency. */
  formatDisplay: (usd: number, opts?: FormatOptions) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(loadStored);

  const setDisplayCurrency = useCallback((next: DisplayCurrency) => {
    setDisplayCurrencyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const formatDisplay = useCallback(
    (usd: number, opts?: FormatOptions) => formatIn(usd, displayCurrency, opts),
    [displayCurrency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ displayCurrency, setDisplayCurrency, formatDisplay }),
    [displayCurrency, setDisplayCurrency, formatDisplay],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
