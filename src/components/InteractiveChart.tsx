import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AssetCategory, PricePoint, Range } from "../types";
import { useLocale } from "../context/LocaleContext";
import { getMarketSession, type SessionStatus } from "../lib/marketSession";
import { pickAxisIndices, formatAxisTick } from "../lib/chartAxis";

interface InteractiveChartProps {
  data: PricePoint[];
  positive: boolean;
  height?: number;
  onScrub?: (point: PricePoint | null, index: number | null) => void;
  /** Enables bottom x-axis tick labels formatted for this range. Omit for a chart with no fixed range semantics (e.g. the portfolio-value chart, which isn't tied to one instrument). */
  range?: Range;
  /** Enables per-point pre-market/regular/after-hours background shading for range === "1D" — every point is classified by the session that applied AT ITS OWN timestamp, never "today's" session. Omit (or pass "crypto") to skip shading — crypto has no sessions. */
  sessionCategory?: AssetCategory;
  sessionSymbol?: string;
}

const SESSION_BAND_FILL: Partial<Record<SessionStatus, string>> = {
  "pre-market": "var(--color-brand-soft)",
  "after-hours": "var(--color-session-after-soft)",
};

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
  range,
  sessionCategory,
  sessionSymbol,
}: InteractiveChartProps) {
  const { t, locale } = useLocale();
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

  const showAxis = range !== undefined;
  const axisHeight = showAxis ? 20 : 0;
  const plotHeight = height - axisHeight;

  const { linePath, areaPath, points, min, max, bands, daySeparators, axisTicks } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: "", areaPath: "", points: [] as { x: number; y: number }[], min: 0, max: 0, bands: [], daySeparators: [], axisTicks: [] };
    }
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const priceRange = max - min || 1;
    const pad = plotHeight * 0.12;
    const usable = plotHeight - pad * 2;
    const stepX = width / (data.length - 1 || 1);
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: pad + usable - ((d.price - min) / priceRange) * usable,
    }));
    const line = buildSmoothPath(pts);
    const area = `${line} L${pts[pts.length - 1].x},${plotHeight} L0,${plotHeight} Z`;

    // Session shading — only meaningful for a single-day intraday view of an
    // instrument that actually has sessions (equities/funds; crypto is
    // always "open", so no bands are drawn for it). Every point is
    // classified by getMarketSession using THAT point's own timestamp, per
    // spec — never "today's" status applied retroactively to older points.
    const bands: { x1: number; x2: number; fill: string }[] = [];
    if (range === "1D" && sessionCategory && sessionCategory !== "crypto") {
      let runStart = 0;
      let runStatus = getMarketSession(sessionCategory, { now: new Date(data[0].t), symbol: sessionSymbol }).status;
      const flush = (endIdx: number, status: SessionStatus) => {
        const fill = SESSION_BAND_FILL[status];
        if (!fill) return;
        const x1 = runStart === 0 ? 0 : (pts[runStart - 1].x + pts[runStart].x) / 2;
        const x2 = endIdx === pts.length - 1 ? width : (pts[endIdx].x + pts[endIdx + 1].x) / 2;
        bands.push({ x1, x2, fill });
      };
      for (let i = 1; i < data.length; i++) {
        const status = getMarketSession(sessionCategory, { now: new Date(data[i].t), symbol: sessionSymbol }).status;
        if (status !== runStatus) {
          flush(i - 1, runStatus);
          runStart = i;
          runStatus = status;
        }
      }
      flush(data.length - 1, runStatus);
    }

    // Day-boundary separators for a multi-day intraday view (1W) — a thin
    // guide at each local-midnight crossing, not a colored band (spec:
    // "day separators" distinct from session shading, which is 1D-only here).
    const daySeparators: number[] = [];
    if (range === "1W") {
      let lastDay = new Date(data[0].t).toDateString();
      for (let i = 1; i < data.length; i++) {
        const day = new Date(data[i].t).toDateString();
        if (day !== lastDay) {
          daySeparators.push((pts[i - 1].x + pts[i].x) / 2);
          lastDay = day;
        }
      }
    }

    // Dedupe consecutive identical labels (e.g. several 5-minute points
    // that all still round to the same hour) rather than printing the same
    // tick twice in a row — this naturally thins ticks down to real
    // boundaries for a narrow window instead of looking broken/redundant.
    const axisTicks: { x: number; label: string }[] = [];
    if (showAxis) {
      let lastLabel: string | null = null;
      for (const i of pickAxisIndices(data.length, width < 380 ? 4 : 6)) {
        const label = formatAxisTick(range!, data[i].t, locale === "tr" ? "tr-TR" : undefined);
        if (label === lastLabel) continue;
        axisTicks.push({ x: pts[i].x, label });
        lastLabel = label;
      }
    }

    return { linePath: line, areaPath: area, points: pts, min, max, bands, daySeparators, axisTicks };
  }, [data, width, plotHeight, range, sessionCategory, sessionSymbol, showAxis, locale]);

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
          {bands.map((b, i) => (
            <rect key={i} x={b.x1} y={0} width={Math.max(0, b.x2 - b.x1)} height={plotHeight} fill={b.fill} />
          ))}
          {daySeparators.map((x, i) => (
            <line key={i} x1={x} y1={0} x2={x} y2={plotHeight} stroke="var(--color-border-soft)" strokeWidth={1} strokeDasharray="2 3" />
          ))}
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
                y2={plotHeight}
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
          {showAxis &&
            axisTicks.map((tick, i) => (
              <text
                key={i}
                x={Math.min(Math.max(tick.x, 14), width - 14)}
                y={plotHeight + 15}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-ink-faint)"
              >
                {tick.label}
              </text>
            ))}
        </svg>
      )}
      <span className="sr-only">
        {t("common.priceRange", { min: min.toFixed(2), max: max.toFixed(2) })}
      </span>
    </div>
  );
}
