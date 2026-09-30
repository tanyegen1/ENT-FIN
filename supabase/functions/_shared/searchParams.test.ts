import { describe, expect, it } from "vitest";
import { isSearchParamsError, parseSearchParams } from "./searchParams.ts";

function url(qs: string): URL {
  return new URL(`https://example.com/catalogue-search?${qs}`);
}

describe("parseSearchParams", () => {
  it("requires a non-empty q", () => {
    const result = parseSearchParams(url(""));
    expect(isSearchParamsError(result)).toBe(true);
  });

  it("treats a whitespace-only q as missing", () => {
    const result = parseSearchParams(url("q=%20%20"));
    expect(isSearchParamsError(result)).toBe(true);
  });

  it("parses a plain ticker query with defaults", () => {
    const result = parseSearchParams(url("q=AAPL"));
    expect(isSearchParamsError(result)).toBe(false);
    if (!isSearchParamsError(result)) {
      expect(result).toEqual({ q: "AAPL", exchange: null, limit: 20, offset: 0 });
    }
  });

  it("accepts a valid exchange filter, case-insensitively", () => {
    const result = parseSearchParams(url("q=AAPL&exchange=xnas"));
    if (!isSearchParamsError(result)) expect(result.exchange).toBe("XNAS");
  });

  it("ignores an invalid exchange value rather than erroring", () => {
    const result = parseSearchParams(url("q=AAPL&exchange=LSE"));
    if (!isSearchParamsError(result)) expect(result.exchange).toBeNull();
  });

  it("clamps an excessive limit rather than trusting the client", () => {
    const result = parseSearchParams(url("q=AAPL&limit=99999"));
    if (!isSearchParamsError(result)) expect(result.limit).toBe(50);
  });

  it("falls back to default limit for a non-numeric or zero/negative value", () => {
    expect((parseSearchParams(url("q=AAPL&limit=abc")) as { limit: number }).limit).toBe(20);
    expect((parseSearchParams(url("q=AAPL&limit=0")) as { limit: number }).limit).toBe(20);
    expect((parseSearchParams(url("q=AAPL&limit=-5")) as { limit: number }).limit).toBe(20);
  });

  it("parses a valid offset and rejects a negative one", () => {
    expect((parseSearchParams(url("q=AAPL&offset=40")) as { offset: number }).offset).toBe(40);
    expect((parseSearchParams(url("q=AAPL&offset=-1")) as { offset: number }).offset).toBe(0);
  });
});
