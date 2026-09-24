import { useQuoteError, useQuoteStatus } from "../data/liveQuotes";
import { useLocale } from "../context/LocaleContext";

interface LiveDotProps {
  symbol: string;
  showLabel?: boolean;
}

/** Small status indicator for the handful of tickers with real live quotes. */
export function LiveDot({ symbol, showLabel }: LiveDotProps) {
  const { t } = useLocale();
  const status = useQuoteStatus(symbol);
  const error = useQuoteError(symbol);
  if (!status || status === "idle") return null;

  const color =
    status === "live" ? "bg-brand" : status === "loading" ? "bg-ink-faint" : "bg-down";
  const label =
    status === "live" ? t("liveDot.live") : status === "loading" ? t("liveDot.updating") : t("liveDot.demoData");
  const title =
    status === "error"
      ? `${t("liveDot.titleError")} ${error ?? ""}`
      : status === "live"
        ? t("liveDot.titleLive")
        : t("liveDot.titleFetching");

  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${color} ${status === "live" ? "animate-pulse" : ""}`}
      />
      {showLabel && <span className="text-[11px] font-medium text-ink-faint">{label}</span>}
    </span>
  );
}
