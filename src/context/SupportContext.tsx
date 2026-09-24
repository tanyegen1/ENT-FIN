import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SupportMessage, SupportRefType, SupportTicket } from "../types";
import { useLocale } from "./LocaleContext";
import { useNotifications } from "./NotificationsContext";

const STORAGE_KEY = "arvo.support.v1";
const REPLY_DELAY_MS = 1400;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return [];
}

function saveTickets(tickets: SupportTicket[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    // ignore
  }
}

interface SupportContextValue {
  tickets: SupportTicket[];
  createTicket: (refType: SupportRefType, refLabel: string, message: string) => string;
  addUserMessage: (ticketId: string, text: string) => void;
  getTicket: (id: string) => SupportTicket | undefined;
}

const SupportContext = createContext<SupportContextValue | null>(null);

export function SupportProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { addNotification } = useNotifications();
  const [tickets, setTickets] = useState<SupportTicket[]>(loadTickets);

  const scriptedReplyFor = useCallback(
    (refType: SupportRefType, refLabel: string) => {
      const key =
        refType === "order"
          ? "support.scriptedOrderReply"
          : refType === "transfer"
            ? "support.scriptedTransferReply"
            : "support.scriptedDocumentReply";
      return t(key, { refLabel });
    },
    [t],
  );

  const appendReply = useCallback(
    (ticketId: string, text: string) => {
      const reply: SupportMessage = { id: makeId(), sender: "support", text, timestamp: Date.now() };
      setTickets((prev) => {
        const ticket = prev.find((tk) => tk.id === ticketId);
        const next = prev.map((tk) =>
          tk.id === ticketId ? { ...tk, status: "answered" as const, messages: [...tk.messages, reply] } : tk,
        );
        saveTickets(next);
        if (ticket) {
          addNotification(
            "support",
            t("notifications.supportReplyTitle"),
            t("notifications.supportReplyBody", { refLabel: ticket.refLabel }),
            `/support/${ticketId}`,
          );
        }
        return next;
      });
    },
    [addNotification, t],
  );

  const createTicket = useCallback(
    (refType: SupportRefType, refLabel: string, message: string): string => {
      const id = makeId();
      const userMessage: SupportMessage = { id: makeId(), sender: "user", text: message, timestamp: Date.now() };
      const ticket: SupportTicket = {
        id,
        refType,
        refLabel,
        status: "open",
        createdAt: Date.now(),
        messages: [userMessage],
      };
      setTickets((prev) => {
        const next = [ticket, ...prev];
        saveTickets(next);
        return next;
      });
      setTimeout(() => appendReply(id, scriptedReplyFor(refType, refLabel)), REPLY_DELAY_MS);
      return id;
    },
    [appendReply, scriptedReplyFor],
  );

  const addUserMessage = useCallback(
    (ticketId: string, text: string) => {
      const userMessage: SupportMessage = { id: makeId(), sender: "user", text, timestamp: Date.now() };
      setTickets((prev) => {
        const next = prev.map((tk) =>
          tk.id === ticketId ? { ...tk, status: "open" as const, messages: [...tk.messages, userMessage] } : tk,
        );
        saveTickets(next);
        return next;
      });
      setTimeout(() => appendReply(ticketId, t("support.scriptedFollowUp")), REPLY_DELAY_MS);
    },
    [appendReply, t],
  );

  const getTicket = useCallback((id: string) => tickets.find((tk) => tk.id === id), [tickets]);

  const value = useMemo<SupportContextValue>(
    () => ({ tickets, createTicket, addUserMessage, getTicket }),
    [tickets, createTicket, addUserMessage, getTicket],
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error("useSupport must be used within SupportProvider");
  return ctx;
}
