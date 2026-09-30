import { useEffect, useState } from "react";
import { Beaker } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "../components/PageHeader";
import { VISUALS, STATUS_LABEL_KEY } from "../components/MarketStatusPill";
import { useLocale } from "../context/LocaleContext";
import {
  getMarketSession,
  formatInZone,
  US_EQUITY_TIME_ZONE,
  setSymbolHalt,
  clearSymbolHalt,
  zonedTimeToUtc,
  type SessionWindow,
} from "../lib/marketSession";
import { describeSessionSubtext } from "../lib/sessionCopy";

// A symbol that doesn't exist in the real stock catalog — halting it here
// can never affect a real instrument's trading eligibility anywhere else
// in the app.
const DEMO_HALT_SYMBOL = "ZZDEMO";

function et(year: number, month: number, day: number, hour: number, minute: number): Date {
  return zonedTimeToUtc(year, month, day, hour, minute, US_EQUITY_TIME_ZONE);
}

interface Scenario {
  id: string;
  labelKey: string;
  noteKey: string;
  at: Date;
  halted?: boolean;
}

// Fixed, calendar-verified instants (see lib/marketSession.ts's documented
// NYSE holiday/early-close table) — never derived from the real clock, so
// this page always demonstrates the same 8 states regardless of when it's
// opened. 2025-06-16 is a plain Monday in both DST regimes' neighborhood;
// 2025-06-14 is the Saturday right before it; 2025-01-01 and 2025-11-28 are
// real entries in that table (New Year's Day, and the day-after-Thanksgiving
// early close).
const SCENARIOS: Scenario[] = [
  { id: "pre-market", labelKey: "sessionDemo.scenarioPreMarket", noteKey: "sessionDemo.scenarioPreMarketNote", at: et(2025, 6, 16, 7, 0) },
  { id: "regular-open", labelKey: "sessionDemo.scenarioRegularOpen", noteKey: "sessionDemo.scenarioRegularOpenNote", at: et(2025, 6, 16, 9, 31) },
  { id: "regular-close", labelKey: "sessionDemo.scenarioRegularClose", noteKey: "sessionDemo.scenarioRegularCloseNote", at: et(2025, 6, 16, 16, 0) },
  { id: "after-hours", labelKey: "sessionDemo.scenarioAfterHours", noteKey: "sessionDemo.scenarioAfterHoursNote", at: et(2025, 6, 16, 18, 0) },
  { id: "closed", labelKey: "sessionDemo.scenarioClosed", noteKey: "sessionDemo.scenarioClosedNote", at: et(2025, 6, 14, 12, 0) },
  { id: "holiday", labelKey: "sessionDemo.scenarioHoliday", noteKey: "sessionDemo.scenarioHolidayNote", at: et(2025, 1, 1, 10, 0) },
  { id: "early-close", labelKey: "sessionDemo.scenarioEarlyClose", noteKey: "sessionDemo.scenarioEarlyCloseNote", at: et(2025, 11, 28, 12, 0) },
  { id: "halted", labelKey: "sessionDemo.scenarioHalted", noteKey: "sessionDemo.scenarioHaltedNote", at: et(2025, 6, 16, 10, 0), halted: true },
];

const SESSION_ROW_LABEL: Record<SessionWindow["status"], string> = {
  "pre-market": "marketStatus.sessionRowPreMarket",
  regular: "marketStatus.sessionRowRegular",
  "after-hours": "marketStatus.sessionRowAfterHours",
};

/**
 * A read-only, clearly-labeled developer/testing surface (spec section 10)
 * that demonstrates every session state using a simulated clock — it never
 * touches the real practice account, its clock, its orders, or any real
 * instrument. All demo output goes through the exact same
 * lib/marketSession.ts + lib/sessionCopy.ts a real user's session pill uses,
 * so what's shown here is never a separate, potentially-drifted copy of
 * that logic.
 */
export function SessionDemoPage() {
  const { t, locale } = useLocale();
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === selectedId)!;
  const dateLocale = locale === "tr" ? "tr-TR" : undefined;

  // The halt registry is a small in-memory map keyed by symbol — scoped
  // entirely to this fake demo symbol, and cleared on unmount so leaving
  // this page never leaves stray state behind (harmless either way, since
  // no real feature ever looks up ZZDEMO, but tidy).
  useEffect(() => {
    setSymbolHalt(DEMO_HALT_SYMBOL, t("sessionDemo.haltReason"));
    return () => clearSymbolHalt(DEMO_HALT_SYMBOL);
  }, [t]);

  const session = getMarketSession("stock", {
    now: scenario.at,
    symbol: scenario.halted ? DEMO_HALT_SYMBOL : undefined,
  });
  const visual = VISUALS[session.status];
  const subtext = describeSessionSubtext(session, t, dateLocale);

  return (
    <div className="pb-10">
      <PageHeader title={t("sessionDemo.pageTitle")} back />

      <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3.5 lg:mx-6">
        <Beaker size={18} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <div className="text-[13px] font-semibold text-warn">{t("sessionDemo.bannerTitle")}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{t("sessionDemo.bannerBody")}</p>
        </div>
      </div>

      <div className="mt-6 px-4 lg:px-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">{t("sessionDemo.scenarioHeading")}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={clsx(
                "rounded-2xl border px-3.5 py-3 text-left text-[13px] font-medium cursor-pointer",
                s.id === selectedId ? "border-brand bg-brand-soft text-brand-light" : "border-border-soft text-ink-dim hover:bg-surface-2",
              )}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 px-4 lg:px-6">
        <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
          <div className="text-[11px] text-ink-faint">
            {t("sessionDemo.simulatedClockLabel")}: {formatInZone(scenario.at, US_EQUITY_TIME_ZONE, { weekday: "short", month: "short", day: "numeric" })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", visual.bg, visual.fg)}>
              <visual.Icon size={12} strokeWidth={2.25} />
              {t(STATUS_LABEL_KEY[session.status])}
            </span>
            {session.isEarlyClose && (
              <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-medium text-ink-dim">
                {t("sessionDemo.earlyCloseBadge")}
              </span>
            )}
          </div>

          {subtext && <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{subtext}</p>}
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{t(scenario.noteKey)}</p>

          {session.sessionsForDay.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{t("sessionDemo.sessionsForDayHeading")}</div>
              {session.sessionsForDay.map((w) => (
                <div key={w.status} className="flex items-center justify-between rounded-xl bg-surface-3 px-3 py-2 text-[13px]">
                  <span className="text-ink-dim">{t(SESSION_ROW_LABEL[w.status])}</span>
                  <span className="tabular-nums text-ink">
                    {formatInZone(new Date(w.startsAt), US_EQUITY_TIME_ZONE)} – {formatInZone(new Date(w.endsAt), US_EQUITY_TIME_ZONE)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 px-4 text-[11px] leading-relaxed text-ink-faint lg:px-6">{t("sessionDemo.footerNote")}</p>
    </div>
  );
}
