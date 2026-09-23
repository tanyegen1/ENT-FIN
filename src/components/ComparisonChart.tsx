import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PricePoint } from "../types";

export interface ComparisonSeries {
  symbol: string;
  label: string;
  color: string;
  points: PricePoint[];
}

interface ComparisonChartProps {
  series: ComparisonSeries[];
  height?: number;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` Q${p0.x},${p0.y} ${mx},${(p0.y + p1.y) / 2}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}

function toPercentSeries(points: PricePoint[]): number[] {
  const base = points[0]?.price ?? 0;
  if (!base) return points.map(() => 0);
  return points.map((p) => ((p.price - base) / base) * 100);
}

export function ComparisonChart({ series, height = 200 }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const percentSeries = useMemo(() => series.map((s) => toPercentSeries(s.points)), [series]);

  const { paths, pointSets, min, max } = useMemo(() => {
    const allValues = percentSeries.flat();
    const min = allValues.length ? Math.min(...allValues, 0) : 0;
    const max = allValues.length ? Math.max(...allValues, 0) : 0;
    const range = max - min || 1;
    const pad = height * 0.1;
    const usable = height - pad * 2;

    const pointSets = percentSeries.map((values) => {
      const stepX = width / (values.length - 1 || 1);
      return values.map((v, i) => ({
        x: i * stepX,
        y: pad + usable - ((v - min) / range) * usable,
      }));
    });
    const paths = pointSets.map(buildSmoothPath);
    return { paths, pointSets, min, max };
  }, [percentSeries, width, height]);

  const zeroY = useMemo(() => {
    const range = max - min || 1;
    const pad = height * 0.1;
    const usable = height - pad * 2;
    return pad + usable - ((0 - min) / range) * usable;
  }, [min, max, height]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || pointSets.length === 0 || pointSets[0].length === 0) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const len = pointSets[0].length;
      const stepX = width / (len - 1 || 1);
      const idx = Math.min(len - 1, Math.max(0, Math.round(x / stepX)));
      setActiveIndex(idx);
    },
    [pointSets, width],
  );

  const handleEnd = useCallback(() => setActiveIndex(null), []);

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full touch-none select-none"
        style={{ height }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType !== "touch") return;
          if (e.pressure === 0 && e.pointerType === "touch") return;
          updateFromClientX(e.clientX);
        }}
        onPointerUp={handleEnd}
        onPointerLeave={handleEnd}
        onPointerCancel={handleEnd}
      >
        {width > 0 && (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <line
              x1={0}
              y1={zeroY}
              x2={width}
              y2={zeroY}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {paths.map((d, i) => (
              <path
                key={series[i].symbol}
                d={d}
                fill="none"
                stroke={series[i].color}
                strokeWidth={i === 0 ? 2.25 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {activeIndex !== null && (
              <g>
                <line
                  x1={pointSets[0][activeIndex]?.x}
                  y1={0}
                  x2={pointSets[0][activeIndex]?.x}
                  y2={height}
                  stroke="var(--color-ink-faint)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {pointSets.map((pts, i) => {
                  const p = pts[activeIndex];
                  if (!p) return null;
                  return <circle key={series[i].symbol} cx={p.x} cy={p.y} r={4} fill={series[i].color} />;
                })}
              </g>
            )}
          </svg>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, i) => {
          const values = percentSeries[i];
          const shown = activeIndex !== null ? values[activeIndex] : values[values.length - 1];
          return (
            <div key={s.symbol} className="flex items-center gap-1.5 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-ink">{s.label}</span>
              <span className={`tabular-nums font-medium ${shown >= 0 ? "text-up" : "text-down"}`}>
                {shown >= 0 ? "+" : ""}
                {shown.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
