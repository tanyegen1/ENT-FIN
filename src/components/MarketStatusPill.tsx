import { useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CalendarOff,
  CircleSlash,
  HelpCircle,
  Infinity as InfinityIcon,
  Moon,
  Sunrise,
  TrendingUp,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { AssetCategory } from "../types";
import type { SessionStatus, SessionWindow } from "../lib/marketSession";
import { US_EQUITY_TIME_ZONE, formatInZone } from "../lib/marketSession";
import { useMarketSessionState } from "../hooks/useMarketSessionState";
import { useLocale } from "../context/LocaleContext";

interface StatusVisual {
  Icon: typeof Sunrise;
  dot: string;
  bg: string;
  fg: string;
}

// Icon shape carries the meaning as much as color does — never rely on
// color alone (a colorblind user, or a black & white screenshot, still
// gets the right answer from the icon + text).
const VISUALS: Record<SessionStatus, StatusVisual> = {
  "pre-market": { Icon: Sunrise, dot: "bg-brand-light", bg: "bg-brand-soft", fg: "text-brand-light" },
  regular: { Icon: TrendingUp, dot: "bg-session-open", bg: "bg-session-open-soft", fg: "text-session-open" },
  open: { Icon: InfinityIcon, dot: "bg-session-open", bg: "bg-session-open-soft", fg: "text-session-open" },
  "after-hours": { Icon: Moon, dot: "bg-session-after", bg: "bg-session-after-soft", fg: "text-session-after" },
  closed: { Icon: CircleSlash, dot: "bg-ink-faint", bg: "bg-surface-3", fg: "text-ink-dim" },
  holiday: { Icon: CalendarOff, dot: "bg-ink-faint", bg: "bg-surface-3", fg: "text-ink-dim" },
  halted: { Icon: AlertTriangle, dot: "bg-warn", bg: "bg-warn-soft", fg: "text-warn" },
  unavailable: { Icon: HelpCircle, dot: "bg-ink-faint", bg: "bg-surface-3", fg: "text-ink-dim" },
};

export const STATUS_LABEL_KEY: Record<SessionStatus, string> = {
  "pre-market": "marketStatus.preMarket",
  regular: "marketStatus.regular",
  open: "marketStatus.open247",
  "after-hours": "marketStatus.afterHours",
  closed: "marketStatus.closed",
  holiday: "marketStatus.holiday",
  halted: "marketStatus.halted",
  unavailable: "marketStatus.unavailable",
};

function formatDuration(ms: number, t: (path: string, vars?: Record<string, string | number>) => string): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return t("marketStatus.durationLessThanMinute");
  if (totalMinutes < 60) return t("marketStatus.durationMinutes", { minutes: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t("marketStatus.durationHours", { hours, minutes });
}

interface MarketStatusPillProps {
  category: AssetCategory;
  symbol?: string;
  /** Hides the subtext line under the pill — used in tight spaces like a watchlist row. */
  compact?: boolean;
  /** Renders just the icon in a small circle (still tappable, still opens the same popover, still icon+color so it's never color-only with its title attribute) — for a list row too tight for the full text pill. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * The one status pill every screen should use — dashboard, stock page,
 * order forms, watchlist rows. Never invents its own session logic; it's a
 * thin, consistent renderer over useMarketSessionState (which itself reads
 * lib/marketSession.ts, the single source of truth).
 */
export function MarketStatusPill({ category, symbol, compact, iconOnly, className }: MarketStatusPillProps) {
  const { t, locale } = useLocale();
  const session = useMarketSessionState(category, symbol);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const visual = VISUALS[session.status];
  const dateLocale = locale === "tr" ? "tr-TR" : undefined;
  const label = t(STATUS_LABEL_KEY[session.status]);

  const subtext = (() => {
    if (session.status === "halted") return t("marketStatus.haltedReason", { reason: session.haltedReason ?? "" });
    if (session.status === "unavailable") return t("marketStatus.unavailableDetail");
    if (session.status === "open") return t("marketStatus.open247Note");
    if (session.status === "pre-market" && session.nextTransition) {
      return t("marketStatus.opensIn", { duration: formatDuration(session.nextTransition.at - session.asOf, t) });
    }
    if (session.status === "regular" && session.nextTransition) {
      return t("marketStatus.closesIn", { duration: formatDuration(session.nextTransition.at - session.asOf, t) });
    }
    if (session.status === "after-hours") return t("marketStatus.afterHoursNote");
    if ((session.status === "closed" || session.status === "holiday") && session.nextRegularOpen !== null) {
      const when = new Date(session.nextRegularOpen).toLocaleString(dateLocale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      return session.status === "holiday"
        ? t("marketStatus.holidayNextSession", { name: session.holidayName ?? "", when })
        : t("marketStatus.closedNextSession", { when });
    }
    return null;
  })();

  const handleOpen = (e: MouseEvent) => {
    // Stops a parent <Link> (e.g. a watchlist row) from also navigating
    // when this pill is tapped inside it.
    e.preventDefault();
    e.stopPropagation();
    setDetailsOpen(true);
  };

  return (
    <div className={className}>
      {iconOnly ? (
        <button
          onClick={handleOpen}
          title={label}
          aria-label={label}
          aria-haspopup="dialog"
          className={clsx("inline-flex h-5 w-5 items-center justify-center rounded-full cursor-pointer", visual.bg, visual.fg)}
        >
          <visual.Icon size={11} strokeWidth={2.25} />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium cursor-pointer",
            visual.bg,
            visual.fg,
          )}
          aria-haspopup="dialog"
        >
          <visual.Icon size={12} strokeWidth={2.25} />
          {label}
        </button>
      )}
      {!compact && !iconOnly && subtext && <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{subtext}</p>}

      <AnimatePresence>
        {detailsOpen && (
          <SessionDetailsPopover session={session} category={category} onClose={() => setDetailsOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

interface SessionDetailsPopoverProps {
  session: ReturnType<typeof useMarketSessionState>;
  category: AssetCategory;
  onClose: () => void;
}

const SESSION_ROW_LABEL: Record<SessionWindow["status"], string> = {
  "pre-market": "marketStatus.sessionRowPreMarket",
  regular: "marketStatus.sessionRowRegular",
  "after-hours": "marketStatus.sessionRowAfterHours",
};

function SessionDetailsPopover({ session, category, onClose }: SessionDetailsPopoverProps) {
  const { t } = useLocale();
  const [showExchangeTime, setShowExchangeTime] = useState(false);
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatWindow = (w: SessionWindow) => {
    const zone = showExchangeTime ? US_EQUITY_TIME_ZONE : localTimeZone;
    return `${formatInZone(new Date(w.startsAt), zone)} – ${formatInZone(new Date(w.endsAt), zone)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-3 rounded-t-3xl border border-border-soft bg-surface px-5 py-5 lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">{t("marketStatus.detailsTitle")}</span>
          <button
            onClick={onClose}
            aria-label={t("marketStatus.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {category !== "crypto" && (
          <button
            onClick={() => setShowExchangeTime((v) => !v)}
            className="self-start rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-dim hover:bg-surface-3 cursor-pointer"
          >
            {t(showExchangeTime ? "marketStatus.switchToLocalTime" : "marketStatus.switchToExchangeTime")}
          </button>
        )}

        {category === "crypto" ? (
          <p className="text-[13px] leading-relaxed text-ink-dim">{t("marketStatus.open247Note")}</p>
        ) : session.sessionsForDay.length === 0 ? (
          <p className="text-[13px] text-ink-faint">{t("marketStatus.noSessionsToday")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {session.sessionsForDay.map((w) => (
              <div key={w.status} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                <span className="text-ink-dim">{t(SESSION_ROW_LABEL[w.status])}</span>
                <span className="tabular-nums text-ink">{formatWindow(w)}</span>
              </div>
            ))}
          </div>
        )}

        {category !== "crypto" && <p className="text-[11px] leading-relaxed text-ink-faint">{t("marketStatus.timezoneNote")}</p>}
        <p className="text-[11px] leading-relaxed text-ink-faint">{t("marketStatus.calendarSource")}</p>
      </motion.div>
    </div>
  );
}
