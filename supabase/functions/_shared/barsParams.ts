export interface ParsedBarsParams {
  ticker: string;
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week" | "month";
  from: string;
  to: string;
  adjusted: boolean;
}

export interface ParsedBarsParamsError {
  error: string;
}

const VALID_TIMESPANS = new Set(["minute", "hour", "day", "week", "month"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBarsParams(url: URL): ParsedBarsParams | ParsedBarsParamsError {
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (ticker.length === 0) return { error: "missing required 'ticker' query parameter" };

  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DATE_RE.test(from)) return { error: "missing or invalid 'from' date (expected YYYY-MM-DD)" };
  if (!DATE_RE.test(to)) return { error: "missing or invalid 'to' date (expected YYYY-MM-DD)" };
  if (from > to) return { error: "'from' must not be after 'to'" };

  const timespanRaw = url.searchParams.get("timespan") ?? "day";
  if (!VALID_TIMESPANS.has(timespanRaw)) {
    return { error: `invalid 'timespan' — expected one of ${[...VALID_TIMESPANS].join(", ")}` };
  }

  const multiplierRaw = Number(url.searchParams.get("multiplier"));
  const multiplier = Number.isInteger(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 1;

  const adjustedRaw = url.searchParams.get("adjusted");
  const adjusted = adjustedRaw === null ? true : adjustedRaw !== "false";

  return { ticker, multiplier, timespan: timespanRaw as ParsedBarsParams["timespan"], from, to, adjusted };
}

export function isBarsParamsError(v: ParsedBarsParams | ParsedBarsParamsError): v is ParsedBarsParamsError {
  return "error" in v;
}
