import { Link, useNavigate } from "react-router-dom";
import {
  Banknote,
  Bell,
  FileText,
  MessageCircle,
  Repeat,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocale } from "../context/LocaleContext";
import { useNotifications, NOTIFICATION_CATEGORIES } from "../context/NotificationsContext";
import { usePriceAlerts } from "../context/PriceAlertsContext";
import { formatCurrencyPrecise } from "../lib/format";
import type { NotificationCategory } from "../types";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  money: Banknote,
  orders: ShoppingCart,
  recurring: Repeat,
  documents: FileText,
  support: MessageCircle,
  priceAlerts: Bell,
};

const CATEGORY_LABEL_KEY: Record<NotificationCategory, string> = {
  money: "notifications.categoryMoney",
  orders: "notifications.categoryOrders",
  recurring: "notifications.categoryRecurring",
  documents: "notifications.categoryDocuments",
  support: "notifications.categorySupport",
  priceAlerts: "notifications.categoryPriceAlerts",
};

export function NotificationsPage() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { notifications, unreadCount, preferences, setPreference, markRead, markAllRead } = useNotifications();
  const { alerts, deleteAlert } = usePriceAlerts();
  const activeAlerts = alerts.filter((a) => !a.triggeredAt);

  const openNotification = (id: string, linkTo: string) => {
    markRead(id);
    navigate(linkTo);
  };

  return (
    <div className="pb-10">
      <PageHeader
        title={t("notifications.title")}
        back
        right={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="text-[13px] font-medium text-brand-light hover:brightness-125 cursor-pointer"
            >
              {t("notifications.markAllRead")}
            </button>
          ) : undefined
        }
      />

      <div className="mt-2 px-2 lg:px-4">
        {notifications.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-ink-faint">{t("notifications.empty")}</p>
        )}
        <div className="flex flex-col divide-y divide-border-soft">
          {notifications.map((n) => {
            const Icon = CATEGORY_ICON[n.category];
            return (
              <button
                key={n.id}
                onClick={() => openNotification(n.id, n.linkTo)}
                className="flex items-start gap-3 px-2 py-3 text-left hover:bg-surface-2 rounded-xl cursor-pointer"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    <span className="text-[14px] font-medium text-ink">{n.title}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-dim">{n.body}</p>
                  <div className="mt-0.5 text-[12px] text-ink-faint">
                    {new Date(n.timestamp).toLocaleString(locale === "tr" ? "tr-TR" : undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("notifications.settingsTitle")}</h2>
        <p className="mt-1 text-[13px] text-ink-faint">{t("notifications.settingsNote")}</p>
        <div className="mt-3 flex flex-col gap-2">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category];
            const enabled = preferences[category];
            return (
              <div key={category} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <Icon size={17} className="text-ink-dim" />
                  <span className="text-[14px] text-ink">{t(CATEGORY_LABEL_KEY[category])}</span>
                </div>
                <div className="relative flex rounded-full bg-surface-3 p-0.5">
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => setPreference(category, val)}
                      className={`relative z-10 rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer ${
                        enabled === val ? "bg-brand-soft text-brand-light" : "text-ink-faint"
                      }`}
                    >
                      {val ? t("notifications.instant") : t("notifications.off")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {activeAlerts.length > 0 && (
        <section className="mt-8 px-4 lg:px-6">
          <h2 className="text-[15px] font-semibold text-ink">{t("priceAlerts.activeHeading")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {activeAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-3">
                <Link to={`/stock/${a.symbol}`} className="text-[14px] text-ink hover:text-brand-light">
                  {a.symbol}{" "}
                  <span className="text-ink-faint">
                    {a.direction === "above" ? t("priceAlerts.directionAbove") : t("priceAlerts.directionBelow")}{" "}
                    {formatCurrencyPrecise(a.targetPrice)}
                  </span>
                </Link>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="text-[12px] font-medium text-down hover:brightness-125 cursor-pointer"
                >
                  {t("priceAlerts.cancel")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
