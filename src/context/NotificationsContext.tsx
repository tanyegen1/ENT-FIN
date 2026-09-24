import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NotificationCategory, NotificationItem } from "../types";

const ITEMS_KEY = "arvo.notifications.v1";
const PREFS_KEY = "arvo.notificationPrefs.v1";
const MAX_ITEMS = 50;

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "money",
  "orders",
  "recurring",
  "documents",
  "support",
  "priceAlerts",
];

type Prefs = Record<NotificationCategory, boolean>;

function defaultPrefs(): Prefs {
  return {
    money: true,
    orders: true,
    recurring: true,
    documents: true,
    support: true,
    priceAlerts: true,
  };
}

function loadItems(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return [];
}

function saveItems(items: NotificationItem[]) {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {
    // ignore corrupted storage
  }
  return defaultPrefs();
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: Prefs;
  setPreference: (category: NotificationCategory, enabled: boolean) => void;
  addNotification: (category: NotificationCategory, title: string, body: string, linkTo: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(loadItems);
  const [preferences, setPreferences] = useState<Prefs>(loadPrefs);

  const setPreference = useCallback((category: NotificationCategory, enabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, [category]: enabled };
      savePrefs(next);
      return next;
    });
  }, []);

  const addNotification = useCallback(
    (category: NotificationCategory, title: string, body: string, linkTo: string) => {
      if (!preferences[category]) return;
      setNotifications((prev) => {
        const next = [
          { id: makeId(), category, title, body, timestamp: Date.now(), read: false, linkTo },
          ...prev,
        ].slice(0, MAX_ITEMS);
        saveItems(next);
        return next;
      });
    },
    [preferences],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveItems(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveItems(next);
      return next;
    });
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, preferences, setPreference, addNotification, markRead, markAllRead }),
    [notifications, unreadCount, preferences, setPreference, addNotification, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
