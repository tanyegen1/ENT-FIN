import { describe, expect, it, beforeEach } from "vitest";
import {
  getMarketSession,
  zonedTimeToUtc,
  getZonedParts,
  formatInZone,
  setSymbolHalt,
  clearSymbolHalt,
  regularSessionExpiry,
  extendedSessionExpiry,
  regularSessionExpiryOn,
  CALENDAR_COVERAGE,
  US_EQUITY_TIME_ZONE,
} from "./marketSession";

// A plain trading Monday with no holiday in either DST regime, used as the
// baseline for boundary tests.
const WINTER_TRADING_DAY = "2025-01-06"; // Monday, EST (UTC-5)
const SUMMER_TRADING_DAY = "2025-06-16"; // Monday, EDT (UTC-4)

function etInstant(dateIso: string, hour: number, minute: number): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, hour, minute, US_EQUITY_TIME_ZONE);
}

describe("session boundaries on an ordinary trading day", () => {
  it.each([
    ["03:59", 3, 59, "closed"],
    ["04:00", 4, 0, "pre-market"],
    ["09:29", 9, 29, "pre-market"],
    ["09:30", 9, 30, "regular"],
    ["15:59", 15, 59, "regular"],
    ["16:00", 16, 0, "after-hours"],
    ["19:59", 19, 59, "after-hours"],
    ["20:00", 20, 0, "closed"],
  ] as const)("%s ET is %s", (_label, hour, minute, expected) => {
    const now = etInstant(SUMMER_TRADING_DAY, hour, minute);
    expect(getMarketSession("stock", { now }).status).toBe(expected);
  });

  it("behaves identically in winter (EST) at the same wall-clock boundaries", () => {
    expect(getMarketSession("stock", { now: etInstant(WINTER_TRADING_DAY, 9, 29) }).status).toBe("pre-market");
    expect(getMarketSession("stock", { now: etInstant(WINTER_TRADING_DAY, 9, 30) }).status).toBe("regular");
    expect(getMarketSession("stock", { now: etInstant(WINTER_TRADING_DAY, 16, 0) }).status).toBe("after-hours");
  });
});

describe("weekends and holidays", () => {
  it("is closed all day on a Saturday, with no holiday name", () => {
    const state = getMarketSession("stock", { now: etInstant("2025-06-14", 12, 0) });
    expect(state.status).toBe("closed");
    expect(state.isTradingDay).toBe(false);
    expect(state.holidayName).toBeNull();
  });

  it("reports 'holiday' with the correct name on Independence Day", () => {
    const state = getMarketSession("stock", { now: etInstant("2025-07-04", 12, 0) });
    expect(state.status).toBe("holiday");
    expect(state.holidayName).toBe("Independence Day");
  });

  it("finds the next regular open across a holiday immediately followed by a weekend", () => {
    // Fri Jul 4 2025 is a holiday; Jul 5-6 is a weekend; next open is Mon Jul 7.
    const state = getMarketSession("stock", { now: etInstant("2025-07-04", 12, 0) });
    expect(state.nextRegularOpen).not.toBeNull();
    const open = new Date(state.nextRegularOpen!);
    expect(getZonedParts(open, US_EQUITY_TIME_ZONE)).toMatchObject({ year: 2025, month: 7, day: 7, hour: 9, minute: 30 });
  });
});

describe("early closes", () => {
  it("closes the regular session at 1pm and runs after-hours 1-5pm on the day after Thanksgiving", () => {
    const day = "2025-11-28";
    expect(getMarketSession("stock", { now: etInstant(day, 12, 59) }).status).toBe("regular");
    const early = getMarketSession("stock", { now: etInstant(day, 13, 0) });
    expect(early.status).toBe("after-hours");
    expect(early.isEarlyClose).toBe(true);
    expect(getMarketSession("stock", { now: etInstant(day, 16, 59) }).status).toBe("after-hours");
    expect(getMarketSession("stock", { now: etInstant(day, 17, 0) }).status).toBe("closed");
  });

  it("closes at 1pm on Christmas Eve", () => {
    const state = getMarketSession("stock", { now: etInstant("2025-12-24", 13, 0) });
    expect(state.status).toBe("after-hours");
    expect(state.isEarlyClose).toBe(true);
  });
});

describe("daylight saving time", () => {
  it("computes a different UTC offset for the same 9:30 ET wall time in winter vs summer", () => {
    const winterOpen = etInstant(WINTER_TRADING_DAY, 9, 30);
    const summerOpen = etInstant(SUMMER_TRADING_DAY, 9, 30);
    // EST is UTC-5 (09:30 ET = 14:30 UTC), EDT is UTC-4 (09:30 ET = 13:30 UTC).
    expect(winterOpen.getUTCHours()).toBe(14);
    expect(summerOpen.getUTCHours()).toBe(13);
  });

  it("keeps the regular session at the same 9:30-16:00 ET wall-clock window immediately either side of the spring-forward transition", () => {
    // US DST began 2025-03-09. Check the Friday before and the Monday after.
    const before = getMarketSession("stock", { now: etInstant("2025-03-07", 9, 30) });
    const after = getMarketSession("stock", { now: etInstant("2025-03-10", 9, 30) });
    expect(before.status).toBe("regular");
    expect(after.status).toBe("regular");
  });
});

describe("New York vs Istanbul display of the same instant", () => {
  it("shows the expected wall-clock hour gap in winter (EST, UTC-5) and Istanbul (UTC+3): 8 hours", () => {
    const instant = etInstant(WINTER_TRADING_DAY, 9, 30); // 09:30 ET
    const ny = getZonedParts(instant, US_EQUITY_TIME_ZONE);
    const ist = getZonedParts(instant, "Europe/Istanbul");
    expect(ny.hour).toBe(9);
    expect(ist.hour).toBe(17); // 09:30 + 8h
  });

  it("shows a 7-hour gap in summer (EDT, UTC-4) since Istanbul doesn't observe DST", () => {
    const instant = etInstant(SUMMER_TRADING_DAY, 9, 30);
    const ny = getZonedParts(instant, US_EQUITY_TIME_ZONE);
    const ist = getZonedParts(instant, "Europe/Istanbul");
    expect(ny.hour).toBe(9);
    expect(ist.hour).toBe(16); // 09:30 + 7h
  });

  it("formatInZone labels each zone explicitly rather than implying a shared local time", () => {
    const instant = etInstant(SUMMER_TRADING_DAY, 9, 30);
    const nyLabel = formatInZone(instant, US_EQUITY_TIME_ZONE);
    const istLabel = formatInZone(instant, "Europe/Istanbul");
    expect(nyLabel).not.toBe(istLabel);
    expect(nyLabel.length).toBeGreaterThan(0);
    expect(istLabel.length).toBeGreaterThan(0);
  });
});

describe("out-of-coverage calendar", () => {
  it("reports 'unavailable' rather than guessing beyond the documented coverage window", () => {
    const now = new Date(`${CALENDAR_COVERAGE.end}T23:59:59Z`);
    const wellBeyond = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000);
    const state = getMarketSession("stock", { now: wellBeyond });
    expect(state.status).toBe("unavailable");
    expect(state.nextRegularOpen).toBeNull();
    expect(state.nextTransition).toBeNull();
  });
});

describe("crypto is always open", () => {
  it("reports 'open' at any time of day, weekday or weekend", () => {
    expect(getMarketSession("crypto", { now: etInstant("2025-06-14", 3, 0) }).status).toBe("open"); // Saturday
    expect(getMarketSession("crypto", { now: etInstant("2025-07-04", 12, 0) }).status).toBe("open"); // holiday
  });
});

describe("halts", () => {
  beforeEach(() => clearSymbolHalt("TESTX"));

  it("overrides the ordinary session status while a symbol-specific halt is set, and reverts once cleared", () => {
    const now = etInstant(SUMMER_TRADING_DAY, 10, 0);
    expect(getMarketSession("stock", { now, symbol: "TESTX" }).status).toBe("regular");
    setSymbolHalt("TESTX", "Volatility halt");
    const halted = getMarketSession("stock", { now, symbol: "TESTX" });
    expect(halted.status).toBe("halted");
    expect(halted.haltedReason).toBe("Volatility halt");
    clearSymbolHalt("TESTX");
    expect(getMarketSession("stock", { now, symbol: "TESTX" }).status).toBe("regular");
  });

  it("does not affect an unrelated symbol", () => {
    setSymbolHalt("TESTX", "Volatility halt");
    const now = etInstant(SUMMER_TRADING_DAY, 10, 0);
    expect(getMarketSession("stock", { now, symbol: "OTHER" }).status).toBe("regular");
    clearSymbolHalt("TESTX");
  });
});

describe("next-transition sequencing across a full trading day", () => {
  it("walks pre-market -> regular -> after-hours -> closed(tomorrow's pre-market)", () => {
    const preMarket = getMarketSession("stock", { now: etInstant(SUMMER_TRADING_DAY, 5, 0) });
    expect(preMarket.nextTransition).toMatchObject({ status: "regular" });

    const regular = getMarketSession("stock", { now: etInstant(SUMMER_TRADING_DAY, 10, 0) });
    expect(regular.nextTransition).toMatchObject({ status: "after-hours" });

    const afterHours = getMarketSession("stock", { now: etInstant(SUMMER_TRADING_DAY, 17, 0) });
    expect(afterHours.nextTransition).toMatchObject({ status: "closed" });

    const closed = getMarketSession("stock", { now: etInstant(SUMMER_TRADING_DAY, 21, 0) });
    expect(closed.nextTransition?.status).toBe("pre-market");
    // Tomorrow, 2025-06-17, is also a plain trading day.
    expect(getZonedParts(new Date(closed.nextTransition!.at), US_EQUITY_TIME_ZONE)).toMatchObject({ day: 17, hour: 4, minute: 0 });
  });
});

describe("order-expiry helpers", () => {
  it("regularSessionExpiry matches the regular close of the current/next trading day", () => {
    const now = etInstant(SUMMER_TRADING_DAY, 10, 0);
    const expiry = regularSessionExpiry(now);
    expect(expiry).toBe(etInstant(SUMMER_TRADING_DAY, 16, 0).getTime());
  });

  it("extendedSessionExpiry matches the after-hours end of the current/next trading day", () => {
    const now = etInstant(SUMMER_TRADING_DAY, 10, 0);
    const expiry = extendedSessionExpiry(now);
    expect(expiry).toBe(etInstant(SUMMER_TRADING_DAY, 20, 0).getTime());
  });

  it("uses the early-close time when the current/next trading day is an early close", () => {
    const now = etInstant("2025-11-28", 8, 0);
    expect(regularSessionExpiry(now)).toBe(etInstant("2025-11-28", 13, 0).getTime());
    expect(extendedSessionExpiry(now)).toBe(etInstant("2025-11-28", 17, 0).getTime());
  });

  it("regularSessionExpiryOn rolls a weekend/holiday target date forward to the next trading day's close", () => {
    // Targeting Saturday should resolve to the following Monday's close.
    const targetSaturday = etInstant("2025-06-14", 0, 0);
    const expiry = regularSessionExpiryOn(targetSaturday);
    expect(expiry).toBe(etInstant("2025-06-16", 16, 0).getTime());
  });
});
