import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import type { PriceRuleOrderType } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface RulePreviewProps {
  symbol: string;
  orderType: PriceRuleOrderType;
  targetPrice: number;
  currentPrice: number;
  onClose: () => void;
}

/**
 * A read-only "what could happen" walkthrough shown before submitting a
 * price rule. Purely illustrative — it never calls any context mutation,
 * never touches cash/holdings, and closing it is the only thing it does.
 */
export function RulePreview({ symbol, orderType, targetPrice, currentPrice, onClose }: RulePreviewProps) {
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const reduceMotion = useReducedMotion();
  const isStop = orderType === "buy-stop" || orderType === "sell-stop";
  const priceLabel = formatDisplay(targetPrice, { precise: true });

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
        className="relative z-10 flex max-h-[92svh] w-full max-w-[480px] flex-col overflow-y-auto rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">{t("priceRules.previewTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <span className="text-ink-faint">{t("priceRules.selectorCurrentPrice")}</span>
            <span className="font-semibold tabular-nums text-ink">{formatDisplay(currentPrice, { precise: true })}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-faint">{t("priceRules.previewNote")}</p>

          <ScenarioCard
            label={t("priceRules.previewReachesHeading", { price: priceLabel })}
            body={t(isStop ? "priceRules.previewReachesBodyStop" : "priceRules.previewReachesBodyLimit", { price: priceLabel })}
            kind="reaches"
            reduceMotion={!!reduceMotion}
          />
          <ScenarioCard
            label={t("priceRules.previewNeverHeading", { price: priceLabel })}
            body={t("priceRules.previewNeverBody")}
            kind="never"
            reduceMotion={!!reduceMotion}
          />
          <ScenarioCard
            label={t("priceRules.previewJumpsHeading", { price: priceLabel })}
            body={t(isStop ? "priceRules.previewJumpsBodyStop" : "priceRules.previewJumpsBodyLimit", { price: priceLabel })}
            kind="jumps"
            reduceMotion={!!reduceMotion}
          />

          {isStop && (
            <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
              <div className="text-[12px] font-semibold text-ink">{t("priceRules.previewWorkedExampleTitle")}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{t("priceRules.previewWorkedExampleBody")}</p>
            </div>
          )}
          {!isStop && (
            <p className="text-[12px] leading-relaxed text-ink-faint">{t("priceRules.previewLimitFillNote")}</p>
          )}

          <p className="text-[11px] text-ink-faint">
            {symbol} · {t("priceRules.selectorYourTarget")} {priceLabel}
          </p>

          <button
            onClick={onClose}
            className="w-full rounded-full bg-surface-2 py-3 text-[14px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ScenarioCard({
  label,
  body,
  kind,
  reduceMotion,
}: {
  label: string;
  body: string;
  kind: "reaches" | "never" | "jumps";
  reduceMotion: boolean;
}) {
  const startX = 8;
  const targetX = kind === "never" ? 42 : kind === "jumps" ? 96 : 92;
  const dotAnimate = reduceMotion ? { left: `${targetX}%` } : { left: [`${startX}%`, `${targetX}%`] };
  const transition = reduceMotion
    ? { duration: 0 }
    : kind === "jumps"
      ? { duration: 0.5, ease: "easeIn" as const, delay: 0.3 }
      : { duration: 1.1, ease: "easeInOut" as const };

  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
      <div className="text-[13px] font-semibold text-ink">{label}</div>
      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <div className="absolute top-1/2 left-[92%] h-3 w-px -translate-y-1/2 bg-ink-faint" />
        <AnimatePresence>
          <motion.div
            key={kind}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-brand"
            initial={{ left: `${startX}%` }}
            animate={dotAnimate}
            transition={transition}
          />
        </AnimatePresence>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">{body}</p>
    </div>
  );
}
