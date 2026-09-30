import { describe, expect, it } from "vitest";
import { backoffDelayMs } from "./backoff.ts";

describe("backoffDelayMs", () => {
  it("doubles from the base delay on each successive attempt", () => {
    expect(backoffDelayMs(0, 2000, 20000)).toBe(2000);
    expect(backoffDelayMs(1, 2000, 20000)).toBe(4000);
    expect(backoffDelayMs(2, 2000, 20000)).toBe(8000);
    expect(backoffDelayMs(3, 2000, 20000)).toBe(16000);
  });

  it("caps the delay rather than growing unboundedly", () => {
    expect(backoffDelayMs(4, 2000, 20000)).toBe(20000);
    expect(backoffDelayMs(10, 2000, 20000)).toBe(20000);
  });

  it("uses sensible defaults when base/max aren't passed", () => {
    expect(backoffDelayMs(0)).toBe(2000);
    expect(backoffDelayMs(20)).toBe(20000);
  });
});
