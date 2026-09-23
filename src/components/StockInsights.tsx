import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { Range, Stock } from "../types";
import { STOCKS, getStock } from "../data/stocks";
import { getPriceHistory } from "../data/priceHistory";
import { getLiveQuote, isLiveSymbol } from "../data/liveQuotes";
import { buildInsights } from "../lib/insights";
import { formatCompactNumber } from "../lib/format";
import { ComparisonChart, type ComparisonSeries } from "./ComparisonChart";

const FRIENDLY_NAMES: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
};

const BENCHMARK_COLOR = "#5b8def";
const PEER_COLOR = "#f59e0b";

function friendlyName(symbol: string): string {
  return FRIENDLY_NAMES[symbol] ?? symbol;
}

function priceAt(symbol: string, range: Range): { first: number; last: number } | null {
  const liveEnd = isLiveSymbol(symbol) ? getLiveQuote(symbol)?.price : undefined;
  const history = getPriceHistory(symbol, range, liveEnd);
  if (history.length === 0) return null;
  return { first: history[0].price, last: history[history.length - 1].price };
}

function rangePosition(stock: Stock): number {
  const span = stock.weekHigh52 - stock.weekLow52;
  if (span === 0) return 50;
  return ((stock.price - stock.weekLow52) / span) * 100;
}

interface StockInsightsProps {
  stock: Stock;
  range: Range;
}

export function StockInsights({ stock, range }: StockInsightsProps) {
  const benchmarkSymbol = stock.symbol === "SPY" ? "QQQ" : "SPY";
  const benchmarkStock = getStock(benchmarkSymbol);

  const peerCandidates = useMemo(() => {
    const sameSector = STOCKS.filter(
      (s) => s.sector === stock.sector && s.symbol !== stock.symbol && s.symbol !== benchmarkSymbol,
    );
    const majors = STOCKS.filter(
      (s) =>
        ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META"].includes(s.symbol) &&
        s.symbol !== stock.symbol &&
        s.symbol !== benchmarkSymbol,
    );
    const combined = [...sameSector, ...majors];
    const seen = new Set<string>();
    const deduped = combined.filter((s) => (seen.has(s.symbol) ? false : (seen.add(s.symbol), true)));
    return deduped.slice(0, 5);
  }, [stock.symbol, stock.sector, benchmarkSymbol]);

  const [peerSymbol, setPeerSymbol] = useState(peerCandidates[0]?.symbol ?? benchmarkSymbol);
  const peerStock = getStock(peerSymbol) ?? peerCandidates[0];

  const insights = useMemo(() => buildInsights(stock), [stock]);

  const series: ComparisonSeries[] = useMemo(() => {
    const result: ComparisonSeries[] = [
      {
        symbol: stock.symbol,
        label: stock.symbol,
        color: "var(--color-ink)",
        points: getPriceHistory(stock.symbol, range, isLiveSymbol(stock.symbol) ? stock.price : undefined),
      },
    ];
    if (benchmarkStock) {
      result.push({
        symbol: benchmarkStock.symbol,
        label: friendlyName(benchmarkStock.symbol),
        color: BENCHMARK_COLOR,
        points: getPriceHistory(
          benchmarkStock.symbol,
          range,
          isLiveSymbol(benchmarkStock.symbol) ? getLiveQuote(benchmarkStock.symbol)?.price : undefined,
        ),
      });
    }
    if (peerStock && peerStock.symbol !== benchmarkStock?.symbol) {
      result.push({
        symbol: peerStock.symbol,
        label: peerStock.symbol,
        color: PEER_COLOR,
        points: getPriceHistory(
          peerStock.symbol,
          range,
          isLiveSymbol(peerStock.symbol) ? getLiveQuote(peerStock.symbol)?.price : undefined,
        ),
      });
    }
    return result;
  }, [stock, range, benchmarkStock, peerStock]);

  const returnFor = (symbol: string) => {
    const p = priceAt(symbol, range);
    if (!p || p.first === 0) return 0;
    return ((p.last - p.first) / p.first) * 100;
  };

  const tableRows: {
    label: string;
    stock: string;
    benchmark: string;
    peer: string;
  }[] = [
    {
      label: `Return (${range})`,
      stock: `${returnFor(stock.symbol) >= 0 ? "+" : ""}${returnFor(stock.symbol).toFixed(2)}%`,
      benchmark: benchmarkStock
        ? `${returnFor(benchmarkStock.symbol) >= 0 ? "+" : ""}${returnFor(benchmarkStock.symbol).toFixed(2)}%`
        : "—",
      peer: peerStock ? `${returnFor(peerStock.symbol) >= 0 ? "+" : ""}${returnFor(peerStock.symbol).toFixed(2)}%` : "—",
    },
    {
      label: "P/E ratio",
      stock: stock.peRatio ? stock.peRatio.toFixed(1) : "—",
      benchmark: benchmarkStock?.peRatio ? benchmarkStock.peRatio.toFixed(1) : "—",
      peer: peerStock?.peRatio ? peerStock.peRatio.toFixed(1) : "—",
    },
    {
      label: "Dividend yield",
      stock: stock.divYield ? `${stock.divYield.toFixed(2)}%` : "—",
      benchmark: benchmarkStock?.divYield ? `${benchmarkStock.divYield.toFixed(2)}%` : "—",
      peer: peerStock?.divYield ? `${peerStock.divYield.toFixed(2)}%` : "—",
    },
    {
      label: "Market cap",
      stock: `$${formatCompactNumber(stock.marketCap)}`,
      benchmark: benchmarkStock ? `$${formatCompactNumber(benchmarkStock.marketCap)}` : "—",
      peer: peerStock ? `$${formatCompactNumber(peerStock.marketCap)}` : "—",
    },
    {
      label: "52-wk position",
      stock: `${rangePosition(stock).toFixed(0)}%`,
      benchmark: benchmarkStock ? `${rangePosition(benchmarkStock).toFixed(0)}%` : "—",
      peer: peerStock ? `${rangePosition(peerStock).toFixed(0)}%` : "—",
    },
  ];

  return (
    <section className="mt-8 px-4 lg:px-6">
      <h2 className="text-lg font-semibold text-ink">Insights</h2>
      <p className="mt-1 text-[13px] text-ink-faint">
        Plain-English context on {stock.symbol}'s numbers — for understanding, not investment advice.
      </p>

      {/* Glossary cards */}
      <div className="mt-4 flex flex-col gap-3">
        {insights.map((item) => (
          <div key={item.key} className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-ink-faint">{item.label}</span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-dim">
                {item.badge}
              </span>
            </div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{item.value}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{item.text}</p>
          </div>
        ))}
      </div>

      {/* Comparison */}
      <div className="mt-8">
        <h3 className="text-[15px] font-semibold text-ink">
          How {stock.symbol} compares
        </h3>
        <p className="mt-1 text-[13px] text-ink-faint">
          Normalized % change over {range}, so you can compare shape and magnitude regardless of price.
        </p>

        {peerCandidates.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {peerCandidates.map((p) => (
              <button
                key={p.symbol}
                onClick={() => setPeerSymbol(p.symbol)}
                className={clsx(
                  "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
                  peerSymbol === p.symbol
                    ? "bg-brand-soft text-brand-light"
                    : "bg-surface-2 text-ink-faint hover:text-ink-dim",
                )}
              >
                vs {p.symbol}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <ComparisonChart series={series} height={200} />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border-soft">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-soft bg-surface-2 text-ink-faint">
                <th className="px-3 py-2 font-medium">Metric</th>
                <th className="px-3 py-2 text-right font-medium text-ink">{stock.symbol}</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: BENCHMARK_COLOR }}>
                  {benchmarkStock ? friendlyName(benchmarkStock.symbol) : "—"}
                </th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: PEER_COLOR }}>
                  {peerStock?.symbol ?? "—"}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 1 ? "bg-surface-2/40" : undefined}>
                  <td className="px-3 py-2 text-ink-faint">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{row.stock}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-dim">{row.benchmark}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-dim">{row.peer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-faint">
          {benchmarkStock && (
            <Link to={`/stock/${benchmarkStock.symbol}`} className="hover:text-ink-dim underline decoration-dotted underline-offset-4">
              Open {friendlyName(benchmarkStock.symbol)}
            </Link>
          )}
          {peerStock && (
            <Link to={`/stock/${peerStock.symbol}`} className="hover:text-ink-dim underline decoration-dotted underline-offset-4">
              Open {peerStock.symbol}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
