import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Goal, GoalContribution } from "../types";
import { usePortfolio } from "./PortfolioContext";

const STORAGE_KEY = "arvo.goals.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadGoals(): Goal[] {
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

function saveGoals(goals: Goal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // ignore
  }
}

interface GoalsContextValue {
  goals: Goal[];
  /** How much $1 contributed to a goal is worth today, blended across the whole portfolio's performance. */
  growthMultiplier: number;
  createGoal: (name: string, targetAmount: number) => string;
  contribute: (goalId: string, amount: number) => void;
  deleteGoal: (goalId: string) => void;
  contributedTotal: (goal: Goal) => number;
  currentValue: (goal: Goal) => number;
}

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const { deposit, holdings, equityValue } = usePortfolio();

  const createGoal = useCallback((name: string, targetAmount: number) => {
    const id = makeId();
    const goal: Goal = { id, name, targetAmount, createdAt: Date.now(), contributions: [] };
    setGoals((prev) => {
      const next = [goal, ...prev];
      saveGoals(next);
      return next;
    });
    return id;
  }, []);

  const contribute = useCallback(
    (goalId: string, amount: number) => {
      if (amount <= 0) return;
      deposit(amount);
      const contribution: GoalContribution = { id: makeId(), amount, timestamp: Date.now() };
      setGoals((prev) => {
        const next = prev.map((g) =>
          g.id === goalId ? { ...g, contributions: [contribution, ...g.contributions] } : g,
        );
        saveGoals(next);
        return next;
      });
    },
    [deposit],
  );

  const deleteGoal = useCallback((goalId: string) => {
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== goalId);
      saveGoals(next);
      return next;
    });
  }, []);

  const costBasis = useMemo(
    () => holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0),
    [holdings],
  );

  // Goal money isn't tracked as a separate invested balance — it becomes part of the
  // whole portfolio's cash. So "how has this goal's money done" is approximated using
  // the portfolio's overall unrealized return ratio (current holdings value vs. what
  // was paid for them), the same figure shown as investment gain/loss elsewhere.
  const growthMultiplier = costBasis > 0.01 ? equityValue / costBasis : 1;

  const contributedTotal = useCallback(
    (goal: Goal) => goal.contributions.reduce((sum, c) => sum + c.amount, 0),
    [],
  );

  const currentValue = useCallback(
    (goal: Goal) => contributedTotal(goal) * growthMultiplier,
    [contributedTotal, growthMultiplier],
  );

  const value: GoalsContextValue = {
    goals,
    growthMultiplier,
    createGoal,
    contribute,
    deleteGoal,
    contributedTotal,
    currentValue,
  };

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error("useGoals must be used within GoalsProvider");
  return ctx;
}
