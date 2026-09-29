import { MessageCircleQuestion } from "lucide-react";
import { useChat } from "../context/ChatContext";
import { useLocale } from "../context/LocaleContext";
import type { PriceRuleOrder } from "../types";

interface ExplainRuleButtonProps {
  order: PriceRuleOrder;
  className?: string;
}

/** Opens the existing (scripted, non-AI) chat assistant with a deterministic explanation of this one order's mechanics. Never submits, edits, or cancels it. */
export function ExplainRuleButton({ order, className }: ExplainRuleButtonProps) {
  const { t } = useLocale();
  const { explainRule } = useChat();

  return (
    <button
      onClick={() => explainRule(order)}
      className={
        className ??
        "flex items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-2 text-[12px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
      }
    >
      <MessageCircleQuestion size={14} />
      {t("priceRules.explainThisRule")}
    </button>
  );
}
