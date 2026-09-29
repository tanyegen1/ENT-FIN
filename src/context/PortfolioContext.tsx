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
import type {
  AccountMode,
  Holding,
  OrderRecord,
  PriceRuleDuration,
  PriceRuleOrder,
  PriceRuleOrderType,
  TransferRecord,
} from "../types";
import { EMPTY_START_CASH, INITIAL_CASH, INITIAL_HOLDINGS, INITIAL_WATCHLIST } from "../data/portfolio";
import { getStock } from "../data/stocks";
import { getLiveStock, startLiveQuotes, useLiveQuotes } from "../data/liveQuotes";
import { useAuth } from "./AuthContext";
import { useOnboarding } from "./OnboardingContext";
import { useLocale } from "./LocaleContext";
import { useNotifications } from "./NotificationsContext";
import { createPortfolio, fetchPortfolio, savePortfolio } from "../lib/portfolioService";
import { formatCurrency, formatShares } from "../lib/format";
import { Logo } from "../components/Logo";
import {
  computeReservation,
  processOrderTick,
  sumReservedCash,
  sumReservedShares,
} from "../lib/practiceOrders/engine";
import { endOfCurrentOrNextSession, sessionCloseOn } from "../lib/marketClock";

const STORAGE_KEY = "arvo.portfolio.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PersistedState {
  cash: number;
  holdings: Holding[];
  watchlist: string[];
  orders: OrderRecord[];
  transfers: TransferRecord[];
  priceRules: PriceRuleOrder[];
}

export type SyncStatus = "local" | "saving" | "synced" | "error";

export interface CreatePriceRuleInput {
  symbol: string;
  side: "buy" | "sell";
  orderType: PriceRuleOrderType;
  targetPrice: number;
  quantity: number;
  duration: PriceRuleDuration;
  /** Required when duration === "date". */
  untilDate?: Date;
}

export type CreatePriceRuleError =
  | "invalid-quantity"
  | "invalid-price"
  | "insufficient-funds"
  | "insufficient-shares";

export type CreatePriceRuleResult = { ok: true; id: string } | { ok: false; error: CreatePriceRuleError };

interface PortfolioContextValue extends PersistedState {
  buy: (symbol: string, shares: number, price: number) => void;
  sell: (symbol: string, shares: number, price: number) => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  resetPortfolio: (startingCash?: number) => void;
  toggleWatchlist: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  getHolding: (symbol: string) => Holding | undefined;
  equityValue: number;
  totalValue: number;
  /** Cash held back by pending ("Waiting for price" / "Triggered") buy price rules. */
  reservedCash: number;
  /** Cash minus reservedCash — the actual amount available to invest, place a new buy rule, or withdraw right now. */
  spendableCash: number;
  /** Shares of a symbol available to sell or place a new sell rule against — holdings minus whatever's already reserved by other pending sell rules. */
  availableShares: (symbol: string) => number;
  createPriceRule: (input: CreatePriceRuleInput) => CreatePriceRuleResult;
  cancelPriceRule: (id: string) => void;
  editPriceRule: (id: string, changes: { targetPrice: number; quantity: number }) => CreatePriceRuleResult;
  syncStatus: SyncStatus;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function defaultState(mode: AccountMode, startingCash?: number): PersistedState {
  if (mode === "sample") {
    return {
      cash: startingCash ?? INITIAL_CASH,
      holdings: INITIAL_HOLDINGS,
      watchlist: INITIAL_WATCHLIST,
      orders: [],
      transfers: [],
      priceRules: [],
    };
  }
  return {
    cash: startingCash ?? EMPTY_START_CASH,
    holdings: [],
    watchlist: INITIAL_WATCHLIST,
    orders: [],
    transfers: [],
    priceRules: [],
  };
}

function loadLocal(mode: AccountMode): PersistedState {
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
          priceRules: parsed.priceRules ?? [],
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return defaultState(mode);
}

function resolveExpiry(duration: PriceRuleDuration, untilDate?: Date): number {
  if (duration === "date" && untilDate) return sessionCloseOn(untilDate).getTime();
  return endOfCurrentOrNextSession(new Date()).getTime();
}

function referencePriceFor(symbol: string): number | null {
  const stock = getLiveStock(symbol) ?? getStock(symbol);
  return stock ? stock.price : null;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const { profile } = useOnboarding();
  const { t } = useLocale();
  const { addNotification } = useNotifications();
  const mode = profile.mode;
  const isCloud = status === "signed-in" && !!user;

  const [state, setState] = useState<PersistedState>(() => (isCloud ? defaultState(mode) : loadLocal(mode)));
  const [loaded, setLoaded] = useState(!isCloud);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isCloud ? "saving" : "local");
  const skipNextSaveRef = useRef(false);
  const processingRef = useRef(false);
  const liveQuotes = useLiveQuotes();

  useEffect(() => {
    startLiveQuotes();
  }, []);

  // Fetch (or create) the signed-in user's cloud portfolio once per session.
  useEffect(() => {
    if (!isCloud || !user) return;
    let cancelled = false;
    let settled = false;
    setLoaded(false);
    setSyncStatus("saving");

    (async () => {
      try {
        const remote = await fetchPortfolio(user.id);
        if (cancelled) return;
        skipNextSaveRef.current = true;
        if (remote) {
          setState({ priceRules: [], ...remote });
          setSyncStatus("synced");
        } else {
          const initial = defaultState(mode);
          setState(initial);
          try {
            await createPortfolio(user.id, initial);
            if (!cancelled) setSyncStatus("synced");
          } catch {
            if (!cancelled) setSyncStatus("error");
          }
        }
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally {
        settled = true;
        if (!cancelled) setLoaded(true);
      }
    })();

    // Absolute fallback: never let a hung request strand the user on a
    // loading screen — fall back to a local, unsynced session instead.
    const timeout = setTimeout(() => {
      if (!settled && !cancelled) {
        skipNextSaveRef.current = true;
        setState(defaultState(mode));
        setSyncStatus("error");
        setLoaded(true);
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when switching cloud users, not on every mode/state change
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
    addNotification(
      "orders",
      t("notifications.orderBoughtTitle"),
      t("notifications.orderBoughtBody", { shares: formatShares(shares), symbol, amount: formatCurrency(shares * price) }),
      `/stock/${symbol}`,
    );
  }, [addNotification, t]);

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
    addNotification(
      "orders",
      t("notifications.orderSoldTitle"),
      t("notifications.orderSoldBody", { shares: formatShares(shares), symbol, amount: formatCurrency(shares * price) }),
      `/stock/${symbol}`,
    );
  }, [addNotification, t]);

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
    addNotification("money", t("notifications.moneyAddedTitle"), t("notifications.moneyAddedBody", { amount: formatCurrency(amount) }), "/account");
  }, [addNotification, t]);

  const withdraw = useCallback((amount: number): boolean => {
    let succeeded = false;
    setState((prev) => {
      const spendable = prev.cash - sumReservedCash(prev.priceRules);
      if (amount <= 0 || amount > spendable + 0.005) return prev;
      succeeded = true;
      const transfer: TransferRecord = {
        id: makeId(),
        type: "withdraw",
        amount,
        timestamp: Date.now(),
      };
      return { ...prev, cash: prev.cash - amount, transfers: [transfer, ...prev.transfers] };
    });
    if (succeeded) {
      addNotification(
        "money",
        t("notifications.moneyWithdrawnTitle"),
        t("notifications.moneyWithdrawnBody", { amount: formatCurrency(amount) }),
        "/account",
      );
    }
    return succeeded;
  }, [addNotification, t]);

  const resetPortfolio = useCallback((startingCash?: number) => {
    setState(defaultState(mode, startingCash));
  }, [mode]);

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

  const availableShares = useCallback(
    (symbol: string) => {
      const held = state.holdings.find((h) => h.symbol === symbol)?.shares ?? 0;
      return Math.max(0, held - sumReservedShares(state.priceRules, symbol));
    },
    [state.holdings, state.priceRules],
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
  const reservedCash = useMemo(() => sumReservedCash(state.priceRules), [state.priceRules]);
  const spendableCash = state.cash - reservedCash;

  // The order processor — deterministic, applied to one order at a time via
  // the pure engine functions in lib/practiceOrders/engine.ts. Runs on every
  // live-quote tick and once right after a new order is created. Declared
  // before createPriceRule (which calls it) so it can be a real dependency
  // rather than a forward reference.
  const processTick = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      setState((prev) => {
        if (prev.priceRules.length === 0) return prev;
        const now = Date.now();
        let changed = false;
        let cash = prev.cash;
        let holdings = prev.holdings;
        const newOrders: OrderRecord[] = [];
        const notify: { title: string; body: string; link: string }[] = [];

        const nextRules = prev.priceRules.map((rule) => {
          if (rule.status !== "waiting" && rule.status !== "triggered") return rule;
          const referencePrice = referencePriceFor(rule.symbol);
          if (referencePrice === null) return rule;

          const { outcome } = processOrderTick({ order: rule, referencePrice, now });

          switch (outcome.kind) {
            case "no-change":
              return rule;
            case "expired": {
              changed = true;
              return { ...rule, status: "expired" as const, expiredAt: now, statusMessage: null };
            }
            case "triggered": {
              changed = true;
              return { ...rule, status: "triggered" as const, triggeredAt: now };
            }
            case "rejected-remainder": {
              changed = true;
              return {
                ...rule,
                status: "rejected" as const,
                rejectedAt: now,
                statusMessage: "gap-insufficient-funds",
              };
            }
            case "filled":
            case "partial": {
              changed = true;
              const fillId = makeId();
              const total = outcome.fillPrice * outcome.filledShares;
              if (rule.side === "buy") {
                cash -= total;
                const existingHolding = holdings.find((h) => h.symbol === rule.symbol);
                if (existingHolding) {
                  const newShares = existingHolding.shares + outcome.filledShares;
                  const newAvgCost = (existingHolding.avgCost * existingHolding.shares + total) / newShares;
                  holdings = holdings.map((h) => (h.symbol === rule.symbol ? { ...h, shares: newShares, avgCost: newAvgCost } : h));
                } else {
                  holdings = [...holdings, { symbol: rule.symbol, shares: outcome.filledShares, avgCost: outcome.fillPrice }];
                }
              } else {
                cash += total;
                const existingHolding = holdings.find((h) => h.symbol === rule.symbol);
                if (existingHolding) {
                  const remaining = existingHolding.shares - outcome.filledShares;
                  holdings =
                    remaining <= 0.000001
                      ? holdings.filter((h) => h.symbol !== rule.symbol)
                      : holdings.map((h) => (h.symbol === rule.symbol ? { ...h, shares: remaining } : h));
                }
              }
              newOrders.push({
                id: fillId,
                symbol: rule.symbol,
                side: rule.side,
                shares: outcome.filledShares,
                price: outcome.fillPrice,
                total,
                timestamp: now,
              });
              notify.push({
                title: rule.side === "buy" ? "notifications.orderBoughtTitle" : "notifications.orderSoldTitle",
                body: rule.side === "buy" ? "notifications.orderBoughtBody" : "notifications.orderSoldBody",
                link: `/stock/${rule.symbol}`,
              });
              const filledQuantity = rule.filledQuantity + outcome.filledShares;
              const fill = { id: fillId, shares: outcome.filledShares, price: outcome.fillPrice, timestamp: now };
              const isDone = outcome.kind === "filled";
              return {
                ...rule,
                status: isDone ? ("filled" as const) : ("partial" as const),
                filledQuantity,
                fills: [...rule.fills, fill],
                filledAt: isDone ? now : rule.filledAt,
                statusMessage: outcome.reason ?? null,
                // A partial fill from a gap gets closed out rather than left
                // waiting for more cash that was never reserved for it.
                ...(outcome.kind === "partial" && outcome.reason === "gap-insufficient-funds"
                  ? { status: "rejected" as const, rejectedAt: now, statusMessage: "gap-insufficient-funds" }
                  : {}),
              };
            }
          }
        });

        if (!changed) return prev;
        for (const n of notify) {
          addNotification("orders", t(n.title), t(n.body), n.link);
        }
        return { ...prev, cash, holdings, orders: [...newOrders, ...prev.orders], priceRules: nextRules };
      });
    } finally {
      processingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addNotification/t are stable enough for this demo poll
  }, [addNotification, t]);

  useEffect(() => {
    processTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check on every live-quote tick
  }, [liveQuotes]);

  const createPriceRule = useCallback(
    (input: CreatePriceRuleInput): CreatePriceRuleResult => {
      if (!Number.isFinite(input.quantity) || input.quantity <= 0 || !Number.isInteger(input.quantity)) {
        return { ok: false, error: "invalid-quantity" };
      }
      if (!Number.isFinite(input.targetPrice) || input.targetPrice <= 0) {
        return { ok: false, error: "invalid-price" };
      }

      const { reservedCash: newReservedCash, reservedShares: newReservedShares } = computeReservation(input);

      // A plain `let` reassigned only inside the setState updater below
      // narrows to `never` at the read site (a TS control-flow quirk with
      // closures) — an object property doesn't have that problem.
      const outcome: { result: CreatePriceRuleResult | null } = { result: null };
      setState((prev) => {
        if (input.side === "buy") {
          const currentlyReserved = sumReservedCash(prev.priceRules);
          const available = prev.cash - currentlyReserved;
          if (newReservedCash > available + 0.005) {
            outcome.result = { ok: false, error: "insufficient-funds" };
            return prev;
          }
        } else {
          const held = prev.holdings.find((h) => h.symbol === input.symbol)?.shares ?? 0;
          const currentlyReserved = sumReservedShares(prev.priceRules, input.symbol);
          const available = held - currentlyReserved;
          if (newReservedShares > available + 0.000001) {
            outcome.result = { ok: false, error: "insufficient-shares" };
            return prev;
          }
        }

        const id = makeId();
        const now = Date.now();
        const rule: PriceRuleOrder = {
          id,
          symbol: input.symbol,
          side: input.side,
          orderType: input.orderType,
          targetPrice: input.targetPrice,
          quantity: input.quantity,
          filledQuantity: 0,
          fills: [],
          status: "waiting",
          createdAt: now,
          duration: input.duration,
          expiresAt: resolveExpiry(input.duration, input.untilDate),
          reservedCash: newReservedCash,
          reservedShares: newReservedShares,
          statusMessage: null,
          triggeredAt: null,
          filledAt: null,
          cancelledAt: null,
          expiredAt: null,
          rejectedAt: null,
        };
        outcome.result = { ok: true, id };
        return { ...prev, priceRules: [rule, ...prev.priceRules] };
      });

      // Give a brand-new order one immediate evaluation against the current
      // price — otherwise an already-actionable order (the user explicitly
      // chose to proceed anyway) would sit idle until the next live-quote
      // tick, which can be up to 45s away or may never fire without a
      // configured live-data key.
      if (outcome.result && outcome.result.ok) {
        processTick();
      }
      return outcome.result ?? { ok: false, error: "invalid-quantity" };
    },
    [processTick],
  );

  const cancelPriceRule = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      priceRules: prev.priceRules.map((r) =>
        r.id === id && (r.status === "waiting" || r.status === "triggered")
          ? { ...r, status: "cancelled", cancelledAt: Date.now() }
          : r,
      ),
    }));
  }, []);

  const editPriceRule = useCallback(
    (id: string, changes: { targetPrice: number; quantity: number }): CreatePriceRuleResult => {
      let existing: PriceRuleOrder | undefined;
      setState((prev) => {
        existing = prev.priceRules.find((r) => r.id === id);
        return prev;
      });
      if (!existing || existing.status !== "waiting") {
        return { ok: false, error: "invalid-quantity" };
      }
      // Cancel the remaining order, then try to create its replacement —
      // if the replacement fails validation, put the original back so an
      // edit can never destroy a still-valid order.
      let created: CreatePriceRuleResult = { ok: false, error: "invalid-quantity" };
      setState((prev) => {
        const withoutOld = prev.priceRules.filter((r) => r.id !== id);
        const reservation = computeReservation({ side: existing!.side, targetPrice: changes.targetPrice, quantity: changes.quantity });
        if (existing!.side === "buy") {
          const available = prev.cash - sumReservedCash(withoutOld);
          if (reservation.reservedCash > available + 0.005) {
            created = { ok: false, error: "insufficient-funds" };
            return prev;
          }
        } else {
          const held = prev.holdings.find((h) => h.symbol === existing!.symbol)?.shares ?? 0;
          const available = held - sumReservedShares(withoutOld, existing!.symbol);
          if (reservation.reservedShares > available + 0.000001) {
            created = { ok: false, error: "insufficient-shares" };
            return prev;
          }
        }
        const newId = makeId();
        const replacement: PriceRuleOrder = {
          ...existing!,
          id: newId,
          targetPrice: changes.targetPrice,
          quantity: changes.quantity,
          reservedCash: reservation.reservedCash,
          reservedShares: reservation.reservedShares,
          createdAt: Date.now(),
        };
        created = { ok: true, id: newId };
        return {
          ...prev,
          priceRules: [
            replacement,
            ...withoutOld.map((r) => (r.id === id ? { ...r, status: "cancelled" as const, cancelledAt: Date.now() } : r)),
          ],
        };
      });
      return created;
    },
    [],
  );

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
    availableShares,
    equityValue,
    totalValue,
    reservedCash,
    spendableCash,
    createPriceRule,
    cancelPriceRule,
    editPriceRule,
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
