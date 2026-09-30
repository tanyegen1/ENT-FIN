import { describe, expect, it, vi } from "vitest";
import {
  MassiveApiError,
  computeFreshness,
  fetchAggregates,
  fetchTickersPage,
  iterateAllTickers,
  normalizeAggregates,
  normalizeEpochToMs,
  selectQuoteFromSnapshot,
} from "./massiveClient.ts";
import type { MassiveAggsResponse, MassiveSnapshotTicker, MassiveTickersPage } from "./types.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchTickersPage", () => {
  it("builds the first-page URL with market/type/exchange/active/limit and the key", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return jsonResponse({ results: [], status: "OK", request_id: "1" } satisfies MassiveTickersPage);
    });
    await fetchTickersPage(
      { apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch },
      { market: "stocks", type: "CS", exchange: "XNAS", active: true, limit: 1000 },
    );
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]);
    expect(url.pathname).toBe("/v3/reference/tickers");
    expect(url.searchParams.get("market")).toBe("stocks");
    expect(url.searchParams.get("type")).toBe("CS");
    expect(url.searchParams.get("exchange")).toBe("XNAS");
    expect(url.searchParams.get("active")).toBe("true");
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(url.searchParams.get("apiKey")).toBe("secret-key");
  });

  it("follows a cursor URL by appending apiKey rather than rebuilding query params", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return jsonResponse({ results: [], status: "OK", request_id: "1" } satisfies MassiveTickersPage);
    });
    await fetchTickersPage(
      { apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch },
      {},
      "https://api.massive.com/v3/reference/tickers?cursor=abc123",
    );
    expect(calls[0]).toBe("https://api.massive.com/v3/reference/tickers?cursor=abc123&apiKey=secret-key");
  });

  it("classifies a 401 as an unauthorized MassiveApiError, never a silent empty result", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, 401));
    await expect(
      fetchTickersPage({ apiKey: "bad-key", fetchImpl: fetchImpl as unknown as typeof fetch }, {}),
    ).rejects.toMatchObject({ kind: "unauthorized" } satisfies Partial<MassiveApiError>);
  });

  it("classifies a 429 as rate_limited", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429));
    await expect(
      fetchTickersPage({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch }, {}),
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("classifies a 500 as server_error and a thrown network exception as network_error", async () => {
    const fetchImpl500 = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      fetchTickersPage({ apiKey: "k", fetchImpl: fetchImpl500 as unknown as typeof fetch }, {}),
    ).rejects.toMatchObject({ kind: "server_error" });

    const fetchImplDown = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(
      fetchTickersPage({ apiKey: "k", fetchImpl: fetchImplDown as unknown as typeof fetch }, {}),
    ).rejects.toMatchObject({ kind: "network_error" });
  });
});

describe("iterateAllTickers", () => {
  it("follows every next_url until the provider stops returning one — never stops at page 1", async () => {
    const page1: MassiveTickersPage = {
      results: [{ ticker: "A", name: "A Inc", market: "stocks", locale: "us", active: true }],
      status: "OK",
      request_id: "1",
      next_url: "https://api.massive.com/v3/reference/tickers?cursor=page2",
    };
    const page2: MassiveTickersPage = {
      results: [{ ticker: "B", name: "B Inc", market: "stocks", locale: "us", active: true }],
      status: "OK",
      request_id: "2",
      next_url: "https://api.massive.com/v3/reference/tickers?cursor=page3",
    };
    const page3: MassiveTickersPage = {
      results: [{ ticker: "C", name: "C Inc", market: "stocks", locale: "us", active: true }],
      status: "OK",
      request_id: "3",
      // no next_url — pagination genuinely ends here
    };
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call++;
      if (call === 1) return jsonResponse(page1);
      if (call === 2) return jsonResponse(page2);
      return jsonResponse(page3);
    });

    const pages: string[][] = [];
    for await (const { results } of iterateAllTickers({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch }, { market: "stocks" })) {
      pages.push(results.map((r) => r.ticker));
    }
    expect(pages).toEqual([["A"], ["B"], ["C"]]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("stops at maxPages as a safety valve against a misbehaving cursor, rather than looping forever", async () => {
    const infinitePage: MassiveTickersPage = {
      results: [{ ticker: "X", name: "X", market: "stocks", locale: "us", active: true }],
      status: "OK",
      request_id: "x",
      next_url: "https://api.massive.com/v3/reference/tickers?cursor=same",
    };
    const fetchImpl = vi.fn(async () => jsonResponse(infinitePage));

    let pageCount = 0;
    for await (const _ of iterateAllTickers({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch }, {}, 5)) {
      pageCount++;
    }
    expect(pageCount).toBe(5);
  });
});

describe("fetchAggregates", () => {
  it("builds the correct aggregates URL", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return jsonResponse({ ticker: "AAPL", status: "OK", adjusted: true, results: [] } satisfies MassiveAggsResponse);
    });
    await fetchAggregates(
      { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch },
      { ticker: "AAPL", multiplier: 5, timespan: "minute", from: "2025-06-16", to: "2025-06-16" },
    );
    const url = new URL(calls[0]);
    expect(url.pathname).toBe("/v2/aggs/ticker/AAPL/range/5/minute/2025-06-16/2025-06-16");
    expect(url.searchParams.get("adjusted")).toBe("true");
  });
});

describe("normalizeEpochToMs", () => {
  it("detects nanoseconds", () => {
    const ns = 1_718_000_000_000_000_000; // ~2024, in ns
    expect(normalizeEpochToMs(ns)).toBe(Math.round(ns / 1e6));
  });

  it("detects milliseconds", () => {
    const ms = 1_718_000_000_000; // ~2024, in ms
    expect(normalizeEpochToMs(ms)).toBe(ms);
  });

  it("detects seconds", () => {
    const s = 1_718_000_000; // ~2024, in s
    expect(normalizeEpochToMs(s)).toBe(s * 1000);
  });
});

describe("computeFreshness", () => {
  const now = Date.UTC(2025, 5, 16, 15, 0, 0);

  it("reads real_time for a fresh price with no configured delay", () => {
    expect(computeFreshness(now - 10_000, now, 0)).toBe("real_time");
  });

  it("reads stale for an old price with no configured delay", () => {
    expect(computeFreshness(now - 10 * 60_000, now, 0)).toBe("stale");
  });

  it("never reports real_time when the account is configured as delayed, even for a fresh-looking timestamp", () => {
    expect(computeFreshness(now - 1000, now, 900)).toBe("delayed");
  });

  it("reads stale once a delayed feed's price exceeds its configured delay plus grace", () => {
    expect(computeFreshness(now - 20 * 60_000, now, 900)).toBe("stale");
  });
});

describe("selectQuoteFromSnapshot", () => {
  const now = Date.UTC(2025, 5, 16, 15, 0, 0);

  it("prefers a real last trade, labeled last_trade", () => {
    const snap: MassiveSnapshotTicker = { ticker: "AAPL", lastTrade: { p: 227.5, s: 100, t: now - 5000 } };
    const quote = selectQuoteFromSnapshot("AAPL", snap, now, 0);
    expect(quote).toMatchObject({ price: 227.5, priceType: "last_trade", freshness: "real_time" });
  });

  it("falls back to the regular close, explicitly labeled — never presented as a live trade", () => {
    const snap: MassiveSnapshotTicker = { ticker: "AAPL", prevDay: { o: 1, h: 2, l: 1, c: 224.31, v: 100 } };
    const quote = selectQuoteFromSnapshot("AAPL", snap, now, 0);
    expect(quote).toMatchObject({ price: 224.31, priceType: "regular_close", freshness: "end_of_day" });
  });

  it("returns null (never $0, never fabricated) when neither a trade nor a prior close exists", () => {
    expect(selectQuoteFromSnapshot("AAPL", { ticker: "AAPL" }, now, 0)).toBeNull();
  });

  it("rejects a zero or negative last-trade price rather than displaying $0", () => {
    const snap: MassiveSnapshotTicker = { ticker: "AAPL", lastTrade: { p: 0, s: 100, t: now } };
    expect(selectQuoteFromSnapshot("AAPL", snap, now, 0)).toBeNull();
  });
});

describe("normalizeAggregates", () => {
  it("maps bars 1:1, carrying the adjusted flag through", () => {
    const response: MassiveAggsResponse = {
      ticker: "AAPL",
      status: "OK",
      adjusted: true,
      results: [{ o: 1, h: 2, l: 0.5, c: 1.5, v: 1000, t: 1_718_000_000_000 }],
    };
    expect(normalizeAggregates(response)).toEqual([
      { t: 1_718_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1000, adjusted: true },
    ]);
  });

  it("returns an empty array (never a fabricated bar) when the provider has no results", () => {
    expect(normalizeAggregates({ ticker: "AAPL", status: "OK", adjusted: true })).toEqual([]);
  });
});
