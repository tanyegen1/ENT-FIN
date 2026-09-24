import { useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { usePortfolio } from "../context/PortfolioContext";
import { STOCKS, searchStocks, stocksByCategory, suggestStocks } from "../data/stocks";
import { StockRow } from "../components/StockRow";
import type { AssetCategory, Stock } from "../types";

const RECENT_KEY = "arvo.recentSearches";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // ignore corrupted storage
  }
  return [];
}

function saveRecent(symbols: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(symbols));
  } catch {
    // storage unavailable — recents just won't persist
  }
}

const CATEGORY_ORDER: AssetCategory[] = ["stock", "fund", "crypto"];

export function Search() {
  const { t } = useLocale();
  const { watchlist } = usePortfolio();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const results = useMemo(() => (query.trim() ? searchStocks(query) : []), [query]);
  const suggestions = useMemo(
    () => (query.trim() && results.length === 0 ? suggestStocks(query) : []),
    [query, results],
  );

  const recordRecent = (symbol: string) => {
    setRecent((prev) => {
      const next = [symbol, ...prev.filter((s) => s !== symbol)].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecent([]);
  };

  const recentStocks = recent
    .map((sym) => STOCKS.find((s) => s.symbol === sym))
    .filter((s): s is Stock => !!s);

  const categoryLabels: Record<AssetCategory, { title: string; desc: string }> = {
    stock: { title: t("search.categoryStock"), desc: t("search.categoryStockDesc") },
    fund: { title: t("search.categoryFund"), desc: t("search.categoryFundDesc") },
    crypto: { title: t("search.categoryCrypto"), desc: t("search.categoryCryptoDesc") },
  };

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-app-bg/95 px-4 pb-3 pt-5 backdrop-blur lg:px-6">
        <h1 className="mb-3 text-2xl font-semibold text-ink">{t("search.title")}</h1>
        <div className="flex items-center gap-2 rounded-xl border border-transparent bg-surface-2 px-3 py-2.5 transition-colors has-[input:focus]:border-brand">
          <SearchIcon size={18} className="text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-ink-faint hover:text-ink cursor-pointer"
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {query.trim() ? (
        <div className="px-2 pt-2 lg:px-4">
          {results.length > 0 ? (
            <>
              <h2 className="px-2 pb-1 text-sm font-medium text-ink-faint">
                {t("search.resultsHeading", { query })}
              </h2>
              {results.map((stock) => (
                <StockRow
                  key={stock.symbol}
                  stock={stock}
                  subtitle={stock.name}
                  onClick={() => recordRecent(stock.symbol)}
                />
              ))}
            </>
          ) : (
            <div className="px-2 py-8 text-center">
              <div className="text-[15px] font-semibold text-ink">
                {t("search.noResultsTitle", { query })}
              </div>
              <p className="mt-1.5 px-4 text-[13px] text-ink-faint">{t("search.noResultsHint")}</p>
              {suggestions.length > 0 && (
                <div className="mt-6 text-left">
                  <h3 className="px-2 pb-1 text-sm font-medium text-ink-faint">
                    {t("search.noResultsSuggestionsHeading")}
                  </h3>
                  {suggestions.map((stock) => (
                    <StockRow
                      key={stock.symbol}
                      stock={stock}
                      subtitle={stock.name}
                      onClick={() => recordRecent(stock.symbol)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-2 pt-2 lg:px-4">
          {recentStocks.length > 0 && (
            <section className="mb-5">
              <div className="flex items-center justify-between px-2 pb-1">
                <h2 className="text-sm font-medium text-ink-faint">{t("search.recentHeading")}</h2>
                <button
                  onClick={clearRecent}
                  className="text-[12px] font-medium text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink-dim cursor-pointer"
                >
                  {t("search.clearRecent")}
                </button>
              </div>
              {recentStocks.map((stock) => (
                <StockRow
                  key={stock.symbol}
                  stock={stock}
                  subtitle={stock.name}
                  onClick={() => recordRecent(stock.symbol)}
                />
              ))}
            </section>
          )}

          {watchlist.length > 0 && (
            <section className="mb-5">
              <h2 className="px-2 pb-1 text-sm font-medium text-ink-faint">{t("search.savedHeading")}</h2>
              {watchlist.map((symbol) => {
                const stock = STOCKS.find((s) => s.symbol === symbol);
                if (!stock) return null;
                return (
                  <StockRow
                    key={symbol}
                    stock={stock}
                    subtitle={stock.name}
                    onClick={() => recordRecent(symbol)}
                  />
                );
              })}
            </section>
          )}

          {CATEGORY_ORDER.map((category) => {
            const stocks = stocksByCategory(category);
            if (stocks.length === 0) return null;
            const label = categoryLabels[category];
            return (
              <section key={category} className="mb-5">
                <div className="px-2 pb-1">
                  <h2 className="text-sm font-medium text-ink">{label.title}</h2>
                  <p className="text-[12px] text-ink-faint">{label.desc}</p>
                </div>
                {stocks.map((stock) => (
                  <StockRow
                    key={stock.symbol}
                    stock={stock}
                    subtitle={stock.name}
                    onClick={() => recordRecent(stock.symbol)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
