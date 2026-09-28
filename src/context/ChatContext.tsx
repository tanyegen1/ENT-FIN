import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePortfolio } from "./PortfolioContext";
import { useLocale } from "./LocaleContext";
import { useCurrency } from "./CurrencyContext";
import { answerMessage } from "../lib/chatEngine";

const STORAGE_KEY = "arvo.chat.v1";
const REPLY_DELAY_MS = 650;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
  linkTo?: string;
  linkLabel?: string;
}

function loadMessages(): ChatMessage[] {
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

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

interface ChatContextValue {
  messages: ChatMessage[];
  isTyping: boolean;
  hasUnread: boolean;
  sendMessage: (text: string) => void;
  markRead: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const portfolio = usePortfolio();
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = { id: makeId(), sender: "user", text: trimmed, timestamp: Date.now() };
      setMessages((prev) => {
        const next = [...prev, userMessage];
        saveMessages(next);
        return next;
      });
      setIsTyping(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const reply = answerMessage(trimmed, {
          t,
          formatDisplay,
          portfolio: {
            cash: portfolio.cash,
            equityValue: portfolio.equityValue,
            totalValue: portfolio.totalValue,
            spendableCash: portfolio.spendableCash,
            holdings: portfolio.holdings,
            watchlist: portfolio.watchlist,
            transfers: portfolio.transfers,
          },
        });
        const assistantMessage: ChatMessage = {
          id: makeId(),
          sender: "assistant",
          text: reply.text,
          timestamp: Date.now(),
          linkTo: reply.linkTo,
          linkLabel: reply.linkLabel,
        };
        setMessages((prev) => {
          const next = [...prev, assistantMessage];
          saveMessages(next);
          return next;
        });
        setIsTyping(false);
        setHasUnread(true);
      }, REPLY_DELAY_MS);
    },
    [t, formatDisplay, portfolio],
  );

  const markRead = useCallback(() => setHasUnread(false), []);

  const value = useMemo<ChatContextValue>(
    () => ({ messages, isTyping, hasUnread, sendMessage, markRead }),
    [messages, isTyping, hasUnread, sendMessage, markRead],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
