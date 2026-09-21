import clsx from "clsx";
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
            className={clsx(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              active
                ? positive
                  ? "bg-up-soft text-up"
                  : "bg-down-soft text-down"
                : "text-ink-faint hover:text-ink-dim",
            )}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
