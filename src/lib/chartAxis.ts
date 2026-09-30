import type { PricePoint, Range } from "../types";

export interface DataInterval {
  key: string;
  vars?: Record<string, number>;
}

/**
 * What interval actually separates the rendered points — measured from the
 * data itself (the median gap between consecutive points) rather than
 * assumed from the selected range, so the label is honest for both the
 * synthetic fallback (whose point density doesn't line up with any real
 * exchange resolution) and real fetched data (whose actual resolution
 * varies by provider/plan) alike. Distinguishes "the range selected" from
 * "the interval each point covers," per spec.
 */
export function describeDataInterval(data: PricePoint[]): DataInterval | null {
  if (data.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < data.length; i++) gaps.push(data[i].t - data[i - 1].t);
  gaps.sort((a, b) => a - b);
  const medianMs = gaps[Math.floor(gaps.length / 2)];
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (medianMs < 50 * minute) return { key: "chart.intervalMinutes", vars: { minutes: Math.max(1, Math.round(medianMs / minute)) } };
  if (medianMs < 20 * hour) return { key: "chart.intervalHours", vars: { hours: Math.max(1, Math.round(medianMs / hour)) } };
  if (medianMs < 4 * day) return { key: "chart.intervalDaily" };
  if (medianMs < 20 * day) return { key: "chart.intervalWeekly" };
  return { key: "chart.intervalMonthly" };
}

/** Picks `count` indices spread evenly across [0, length-1], always including the first and last. */
export function pickAxisIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  if (length === 1 || count <= 1) return [0];
  const step = (length - 1) / (count - 1);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round(i * step));
  }
  return Array.from(new Set(out));
}

/** Formats one x-axis tick label for a given range — short, unambiguous, and never claiming more precision than the range implies (e.g. never a time-of-day label for a daily-candle range). */
export function formatAxisTick(range: Range, t: number, locale?: string): string {
  const d = new Date(t);
  switch (range) {
    case "1D":
      return d.toLocaleTimeString(locale, { hour: "numeric" });
    case "1W":
      return d.toLocaleDateString(locale, { weekday: "short" });
    case "1M":
    case "3M":
      return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
    case "YTD":
    case "1Y":
      return d.toLocaleDateString(locale, { month: "short" });
    case "5Y":
    case "ALL":
      return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  }
}

/** The full, unambiguous date/time string for a tooltip/crosshair — always includes an explicit timezone abbreviation, per the "never let a displayed time be ambiguous about its zone" rule. */
export function formatTooltipDateTime(t: number, locale?: string): string {
  return new Date(t).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
