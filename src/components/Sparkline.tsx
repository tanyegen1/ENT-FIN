import { useMemo } from "react";
import type { PricePoint } from "../types";

interface SparklineProps {
  data: PricePoint[];
  positive: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({ data, positive, width = 96, height = 36 }: SparklineProps) {
  const path = useMemo(() => {
    if (data.length === 0) return "";
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const stepX = width / (data.length - 1 || 1);
    return data
      .map((d, i) => {
        const x = i * stepX;
        const y = height - ((d.price - min) / range) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data, width, height]);

  const color = positive ? "var(--color-up)" : "var(--color-down)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
