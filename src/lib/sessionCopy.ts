import type { MarketSessionState } from "./marketSession";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** "in 42 minutes" / "in 2h 15m" — never a bare millisecond count. */
export function formatSessionDuration(ms: number, t: Translate): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return t("marketStatus.durationLessThanMinute");
  if (totalMinutes < 60) return t("marketStatus.durationMinutes", { minutes: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t("marketStatus.durationHours", { hours, minutes });
}

/**
 * The one beginner-facing subtext line under a status pill ("Regular
 * trading opens in 42 minutes.", "Closed for a market holiday...") — the
 * single source of truth for this copy, shared by the real MarketStatusPill
 * and the read-only session demo page, so the demo can never drift from
 * what a real user actually sees for the same status.
 */
export function describeSessionSubtext(session: MarketSessionState, t: Translate, dateLocale?: string): string | null {
  if (session.status === "halted") return t("marketStatus.haltedReason", { reason: session.haltedReason ?? "" });
  if (session.status === "unavailable") return t("marketStatus.unavailableDetail");
  if (session.status === "open") return t("marketStatus.open247Note");
  if (session.status === "pre-market" && session.nextTransition) {
    return t("marketStatus.opensIn", { duration: formatSessionDuration(session.nextTransition.at - session.asOf, t) });
  }
  if (session.status === "regular" && session.nextTransition) {
    return t("marketStatus.closesIn", { duration: formatSessionDuration(session.nextTransition.at - session.asOf, t) });
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
}
