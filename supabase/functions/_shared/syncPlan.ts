/**
 * Pure planning logic for the resumable catalogue sync (see
 * catalogue-sync/index.ts) — deciding what work remains and how to
 * advance, with zero I/O, so it's fully unit-testable without a real
 * Massive/Supabase connection.
 */

export interface SyncCombo {
  exchange: string;
  type: string;
}

// One paginated query per (exchange, type) pair rather than one query over
// the whole "stocks" market — keeps each query's result set bounded and
// lets counts-by-exchange/type fall out of the plan itself. ETF is
// included so existing ETF functionality gets real synced data too (spec:
// "preserve existing ETF functionality... but categorise ETFs separately").
export const SYNC_EXCHANGES = ["XNAS", "XNYS", "XASE", "ARCX"] as const;
export const SYNC_TYPES = ["CS", "ADRC", "ETF"] as const;

export function buildFullComboQueue(): SyncCombo[] {
  const combos: SyncCombo[] = [];
  for (const exchange of SYNC_EXCHANGES) {
    for (const type of SYNC_TYPES) combos.push({ exchange, type });
  }
  return combos;
}

export interface ResumeState {
  remainingCombos: SyncCombo[];
  currentCombo: SyncCombo | null;
  currentCursor: string | null;
}

export function initialResumeState(): ResumeState {
  const [first, ...rest] = buildFullComboQueue();
  return { remainingCombos: rest, currentCombo: first ?? null, currentCursor: null };
}

/** Call after successfully fetching and staging one page for the current combo. `nextCursor` is that page's own next_url, or null when the provider signaled no more pages for this combo. */
export function advanceAfterPage(state: ResumeState, nextCursor: string | null): ResumeState {
  if (nextCursor) {
    return { ...state, currentCursor: nextCursor };
  }
  const [nextCombo, ...rest] = state.remainingCombos;
  return { remainingCombos: rest, currentCombo: nextCombo ?? null, currentCursor: null };
}

export function isSyncComplete(state: ResumeState): boolean {
  return state.currentCombo === null;
}
