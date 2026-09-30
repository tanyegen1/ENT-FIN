import type { PricePoint } from "../types";

/**
 * Pure, deterministic chart-indicator math — no React, no live data. Every
 * function here operates only on the points it's given (typically whatever
 * the chart is currently displaying), so a caller is always in control of
 * exactly what data basis an indicator reflects (spec: label the data basis,
 * never silently mix incompatible series).
 */

export interface HighLow {
  high: number;
  low: number;
  highIndex: number;
  lowIndex: number;
}

/** The highest/lowest price among the given points, plus which point each came from — the caller decides how to label the scope ("selected range" vs. "highest displayed price" for sampled data). */
export function computeHighLow(data: PricePoint[]): HighLow | null {
  if (data.length === 0) return null;
  let high = data[0].price;
  let low = data[0].price;
  let highIndex = 0;
  let lowIndex = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].price > high) {
      high = data[i].price;
      highIndex = i;
    }
    if (data[i].price < low) {
      low = data[i].price;
      lowIndex = i;
    }
  }
  return { high, low, highIndex, lowIndex };
}

export interface SmaPoint {
  t: number;
  value: number;
}

/**
 * Simple moving average over `period` points of the given series, keyed by
 * each point's own timestamp `t` — NOT "period" meaning calendar days
 * unless the series itself is daily. A caller charting this against
 * intraday data must not relabel it "N-day" (spec: never relabel N intraday
 * bars as N days). Returns one entry per point once enough warm-up data
 * exists; before that, no entry (never a partial/misleading average).
 */
export function computeSma(data: PricePoint[], period: number): SmaPoint[] {
  if (period <= 0 || data.length < period) return [];
  const out: SmaPoint[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].price;
    if (i >= period) sum -= data[i - period].price;
    if (i >= period - 1) out.push({ t: data[i].t, value: sum / period });
  }
  return out;
}

export interface RsiPoint {
  t: number;
  value: number;
}

/**
 * Wilder's 14-period RSI (the standard, textbook formulation): average
 * gain/loss over the first `period` changes seeds the calculation, then
 * each subsequent value is a smoothed (Wilder) running average — not a
 * plain rolling-window average. Returns one entry per point once warm-up
 * data exists (period+1 input points needed for the first value). Handles
 * the zero-change edge case (RSI = 50, neither gaining nor losing) and the
 * all-gains/all-losses edge case (RSI pinned at 100/0) explicitly rather
 * than dividing by zero.
 */
export function computeRsi(data: PricePoint[], period = 14): RsiPoint[] {
  if (data.length < period + 1) return [];
  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) changes.push(data[i].price - data[i - 1].price);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  const out: RsiPoint[] = [];
  const rsiFromAverages = (gain: number, loss: number): number => {
    if (gain === 0 && loss === 0) return 50; // No movement at all yet — neither overbought nor oversold.
    if (loss === 0) return 100; // Every recent change was a gain.
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  };

  out.push({ t: data[period].t, value: rsiFromAverages(avgGain, avgLoss) });

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push({ t: data[i + 1].t, value: rsiFromAverages(avgGain, avgLoss) });
  }

  return out;
}
