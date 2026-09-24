import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Briefcase, Compass, LineChart, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { Logo } from "../components/Logo";
import { useOnboarding, type Experience, type Goal } from "../context/OnboardingContext";
import { useLocale } from "../context/LocaleContext";
import type { AccountMode } from "../types";

type Step = 0 | 1 | 2;

const STEP_TRANSITION = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

export function Onboarding() {
  const { complete } = useOnboarding();
  const { t } = useLocale();
  const [step, setStep] = useState<Step>(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const experienceOptions: { value: Experience; label: string; subtitle: string }[] = [
    { value: "experienced", label: t("onboarding.q1ExperiencedLabel"), subtitle: t("onboarding.q1ExperiencedSub") },
    { value: "new", label: t("onboarding.q1NewLabel"), subtitle: t("onboarding.q1NewSub") },
  ];

  const goalOptions: { value: Goal; label: string; subtitle: string; icon: LucideIcon }[] = [
    { value: "explore", label: t("onboarding.q2ExploreLabel"), subtitle: t("onboarding.q2ExploreSub"), icon: Compass },
    { value: "regular", label: t("onboarding.q2RegularLabel"), subtitle: t("onboarding.q2RegularSub"), icon: Repeat },
    {
      value: "manage",
      label: t("onboarding.q2ManageLabel"),
      subtitle: t("onboarding.q2ManageSub"),
      icon: Briefcase,
    },
  ];

  function modeCopy(mode: AccountMode): { title: string; subtitle: string } {
    if (mode === "empty") {
      return {
        title: t("onboarding.emptyTitle"),
        subtitle: t(experience === "new" ? "onboarding.emptySubNew" : "onboarding.emptySubDefault"),
      };
    }
    return {
      title: t("onboarding.sampleTitle"),
      subtitle: t(experience === "new" ? "onboarding.sampleSubNew" : "onboarding.sampleSubDefault"),
    };
  }

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
          <h1 className="text-xl font-semibold text-ink">{t("onboarding.welcome")}</h1>
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
              {t("onboarding.skip")}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step-0" {...STEP_TRANSITION}>
              <h2 className="text-lg font-semibold text-ink">{t("onboarding.q1Title")}</h2>
              <p className="mt-1 text-[13px] text-ink-faint">{t("onboarding.q1Subtitle")}</p>
              <div className="mt-5 flex flex-col gap-3">
                {experienceOptions.map((opt) => (
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
                <ArrowLeft size={14} /> {t("common.back")}
              </button>
              <h2 className="text-lg font-semibold text-ink">{t("onboarding.q2Title")}</h2>
              <p className="mt-1 text-[13px] text-ink-faint">{t("onboarding.q2Subtitle")}</p>
              <div className="mt-5 flex flex-col gap-3">
                {goalOptions.map((opt) => (
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
                <ArrowLeft size={14} /> {t("common.back")}
              </button>
              <h2 className="text-lg font-semibold text-ink">{t("onboarding.q3Title")}</h2>
              <p className="mt-1 text-[13px] text-ink-faint">{t("onboarding.q3Subtitle")}</p>
              <div className="mt-5 flex flex-col gap-3">
                {(["empty", "sample"] as AccountMode[]).map((mode) => {
                  const copy = modeCopy(mode);
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
