import { useEffect, useMemo, useRef, useState } from "react";
import type { RsiPoint } from "../lib/indicators";
import { useLocale } from "../context/LocaleContext";

interface RsiPanelProps {
  /** The full x-axis time span to align against — the main chart's own data range, so this panel's x positions line up with it exactly even though RSI itself only has values from period+1 onward. */
  timeRange: { start: number; end: number };
  rsi: RsiPoint[];
  height?: number;
}

/**
 * A small, separate 0-100-scaled panel for RSI — kept apart from the main
 * price chart's own y-scale rather than shoehorned onto it. Draws the
 * conventional 30/70 reference lines as plain, unlabeled-as-signals guides
 * (spec: never call these automatic buy/sell signals).
 */
export function RsiPanel({ timeRange, rsi, height = 90 }: RsiPanelProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

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

  const path = useMemo(() => {
    if (rsi.length === 0 || width <= 0) return "";
    const { start, end } = timeRange;
    const span = end - start || 1;
    const toXY = (p: RsiPoint) => ({ x: ((p.t - start) / span) * width, y: height - (p.value / 100) * height });
    const pts = rsi.map(toXY);
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x},${pts[i].y}`;
    return d;
  }, [rsi, timeRange, width, height]);

  const latest = rsi[rsi.length - 1];

  return (
    <div ref={containerRef} className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-faint">
        <span>{t("chart.rsiLabel")}</span>
        {latest && <span className="tabular-nums text-ink-dim">{latest.value.toFixed(0)}</span>}
      </div>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <line x1={0} y1={height * 0.3} x2={width} y2={height * 0.3} stroke="var(--color-border-soft)" strokeWidth={1} strokeDasharray="2 2" />
          <line x1={0} y1={height * 0.7} x2={width} y2={height * 0.7} stroke="var(--color-border-soft)" strokeWidth={1} strokeDasharray="2 2" />
          <text x={2} y={height * 0.3 - 2} fontSize={9} fill="var(--color-ink-faint)">70</text>
          <text x={2} y={height * 0.7 - 2} fontSize={9} fill="var(--color-ink-faint)">30</text>
          {path && <path d={path} fill="none" stroke="var(--color-brand-light)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      )}
    </div>
  );
}
