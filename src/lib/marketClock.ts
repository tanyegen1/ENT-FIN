/**
 * A simplified, explicit simulated market session used only for practice
 * price rules (expiry timing and the open/closed indicator on the order
 * builder). This is NOT a real exchange calendar: it doesn't know about
 * holidays, early closes, or the actual trading hours of any specific real
 * market, and it evaluates against the browser's local clock/timezone
 * rather than a real exchange's timezone. It exists purely so "Today only"
 * vs "Until a date" duration has a concrete, honest, documented meaning in
 * this simulator — never presented in-app as matching any real exchange.
 */

export const SESSION_OPEN_HOUR = 9;
export const SESSION_OPEN_MINUTE = 30;
export const SESSION_CLOSE_HOUR = 16;
export const SESSION_CLOSE_MINUTE = 0;

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function atSessionOpen(date: Date): Date {
  const d = new Date(date);
  d.setHours(SESSION_OPEN_HOUR, SESSION_OPEN_MINUTE, 0, 0);
  return d;
}

function atSessionClose(date: Date): Date {
  const d = new Date(date);
  d.setHours(SESSION_CLOSE_HOUR, SESSION_CLOSE_MINUTE, 0, 0);
  return d;
}

/** Is the simulated market open right now (a weekday, within the session window)? */
export function isMarketOpen(now: Date = new Date()): boolean {
  if (!isWeekday(now)) return false;
  return now >= atSessionOpen(now) && now < atSessionClose(now);
}

/** The next time the simulated session opens, starting from `now` (skips weekends). */
export function nextSessionOpen(now: Date = new Date()): Date {
  const open = atSessionOpen(now);
  let candidate = now < open && isWeekday(now) ? open : atSessionOpen(addDays(now, 1));
  while (!isWeekday(candidate)) {
    candidate = atSessionOpen(addDays(candidate, 1));
  }
  return candidate;
}

/** The close of the current or next simulated session, starting from `now`. */
export function endOfCurrentOrNextSession(now: Date = new Date()): Date {
  if (isWeekday(now) && now < atSessionClose(now)) {
    return atSessionClose(now);
  }
  const nextOpen = nextSessionOpen(now);
  return atSessionClose(nextOpen);
}

/** The simulated session close on a specific chosen date (used for "Until a date" duration). */
export function sessionCloseOn(date: Date): Date {
  let candidate = date;
  while (!isWeekday(candidate)) {
    candidate = addDays(candidate, 1);
  }
  return atSessionClose(candidate);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
