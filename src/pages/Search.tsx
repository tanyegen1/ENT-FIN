import { useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { STOCKS, searchStocks } from "../data/stocks";
import { StockRow } from "../components/StockRow";

export function Search() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return STOCKS;
    return searchStocks(query);
  }, [query]);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-app-bg/95 px-4 pb-3 pt-5 backdrop-blur lg:px-6">
        <h1 className="mb-3 text-2xl font-semibold text-ink">Search</h1>
        <div className="flex items-center gap-2 rounded-xl border border-transparent bg-surface-2 px-3 py-2.5 transition-colors has-[input:focus]:border-brand">
          <SearchIcon size={18} className="text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks, ETFs & crypto"
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-ink-faint hover:text-ink cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 pt-2 lg:px-4">
        <h2 className="px-2 pb-1 text-sm font-medium text-ink-faint">
          {query ? `Results for "${query}"` : "Popular"}
        </h2>
        {results.length === 0 && (
          <p className="px-2 py-6 text-sm text-ink-faint">No matches found.</p>
        )}
        {results.map((stock) => (
          <StockRow key={stock.symbol} stock={stock} subtitle={stock.name} />
        ))}
      </div>
    </div>
  );
}
