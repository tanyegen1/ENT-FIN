import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Send, X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useChat } from "../context/ChatContext";
import { Logo } from "./Logo";

const PANEL_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

export function ChatWidget() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { messages, isTyping, hasUnread, sendMessage, markRead } = useChat();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) markRead();
  }, [open, markRead]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, open]);

  const handleSend = (value?: string) => {
    const toSend = value ?? text;
    if (!toSend.trim()) return;
    sendMessage(toSend);
    setText("");
  };

  const quickQuestions = [
    t("chat.quickPortfolio"),
    t("chat.quickBuyingPower"),
    t("chat.quickWhatToBuy"),
    t("chat.quickCompare"),
  ];

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            onClick={() => setOpen(true)}
            aria-label={t("chat.openLabel")}
            aria-expanded={false}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl cursor-pointer lg:bottom-6 lg:right-6"
          >
            <Logo size={30} />
            {hasUnread && <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-up" />}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={PANEL_SPRING}
            className="fixed inset-x-4 bottom-20 top-16 z-50 flex flex-col overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-2xl sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:max-h-[85svh] sm:w-[380px] lg:bottom-6"
          >
            <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                <Logo size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">{t("chat.title")}</div>
                <div className="truncate text-[11px] text-ink-faint">{t("chat.subtitle")}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("chat.closeLabel")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-3">
                {messages.length === 0 && (
                  <>
                    <div className="rounded-2xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-ink-dim">
                      {t("chat.greeting")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickQuestions.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSend(q)}
                          className="rounded-full bg-surface-2 px-3.5 py-2 text-[12px] font-medium text-ink-dim hover:bg-surface-3 cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex max-w-[88%] flex-col rounded-2xl px-3.5 py-2.5 ${
                      m.sender === "user" ? "self-end bg-brand text-white" : "self-start bg-surface-2 text-ink"
                    }`}
                  >
                    <div className="text-[10px] font-medium opacity-70">
                      {m.sender === "user" ? t("chat.you") : t("chat.assistantName")}
                    </div>
                    <div className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed">{m.text}</div>
                    {m.linkTo && (
                      <button
                        onClick={() => {
                          navigate(m.linkTo!);
                          setOpen(false);
                        }}
                        className="mt-2 self-start rounded-full bg-surface-3 px-3 py-1.5 text-[12px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
                      >
                        {m.linkLabel}
                      </button>
                    )}
                    <div className={`mt-1 text-[10px] ${m.sender === "user" ? "text-white/70" : "text-ink-faint"}`}>
                      {new Date(m.timestamp).toLocaleTimeString(locale === "tr" ? "tr-TR" : undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div
                    className="flex max-w-[60%] items-center gap-1 self-start rounded-2xl bg-surface-2 px-3.5 py-3"
                    aria-label={t("chat.typingLabel")}
                  >
                    {[0, 0.15, 0.3].map((delay) => (
                      <motion.span
                        key={delay}
                        className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>


            <div className="flex items-center gap-2 border-t border-border-soft px-4 py-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder={t("chat.inputPlaceholder")}
                className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!text.trim()}
                aria-label={t("chat.send")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:bg-surface-3 disabled:text-ink-faint cursor-pointer"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
