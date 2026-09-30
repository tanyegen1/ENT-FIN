import { describe, expect, it } from "vitest";
import { advanceAfterPage, buildFullComboQueue, dedupeByProviderId, initialResumeState, isSyncComplete, SYNC_EXCHANGES, SYNC_TYPES } from "./syncPlan.ts";

describe("buildFullComboQueue", () => {
  it("covers every exchange x type pair exactly once", () => {
    const combos = buildFullComboQueue();
    expect(combos).toHaveLength(SYNC_EXCHANGES.length * SYNC_TYPES.length);
    const seen = new Set(combos.map((c) => `${c.exchange}:${c.type}`));
    expect(seen.size).toBe(combos.length); // no duplicates
    for (const exchange of SYNC_EXCHANGES) {
      for (const type of SYNC_TYPES) {
        expect(seen.has(`${exchange}:${type}`)).toBe(true);
      }
    }
  });
});

describe("resumable sync state machine", () => {
  it("starts on the first combo with no cursor", () => {
    const state = initialResumeState();
    expect(state.currentCombo).toEqual(buildFullComboQueue()[0]);
    expect(state.currentCursor).toBeNull();
    expect(isSyncComplete(state)).toBe(false);
  });

  it("stays on the same combo, updating only the cursor, when a page reports a next_url", () => {
    const state = initialResumeState();
    const next = advanceAfterPage(state, "https://api.massive.com/v3/reference/tickers?cursor=abc");
    expect(next.currentCombo).toEqual(state.currentCombo);
    expect(next.currentCursor).toBe("https://api.massive.com/v3/reference/tickers?cursor=abc");
    expect(next.remainingCombos).toEqual(state.remainingCombos);
  });

  it("moves to the next combo and clears the cursor once a combo's pagination ends (no next_url)", () => {
    const state = initialResumeState();
    const next = advanceAfterPage(state, null);
    expect(next.currentCombo).toEqual(buildFullComboQueue()[1]);
    expect(next.currentCursor).toBeNull();
  });

  it("walks every combo exactly once before reporting complete", () => {
    let state = initialResumeState();
    let steps = 0;
    const seen: string[] = [];
    while (!isSyncComplete(state)) {
      seen.push(`${state.currentCombo!.exchange}:${state.currentCombo!.type}`);
      state = advanceAfterPage(state, null); // simulate every combo being a single page
      steps++;
      if (steps > 100) throw new Error("runaway loop — advanceAfterPage never completed");
    }
    expect(seen).toHaveLength(buildFullComboQueue().length);
    expect(new Set(seen).size).toBe(seen.length);
    expect(state.currentCombo).toBeNull();
  });

  it("is resumable: reconstructing state mid-way (as if loaded from a DB row) continues correctly", () => {
    let state = initialResumeState();
    state = advanceAfterPage(state, "cursor-page-2"); // mid-page-1 of combo 0
    // Simulate persisting `state` to resume_state and reloading it verbatim.
    const reloaded: typeof state = JSON.parse(JSON.stringify(state));
    const next = advanceAfterPage(reloaded, null); // that combo's last page
    expect(next.currentCombo).toEqual(buildFullComboQueue()[1]);
  });
});

describe("dedupeByProviderId", () => {
  it("leaves a batch with no duplicates unchanged", () => {
    const rows = [{ provider_id: "a", n: 1 }, { provider_id: "b", n: 2 }];
    expect(dedupeByProviderId(rows)).toEqual(rows);
  });

  it("collapses duplicate provider_ids within one page, keeping the last occurrence", () => {
    const rows = [
      { provider_id: "a", n: 1 },
      { provider_id: "b", n: 2 },
      { provider_id: "a", n: 3 }, // same id as the first row, later in the page
    ];
    const result = dedupeByProviderId(rows);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.provider_id === "a")?.n).toBe(3);
  });

  it("returns an empty array for an empty batch", () => {
    expect(dedupeByProviderId([])).toEqual([]);
  });
});
