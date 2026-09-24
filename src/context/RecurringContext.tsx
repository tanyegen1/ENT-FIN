import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { RecurringPlan, RecurringRun } from "../types";
import { getStock } from "../data/stocks";
import { getLiveStock } from "../data/liveQuotes";
import { usePortfolio } from "./PortfolioContext";
import { useLocale } from "./LocaleContext";
import { useNotifications } from "./NotificationsContext";
import { formatCurrency } from "../lib/format";

const STORAGE_KEY = "arvo.recurring.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPlans(): RecurringPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return [];
}

function savePlans(plans: RecurringPlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // ignore
  }
}

/** The next date a plan targeting `dayOfMonth` will run, given `from` as "now". */
export function nextRunDate(dayOfMonth: number, from: Date = new Date()): Date {
  const clampedDay = Math.min(dayOfMonth, 28);
  let target = new Date(from.getFullYear(), from.getMonth(), clampedDay);
  if (target <= from) {
    target = new Date(from.getFullYear(), from.getMonth() + 1, clampedDay);
  }
  return target;
}

interface RecurringContextValue {
  plans: RecurringPlan[];
  createPlan: (symbol: string, amount: number, dayOfMonth: number) => string;
  pausePlan: (id: string) => void;
  resumePlan: (id: string) => void;
  cancelPlan: (id: string) => void;
  editPlan: (id: string, amount: number, dayOfMonth: number) => void;
  simulateRun: (id: string) => void;
}

const RecurringContext = createContext<RecurringContextValue | null>(null);

export function RecurringProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<RecurringPlan[]>(loadPlans);
  const { spendableCash, buy } = usePortfolio();
  const { t } = useLocale();
  const { addNotification } = useNotifications();

  const createPlan = useCallback((symbol: string, amount: number, dayOfMonth: number) => {
    const id = makeId();
    const plan: RecurringPlan = {
      id,
      symbol,
      amount,
      dayOfMonth,
      status: "active",
      createdAt: Date.now(),
      history: [],
    };
    setPlans((prev) => {
      const next = [plan, ...prev];
      savePlans(next);
      return next;
    });
    return id;
  }, []);

  const pausePlan = useCallback((id: string) => {
    setPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, status: "paused" as const } : p));
      savePlans(next);
      return next;
    });
  }, []);

  const resumePlan = useCallback((id: string) => {
    setPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, status: "active" as const } : p));
      savePlans(next);
      return next;
    });
  }, []);

  const cancelPlan = useCallback((id: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePlans(next);
      return next;
    });
  }, []);

  const editPlan = useCallback((id: string, amount: number, dayOfMonth: number) => {
    setPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, amount, dayOfMonth } : p));
      savePlans(next);
      return next;
    });
  }, []);

  const simulateRun = useCallback(
    (id: string) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return;
      const stock = getLiveStock(plan.symbol) ?? getStock(plan.symbol);
      const price = stock?.price ?? 0;
      const succeeded = price > 0 && plan.amount <= spendableCash + 0.005;
      if (succeeded) {
        buy(plan.symbol, plan.amount / price, price);
      }
      const run: RecurringRun = {
        id: makeId(),
        timestamp: Date.now(),
        status: succeeded ? "success" : "skipped",
        amount: plan.amount,
      };
      setPlans((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, history: [run, ...p.history] } : p));
        savePlans(next);
        return next;
      });
      addNotification(
        "recurring",
        succeeded ? t("notifications.recurringSuccessTitle") : t("notifications.recurringSkippedTitle"),
        succeeded
          ? t("notifications.recurringSuccessBody", { amount: formatCurrency(plan.amount), symbol: plan.symbol })
          : t("notifications.recurringSkippedBody", { amount: formatCurrency(plan.amount), symbol: plan.symbol }),
        "/recurring",
      );
    },
    [plans, spendableCash, buy, addNotification, t],
  );

  const value: RecurringContextValue = {
    plans,
    createPlan,
    pausePlan,
    resumePlan,
    cancelPlan,
    editPlan,
    simulateRun,
  };

  return <RecurringContext.Provider value={value}>{children}</RecurringContext.Provider>;
}

export function useRecurring() {
  const ctx = useContext(RecurringContext);
  if (!ctx) throw new Error("useRecurring must be used within RecurringProvider");
  return ctx;
}
