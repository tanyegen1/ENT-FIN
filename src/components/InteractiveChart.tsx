import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PricePoint } from "../types";
import { useLocale } from "../context/LocaleContext";

interface InteractiveChartProps {
  data: PricePoint[];
  positive: boolean;
  height?: number;
  onScrub?: (point: PricePoint | null, index: number | null) => void;
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

export function InteractiveChart({
  data,
  positive,
  height = 260,
  onScrub,
}: InteractiveChartProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId();

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

  const { linePath, areaPath, points, min, max } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: "", areaPath: "", points: [], min: 0, max: 0 };
    }
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = height * 0.12;
    const usable = height - pad * 2;
    const stepX = width / (data.length - 1 || 1);
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: pad + usable - ((d.price - min) / range) * usable,
    }));
    const line = buildSmoothPath(pts);
    const area = `${line} L${pts[pts.length - 1].x},${height} L0,${height} Z`;
    return { linePath: line, areaPath: area, points: pts, min, max };
  }, [data, width, height]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || points.length === 0) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const stepX = width / (points.length - 1 || 1);
      const idx = Math.min(
        points.length - 1,
        Math.max(0, Math.round(x / stepX)),
      );
      setActiveIndex(idx);
      onScrub?.(data[idx], idx);
    },
    [points, width, data, onScrub],
  );

  const handleEnd = useCallback(() => {
    setActiveIndex(null);
    onScrub?.(null, null);
  }, [onScrub]);

  const color = positive ? "var(--color-up)" : "var(--color-down)";
  const active = activeIndex !== null ? points[activeIndex] : null;

  return (
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
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {active && (
            <g>
              <line
                x1={active.x}
                y1={0}
                x2={active.x}
                y2={height}
                stroke="var(--color-ink-faint)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={active.x} cy={active.y} r={5} fill={color} />
              <circle
                cx={active.x}
                cy={active.y}
                r={9}
                fill={color}
                opacity={0.18}
              />
            </g>
          )}
        </svg>
      )}
      <span className="sr-only">
        {t("common.priceRange", { min: min.toFixed(2), max: max.toFixed(2) })}
      </span>
    </div>
  );
}
