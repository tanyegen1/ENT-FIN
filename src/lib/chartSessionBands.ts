import { getMarketSession, type SessionStatus } from "./marketSession";
import type { AssetCategory, PricePoint } from "../types";

export interface SessionRun {
  status: SessionStatus;
  /** Index into the original data array where this run starts. */
  startIndex: number;
  /** Index into the original data array where this run ends (inclusive). */
  endIndex: number;
}

/**
 * Groups a chart's data points into runs of contiguous session status —
 * every point classified by getMarketSession using THAT point's own
 * timestamp, never "today's" status applied retroactively (spec: every
 * historical point uses the session that applied at its own timestamp).
 * A pure, index-based function (no pixel math) so it stays correct across
 * a DST transition or an early-close day regardless of how a chart chooses
 * to render it.
 */
export function computeSessionRuns(data: PricePoint[], category: AssetCategory, symbol?: string): SessionRun[] {
  if (data.length === 0) return [];
  const statusAt = (t: number) => getMarketSession(category, { now: new Date(t), symbol }).status;

  const runs: SessionRun[] = [];
  let start = 0;
  let status = statusAt(data[0].t);
  for (let i = 1; i < data.length; i++) {
    const next = statusAt(data[i].t);
    if (next !== status) {
      runs.push({ status, startIndex: start, endIndex: i - 1 });
      start = i;
      status = next;
    }
  }
  runs.push({ status, startIndex: start, endIndex: data.length - 1 });
  return runs;
}
