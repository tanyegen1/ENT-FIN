import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { SupportStatusBadge } from "../components/SupportStatusBadge";
import { useLocale } from "../context/LocaleContext";
import { useSupport } from "../context/SupportContext";

export function SupportThread() {
  const { id = "" } = useParams();
  const { t, locale } = useLocale();
  const { getTicket, addUserMessage } = useSupport();
  const ticket = getTicket(id);
  const [text, setText] = useState("");

  if (!ticket) return <Navigate to="/support" replace />;

  const handleSend = () => {
    if (!text.trim()) return;
    addUserMessage(ticket.id, text.trim());
    setText("");
  };

  return (
    <div className="pb-32">
      <PageHeader title={ticket.refLabel} back right={<SupportStatusBadge status={ticket.status} />} />

      <div className="flex flex-col gap-3 px-4 py-4 lg:px-6">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`flex max-w-[85%] flex-col rounded-2xl px-3.5 py-2.5 ${
              m.sender === "user" ? "self-end bg-brand text-white" : "self-start bg-surface-2 text-ink"
            }`}
          >
            <div className="text-[11px] font-medium opacity-70">
              {m.sender === "user" ? t("support.you") : t("support.arvoSupport")}
            </div>
            <div className="mt-0.5 text-[14px] leading-relaxed">{m.text}</div>
            <div className={`mt-1 text-[10px] ${m.sender === "user" ? "text-white/70" : "text-ink-faint"}`}>
              {new Date(m.timestamp).toLocaleTimeString(locale === "tr" ? "tr-TR" : undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-[1100px] gap-2 border-t border-border-soft bg-app-bg/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:mt-4 lg:rounded-2xl lg:border lg:px-6">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={t("support.replyPlaceholder")}
          className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label={t("support.send")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:bg-surface-3 disabled:text-ink-faint cursor-pointer"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
