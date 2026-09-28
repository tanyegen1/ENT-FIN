import { motion } from "motion/react";
import clsx from "clsx";
import type { AnalystRating } from "../types";
import { ratingBadgeClass, ratingLabelKey } from "../lib/analystRating";
import { useLocale } from "../context/LocaleContext";

interface RatingMeterProps {
  rating: AnalystRating;
  score: number;
  variant?: "badge" | "gauge";
  className?: string;
}

const GAUGE_GRADIENT = {
  background: "linear-gradient(to right, var(--color-down), var(--color-warn), var(--color-up))",
};

/** Strong Sell -> Strong Buy indicator. `badge` is a compact colored pill (cards, teasers); `gauge` is the full animated meter used on the outlook report. */
export function RatingMeter({ rating, score, variant = "badge", className }: RatingMeterProps) {
  const { t } = useLocale();
  const label = t(ratingLabelKey(rating));

  if (variant === "badge") {
    return (
      <span
        className={clsx(
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
          ratingBadgeClass(rating),
          className,
        )}
      >
        {label}
      </span>
    );
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div className={className}>
      <span className={clsx("inline-flex items-center rounded-full px-3.5 py-1.5 text-[15px] font-semibold", ratingBadgeClass(rating))}>
        {label}
      </span>
      <div className="relative mt-4 h-2 w-full rounded-full" style={GAUGE_GRADIENT}>
        <motion.div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-app-bg bg-ink shadow-lg"
          initial={{ left: 0 }}
          animate={{ left: `${clampedScore}%` }}
          style={{ marginLeft: -8 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-ink-faint">
        <span>{t("analyst.ratingStrongSell")}</span>
        <span>{t("analyst.ratingHold")}</span>
        <span>{t("analyst.ratingStrongBuy")}</span>
      </div>
    </div>
  );
}
