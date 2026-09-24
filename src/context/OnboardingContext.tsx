import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccountMode } from "../types";

export type Experience = "new" | "experienced";
export type Goal = "explore" | "regular" | "manage";

export interface OnboardingProfile {
  experience: Experience | null;
  goal: Goal | null;
  mode: AccountMode;
  tipsDismissed: boolean;
}

interface OnboardingContextValue {
  completed: boolean;
  profile: OnboardingProfile;
  complete: (answers: { experience: Experience | null; goal: Goal | null; mode: AccountMode }) => void;
  dismissTips: () => void;
}

const STORAGE_KEY = "arvo.onboarding.v1";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const EMPTY_PROFILE: OnboardingProfile = {
  experience: null,
  goal: null,
  mode: "empty",
  tipsDismissed: false,
};

function load(): { completed: boolean; profile: OnboardingProfile } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
      return {
        completed: true,
        profile: {
          experience: parsed.experience ?? null,
          goal: parsed.goal ?? null,
          mode: parsed.mode === "sample" ? "sample" : "empty",
          tipsDismissed: !!parsed.tipsDismissed,
        },
      };
    }
  } catch {
    // ignore corrupted storage
  }
  return { completed: false, profile: EMPTY_PROFILE };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [{ completed, profile }, setState] = useState(load);

  const persist = useCallback((next: OnboardingProfile) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — onboarding will simply re-run next visit
    }
  }, []);

  const complete = useCallback(
    (answers: { experience: Experience | null; goal: Goal | null; mode: AccountMode }) => {
      const next: OnboardingProfile = { ...answers, tipsDismissed: false };
      persist(next);
      setState({ completed: true, profile: next });
    },
    [persist],
  );

  const dismissTips = useCallback(() => {
    setState((prev) => {
      const next = { ...prev.profile, tipsDismissed: true };
      persist(next);
      return { completed: prev.completed, profile: next };
    });
  }, [persist]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ completed, profile, complete, dismissTips }),
    [completed, profile, complete, dismissTips],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
