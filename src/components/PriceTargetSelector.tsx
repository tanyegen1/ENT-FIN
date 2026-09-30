import { useId, useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { classifyOrderType } from "../lib/practiceOrders/engine";
import type { PriceRuleOrderType } from "../types";

interface PriceTargetSelectorProps {
  symbol: string;
  side: "buy" | "sell";
  currentPrice: number;
  value: number;
  onChange: (value: number) => void;
}

// This selector is only ever driven by classifyOrderType's result, which
// never produces "market" (queued market orders are built by a separate
// flow) — included anyway so the map stays a total function of the type.
const EXPLAIN_KEY: Record<PriceRuleOrderType, string> = {
  "buy-limit": "priceRules.explainBuyLimit",
  "buy-stop": "priceRules.explainBuyStop",
  "sell-limit": "priceRules.explainSellLimit",
  "sell-stop": "priceRules.explainSellStop",
  market: "priceRules.explainMarket",
};

const TECHNICAL_KEY: Record<PriceRuleOrderType, string> = {
  "buy-limit": "priceRules.technicalBuyLimit",
  "buy-stop": "priceRules.technicalBuyStop",
  "sell-limit": "priceRules.technicalSellLimit",
  "sell-stop": "priceRules.technicalSellStop",
  market: "priceRules.technicalMarket",
};

/**
 * A visual + numeric price target picker. The native range input is the
 * real control (full keyboard and touch support come for free from it);
 * the track markers and live sentence underneath are a read-only overlay
 * that mirrors the same value, and the numeric field beside it is always a
 * valid alternate way to set an exact price without needing precise
 * dragging.
 */
export function PriceTargetSelector({ symbol, side, currentPrice, value, onChange }: PriceTargetSelectorProps) {
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const inputId = useId();

  const bounds = useMemo(() => {
    const lo = Math.min(currentPrice * 0.5, value * 0.9);
    const hi = Math.max(currentPrice * 1.5, value * 1.1);
    return { min: Math.max(0.01, lo), max: Math.max(hi, currentPrice * 1.5, 0.02) };
  }, [currentPrice, value]);

  const clampedValue = Math.min(bounds.max, Math.max(bounds.min, value));
  const valuePct = ((clampedValue - bounds.min) / (bounds.max - bounds.min)) * 100;
  const currentPct = ((currentPrice - bounds.min) / (bounds.max - bounds.min)) * 100;

  const orderType = classifyOrderType(side, value, currentPrice);
  const distancePercent = currentPrice > 0 ? ((value - currentPrice) / currentPrice) * 100 : 0;
  const isAbove = value > currentPrice;
  const isEqual = Math.abs(value - currentPrice) < 0.005;

  const handleNumberChange = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  };

  const step = currentPrice >= 100 ? 0.5 : currentPrice >= 10 ? 0.1 : 0.01;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-ink-faint">{t("priceRules.selectorCurrentPrice")}</span>
        <span className="font-semibold tabular-nums text-ink">{formatDisplay(currentPrice, { precise: true })}</span>
      </div>

      {/* Decorative visual track — the native range input below is the real
          control; this mirrors its value so dragging feels like moving a
          line on a price scale, not just an abstract slider. */}
      <div className="relative h-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink-faint"
          style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
        />
        <div
          className={clsx(
            "absolute top-1/2 flex -translate-y-1/2 -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow",
            isEqual ? "bg-ink-dim" : isAbove ? "bg-up text-black" : "bg-down",
          )}
          style={{ left: `${Math.min(100, Math.max(0, valuePct))}%` }}
        >
          {!isEqual && (isAbove ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
          {formatDisplay(value, { precise: true })}
        </div>
      </div>

      <input
        type="range"
        aria-label={`${t("priceRules.selectorYourTarget")} · ${symbol}`}
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={clampedValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
      />

      <div className="flex items-center gap-3">
        <label htmlFor={inputId} className="text-[13px] text-ink-faint">
          {t("priceRules.selectorInputLabel")}
        </label>
        <div className="flex flex-1 items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2">
          <span className="text-ink-faint">$</span>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => handleNumberChange(e.target.value)}
            className="w-full bg-transparent text-[15px] font-semibold tabular-nums text-ink focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2.5">
        {!isEqual && (
          <span className="text-[12px] font-medium text-ink-dim">
            {t(isAbove ? "priceRules.distanceAbove" : "priceRules.distanceBelow", {
              percent: Math.abs(distancePercent).toFixed(1),
            })}
          </span>
        )}
        {orderType && (
          <>
            <p className="text-[13px] leading-relaxed text-ink">
              {t(EXPLAIN_KEY[orderType], { price: formatDisplay(value, { precise: true }) })}
            </p>
            <span className="text-[11px] text-ink-faint">{t(TECHNICAL_KEY[orderType])}</span>
          </>
        )}
      </div>
    </div>
  );
}
