import { useEffect, useRef, useState } from "react";
import type { AssetCategory } from "../types";
import { getMarketSession, type MarketSessionState } from "../lib/marketSession";

// A safety-net poll in addition to the precise timeout below — covers
// external state this hook can't otherwise observe changing, namely a
// dev-only halt (see marketSession.ts's setSymbolHalt/clearSymbolHalt),
// which has no change event of its own.
const SAFETY_POLL_MS = 15_000;

/**
 * Live market-session state for one instrument, recomputed exactly at the
 * next status boundary, on tab focus/visibility, on reconnect, and on a
 * short safety poll — so a pill built on this never shows a stale status
 * because "the user just kept the tab open." Every consumer (dashboard,
 * stock page, order forms, watchlist rows) should go through this hook
 * rather than computing session state itself.
 */
export function useMarketSessionState(category: AssetCategory, symbol?: string): MarketSessionState {
  const [state, setState] = useState<MarketSessionState>(() => getMarketSession(category, { symbol }));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      const next = getMarketSession(category, { symbol });
      setState(next);
      scheduleNext(next);
    };

    const scheduleNext = (current: MarketSessionState) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const untilTransition = current.nextTransition ? current.nextTransition.at - Date.now() : null;
      // Whichever is sooner: the exact next status boundary, or the safety
      // poll — clamped so a bug in the schedule math can't produce a
      // negative/instant/near-infinite timer.
      const delay = Math.min(untilTransition ?? SAFETY_POLL_MS, SAFETY_POLL_MS);
      timeoutRef.current = setTimeout(refresh, Math.max(250, delay));
    };

    refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [category, symbol]);

  return state;
}
