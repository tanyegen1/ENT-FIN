import { useQuoteError, useQuoteStatus } from "../data/liveQuotes";

interface LiveDotProps {
  symbol: string;
  showLabel?: boolean;
}

/** Small status indicator for the handful of tickers with real live quotes. */
export function LiveDot({ symbol, showLabel }: LiveDotProps) {
  const status = useQuoteStatus(symbol);
  const error = useQuoteError(symbol);
  if (!status || status === "idle") return null;

  const color =
    status === "live" ? "bg-up" : status === "loading" ? "bg-ink-faint" : "bg-down";
  const label = status === "live" ? "Live" : status === "loading" ? "Updating" : "Demo data";
  const title =
    status === "error"
      ? `Live quote unavailable — showing mock data. ${error ?? ""}`
      : status === "live"
        ? "Live market data"
        : "Fetching live quote…";

  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${color} ${status === "live" ? "animate-pulse" : ""}`}
      />
      {showLabel && <span className="text-[11px] font-medium text-ink-faint">{label}</span>}
    </span>
  );
}
