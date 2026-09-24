import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { SupportStatusBadge } from "../components/SupportStatusBadge";
import { useLocale } from "../context/LocaleContext";
import { useSupport } from "../context/SupportContext";

export function SupportInbox() {
  const { t, locale } = useLocale();
  const { tickets } = useSupport();

  return (
    <div className="pb-10">
      <PageHeader title={t("support.title")} back />
      <div className="mt-2 px-2 lg:px-4">
        {tickets.length === 0 && <p className="px-2 py-8 text-center text-sm text-ink-faint">{t("support.empty")}</p>}
        <div className="flex flex-col divide-y divide-border-soft">
          {tickets.map((tk) => {
            const lastMessage = tk.messages[tk.messages.length - 1];
            return (
              <Link
                key={tk.id}
                to={`/support/${tk.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
                  <LifeBuoy size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{tk.refLabel}</div>
                  {lastMessage && (
                    <div className="truncate text-[12px] text-ink-faint">{lastMessage.text}</div>
                  )}
                  <div className="text-[11px] text-ink-faint">
                    {new Date(tk.createdAt).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <SupportStatusBadge status={tk.status} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
