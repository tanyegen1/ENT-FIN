import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check } from "lucide-react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { PriceTargetSelector } from "./PriceTargetSelector";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const STEP_TRANSITION = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};

export type LessonId = 1 | 2 | 3;
const TOTAL_STEPS = 4; // 3 content steps + 1 check question

interface LessonSheetProps {
  lessonId: LessonId;
  initialStep: number;
  onClose: () => void;
  /** Called when the check question is answered and the user finishes — never affects the real practice account. */
  onComplete: () => void;
  /** Called on every step change so progress can be resumed later, and on Skip. */
  onProgress: (step: number) => void;
}

const MOCK_PRICE = 100;

/**
 * A self-contained, illustrative walkthrough — the "try it" step uses a
 * hypothetical $100 stock and a local draft price, never a real symbol or
 * the practice portfolio, so lessons can never place an order, reserve
 * funds, or affect account state. Rewards attempting the check question,
 * not getting it right — there's no scoring, streak, or time pressure.
 */
export function LessonSheet({ lessonId, initialStep, onClose, onComplete, onProgress }: LessonSheetProps) {
  const { t } = useLocale();
  const [step, setStep] = useState(Math.min(initialStep, TOTAL_STEPS - 1));
  const [draftTarget, setDraftTarget] = useState(lessonId === 2 ? 110 : 90);
  const [answered, setAnswered] = useState<"correct" | "wrong" | null>(null);

  const prefix = `lesson${lessonId}`;
  const side: "buy" | "sell" = lessonId === 2 ? "sell" : "buy";

  const goTo = (next: number) => {
    setStep(next);
    onProgress(next);
  };

  const handleFinish = () => {
    onProgress(TOTAL_STEPS);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[13px] font-semibold text-ink-faint">{t("lessons.stepOf", { step: step + 1, total: TOTAL_STEPS })}</span>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="h-1 bg-surface-2">
          <motion.div
            className="h-full bg-brand"
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>

        <div className="overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...STEP_TRANSITION} className="flex flex-col gap-4 px-4 py-5">
              {step < 3 && (
                <>
                  <h2 className="text-[17px] font-semibold text-ink">{t(`lessons.${prefix}Step${step + 1}Heading`)}</h2>
                  <p className="text-[14px] leading-relaxed text-ink-dim">{t(`lessons.${prefix}Step${step + 1}Body`)}</p>
                  {step === 2 && lessonId !== 3 && (
                    <PriceTargetSelector symbol="DEMO" side={side} currentPrice={MOCK_PRICE} value={draftTarget} onChange={setDraftTarget} />
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="text-[17px] font-semibold text-ink">{t(`lessons.${prefix}CheckQuestion`)}</h2>
                  {!answered ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setAnswered("correct")}
                        className="rounded-2xl border border-border-soft px-4 py-3.5 text-left text-[14px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
                      >
                        {t(`lessons.${prefix}AnswerA`)}
                      </button>
                      <button
                        onClick={() => setAnswered("wrong")}
                        className="rounded-2xl border border-border-soft px-4 py-3.5 text-left text-[14px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
                      >
                        {t(`lessons.${prefix}AnswerB`)}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={clsx(
                        "flex items-start gap-2 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed",
                        answered === "correct" ? "bg-up-soft text-up" : "bg-surface-2 text-ink-dim",
                      )}
                    >
                      {answered === "correct" && <Check size={16} className="mt-0.5 shrink-0" />}
                      <span>
                        {t(
                          (lessonId === 1 && (answered === "correct" ? "lessons.lesson1CheckCorrect" : "lessons.lesson1CheckWrong")) ||
                            (lessonId === 2 && (answered === "correct" ? "lessons.lesson2CheckCorrect" : "lessons.lesson2CheckWrong")) ||
                            (answered === "correct" ? "lessons.lesson3CheckCorrect" : "lessons.lesson3CheckWrong"),
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-border-soft px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-ink-faint hover:bg-surface-2 cursor-pointer"
          >
            {t("lessons.skip")}
          </button>
          <div className="flex-1" />
          {step > 0 && step < 3 && (
            <button
              onClick={() => goTo(step - 1)}
              className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
            >
              {t("lessons.back")}
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => goTo(step + 1)}
              className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 cursor-pointer"
            >
              {t("lessons.next")}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleFinish}
              disabled={!answered}
              className={clsx(
                "rounded-full px-5 py-2.5 text-[13px] font-semibold cursor-pointer",
                answered ? "bg-up text-black hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
              )}
            >
              {t("lessons.finish")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
