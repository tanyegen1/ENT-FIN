import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Briefcase, Compass, LineChart, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { Logo } from "../components/Logo";
import { useOnboarding, type Experience, type Goal } from "../context/OnboardingContext";
import type { AccountMode } from "../types";

type Step = 0 | 1 | 2;

const EXPERIENCE_OPTIONS: { value: Experience; label: string; subtitle: string }[] = [
  { value: "experienced", label: "Yes, I've invested before", subtitle: "I know my way around buying and selling." },
  { value: "new", label: "No, I'm new to investing", subtitle: "Show me the basics as I go." },
];

const GOAL_OPTIONS: { value: Goal; label: string; subtitle: string; icon: LucideIcon }[] = [
  { value: "explore", label: "Explore investing", subtitle: "Browse stocks and see how markets move.", icon: Compass },
  { value: "regular", label: "Invest regularly", subtitle: "Build a habit of adding cash and buying over time.", icon: Repeat },
  {
    value: "manage",
    label: "Manage an existing portfolio",
    subtitle: "Track and adjust positions you already understand.",
    icon: Briefcase,
  },
];

function modeCopy(mode: AccountMode, experience: Experience | null): { title: string; subtitle: string } {
  if (mode === "empty") {
    return {
      title: "Start an empty practice account",
      subtitle:
        experience === "new"
          ? "Add practice cash and place your first trade when you're ready — a clean slate to learn on."
          : "Add practice cash and build your own positions from scratch.",
    };
  }
  return {
    title: "Explore a sample portfolio",
    subtitle:
      experience === "new"
        ? "Start with a realistic mix of stocks already in place, so you can see how a portfolio works."
        : "Start with a realistic mix of holdings you can trade, tweak, or clear out any time.",
  };
}

const STEP_TRANSITION = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

export function Onboarding() {
  const { complete } = useOnboarding();
  const [step, setStep] = useState<Step>(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const selectExperience = (value: Experience) => {
    setExperience(value);
    setStep(1);
  };

  const selectGoal = (value: Goal) => {
    setGoal(value);
    setStep(2);
  };

  const finish = (mode: AccountMode) => {
    complete({ experience, goal, mode });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-app-bg px-6 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-20 w-20 rounded-full blur-2xl"
              style={{ backgroundColor: "var(--color-brand)", opacity: 0.3 }}
            />
            <Logo size={32} />
          </div>
          <h1 className="text-xl font-semibold text-ink">Welcome to Arvo</h1>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {([0, 1, 2] as Step[]).map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-brand" : i < step ? "w-1.5 bg-brand-light" : "w-1.5 bg-surface-3"
                }`}
              />
            ))}
          </div>
          {step < 2 && (
            <button
              onClick={() => setStep(2)}
              className="text-[13px] font-medium text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink-dim cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step-0" {...STEP_TRANSITION}>
              <h2 className="text-lg font-semibold text-ink">Have you invested before?</h2>
              <p className="mt-1 text-[13px] text-ink-faint">We'll tailor tips and shortcuts to fit.</p>
              <div className="mt-5 flex flex-col gap-3">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    onClick={() => selectExperience(opt.value)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="rounded-2xl border border-border bg-surface-2 px-4 py-4 text-left hover:border-brand cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-ink">{opt.label}</div>
                    <div className="mt-0.5 text-[13px] text-ink-faint">{opt.subtitle}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step-1" {...STEP_TRANSITION}>
              <button
                onClick={() => setStep(0)}
                className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink-faint hover:text-ink-dim cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-lg font-semibold text-ink">What would you like to do?</h2>
              <p className="mt-1 text-[13px] text-ink-faint">Pick what fits best — you can always change course.</p>
              <div className="mt-5 flex flex-col gap-3">
                {GOAL_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    onClick={() => selectGoal(opt.value)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-4 text-left hover:border-brand cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-light">
                      <opt.icon size={19} />
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold text-ink">{opt.label}</div>
                      <div className="mt-0.5 text-[13px] text-ink-faint">{opt.subtitle}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step-2" {...STEP_TRANSITION}>
              <button
                onClick={() => setStep(1)}
                className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink-faint hover:text-ink-dim cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-lg font-semibold text-ink">How do you want to start?</h2>
              <p className="mt-1 text-[13px] text-ink-faint">
                Both are free practice accounts — you can reset yours anytime from Account.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                {(["empty", "sample"] as AccountMode[]).map((mode) => {
                  const copy = modeCopy(mode, experience);
                  const Icon = mode === "empty" ? Wallet : LineChart;
                  return (
                    <motion.button
                      key={mode}
                      onClick={() => finish(mode)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="rounded-2xl border border-border bg-surface-2 px-4 py-4 text-left hover:border-brand cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={18} className="text-brand-light" />
                        <div className="text-[15px] font-semibold text-ink">{copy.title}</div>
                      </div>
                      <div className="mt-1 text-[13px] leading-relaxed text-ink-faint">{copy.subtitle}</div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
