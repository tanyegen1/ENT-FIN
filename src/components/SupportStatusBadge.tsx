import { useLocale } from "../context/LocaleContext";
import type { SupportTicket } from "../types";

const STYLES: Record<SupportTicket["status"], string> = {
  open: "bg-brand-soft text-brand-light",
  answered: "bg-up-soft text-up",
  closed: "bg-surface-3 text-ink-faint",
};

export function SupportStatusBadge({ status }: { status: SupportTicket["status"] }) {
  const { t } = useLocale();
  const labels: Record<SupportTicket["status"], string> = {
    open: t("support.statusOpen"),
    answered: t("support.statusAnswered"),
    closed: t("support.statusClosed"),
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STYLES[status]}`}>
      {labels[status]}
    </span>
  );
}
