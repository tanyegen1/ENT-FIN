import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { useLocale } from "../context/LocaleContext";
import { useLists } from "../context/ListsContext";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

interface CreateListSheetProps {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateListSheet({ onClose, onCreated }: CreateListSheetProps) {
  const { t } = useLocale();
  const { createList } = useLists();
  const [name, setName] = useState("");

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const id = createList(name.trim());
    onCreated?.(id);
    onClose();
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
          <span className="text-[15px] font-semibold text-ink">{t("lists.newListTitle")}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <div className="mb-1.5 text-[13px] text-ink-faint">{t("lists.listNameLabel")}</div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={t("lists.listNamePlaceholder")}
              maxLength={60}
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
          </div>
          <motion.button
            disabled={!canCreate}
            onClick={handleCreate}
            whileTap={canCreate ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold transition-all cursor-pointer",
              canCreate
                ? "brand-gradient brand-glow text-white hover:brightness-110"
                : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {t("lists.createList")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
