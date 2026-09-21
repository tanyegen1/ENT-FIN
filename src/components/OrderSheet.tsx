import { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import clsx from "clsx";
import type { Stock } from "../types";
import { Keypad } from "./Keypad";
import { usePortfolio } from "../context/PortfolioContext";
import { formatCurrency, formatCurrencyPrecise, formatShares } from "../lib/format";

type Side = "buy" | "sell";
type Mode = "dollars" | "shares";
type Step = "entry" | "review" | "success";

interface OrderSheetProps {
  stock: Stock;
  initialSide: Side;
  onClose: () => void;
}

export function OrderSheet({ stock, initialSide, onClose }: OrderSheetProps) {
  const { cash, getHolding, buy, sell } = usePortfolio();
  const [side, setSide] = useState<Side>(initialSide);
  const [mode, setMode] = useState<Mode>("dollars");
  const [raw, setRaw] = useState("0");
  const [step, setStep] = useState<Step>("entry");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const holding = getHolding(stock.symbol);
  const ownedShares = holding?.shares ?? 0;

  const amount = Number(raw) || 0;
  const shares = mode === "dollars" ? amount / stock.price : amount;
  const cost = mode === "dollars" ? amount : amount * stock.price;

  const overBuy = side === "buy" && amount > 0 && cost > cash + 0.005;
  const overSell = side === "sell" && amount > 0 && shares > ownedShares + 0.000001;
  const canReview = amount > 0 && !overBuy && !overSell;

  const errorMessage = overBuy
    ? "Not enough buying power"
    : overSell
      ? "Not enough shares"
      : null;

  const handleDigit = (d: string) => {
    setRaw((prev) => {
      if (prev === "0") return d;
      if (prev.includes(".")) {
        const decimals = prev.split(".")[1];
        if (decimals.length >= 2) return prev;
      }
      if (prev.replace(".", "").length >= 9) return prev;
      return prev + d;
    });
  };
  const handleDecimal = () =>
    setRaw((prev) => (prev.includes(".") ? prev : `${prev}.`));
  const handleBackspace = () =>
    setRaw((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));

  const handleSubmit = () => {
    if (!canReview) return;
    if (side === "buy") buy(stock.symbol, shares, stock.price);
    else sell(stock.symbol, shares, stock.price);
    setStep("success");
  };

  const displayValue = useMemo(() => {
    if (mode === "dollars") return `$${raw}`;
    return raw;
  }, [mode, raw]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">
            {step === "success" ? "Order submitted" : `${stock.symbol} · ${stock.name}`}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {step === "entry" && (
          <div className="flex flex-col overflow-y-auto">
            <div className="flex px-4 pt-3">
              {(["buy", "sell"] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={clsx(
                    "flex-1 border-b-2 pb-2 text-center text-[15px] font-semibold capitalize transition-colors cursor-pointer",
                    side === s
                      ? "border-up text-ink"
                      : "border-transparent text-ink-faint",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-2 px-4 py-8">
              <div className="text-5xl font-semibold tabular-nums text-ink">
                {displayValue}
              </div>
              <button
                onClick={() => {
                  setMode((m) => (m === "dollars" ? "shares" : "dollars"));
                  setRaw("0");
                }}
                className="text-sm font-medium text-ink-faint underline decoration-dotted underline-offset-4 cursor-pointer"
              >
                {mode === "dollars"
                  ? `${formatShares(shares)} shares`
                  : `≈ ${formatCurrency(cost)}`}
                &nbsp;· switch to {mode === "dollars" ? "shares" : "dollars"}
              </button>
              {errorMessage && (
                <span className="text-sm font-medium text-down">{errorMessage}</span>
              )}
            </div>

            <div className="flex items-center justify-between px-4 pb-2 text-[13px] text-ink-faint">
              <span>Market price</span>
              <span className="tabular-nums text-ink-dim">
                {formatCurrencyPrecise(stock.price)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 pb-4 text-[13px] text-ink-faint">
              <span>{side === "buy" ? "Buying power" : "Shares owned"}</span>
              <span className="tabular-nums text-ink-dim">
                {side === "buy"
                  ? formatCurrency(cash)
                  : `${formatShares(ownedShares)} sh`}
              </span>
            </div>

            <div className="px-4 pb-4">
              <Keypad
                onDigit={handleDigit}
                onDecimal={handleDecimal}
                onBackspace={handleBackspace}
              />
            </div>

            <div className="px-4 pb-6">
              <button
                disabled={!canReview}
                onClick={() => setStep("review")}
                className={clsx(
                  "w-full rounded-full py-3.5 text-[15px] font-semibold transition-colors cursor-pointer",
                  canReview
                    ? "bg-up text-black hover:brightness-110"
                    : "bg-surface-3 text-ink-faint cursor-not-allowed",
                )}
              >
                Review order
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col overflow-y-auto px-4 pb-6 pt-4">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm text-ink-faint capitalize">{side} · Market order</span>
            </div>
            <div className="mb-6 flex items-center justify-between">
              <span className="text-3xl font-semibold text-ink">{stock.symbol}</span>
              <span className="text-3xl font-semibold tabular-nums text-ink">
                {formatCurrency(cost)}
              </span>
            </div>
            <dl className="flex flex-col gap-3 border-t border-border-soft pt-4 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-faint">Estimated shares</dt>
                <dd className="tabular-nums text-ink">{formatShares(shares)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Market price</dt>
                <dd className="tabular-nums text-ink">{formatCurrencyPrecise(stock.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Estimated {side === "buy" ? "cost" : "proceeds"}</dt>
                <dd className="tabular-nums text-ink">{formatCurrency(cost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">
                  {side === "buy" ? "Buying power after" : "Cash after"}
                </dt>
                <dd className="tabular-nums text-ink">
                  {formatCurrency(side === "buy" ? cash - cost : cash + cost)}
                </dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                className="w-full rounded-full bg-up py-3.5 text-[15px] font-semibold text-black transition-colors hover:brightness-110 cursor-pointer"
              >
                Submit {side === "buy" ? "buy" : "sell"} order
              </button>
              <button
                onClick={() => setStep("entry")}
                className="w-full rounded-full py-3.5 text-[15px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-up-soft">
              <Check size={32} className="text-up" strokeWidth={2.5} />
            </div>
            <div className="text-xl font-semibold text-ink">
              {side === "buy" ? "Bought" : "Sold"} {formatShares(shares)} shares
            </div>
            <div className="text-ink-faint">
              {stock.symbol} · {formatCurrency(cost)} at market price
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-full bg-surface-2 py-3.5 text-[15px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
