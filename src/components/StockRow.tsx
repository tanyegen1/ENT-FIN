import { Link } from "react-router-dom";
import type { Stock } from "../types";
import { formatCurrencyPrecise, formatShares } from "../lib/format";
import { Sparkline } from "./Sparkline";
import { StockLogo } from "./StockLogo";
import { LiveDot } from "./LiveDot";
import { getPriceHistory } from "../data/priceHistory";
import { isLiveSymbol, useLiveQuotes } from "../data/liveQuotes";
import { usePortfolio } from "../context/PortfolioContext";

interface StockRowProps {
  stock: Stock;
  subtitle?: string;
}

export function StockRow({ stock: baseStock, subtitle }: StockRowProps) {
  const { getHolding } = usePortfolio();
  const holding = getHolding(baseStock.symbol);
  const { quotes } = useLiveQuotes();
  const liveQuote = isLiveSymbol(baseStock.symbol) ? quotes[baseStock.symbol] : undefined;
  const stock = liveQuote ? { ...baseStock, price: liveQuote.price, prevClose: liveQuote.prevClose } : baseStock;
  const change = stock.price - stock.prevClose;
  const positive = change >= 0;
  const history = getPriceHistory(stock.symbol, "1D", liveQuote?.price);

  return (
    <Link
      to={`/stock/${stock.symbol}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 active:bg-surface-2 transition-colors rounded-xl"
    >
      <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          <span className="truncate">{stock.symbol}</span>
          <LiveDot symbol={stock.symbol} />
        </div>
        <div className="truncate text-[13px] text-ink-faint">
          {subtitle ?? (holding ? `${formatShares(holding.shares)} shares` : stock.name)}
        </div>
      </div>
      <div className="shrink-0">
        <Sparkline data={history} positive={positive} width={64} height={28} />
      </div>
      <div className="w-24 shrink-0 text-right">
        <div className="text-[15px] font-medium tabular-nums text-ink">
          {formatCurrencyPrecise(stock.price)}
        </div>
        <div
          className={`text-[13px] tabular-nums font-medium ${positive ? "text-up" : "text-down"}`}
        >
          {positive ? "+" : ""}
          {((change / stock.prevClose) * 100).toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}
