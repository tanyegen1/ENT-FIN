import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Holding, OrderRecord, TransferRecord } from "../types";
import { INITIAL_CASH, INITIAL_HOLDINGS, INITIAL_WATCHLIST } from "../data/portfolio";
import { getStock } from "../data/stocks";
import { getLiveStock, startLiveQuotes, useLiveQuotes } from "../data/liveQuotes";
import { useAuth } from "./AuthContext";
import { createPortfolio, fetchPortfolio, savePortfolio } from "../lib/portfolioService";
import { Logo } from "../components/Logo";

const STORAGE_KEY = "pulse.portfolio.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PersistedState {
  cash: number;
  holdings: Holding[];
  watchlist: string[];
  orders: OrderRecord[];
  transfers: TransferRecord[];
}

export type SyncStatus = "local" | "saving" | "synced" | "error";

interface PortfolioContextValue extends PersistedState {
  buy: (symbol: string, shares: number, price: number) => void;
  sell: (symbol: string, shares: number, price: number) => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  resetPortfolio: () => void;
  toggleWatchlist: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  getHolding: (symbol: string) => Holding | undefined;
  equityValue: number;
  totalValue: number;
  syncStatus: SyncStatus;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function defaultState(): PersistedState {
  return {
    cash: INITIAL_CASH,
    holdings: INITIAL_HOLDINGS,
    watchlist: INITIAL_WATCHLIST,
    orders: [],
    transfers: [],
  };
}

function loadLocal(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed && Array.isArray(parsed.holdings)) {
        return {
          cash: parsed.cash ?? INITIAL_CASH,
          holdings: parsed.holdings,
          watchlist: parsed.watchlist ?? INITIAL_WATCHLIST,
          orders: parsed.orders ?? [],
          transfers: parsed.transfers ?? [],
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return defaultState();
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const isCloud = status === "signed-in" && !!user;

  const [state, setState] = useState<PersistedState>(() => (isCloud ? defaultState() : loadLocal()));
  const [loaded, setLoaded] = useState(!isCloud);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isCloud ? "saving" : "local");
  const skipNextSaveRef = useRef(false);
  const liveQuotes = useLiveQuotes();

  useEffect(() => {
    startLiveQuotes();
  }, []);

  // Fetch (or create) the signed-in user's cloud portfolio once per session.
  useEffect(() => {
    if (!isCloud || !user) return;
    let cancelled = false;
    setLoaded(false);
    setSyncStatus("saving");

    (async () => {
      const remote = await fetchPortfolio(user.id);
      if (cancelled) return;
      skipNextSaveRef.current = true;
      if (remote) {
        setState(remote);
        setSyncStatus("synced");
      } else {
        const initial = defaultState();
        setState(initial);
        try {
          await createPortfolio(user.id, initial);
          if (!cancelled) setSyncStatus("synced");
        } catch {
          if (!cancelled) setSyncStatus("error");
        }
      }
      if (!cancelled) setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when switching cloud users
  }, [isCloud, user?.id]);

  // Persist on every change — cloud upsert for signed-in users, localStorage for guests.
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (isCloud && user) {
      setSyncStatus("saving");
      savePortfolio(user.id, state)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage unavailable — ignore
      }
    }
  }, [state, isCloud, user, loaded]);

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
        id: makeId(),
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
        id: makeId(),
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

  const deposit = useCallback((amount: number) => {
    if (amount <= 0) return;
    setState((prev) => {
      const transfer: TransferRecord = {
        id: makeId(),
        type: "deposit",
        amount,
        timestamp: Date.now(),
      };
      return { ...prev, cash: prev.cash + amount, transfers: [transfer, ...prev.transfers] };
    });
  }, []);

  const withdraw = useCallback((amount: number): boolean => {
    let succeeded = false;
    setState((prev) => {
      if (amount <= 0 || amount > prev.cash + 0.005) return prev;
      succeeded = true;
      const transfer: TransferRecord = {
        id: makeId(),
        type: "withdraw",
        amount,
        timestamp: Date.now(),
      };
      return { ...prev, cash: prev.cash - amount, transfers: [transfer, ...prev.transfers] };
    });
    return succeeded;
  }, []);

  const resetPortfolio = useCallback(() => {
    setState(defaultState());
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
    deposit,
    withdraw,
    resetPortfolio,
    toggleWatchlist,
    isWatched,
    getHolding,
    equityValue,
    totalValue,
    syncStatus,
  };

  if (!loaded) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-app-bg">
        <Logo size={32} />
      </div>
    );
  }

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
