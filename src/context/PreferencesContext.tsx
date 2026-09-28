import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TextSize = "default" | "large" | "xlarge";

const TEXT_SIZE_KEY = "arvo.textSize";
const HIDE_BALANCES_KEY = "arvo.hideBalances";

function loadTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY);
    if (stored === "default" || stored === "large" || stored === "xlarge") return stored;
  } catch {
    // ignore
  }
  return "default";
}

function loadHideBalances(): boolean {
  try {
    return localStorage.getItem(HIDE_BALANCES_KEY) === "1";
  } catch {
    return false;
  }
}

interface PreferencesContextValue {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  hideBalances: boolean;
  toggleHideBalances: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(loadTextSize);
  const [hideBalances, setHideBalances] = useState<boolean>(loadHideBalances);

  useEffect(() => {
    document.documentElement.setAttribute("data-text-size", textSize);
  }, [textSize]);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    try {
      localStorage.setItem(TEXT_SIZE_KEY, size);
    } catch {
      // ignore — preference just won't persist across visits
    }
  }, []);

  const toggleHideBalances = useCallback(() => {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_BALANCES_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ textSize, setTextSize, hideBalances, toggleHideBalances }),
    [textSize, setTextSize, hideBalances, toggleHideBalances],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
