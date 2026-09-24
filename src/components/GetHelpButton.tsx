import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LifeBuoy, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useSupport } from "../context/SupportContext";
import type { SupportRefType } from "../types";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface GetHelpButtonProps {
  refType: SupportRefType;
  refLabel: string;
  className?: string;
}

export function GetHelpButton({ refType, refLabel, className }: GetHelpButtonProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
        }
      >
        <LifeBuoy size={14} /> {t("support.getHelp")}
      </button>
      <AnimatePresence>
        {open && <GetHelpSheet refType={refType} refLabel={refLabel} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

interface GetHelpSheetProps {
  refType: SupportRefType;
  refLabel: string;
  onClose: () => void;
}

function GetHelpSheet({ refType, refLabel, onClose }: GetHelpSheetProps) {
  const { t } = useLocale();
  const { createTicket } = useSupport();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    const id = createTicket(refType, refLabel, message.trim());
    onClose();
    navigate(`/support/${id}`);
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
        className="relative z-10 flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-[15px] font-semibold text-ink">{t("support.newRequestTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{t("support.about")}</div>
            <div className="mt-0.5 text-[14px] font-medium text-ink">{refLabel}</div>
          </div>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("support.messagePlaceholder")}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          <motion.button
            disabled={!message.trim()}
            onClick={handleSend}
            whileTap={message.trim() ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={`w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer ${
              message.trim()
                ? "brand-gradient brand-glow text-white hover:brightness-110"
                : "bg-surface-3 text-ink-faint cursor-not-allowed"
            }`}
          >
            {t("support.send")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
