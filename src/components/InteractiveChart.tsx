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
import type { SessionStatus } from "../lib/marketSession";
import { pickAxisIndices, formatAxisTick } from "../lib/chartAxis";
import { computeSessionRuns } from "../lib/chartSessionBands";

export interface ChartReferenceLine {
  value: number;
  color: string;
  label: string;
}

export interface ChartMovingAverage {
  color: string;
  points: { t: number; value: number }[];
}

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
  /** Draws a dashed line at the highest/lowest displayed price, each labeled with its value — the caller decides the scope wording (e.g. "Highest displayed price" for sampled data). */
  showHighLow?: boolean;
  /** Previous close / my average cost / my order levels — all rendered the same way (a labeled horizontal dashed line), just with different colors and labels supplied by the caller. Values outside the plotted price range still get drawn (the chart's own scale expands to fit them) rather than clipped off-screen. */
  referenceLines?: ChartReferenceLine[];
  /** 20-day/50-day SMA overlays — each point plotted at its own timestamp on the same x scale as the main series, not re-indexed positionally. */
  movingAverages?: ChartMovingAverage[];
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
  showHighLow,
  referenceLines,
  movingAverages,
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

  const { linePath, areaPath, points, min, max, bands, daySeparators, axisTicks, highLowMarkers, referenceLineRows, movingAverageLines } = useMemo(() => {
    if (data.length === 0) {
      return {
        linePath: "",
        areaPath: "",
        points: [] as { x: number; y: number }[],
        min: 0,
        max: 0,
        bands: [],
        daySeparators: [],
        axisTicks: [],
        highLowMarkers: [],
        referenceLineRows: [],
        movingAverageLines: [],
      };
    }
    const prices = data.map((d) => d.price);
    // A reference line (prev close / avg cost / an order's price) or a
    // moving-average value can fall outside the plotted series' own
    // high/low — the scale expands to fit them so nothing is clipped off
    // the visible chart rather than silently invisible.
    const overlayValues = [
      ...(referenceLines ?? []).map((l) => l.value),
      ...(movingAverages ?? []).flatMap((m) => m.points.map((p) => p.value)),
    ];
    const min = Math.min(...prices, ...overlayValues);
    const max = Math.max(...prices, ...overlayValues);
    const priceRange = max - min || 1;
    const pad = plotHeight * 0.12;
    const usable = plotHeight - pad * 2;
    const stepX = width / (data.length - 1 || 1);
    const priceToY = (price: number) => pad + usable - ((price - min) / priceRange) * usable;
    const timeToX = (t: number) => {
      const t0 = data[0].t;
      const t1 = data[data.length - 1].t;
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return frac * width;
    };
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: priceToY(d.price),
    }));
    const line = buildSmoothPath(pts);
    const area = `${line} L${pts[pts.length - 1].x},${plotHeight} L0,${plotHeight} Z`;

    // Session shading — only meaningful for a single-day intraday view of an
    // instrument that actually has sessions (equities/funds; crypto is
    // always "open", so no bands are drawn for it). Grouping is delegated to
    // computeSessionRuns (lib/chartSessionBands.ts), a pure index-based
    // function tested independently against DST-transition and early-close
    // fixtures — this just converts its runs to pixel coordinates.
    const bands: { x1: number; x2: number; fill: string }[] = [];
    if (range === "1D" && sessionCategory && sessionCategory !== "crypto") {
      for (const run of computeSessionRuns(data, sessionCategory, sessionSymbol)) {
        const fill = SESSION_BAND_FILL[run.status];
        if (!fill) continue;
        const x1 = run.startIndex === 0 ? 0 : (pts[run.startIndex - 1].x + pts[run.startIndex].x) / 2;
        const x2 = run.endIndex === pts.length - 1 ? width : (pts[run.endIndex].x + pts[run.endIndex + 1].x) / 2;
        bands.push({ x1, x2, fill });
      }
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

    const highLowMarkers = showHighLow
      ? [
          { y: priceToY(max), value: max, anchor: "top" as const },
          { y: priceToY(min), value: min, anchor: "bottom" as const },
        ]
      : [];

    const referenceLineRows = (referenceLines ?? []).map((l) => ({ ...l, y: priceToY(l.value) }));

    const movingAverageLines = (movingAverages ?? []).map((m) => ({
      color: m.color,
      path: buildSmoothPath(m.points.map((p) => ({ x: timeToX(p.t), y: priceToY(p.value) }))),
    }));

    return { linePath: line, areaPath: area, points: pts, min, max, bands, daySeparators, axisTicks, highLowMarkers, referenceLineRows, movingAverageLines };
  }, [data, width, plotHeight, range, sessionCategory, sessionSymbol, showAxis, locale, showHighLow, referenceLines, movingAverages]);

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
          {movingAverageLines.map((m, i) => (
            <path key={i} d={m.path} fill="none" stroke={m.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {referenceLineRows.map((r, i) => (
            <g key={i}>
              <line x1={0} y1={r.y} x2={width} y2={r.y} stroke={r.color} strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
              <text x={width - 4} y={r.y - 4} textAnchor="end" fontSize={10} fill={r.color} fontWeight={600}>
                {r.label}
              </text>
            </g>
          ))}
          {highLowMarkers.map((m, i) => (
            <text
              key={i}
              x={4}
              y={m.anchor === "top" ? m.y + 11 : m.y - 4}
              textAnchor="start"
              fontSize={10}
              fill="var(--color-ink-faint)"
            >
              {m.value.toFixed(2)}
            </text>
          ))}
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
