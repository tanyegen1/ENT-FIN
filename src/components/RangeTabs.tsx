import clsx from "clsx";
import { motion } from "motion/react";
import type { Range } from "../types";

const RANGES: Range[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

interface RangeTabsProps {
  value: Range;
  onChange: (range: Range) => void;
  positive: boolean;
}

export function RangeTabs({ value, onChange, positive }: RangeTabsProps) {
  return (
    <div className="flex items-center justify-between gap-1 px-1">
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className="relative flex-1 rounded-full py-1.5 text-xs font-semibold cursor-pointer"
          >
            {active && (
              <motion.div
                layoutId="range-pill"
                className={clsx(
                  "absolute inset-0 rounded-full",
                  positive ? "bg-up-soft" : "bg-down-soft",
                )}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={clsx(
                "relative z-10 transition-colors",
                active ? (positive ? "text-up" : "text-down") : "text-ink-faint hover:text-ink-dim",
              )}
            >
              {r}
            </span>
          </button>
        );
      })}
    </div>
  );
}
