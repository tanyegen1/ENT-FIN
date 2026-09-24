import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";
import { useLocale } from "../context/LocaleContext";

interface InfoTipProps {
  definition: ReactNode;
  width?: number;
}

/** Small "what does this mean?" trigger that pops a plain-English definition. */
export function InfoTip({ definition, width = 224 }: InfoTipProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={t("common.whatDoesThisMean")}
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint hover:text-brand-light cursor-pointer"
      >
        <Info size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ width }}
              className="absolute left-0 top-6 z-50 rounded-xl border border-border-soft bg-surface-3 px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim shadow-lg"
            >
              {definition}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}
