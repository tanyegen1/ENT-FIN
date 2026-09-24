import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import en from "../i18n/en";
import tr from "../i18n/tr";
import type { Messages } from "../i18n/en";

export type Locale = "en" | "tr";

const STORAGE_KEY = "arvo.locale";
const DICTS: Record<Locale, Messages> = { en, tr };

function detectDefaultLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "tr") return stored;
  } catch {
    // ignore
  }
  try {
    if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("tr")) {
      return "tr";
    }
  } catch {
    // ignore
  }
  return "en";
}

function getPath(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDefaultLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — locale just won't persist across visits
    }
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const dict = DICTS[locale];
      const value = getPath(dict, path.split("."));
      let result = typeof value === "string" ? value : path;
      if (vars) {
        for (const [key, v] of Object.entries(vars)) {
          result = result.replace(new RegExp(`{{${key}}}`, "g"), String(v));
        }
      }
      return result;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
