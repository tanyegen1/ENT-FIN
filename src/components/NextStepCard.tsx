import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLocale } from "../context/LocaleContext";

interface NextStepCardProps {
  hasCash: boolean;
  onAddMoney: () => void;
}

export function NextStepCard({ hasCash, onAddMoney }: NextStepCardProps) {
  const { t } = useLocale();
  const body = t(hasCash ? "home.nextStepInvestBody" : "home.nextStepDepositBody");
  const cta = t(hasCash ? "home.nextStepInvestCta" : "home.nextStepDepositCta");

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
          <div className="text-[14px] font-semibold text-ink">{t("home.nextStepTitle")}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{body}</p>
          <div className="mt-2.5">
            {hasCash ? (
              <Link
                to="/search"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125"
              >
                {cta} <ArrowRight size={14} />
              </Link>
            ) : (
              <button
                onClick={onAddMoney}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
              >
                {cta} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
