import { Link } from "react-router-dom";
import { usePortfolio } from "../context/PortfolioContext";
import { getStock } from "../data/stocks";
import { StockRow } from "../components/StockRow";

export function Lists() {
  const { watchlist } = usePortfolio();

  return (
    <div className="pb-8">
      <div className="px-4 pt-5 lg:px-6">
        <h1 className="text-2xl font-semibold text-ink">Lists</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Stocks and crypto you're keeping an eye on.
        </p>
      </div>

      <div className="mt-4 px-2 lg:px-4">
        {watchlist.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-ink-faint">
            Your watchlist is empty.{" "}
            <Link to="/search" className="font-medium text-up">
              Find something to add
            </Link>
            .
          </div>
        )}
        {watchlist.map((symbol) => {
          const stock = getStock(symbol);
          if (!stock) return null;
          return <StockRow key={symbol} stock={stock} subtitle={stock.name} />;
        })}
      </div>
    </div>
  );
}
