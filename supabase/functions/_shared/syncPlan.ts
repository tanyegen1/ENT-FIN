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

/**
 * A single page from Massive/Polygon can — rarely, e.g. mid corporate-action
 * transition — contain two rows that resolve to the same provider_id
 * (composite_figi/share_class_figi/cik/ticker fallback chain in
 * classify.ts). Postgres' `ON CONFLICT DO UPDATE` refuses to update the
 * same row twice within one statement ("command cannot affect row a second
 * time"), so a page-local duplicate must be collapsed before staging it —
 * never silently dropped without landing at least one copy, and never
 * split across two separate upsert calls (that would risk one succeeding
 * and the other failing, an inconsistency this staged import is designed
 * to avoid). Keeps the LAST occurrence for a given id, since a duplicate
 * within one page is most often an old/new pair where the later entry in
 * the response is the more current one.
 */
export function dedupeByProviderId<T extends { provider_id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.provider_id, row);
  return [...byId.values()];
}
