// @ts-nocheck — Deno Edge Function entrypoint; see catalogue-sync/index.ts's
// header note.
//
// Full details for one instrument, used when a user opens a stock page.
// Also performs lazy, on-demand branding enrichment (spec section 5):
// Massive's bulk reference-data list never includes branding, only the
// per-ticker GET /v3/reference/tickers/{ticker} call does, so rather than
// bulk-enriching potentially thousands of instruments up front, this
// fetches and caches branding the first time a specific instrument's page
// is actually opened, and not again for BRANDING_RECHECK_INTERVAL_MS —
// including when no branding was found, so a thinly-traded instrument with
// genuinely no provider branding isn't re-queried on every page view.
//
// A branding-enrichment failure (rate limit, network error, no API key)
// never fails this request — the instrument's existing catalogue row is
// still returned, just without fresher branding this time.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, getMassiveApiKey } from "../_shared/supabaseAdmin.ts";
import { fetchTickerDetails, MassiveApiError } from "../_shared/massiveClient.ts";
import { extractBranding, shouldAttemptBrandingEnrichment } from "../_shared/branding.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return jsonResponse({ ok: false, error: "missing ticker" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: instrument, error } = await supabase
    .from("instruments")
    .select(
      "id, ticker, name, primary_exchange, security_type, is_adr, currency, active, cik, composite_figi, " +
        "share_class_figi, website_domain, logo_url, icon_url, branding_verified, branding_checked_at, " +
        "trading_eligible, extended_hours_eligible, metadata_updated_at",
    )
    .eq("ticker", ticker)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, { status: 500 });
  }
  if (!instrument) {
    return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
  }

  const apiKey = getMassiveApiKey();
  if (!apiKey || !shouldAttemptBrandingEnrichment(instrument.branding_checked_at, Date.now())) {
    return jsonResponse({ ok: true, instrument });
  }

  try {
    const details = await fetchTickerDetails({ apiKey }, ticker);
    const branding = extractBranding(details);
    const { data: updated } = await supabase
      .from("instruments")
      .update({
        logo_url: branding.logoUrl,
        icon_url: branding.iconUrl,
        website_domain: branding.websiteDomain,
        branding_verified: branding.brandingVerified,
        branding_checked_at: new Date().toISOString(),
      })
      .eq("id", instrument.id)
      .select(
        "id, ticker, name, primary_exchange, security_type, is_adr, currency, active, cik, composite_figi, " +
          "share_class_figi, website_domain, logo_url, icon_url, branding_verified, branding_checked_at, " +
          "trading_eligible, extended_hours_eligible, metadata_updated_at",
      )
      .maybeSingle();

    return jsonResponse({
      ok: true,
      instrument: updated ?? instrument,
      companyInfo: { marketCap: details.market_cap ?? null, listDate: details.list_date ?? null, homepageUrl: details.homepage_url ?? null },
    });
  } catch (err) {
    // Enrichment failed — still mark branding_checked_at so a persistently
    // rate-limited or branding-less ticker doesn't get re-hit on every view;
    // an unauthorized key is the one exception, since that's a deployment
    // misconfiguration worth retrying on the very next view once fixed.
    if (!(err instanceof MassiveApiError) || err.kind !== "unauthorized") {
      await supabase.from("instruments").update({ branding_checked_at: new Date().toISOString() }).eq("id", instrument.id);
    }
    return jsonResponse({ ok: true, instrument, brandingEnrichmentError: err instanceof Error ? err.message : String(err) });
  }
});
