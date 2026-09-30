// @ts-nocheck — Deno Edge Function entrypoint; see catalogue-sync/index.ts's
// header note.
//
// Batch quote snapshot for whatever symbols a screen currently has visible
// (spec section 7: "batch snapshots for visible lists... do not poll every
// instrument individually"). Every returned price carries its own
// identity, currency, price type, source timestamp, feed, and freshness —
// never a bare number — and a symbol with no usable quote is reported as
// unavailable rather than silently dropped or shown as $0.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { getConfiguredQuoteDelaySeconds, getMassiveApiKey } from "../_shared/supabaseAdmin.ts";
import { fetchSnapshotTickers, MassiveApiError, selectQuoteFromSnapshot } from "../_shared/massiveClient.ts";

const MAX_TICKERS_PER_REQUEST = 100;

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const tickersRaw = (url.searchParams.get("tickers") ?? "").trim();
  if (!tickersRaw) {
    return jsonResponse({ ok: false, error: "missing required 'tickers' query parameter (comma-separated)" }, { status: 400 });
  }
  const tickers = [...new Set(tickersRaw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    MAX_TICKERS_PER_REQUEST,
  );

  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    return jsonResponse(
      {
        ok: false,
        error: "unavailable",
        reason: "MASSIVE_API_KEY not configured for this deployment",
        quotes: tickers.map((ticker) => ({ ticker, quote: null, status: "unavailable" })),
      },
      { status: 503 },
    );
  }

  try {
    const snapshots = await fetchSnapshotTickers({ apiKey }, tickers);
    const byTicker = new Map(snapshots.map((s) => [s.ticker, s]));
    const nowMs = Date.now();
    const delaySeconds = getConfiguredQuoteDelaySeconds();

    const quotes = tickers.map((ticker) => {
      const snap = byTicker.get(ticker);
      if (!snap) return { ticker, quote: null, status: "unavailable" as const };
      const quote = selectQuoteFromSnapshot(ticker, snap, nowMs, delaySeconds);
      return quote ? { ticker, quote, status: "ok" as const } : { ticker, quote: null, status: "unavailable" as const };
    });

    return jsonResponse({ ok: true, quotes, quoteDelaySeconds: delaySeconds });
  } catch (err) {
    if (err instanceof MassiveApiError) {
      return jsonResponse({ ok: false, error: err.kind, message: err.message }, { status: err.status || 502 });
    }
    return jsonResponse({ ok: false, error: "unknown_error", message: String(err) }, { status: 500 });
  }
});
