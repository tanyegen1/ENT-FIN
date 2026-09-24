import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PriceAlert } from "../types";
import { getLiveStock, useLiveQuotes } from "../data/liveQuotes";
import { getStock } from "../data/stocks";
import { useLocale } from "./LocaleContext";
import { useNotifications } from "./NotificationsContext";
import { formatCurrencyPrecise } from "../lib/format";

const STORAGE_KEY = "arvo.priceAlerts.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadAlerts(): PriceAlert[] {
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

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore
  }
}

interface PriceAlertsContextValue {
  alerts: PriceAlert[];
  createAlert: (symbol: string, direction: "above" | "below", targetPrice: number) => string;
  deleteAlert: (id: string) => void;
  alertsFor: (symbol: string) => PriceAlert[];
}

const PriceAlertsContext = createContext<PriceAlertsContextValue | null>(null);

export function PriceAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts);
  const { t } = useLocale();
  const { addNotification } = useNotifications();
  const liveQuotes = useLiveQuotes();

  // Re-check every pending alert whenever the live-quote store ticks.
  useEffect(() => {
    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((alert) => {
        if (alert.triggeredAt) return alert;
        const stock = getLiveStock(alert.symbol) ?? getStock(alert.symbol);
        if (!stock) return alert;
        const hit = alert.direction === "above" ? stock.price >= alert.targetPrice : stock.price <= alert.targetPrice;
        if (!hit) return alert;
        changed = true;
        addNotification(
          "priceAlerts",
          t("notifications.priceAlertTitle", { symbol: alert.symbol }),
          alert.direction === "above"
            ? t("notifications.priceAlertAboveBody", { symbol: alert.symbol, price: formatCurrencyPrecise(alert.targetPrice) })
            : t("notifications.priceAlertBelowBody", { symbol: alert.symbol, price: formatCurrencyPrecise(alert.targetPrice) }),
          `/stock/${alert.symbol}`,
        );
        return { ...alert, triggeredAt: Date.now() };
      });
      if (!changed) return prev;
      saveAlerts(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check on every live-quote tick; addNotification/t are stable for this demo poll
  }, [liveQuotes]);

  const createAlert = useCallback((symbol: string, direction: "above" | "below", targetPrice: number) => {
    const id = makeId();
    const alert: PriceAlert = { id, symbol, direction, targetPrice, createdAt: Date.now(), triggeredAt: null };
    setAlerts((prev) => {
      const next = [alert, ...prev];
      saveAlerts(next);
      return next;
    });
    return id;
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAlerts(next);
      return next;
    });
  }, []);

  const alertsFor = useCallback((symbol: string) => alerts.filter((a) => a.symbol === symbol), [alerts]);

  const value: PriceAlertsContextValue = { alerts, createAlert, deleteAlert, alertsFor };

  return <PriceAlertsContext.Provider value={value}>{children}</PriceAlertsContext.Provider>;
}

export function usePriceAlerts() {
  const ctx = useContext(PriceAlertsContext);
  if (!ctx) throw new Error("usePriceAlerts must be used within PriceAlertsProvider");
  return ctx;
}
