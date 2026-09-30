/**
 * Exponential backoff delay, in milliseconds, for the Nth retry (0-indexed)
 * of a rate-limited request — spec section 7's "rate-limit handling,
 * retries with backoff." Doubles each attempt starting from `baseMs`,
 * capped at `maxMs` so a long run of 429s doesn't grow the wait
 * unboundedly.
 */
export function backoffDelayMs(attempt: number, baseMs = 2000, maxMs = 20000): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}
