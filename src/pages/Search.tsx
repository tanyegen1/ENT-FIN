import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { usePortfolio } from "../context/PortfolioContext";
import { STOCKS, searchStocks, stocksByCategory, suggestStocks } from "../data/stocks";
import { StockRow } from "../components/StockRow";
import { CatalogueStockRow } from "../components/CatalogueStockRow";
import {
  fetchCatalogueQuotes,
  isCatalogueConfigured,
  searchCatalogue,
  type CatalogueExchangeFilter,
} from "../data/catalogService";
import type { AssetCategory, CatalogueInstrument, CatalogueQuote, Stock } from "../types";

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

const CATALOGUE_PAGE_LIMIT = 20;
const EXCHANGE_FILTERS: CatalogueExchangeFilter[] = ["ALL", "XNAS", "XNYS"];

/**
 * Server-side, debounced Nasdaq/NYSE catalogue search (spec section 4) —
 * resets to the first page on every new query/exchange filter. Quotes are
 * fetched once per loaded page, in one batch call, for exactly the rows
 * about to render — never one request per instrument, and never for
 * instruments not currently visible.
 */
function useCatalogueSearch(query: string, exchange: CatalogueExchangeFilter) {
  const [instruments, setInstruments] = useState<CatalogueInstrument[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [quotes, setQuotes] = useState<Record<string, CatalogueQuote | null>>({});

  useEffect(() => {
    if (!isCatalogueConfigured || !query.trim()) {
      setInstruments([]);
      setHasMore(false);
      setOffset(0);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const result = await searchCatalogue(query, exchange, CATALOGUE_PAGE_LIMIT, 0);
      if (cancelled || !result) return;
      setInstruments(result.instruments);
      setHasMore(result.hasMore);
      setOffset(result.instruments.length);
      if (result.instruments.length > 0) {
        const q = await fetchCatalogueQuotes(result.instruments.map((i) => i.ticker));
        if (!cancelled) setQuotes((prev) => ({ ...prev, ...q }));
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, exchange]);

  const loadMore = async () => {
    const result = await searchCatalogue(query, exchange, CATALOGUE_PAGE_LIMIT, offset);
    if (!result) return;
    setInstruments((prev) => [...prev, ...result.instruments]);
    setHasMore(result.hasMore);
    setOffset((prev) => prev + result.instruments.length);
    if (result.instruments.length > 0) {
      const q = await fetchCatalogueQuotes(result.instruments.map((i) => i.ticker));
      setQuotes((prev) => ({ ...prev, ...q }));
    }
  };

  return { instruments, hasMore, quotes, loadMore };
}

export function Search() {
  const { t } = useLocale();
  const { watchlist } = usePortfolio();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [exchangeFilter, setExchangeFilter] = useState<CatalogueExchangeFilter>("ALL");

  const results = useMemo(() => (query.trim() ? searchStocks(query) : []), [query]);
  const suggestions = useMemo(
    () => (query.trim() && results.length === 0 ? suggestStocks(query) : []),
    [query, results],
  );

  const catalogue = useCatalogueSearch(query, exchangeFilter);
  const localSymbols = useMemo(() => new Set(results.map((r) => r.symbol)), [results]);
  // Never show the same instrument twice — the curated STOCKS entry (with
  // its richer authored content) takes priority over its catalogue row.
  const catalogueResults = useMemo(
    () => catalogue.instruments.filter((i) => !localSymbols.has(i.ticker)),
    [catalogue.instruments, localSymbols],
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

        {isCatalogueConfigured && (
          <div className="mt-3 flex items-center gap-1.5">
            {EXCHANGE_FILTERS.map((ex) => {
              const label =
                ex === "ALL" ? t("search.catalogueFilterAll") : ex === "XNAS" ? t("search.catalogueFilterNasdaq") : t("search.catalogueFilterNyse");
              const active = exchangeFilter === ex;
              return (
                <button
                  key={ex}
                  onClick={() => setExchangeFilter(ex)}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer transition-colors ${
                    active ? "bg-brand-soft text-brand-light" : "bg-surface-2 text-ink-faint hover:text-ink-dim"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
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

          {catalogueResults.length > 0 && (
            <section className="mt-6">
              <h2 className="px-2 pb-1 text-sm font-medium text-ink-faint">{t("search.catalogueHeading")}</h2>
              {catalogueResults.map((instrument) => (
                <CatalogueStockRow
                  key={instrument.id}
                  instrument={instrument}
                  quote={catalogue.quotes[instrument.ticker]}
                  onClick={() => recordRecent(instrument.ticker)}
                />
              ))}
              {catalogue.hasMore && (
                <button
                  onClick={catalogue.loadMore}
                  className="mx-2 mt-2 rounded-full border border-dashed border-border px-4 py-2 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
                >
                  {t("search.catalogueLoadMore")}
                </button>
              )}
            </section>
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
