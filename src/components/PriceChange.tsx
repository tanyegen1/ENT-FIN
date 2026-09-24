import { ArrowDown, ArrowUp } from "lucide-react";
import clsx from "clsx";
import { formatPercent, formatSigned } from "../lib/format";

interface PriceChangeProps {
  amount: number;
  percent: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
  /** Override for the signed amount text — defaults to USD. Pass a currency-aware formatter for browsing figures. */
  formatAmount?: (amount: number) => string;
}

export function PriceChange({
  amount,
  percent,
  size = "md",
  showIcon = true,
  className,
  formatAmount,
}: PriceChangeProps) {
  const isUp = amount >= 0;
  const sizeClass =
    size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";
  const signedText = formatAmount
    ? `${amount >= 0 ? "+" : "-"}${formatAmount(Math.abs(amount))}`
    : formatSigned(amount);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 tabular-nums font-medium",
        isUp ? "text-up" : "text-down",
        sizeClass,
        className,
      )}
    >
      {showIcon &&
        (isUp ? (
          <ArrowUp size={size === "lg" ? 16 : 13} strokeWidth={2.75} />
        ) : (
          <ArrowDown size={size === "lg" ? 16 : 13} strokeWidth={2.75} />
        ))}
      <span>
        {signedText} ({formatPercent(percent)})
      </span>
    </span>
  );
}

export function PricePill({ percent }: { percent: number }) {
  const isUp = percent >= 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        isUp ? "bg-up-soft text-up" : "bg-down-soft text-down",
      )}
    >
      {formatPercent(percent)}
    </span>
  );
}
