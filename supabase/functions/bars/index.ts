// @ts-nocheck — Deno Edge Function entrypoint; see catalogue-sync/index.ts's
// header note.
//
// On-demand historical aggregates for the chart (spec sections 7-8).
// Real data only — never fills a missing range with synthetic bars, and
// never silently reuses another instrument's data. A symbol with no
// available history returns an explicit "unavailable" status so the client
// can render "Historical data unavailable" rather than an empty/misleading
// chart.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { getMassiveApiKey } from "../_shared/supabaseAdmin.ts";
import { fetchAggregates, MassiveApiError, normalizeAggregates } from "../_shared/massiveClient.ts";
import { isBarsParamsError, parseBarsParams } from "../_shared/barsParams.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const parsed = parseBarsParams(url);
  if (isBarsParamsError(parsed)) {
    return jsonResponse({ ok: false, error: parsed.error }, { status: 400 });
  }

  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    return jsonResponse(
      { ok: false, error: "unavailable", reason: "MASSIVE_API_KEY not configured for this deployment", bars: [] },
      { status: 503 },
    );
  }

  try {
    const response = await fetchAggregates(
      { apiKey },
      {
        ticker: parsed.ticker,
        multiplier: parsed.multiplier,
        timespan: parsed.timespan,
        from: parsed.from,
        to: parsed.to,
        adjusted: parsed.adjusted,
      },
    );
    const bars = normalizeAggregates(response);
    if (bars.length === 0) {
      return jsonResponse({ ok: true, ticker: parsed.ticker, bars: [], status: "unavailable" });
    }
    return jsonResponse({ ok: true, ticker: parsed.ticker, bars, status: "ok", adjusted: parsed.adjusted });
  } catch (err) {
    if (err instanceof MassiveApiError) {
      if (err.kind === "not_found") {
        return jsonResponse({ ok: true, ticker: parsed.ticker, bars: [], status: "unavailable" });
      }
      return jsonResponse({ ok: false, error: err.kind, message: err.message }, { status: err.status || 502 });
    }
    return jsonResponse({ ok: false, error: "unknown_error", message: String(err) }, { status: 500 });
  }
});
