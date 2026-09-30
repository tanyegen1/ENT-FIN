// @ts-nocheck — Deno Edge Function entrypoint (Deno.serve/Deno.env); not
// part of the app's `tsc -b` build and not imported by any Vitest test —
// see _shared/syncPlan.ts and _shared/massiveClient.ts for the tested pure
// logic this wires together.
//
// Full Nasdaq + NYSE (+ NYSE American + NYSE Arca) common-stock, ADR, and
// ETF catalogue sync (spec section 3). Safe/staged: writes every page into
// `instruments_staging` first; only once EVERY exchange/type combination
// has paginated to completion does it atomically merge into the live
// `instruments` table (via the activate_instrument_sync SQL function) and
// mark anything no longer present as inactive. A failed or partial fetch
// never touches the live table. Resumable across invocations via
// instrument_sync_runs.resume_state, since a full sync can exceed one
// invocation's execution-time budget.
//
// Trigger: POST with header `x-sync-secret: <CATALOGUE_SYNC_SECRET>`,
// either manually or from a scheduled pg_cron job — see README's
// "Catalogue sync" section for the exact `select cron.schedule(...)` to run
// once in the Supabase SQL editor.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getMassiveApiKey } from "../_shared/supabaseAdmin.ts";
import { fetchTickersPage, MassiveApiError } from "../_shared/massiveClient.ts";
import { normalizeTickerRef } from "../_shared/classify.ts";
import { advanceAfterPage, dedupeByProviderId, initialResumeState, isSyncComplete, type ResumeState } from "../_shared/syncPlan.ts";

const TIME_BUDGET_MS = 45_000;

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const expectedSecret = Deno.env.get("CATALOGUE_SYNC_SECRET");
  if (expectedSecret && req.headers.get("x-sync-secret") !== expectedSecret) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const apiKey = getMassiveApiKey();

  if (!apiKey) {
    const { data: run } = await supabase
      .from("instrument_sync_runs")
      .insert({
        provider: "massive",
        status: "failed",
        completed_at: new Date().toISOString(),
        error: "MASSIVE_API_KEY is not configured for this Supabase project. Set it under Edge Functions -> Manage secrets.",
      })
      .select()
      .single();
    return jsonResponse(
      { ok: false, status: "failed", error: "MASSIVE_API_KEY not configured", run },
      { status: 503 },
    );
  }

  const startedAt = Date.now();

  const { data: existingRun } = await supabase
    .from("instrument_sync_runs")
    .select("*")
    .eq("provider", "massive")
    .in("status", ["running", "partial"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let run = existingRun;
  let resumeState: ResumeState;

  if (run && run.resume_state) {
    resumeState = run.resume_state as ResumeState;
  } else {
    resumeState = initialResumeState();
    await supabase.rpc("truncate_instruments_staging");
    const inserted = await supabase
      .from("instrument_sync_runs")
      .insert({ provider: "massive", status: "running", resume_state: resumeState })
      .select()
      .single();
    run = inserted.data;
  }

  if (!run) {
    return jsonResponse({ ok: false, error: "could not create or load a sync run row" }, { status: 500 });
  }

  let pagesThisInvocation = 0;
  let seenThisInvocation = 0;

  try {
    while (!isSyncComplete(resumeState)) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        await supabase
          .from("instrument_sync_runs")
          .update({
            status: "partial",
            resume_state: resumeState,
            pages_fetched: (run.pages_fetched ?? 0) + pagesThisInvocation,
            instruments_seen: (run.instruments_seen ?? 0) + seenThisInvocation,
          })
          .eq("id", run.id);
        return jsonResponse({
          ok: true,
          status: "partial",
          message: "Time budget reached mid-sync; will resume on the next invocation (trigger again, or via the scheduled cron job).",
          runId: run.id,
        });
      }

      const combo = resumeState.currentCombo!;
      const page = await fetchTickersPage(
        { apiKey },
        { market: "stocks", type: combo.type, exchange: combo.exchange, active: true, limit: 1000 },
        resumeState.currentCursor ?? undefined,
      );
      pagesThisInvocation++;

      const rows = dedupeByProviderId(
        page.results
          .map(normalizeTickerRef)
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map((r) => ({
            provider: "massive",
            provider_id: r.providerId,
            ticker: r.ticker,
            name: r.name,
            primary_exchange: r.primaryExchange,
            security_type: r.securityType,
            is_adr: r.isAdr,
            currency: r.currency,
            active: r.active,
            cik: r.cik,
            composite_figi: r.compositeFigi,
            share_class_figi: r.shareClassFigi,
            metadata_updated_at: new Date().toISOString(),
          })),
      );
      seenThisInvocation += rows.length;

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from("instruments_staging")
          .upsert(rows, { onConflict: "provider,provider_id" });
        if (upsertError) throw new Error(`staging upsert failed: ${upsertError.message}`);
      }

      resumeState = advanceAfterPage(resumeState, page.next_url ?? null);
    }

    const { data: activateRows, error: activateError } = await supabase.rpc("activate_instrument_sync", {
      p_provider: "massive",
    });
    if (activateError) throw new Error(`activation failed: ${activateError.message}`);

    const summary = activateRows?.[0] ?? {
      activated: 0,
      deactivated: 0,
      counts_by_exchange: {},
      counts_by_security_type: {},
    };

    await supabase
      .from("instrument_sync_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        resume_state: null,
        pages_fetched: (run.pages_fetched ?? 0) + pagesThisInvocation,
        instruments_seen: (run.instruments_seen ?? 0) + seenThisInvocation,
        instruments_activated: summary.activated,
        instruments_deactivated: summary.deactivated,
        counts_by_exchange: summary.counts_by_exchange,
        counts_by_security_type: summary.counts_by_security_type,
      })
      .eq("id", run.id);

    return jsonResponse({ ok: true, status: "success", runId: run.id, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const kind = err instanceof MassiveApiError ? err.kind : "unknown";
    // A failed/partial fetch must never mark the live catalogue inactive or
    // erase it — `instruments` is simply never touched this attempt;
    // `instruments_staging` is discarded (truncated) at the start of the
    // next fresh run.
    await supabase
      .from("instrument_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: `[${kind}] ${message}`,
        pages_fetched: (run.pages_fetched ?? 0) + pagesThisInvocation,
        instruments_seen: (run.instruments_seen ?? 0) + seenThisInvocation,
      })
      .eq("id", run.id);
    return jsonResponse({ ok: false, status: "failed", error: message, kind, runId: run.id }, { status: 502 });
  }
});
