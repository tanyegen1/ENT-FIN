import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Holding, OrderRecord } from "../types";
import { INITIAL_CASH, INITIAL_HOLDINGS, INITIAL_WATCHLIST } from "../data/portfolio";
import { getStock } from "../data/stocks";
import { getLiveStock, startLiveQuotes, useLiveQuotes } from "../data/liveQuotes";

const STORAGE_KEY = "pulse.portfolio.v1";

interface PersistedState {
  cash: number;
  holdings: Holding[];
  watchlist: string[];
  orders: OrderRecord[];
}

interface PortfolioContextValue extends PersistedState {
  buy: (symbol: string, shares: number, price: number) => void;
  sell: (symbol: string, shares: number, price: number) => void;
  toggleWatchlist: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  getHolding: (symbol: string) => Holding | undefined;
  equityValue: number;
  totalValue: number;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function loadInitial(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && Array.isArray(parsed.holdings)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return {
    cash: INITIAL_CASH,
    holdings: INITIAL_HOLDINGS,
    watchlist: INITIAL_WATCHLIST,
    orders: [],
  };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitial);
  const liveQuotes = useLiveQuotes();

  useEffect(() => {
    startLiveQuotes();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [state]);

  const buy = useCallback((symbol: string, shares: number, price: number) => {
    setState((prev) => {
      const total = shares * price;
      if (total > prev.cash + 0.005) return prev;
      const existing = prev.holdings.find((h) => h.symbol === symbol);
      let holdings: Holding[];
      if (existing) {
        const newShares = existing.shares + shares;
        const newAvgCost =
          (existing.avgCost * existing.shares + total) / newShares;
        holdings = prev.holdings.map((h) =>
          h.symbol === symbol ? { ...h, shares: newShares, avgCost: newAvgCost } : h,
        );
      } else {
        holdings = [...prev.holdings, { symbol, shares, avgCost: price }];
      }
      const order: OrderRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        symbol,
        side: "buy",
        shares,
        price,
        total,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        cash: prev.cash - total,
        holdings,
        orders: [order, ...prev.orders],
      };
    });
  }, []);

  const sell = useCallback((symbol: string, shares: number, price: number) => {
    setState((prev) => {
      const existing = prev.holdings.find((h) => h.symbol === symbol);
      if (!existing || existing.shares < shares - 0.000001) return prev;
      const total = shares * price;
      const remaining = existing.shares - shares;
      const holdings =
        remaining <= 0.000001
          ? prev.holdings.filter((h) => h.symbol !== symbol)
          : prev.holdings.map((h) =>
              h.symbol === symbol ? { ...h, shares: remaining } : h,
            );
      const order: OrderRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        symbol,
        side: "sell",
        shares,
        price,
        total,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        cash: prev.cash + total,
        holdings,
        orders: [order, ...prev.orders],
      };
    });
  }, []);

  const toggleWatchlist = useCallback((symbol: string) => {
    setState((prev) => ({
      ...prev,
      watchlist: prev.watchlist.includes(symbol)
        ? prev.watchlist.filter((s) => s !== symbol)
        : [...prev.watchlist, symbol],
    }));
  }, []);

  const isWatched = useCallback(
    (symbol: string) => state.watchlist.includes(symbol),
    [state.watchlist],
  );

  const getHolding = useCallback(
    (symbol: string) => state.holdings.find((h) => h.symbol === symbol),
    [state.holdings],
  );

  const equityValue = useMemo(
    () =>
      state.holdings.reduce((sum, h) => {
        const stock = getLiveStock(h.symbol) ?? getStock(h.symbol);
        return sum + (stock ? stock.price * h.shares : 0);
      }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveQuotes triggers recompute on each poll
    [state.holdings, liveQuotes],
  );

  const totalValue = equityValue + state.cash;

  const value: PortfolioContextValue = {
    ...state,
    buy,
    sell,
    toggleWatchlist,
    isWatched,
    getHolding,
    equityValue,
    totalValue,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
