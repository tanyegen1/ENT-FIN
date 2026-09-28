import { useCallback, useState } from "react";

const PREFIX = "arvo.draft.";

function readDraft(key: string, initial: string): string {
  try {
    return sessionStorage.getItem(PREFIX + key) ?? initial;
  } catch {
    return initial;
  }
}

/**
 * A raw amount-entry string that survives closing and reopening a sheet, or
 * navigating away and back — so an in-progress, unsubmitted amount isn't
 * silently lost. Scoped to the tab (sessionStorage), and cleared once the
 * flow it belongs to completes.
 */
export function useDraftAmount(key: string, initial = "0") {
  const [raw, setRawState] = useState(() => readDraft(key, initial));

  const setRaw = useCallback(
    (next: string | ((prev: string) => string)) => {
      setRawState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          sessionStorage.setItem(PREFIX + key, value);
        } catch {
          // ignore — draft just won't survive a close/reopen
        }
        return value;
      });
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  }, [key]);

  return [raw, setRaw, clearDraft] as const;
}
