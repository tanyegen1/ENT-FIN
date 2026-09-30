import type { AssetCategory } from "../types";

/**
 * The one shared source of truth for market-session state in Arvo —
 * dashboard, watchlist, stock pages, charts, order forms, pending orders,
 * and the practice execution engine all read session state from here.
 * Nothing else in the app should compute "is the market open" on its own.
 *
 * Design notes (see README's "Market sessions" section for the full writeup):
 * - All internal math is done against real UTC instants (`Date`/`number`
 *   epoch ms). Exchange wall-clock time is derived from a real IANA
 *   timezone (`America/New_York`) via `Intl.DateTimeFormat`, which already
 *   knows the US's DST transition dates — this file never hardcodes an ET
 *   offset (not "UTC-5", not a fixed difference to Istanbul time).
 * - Every entry point accepts an injectable `now`, so tests (and the
 *   developer session-demo screen) can simulate any instant without
 *   touching the real clock.
 * - This is a small, manually-maintained holiday/early-close table with a
 *   documented source and a documented coverage window (see
 *   CALENDAR_COVERAGE below) — not a live calendar feed. Outside that
 *   window, or for a category/exchange this file doesn't model,
 *   `getMarketSession` returns status "unavailable" rather than guessing.
 */

// ---------------------------------------------------------------------------
// Timezone-correct wall-clock <-> UTC conversion, with no hardcoded offset.
// ---------------------------------------------------------------------------

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const zonedPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = zonedPartsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    zonedPartsFormatterCache.set(timeZone, f);
  }
  return f;
}

/** The real wall-clock date/time in `timeZone` for a given UTC instant — DST-correct via ICU's tz database. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = zonedPartsFormatter(timeZone).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: map.hour === "24" ? 0 : Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/** `YYYY-MM-DD` for the given instant, in `timeZone`'s calendar. */
export function zonedIsoDate(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * The UTC instant at which `timeZone`'s wall clock reads `hour:minute` on
 * calendar date `year-month-day`. Standard "double conversion" trick: an
 * initial guess is reinterpreted in the target zone, and the wall-clock
 * error (which encodes that zone's real UTC offset for that specific
 * instant, DST included) is used to correct it — so this is accurate
 * across a DST transition without ever naming an offset.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const seen = getZonedParts(guess, timeZone);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0);
  return new Date(guess.getTime() + (desiredAsUtc - seenAsUtc));
}

function addCalendarDays(d: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  // Noon UTC avoids any DST-adjacent midnight ambiguity in this pure calendar-math step.
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

// ---------------------------------------------------------------------------
// NYSE / Nasdaq holiday + early-close calendar.
//
// Source: NYSE Group's official published calendar for 2024–2026 —
// https://www.businesswire.com/news/home/20231110324734/en/NYSE-Group-Announces-2024-2025-and-2026-Holiday-and-Early-Closings-Calendar
// (mirrored at https://www.nyse.com/trade/hours-calendars). Early closes
// (1:00pm ET) are the day after Thanksgiving and Christmas Eve each year;
// after-hours on those days is documented separately to run 1:00pm–5:00pm
// ET (same 4-hour extended window as a normal day), per NYSE's public FAQ.
//
// This is a manually-entered table, not a live feed. It must be extended
// with NYSE's next published calendar before CALENDAR_COVERAGE.end —
// beyond that date getMarketSession() reports "unavailable" instead of
// guessing.
// ---------------------------------------------------------------------------

export const CALENDAR_COVERAGE = { start: "2024-01-01", end: "2026-12-31" } as const;

interface HolidayEntry {
  date: string; // YYYY-MM-DD, ET calendar date
  name: string;
}

const US_EQUITY_HOLIDAYS: HolidayEntry[] = [
  { date: "2024-01-01", name: "New Year's Day" },
  { date: "2024-01-15", name: "Martin Luther King, Jr. Day" },
  { date: "2024-02-19", name: "Washington's Birthday" },
  { date: "2024-03-29", name: "Good Friday" },
  { date: "2024-05-27", name: "Memorial Day" },
  { date: "2024-06-19", name: "Juneteenth National Independence Day" },
  { date: "2024-07-04", name: "Independence Day" },
  { date: "2024-09-02", name: "Labor Day" },
  { date: "2024-11-28", name: "Thanksgiving Day" },
  { date: "2024-12-25", name: "Christmas Day" },

  { date: "2025-01-01", name: "New Year's Day" },
  { date: "2025-01-20", name: "Martin Luther King, Jr. Day" },
  { date: "2025-02-17", name: "Washington's Birthday" },
  { date: "2025-04-18", name: "Good Friday" },
  { date: "2025-05-26", name: "Memorial Day" },
  { date: "2025-06-19", name: "Juneteenth National Independence Day" },
  { date: "2025-07-04", name: "Independence Day" },
  { date: "2025-09-01", name: "Labor Day" },
  { date: "2025-11-27", name: "Thanksgiving Day" },
  { date: "2025-12-25", name: "Christmas Day" },

  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-19", name: "Martin Luther King, Jr. Day" },
  { date: "2026-02-16", name: "Washington's Birthday" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-06-19", name: "Juneteenth National Independence Day" },
  { date: "2026-07-03", name: "Independence Day (observed)" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

interface EarlyCloseEntry {
  date: string;
  name: string;
  closeHour: number;
  closeMinute: number;
}

const US_EQUITY_EARLY_CLOSES: EarlyCloseEntry[] = [
  { date: "2024-11-29", name: "Day after Thanksgiving", closeHour: 13, closeMinute: 0 },
  { date: "2024-12-24", name: "Christmas Eve", closeHour: 13, closeMinute: 0 },
  { date: "2025-11-28", name: "Day after Thanksgiving", closeHour: 13, closeMinute: 0 },
  { date: "2025-12-24", name: "Christmas Eve", closeHour: 13, closeMinute: 0 },
  { date: "2026-11-27", name: "Day after Thanksgiving", closeHour: 13, closeMinute: 0 },
  { date: "2026-12-24", name: "Christmas Eve", closeHour: 13, closeMinute: 0 },
];

const HOLIDAY_BY_DATE = new Map(US_EQUITY_HOLIDAYS.map((h) => [h.date, h]));
const EARLY_CLOSE_BY_DATE = new Map(US_EQUITY_EARLY_CLOSES.map((e) => [e.date, e]));

function isWithinCoverage(isoDate: string): boolean {
  return isoDate >= CALENDAR_COVERAGE.start && isoDate <= CALENDAR_COVERAGE.end;
}

// ---------------------------------------------------------------------------
// Session profile — the initial US-equity practice profile. Documented as
// configurable defaults (per the spec), not a claim that every real
// exchange uses these hours.
// ---------------------------------------------------------------------------

export const US_EQUITY_TIME_ZONE = "America/New_York";

const PRE_MARKET_START = { hour: 4, minute: 0 };
const REGULAR_OPEN = { hour: 9, minute: 30 };
const REGULAR_CLOSE_NORMAL = { hour: 16, minute: 0 };
const AFTER_HOURS_DURATION_MS = 4 * 60 * 60 * 1000;

export type SessionStatus = "pre-market" | "regular" | "after-hours" | "closed" | "holiday" | "halted" | "unavailable" | "open";

export interface SessionWindow {
  status: "pre-market" | "regular" | "after-hours";
  startsAt: number;
  endsAt: number;
}

export interface MarketSessionState {
  profile: "us_equity" | "crypto_247";
  status: SessionStatus;
  asOf: number;
  timeZone: string;
  isTradingDay: boolean;
  isEarlyClose: boolean;
  holidayName: string | null;
  haltedReason: string | null;
  /** This trading day's (or, if currently closed, the most recently completed trading day's) session windows, in UTC ms — render in whatever zone the UI wants. Empty for crypto (always-open, no discrete sessions) and for non-trading days outside coverage. */
  sessionsForDay: SessionWindow[];
  /** The next status this will become, and exactly when — null only when unavailable/halted with no computable schedule. */
  nextTransition: { status: SessionStatus; at: number } | null;
  /** Next (or, if one is under way, the current) regular session's open/close instants. Null when unavailable. */
  nextRegularOpen: number | null;
  nextRegularClose: number | null;
}

// A tiny, explicit, dev-only halt registry — never a live feed. See the
// session demo page for the only UI that writes to it.
const haltRegistry = new Map<string, string>();
export function setSymbolHalt(symbol: string, reason: string): void {
  haltRegistry.set(symbol.toUpperCase(), reason);
}
export function clearSymbolHalt(symbol: string): void {
  haltRegistry.delete(symbol.toUpperCase());
}
export function getSymbolHalt(symbol: string): string | null {
  return haltRegistry.get(symbol.toUpperCase()) ?? null;
}

function regularCloseFor(isoDate: string): { hour: number; minute: number; isEarly: boolean; name?: string } {
  const early = EARLY_CLOSE_BY_DATE.get(isoDate);
  if (early) return { hour: early.closeHour, minute: early.closeMinute, isEarly: true, name: early.name };
  return { ...REGULAR_CLOSE_NORMAL, isEarly: false };
}

function isUsEquityTradingDay(isoDate: string, weekday: number): boolean {
  if (weekday === 0 || weekday === 6) return false;
  return !HOLIDAY_BY_DATE.has(isoDate);
}

interface DaySessions {
  isoDate: string;
  isTradingDay: boolean;
  isEarlyClose: boolean;
  holidayName: string | null;
  preMarketStart: number;
  regularOpen: number;
  regularClose: number;
  afterHoursEnd: number;
}

function computeDaySessions(isoDate: string, weekday: number): DaySessions {
  const [y, m, d] = isoDate.split("-").map(Number);
  const holiday = HOLIDAY_BY_DATE.get(isoDate);
  const tradingDay = isUsEquityTradingDay(isoDate, weekday);
  const close = regularCloseFor(isoDate);
  const regularOpen = zonedTimeToUtc(y, m, d, REGULAR_OPEN.hour, REGULAR_OPEN.minute, US_EQUITY_TIME_ZONE).getTime();
  const regularClose = zonedTimeToUtc(y, m, d, close.hour, close.minute, US_EQUITY_TIME_ZONE).getTime();
  const preMarketStart = zonedTimeToUtc(y, m, d, PRE_MARKET_START.hour, PRE_MARKET_START.minute, US_EQUITY_TIME_ZONE).getTime();
  const afterHoursEnd = regularClose + AFTER_HOURS_DURATION_MS;
  return {
    isoDate,
    isTradingDay: tradingDay,
    isEarlyClose: close.isEarly,
    holidayName: holiday?.name ?? null,
    preMarketStart,
    regularOpen,
    regularClose,
    afterHoursEnd,
  };
}

/** Searches forward (bounded) from `fromIso` for the next trading day whose regular session hasn't fully closed by `notBeforeMs`. Used for both "next regular session" and "next status transition" lookups. */
function findSessionDay(fromIso: string, notBeforeMs: number, maxDays = 20): DaySessions | null {
  let cursor = { year: Number(fromIso.slice(0, 4)), month: Number(fromIso.slice(5, 7)), day: Number(fromIso.slice(8, 10)) };
  for (let i = 0; i < maxDays; i++) {
    const iso = `${String(cursor.year).padStart(4, "0")}-${String(cursor.month).padStart(2, "0")}-${String(cursor.day).padStart(2, "0")}`;
    if (!isWithinCoverage(iso)) return null;
    const weekday = getZonedParts(new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day, 12)), US_EQUITY_TIME_ZONE).weekday;
    const day = computeDaySessions(iso, weekday);
    if (day.isTradingDay && day.regularClose > notBeforeMs) return day;
    cursor = addCalendarDays(cursor, 1);
  }
  return null;
}

/** Searches backward (bounded) from the day before `fromIso` for the most recent prior trading day — the mirror of findSessionDay, used to find "yesterday's" (or the last trading day's) full session when the market is currently closed. */
function findPreviousSessionDay(fromIso: string, maxDays = 20): DaySessions | null {
  let cursor = addCalendarDays(
    { year: Number(fromIso.slice(0, 4)), month: Number(fromIso.slice(5, 7)), day: Number(fromIso.slice(8, 10)) },
    -1,
  );
  for (let i = 0; i < maxDays; i++) {
    const iso = `${String(cursor.year).padStart(4, "0")}-${String(cursor.month).padStart(2, "0")}-${String(cursor.day).padStart(2, "0")}`;
    if (!isWithinCoverage(iso)) return null;
    const weekday = getZonedParts(new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day, 12)), US_EQUITY_TIME_ZONE).weekday;
    const day = computeDaySessions(iso, weekday);
    if (day.isTradingDay) return day;
    cursor = addCalendarDays(cursor, -1);
  }
  return null;
}

export interface OneDayWindow {
  isoDate: string;
  /** Pre-market start, in UTC ms. */
  start: number;
  /** After-hours end, in UTC ms — or `now` when `isComplete` is false (today's session is still under way). */
  end: number;
  /** False only when this is today's still-in-progress session — `end` is `now`, not the real after-hours close. */
  isComplete: boolean;
}

/**
 * Which single trading day's full pre-market-through-after-hours window a
 * "1D" chart should render, so its data always covers real session
 * boundaries rather than an arbitrary "last 6.5 hours" — the current
 * trading day if one is already under way, otherwise the most recently
 * completed trading day (so the chart still shows something meaningful over
 * a weekend, holiday, or before pre-market opens). Returns null when the
 * calendar can't establish this (outside CALENDAR_COVERAGE). Not meaningful
 * for crypto (no sessions) — callers should use a plain rolling 24h window
 * for that category instead.
 */
export function resolveOneDayWindow(now: Date): OneDayWindow | null {
  const todayIso = zonedIsoDate(now, US_EQUITY_TIME_ZONE);
  if (!isWithinCoverage(todayIso)) return null;
  const asOf = now.getTime();
  const todayWeekday = getZonedParts(now, US_EQUITY_TIME_ZONE).weekday;
  const today = computeDaySessions(todayIso, todayWeekday);
  if (today.isTradingDay && asOf >= today.preMarketStart) {
    return { isoDate: todayIso, start: today.preMarketStart, end: Math.min(asOf, today.afterHoursEnd), isComplete: asOf >= today.afterHoursEnd };
  }
  const prev = findPreviousSessionDay(todayIso);
  if (!prev) return null;
  return { isoDate: prev.isoDate, start: prev.preMarketStart, end: prev.afterHoursEnd, isComplete: true };
}

export interface GetMarketSessionOptions {
  now?: Date;
  /** Checked against the dev-only halt registry when no explicit override is given. */
  symbol?: string;
}

/** The single entry point every part of the app should use for session state. */
export function getMarketSession(category: AssetCategory, options: GetMarketSessionOptions = {}): MarketSessionState {
  const now = options.now ?? new Date();
  const asOf = now.getTime();

  if (category === "crypto") {
    return {
      profile: "crypto_247",
      status: "open",
      asOf,
      timeZone: "UTC",
      isTradingDay: true,
      isEarlyClose: false,
      holidayName: null,
      haltedReason: options.symbol ? getSymbolHalt(options.symbol) : null,
      sessionsForDay: [],
      nextTransition: null,
      nextRegularOpen: asOf,
      nextRegularClose: null,
    };
  }

  const haltedReason = options.symbol ? getSymbolHalt(options.symbol) : null;

  const todayIso = zonedIsoDate(now, US_EQUITY_TIME_ZONE);
  if (!isWithinCoverage(todayIso)) {
    return {
      profile: "us_equity",
      status: "unavailable",
      asOf,
      timeZone: US_EQUITY_TIME_ZONE,
      isTradingDay: false,
      isEarlyClose: false,
      holidayName: null,
      haltedReason,
      sessionsForDay: [],
      nextTransition: null,
      nextRegularOpen: null,
      nextRegularClose: null,
    };
  }

  const todayWeekday = getZonedParts(now, US_EQUITY_TIME_ZONE).weekday;
  const today = computeDaySessions(todayIso, todayWeekday);

  let status: SessionStatus;
  if (haltedReason) {
    status = "halted";
  } else if (!today.isTradingDay) {
    status = today.holidayName ? "holiday" : "closed";
  } else if (asOf < today.preMarketStart) {
    status = "closed";
  } else if (asOf < today.regularOpen) {
    status = "pre-market";
  } else if (asOf < today.regularClose) {
    status = "regular";
  } else if (asOf < today.afterHoursEnd) {
    status = "after-hours";
  } else {
    status = "closed";
  }

  const sessionsForDay: SessionWindow[] = today.isTradingDay
    ? [
        { status: "pre-market", startsAt: today.preMarketStart, endsAt: today.regularOpen },
        { status: "regular", startsAt: today.regularOpen, endsAt: today.regularClose },
        { status: "after-hours", startsAt: today.regularClose, endsAt: today.afterHoursEnd },
      ]
    : [];

  // The "current or next" regular session: today's, if it hasn't closed yet, otherwise search forward.
  const regularDay = today.isTradingDay && today.regularClose > asOf ? today : findSessionDay(todayIso, asOf);

  // Next status transition: the earliest of today's remaining boundaries, else tomorrow's pre-market start.
  let nextTransition: MarketSessionState["nextTransition"] = null;
  if (!haltedReason) {
    const boundaries: { status: SessionStatus; at: number }[] = today.isTradingDay
      ? [
          { status: "pre-market", at: today.preMarketStart },
          { status: "regular", at: today.regularOpen },
          { status: "after-hours", at: today.regularClose },
          { status: "closed", at: today.afterHoursEnd },
        ]
      : [];
    const upcoming = boundaries.filter((b) => b.at > asOf).sort((a, b) => a.at - b.at)[0];
    if (upcoming) {
      nextTransition = upcoming;
    } else {
      const nextDay = findSessionDay(todayIso, asOf);
      if (nextDay) nextTransition = { status: "pre-market", at: nextDay.preMarketStart };
    }
  }

  return {
    profile: "us_equity",
    status,
    asOf,
    timeZone: US_EQUITY_TIME_ZONE,
    isTradingDay: today.isTradingDay,
    isEarlyClose: today.isEarlyClose,
    holidayName: today.holidayName,
    haltedReason,
    sessionsForDay,
    nextTransition,
    nextRegularOpen: regularDay?.regularOpen ?? null,
    nextRegularClose: regularDay?.regularClose ?? null,
  };
}

/** The regular-session close of the trading day that contains `now` if one is under way or still ahead today, else the next trading day's close. Used for DAY-order expiry (regular-only scope). */
export function regularSessionExpiry(now: Date = new Date()): number | null {
  const s = getMarketSession("stock", { now });
  return s.nextRegularClose;
}

/** The after-hours-session end of the trading day that owns the current/next regular session — used for DAY-order expiry when extended hours are included. */
export function extendedSessionExpiry(now: Date = new Date()): number | null {
  const todayIso = zonedIsoDate(now, US_EQUITY_TIME_ZONE);
  if (!isWithinCoverage(todayIso)) return null;
  const asOf = now.getTime();
  const todayWeekday = getZonedParts(now, US_EQUITY_TIME_ZONE).weekday;
  const today = computeDaySessions(todayIso, todayWeekday);
  const day = today.isTradingDay && today.afterHoursEnd > asOf ? today : findSessionDay(todayIso, asOf);
  return day?.afterHoursEnd ?? null;
}

/** The regular-session close on a specific target trading date (rolled forward to the next trading day if the date given falls on a weekend/holiday) — used for the "Until a date" duration. */
export function regularSessionExpiryOn(date: Date): number | null {
  const iso = zonedIsoDate(date, US_EQUITY_TIME_ZONE);
  if (!isWithinCoverage(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const startOfDayUtc = zonedTimeToUtc(y, m, d, 0, 0, US_EQUITY_TIME_ZONE).getTime();
  const day = findSessionDay(iso, startOfDayUtc - 1);
  return day?.regularClose ?? null;
}

/** The after-hours-session end on a specific target trading date (rolled forward past a weekend/holiday) — used for "Until a date" + extended-hours-included orders. */
export function extendedSessionExpiryOn(date: Date): number | null {
  const iso = zonedIsoDate(date, US_EQUITY_TIME_ZONE);
  if (!isWithinCoverage(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const startOfDayUtc = zonedTimeToUtc(y, m, d, 0, 0, US_EQUITY_TIME_ZONE).getTime();
  const day = findSessionDay(iso, startOfDayUtc - 1);
  return day?.afterHoursEnd ?? null;
}

/** Formats a UTC instant in a given IANA zone with an explicit zone abbreviation, e.g. "9:30 AM EDT" or "4:30 PM +03". */
export function formatInZone(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
    ...opts,
  }).format(date);
}
