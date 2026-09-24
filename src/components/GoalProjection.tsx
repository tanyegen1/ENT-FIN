import { useState } from "react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { formatCurrency, formatPercent } from "../lib/format";

interface GoalProjectionProps {
  currentValue: number;
  contributedTotal: number;
}

export function GoalProjection({ currentValue, contributedTotal }: GoalProjectionProps) {
  const { t } = useLocale();
  const [rate, setRate] = useState(6);
  const [years, setYears] = useState(5);

  const projected = currentValue * Math.pow(1 + rate / 100, years);
  const belowContributed = projected < contributedTotal;

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
      <h3 className="text-[15px] font-semibold text-ink">{t("goals.projectionHeading")}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{t("goals.projectionNote")}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-faint">{t("goals.assumedReturnLabel")}</span>
          <span className={clsx("font-semibold tabular-nums", rate < 0 ? "text-down" : "text-up")}>
            {formatPercent(rate)}
          </span>
        </div>
        <input
          type="range"
          min={-15}
          max={15}
          step={1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="mt-2 w-full accent-brand"
          aria-label={t("goals.assumedReturnLabel")}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-faint">{t("goals.yearsLabel")}</span>
          <span className="font-semibold tabular-nums text-ink">{t("goals.yearsValue", { years })}</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
          className="mt-2 w-full accent-brand"
          aria-label={t("goals.yearsLabel")}
        />
      </div>

      <div className="mt-5 rounded-xl bg-surface-3 px-3.5 py-3">
        <div className="text-[12px] text-ink-faint">{t("goals.projectedValue", { years })}</div>
        <div className={clsx("mt-0.5 text-2xl font-semibold tabular-nums", belowContributed ? "text-down" : "text-ink")}>
          {formatCurrency(projected)}
        </div>
        <div className="mt-1.5 text-[11px] text-ink-faint">
          {t("goals.projectedContributed")}: {formatCurrency(contributedTotal)}
        </div>
      </div>
    </div>
  );
}
