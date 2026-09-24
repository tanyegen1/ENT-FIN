import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import type { Goal } from "../context/OnboardingContext";

interface GettingStartedCardProps {
  goal: Goal | null;
  onOpenDeposit: () => void;
  onDismiss: () => void;
}

function ctaFor(goal: Goal | null): { label: string; to?: string } {
  switch (goal) {
    case "regular":
      return { label: "Add practice cash" };
    case "manage":
      return { label: "View your activity", to: "/account" };
    case "explore":
    default:
      return { label: "Explore stocks", to: "/search" };
  }
}

export function GettingStartedCard({ goal, onOpenDeposit, onDismiss }: GettingStartedCardProps) {
  const cta = ctaFor(goal);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-4 mt-4 overflow-hidden lg:mx-6"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border-soft bg-surface-2 px-4 py-3.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-light">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">New here? Quick tips</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
            <span className="font-medium text-ink">Buying power</span> is the practice cash you can trade with, and{" "}
            <span className="font-medium text-ink">portfolio value</span> is that cash plus what your holdings are
            worth right now. Tap any stock to see plain-English stats and buy or sell.
          </p>
          <div className="mt-2.5">
            {cta.to ? (
              <Link
                to={cta.to}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125"
              >
                {cta.label} <ArrowRight size={14} />
              </Link>
            ) : (
              <button
                onClick={onOpenDeposit}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
              >
                {cta.label} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss tips"
          className="text-ink-faint hover:text-ink-dim cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
