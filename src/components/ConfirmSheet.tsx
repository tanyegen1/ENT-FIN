import { motion } from "motion/react";
import { TriangleAlert } from "lucide-react";

interface ConfirmSheetProps {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
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
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-t-3xl border border-border-soft bg-surface px-6 py-6 text-center lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div
          className={
            danger
              ? "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-down-soft"
              : "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2"
          }
        >
          <TriangleAlert size={26} className={danger ? "text-down" : "text-ink-dim"} />
        </div>
        <div>
          <div className="text-lg font-semibold text-ink">{title}</div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-faint">{description}</p>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <motion.button
            onClick={onConfirm}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={
              danger
                ? "w-full rounded-full bg-down py-3.5 text-[15px] font-semibold text-white hover:brightness-110 cursor-pointer"
                : "w-full rounded-full bg-up py-3.5 text-[15px] font-semibold text-black hover:brightness-110 cursor-pointer"
            }
          >
            {confirmLabel}
          </motion.button>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="w-full rounded-full py-3.5 text-[15px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
