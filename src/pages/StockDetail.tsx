import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { getStock } from "../data/stocks";
import { getPriceHistory } from "../data/priceHistory";
import { usePortfolio } from "../context/PortfolioContext";
import { InteractiveChart } from "../components/InteractiveChart";
import { RangeTabs } from "../components/RangeTabs";
import { PriceChange } from "../components/PriceChange";
import { PageHeader } from "../components/PageHeader";
import { OrderSheet } from "../components/OrderSheet";
import {
  formatCompactNumber,
  formatCurrency,
  formatCurrencyPrecise,
  formatShares,
} from "../lib/format";
import type { PricePoint, Range } from "../types";

export function StockDetail() {
  const { symbol = "" } = useParams();
  const stock = getStock(symbol.toUpperCase());
  const { getHolding, isWatched, toggleWatchlist } = usePortfolio();
  const [range, setRange] = useState<Range>("1D");
  const [scrub, setScrub] = useState<PricePoint | null>(null);
  const [order, setOrder] = useState<"buy" | "sell" | null>(null);

  const history = useMemo(
    () => (stock ? getPriceHistory(stock.symbol, range) : []),
    [stock, range],
  );

  if (!stock) return <Navigate to="/search" replace />;

  const holding = getHolding(stock.symbol);
  const watched = isWatched(stock.symbol);

  const baseline = range === "1D" ? stock.prevClose : history[0]?.price ?? stock.price;
  const displayPrice = scrub ? scrub.price : stock.price;
  const diff = displayPrice - baseline;
  const diffPercent = baseline !== 0 ? (diff / baseline) * 100 : 0;
  const positive = diff >= 0;

  const stats: [string, string][] = [
    ["Market cap", `$${formatCompactNumber(stock.marketCap)}`],
    ["P/E ratio", stock.peRatio ? stock.peRatio.toFixed(1) : "—"],
    ["Dividend yield", stock.divYield ? `${stock.divYield.toFixed(2)}%` : "—"],
    ["52-wk high", formatCurrencyPrecise(stock.weekHigh52)],
    ["52-wk low", formatCurrencyPrecise(stock.weekLow52)],
    ["Volume", stock.volume ? formatCompactNumber(stock.volume) : "—"],
    ["Avg volume", stock.avgVolume ? formatCompactNumber(stock.avgVolume) : "—"],
    ["Sector", stock.sector],
  ];

  return (
    <div className="pb-28">
      <PageHeader
        title={stock.symbol}
        back
        right={
          <button
            onClick={() => toggleWatchlist(stock.symbol)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label="Toggle watchlist"
          >
            <Star
              size={20}
              className={watched ? "fill-up text-up" : ""}
            />
          </button>
        }
      />

      <div className="px-4 pt-4 lg:px-6">
        <div className="text-sm text-ink-faint">
          {stock.name} · {stock.symbol}
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-ink">
          {formatCurrencyPrecise(displayPrice)}
        </div>
        <div className="mt-1.5">
          <PriceChange amount={diff} percent={diffPercent} size="md" />
        </div>
      </div>

      <div className="mt-4">
        <InteractiveChart
          data={history}
          positive={positive}
          height={240}
          onScrub={(p) => setScrub(p)}
        />
      </div>

      <div className="mt-4 px-4 lg:px-6">
        <RangeTabs value={range} onChange={setRange} positive={positive} />
      </div>

      {holding && (
        <div className="mx-4 mt-6 rounded-2xl bg-surface-2 px-4 py-3.5 lg:mx-6">
          <div className="text-[13px] text-ink-faint">Your position</div>
          <div className="mt-2 grid grid-cols-2 gap-y-2 text-[14px]">
            <span className="text-ink-faint">Shares owned</span>
            <span className="text-right tabular-nums text-ink">
              {formatShares(holding.shares)}
            </span>
            <span className="text-ink-faint">Average cost</span>
            <span className="text-right tabular-nums text-ink">
              {formatCurrencyPrecise(holding.avgCost)}
            </span>
            <span className="text-ink-faint">Market value</span>
            <span className="text-right tabular-nums text-ink">
              {formatCurrency(holding.shares * stock.price)}
            </span>
            <span className="text-ink-faint">Total return</span>
            <PriceChange
              amount={(stock.price - holding.avgCost) * holding.shares}
              percent={((stock.price - holding.avgCost) / holding.avgCost) * 100}
              size="sm"
              className="justify-end"
            />
          </div>
        </div>
      )}

      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">Stats</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <div className="text-[13px] text-ink-faint">{label}</div>
              <div className="text-[15px] font-medium tabular-nums text-ink">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">About</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{stock.about}</p>
      </section>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-[1100px] gap-3 border-t border-border-soft bg-app-bg/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:mt-8 lg:rounded-2xl lg:border lg:px-6 lg:py-4">
        <button
          onClick={() => setOrder("sell")}
          className="flex-1 rounded-full border border-border py-3 text-[15px] font-semibold text-ink hover:bg-surface-2 cursor-pointer"
        >
          Sell
        </button>
        <button
          onClick={() => setOrder("buy")}
          className="flex-1 rounded-full bg-up py-3 text-[15px] font-semibold text-black hover:brightness-110 cursor-pointer"
        >
          Buy
        </button>
      </div>

      {order && (
        <OrderSheet stock={stock} initialSide={order} onClose={() => setOrder(null)} />
      )}
    </div>
  );
}
