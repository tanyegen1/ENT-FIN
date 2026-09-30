// @ts-nocheck — Deno Edge Function entrypoint; see catalogue-sync/index.ts's
// header note. Tested pure logic lives in _shared/searchParams.ts.
//
// One search experience across every modeled exchange (spec section 4):
// exact ticker match first, then ticker-prefix, then company name — ranked
// server-side by search_instruments() (schema.sql) so the client never
// downloads the full catalogue to filter it locally. Every result carries
// its trading/extended-hours eligibility and branding-verification state;
// catalogue presence never implies trading eligibility on its own.

import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { isSearchParamsError, parseSearchParams } from "../_shared/searchParams.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const parsed = parseSearchParams(url);
  if (isSearchParamsError(parsed)) {
    return jsonResponse({ ok: false, error: parsed.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("search_instruments", {
    p_query: parsed.q,
    p_exchange: parsed.exchange,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, { status: 500 });
  }

  return jsonResponse({
    ok: true,
    query: parsed.q,
    exchange: parsed.exchange,
    results: data ?? [],
    // The client treats a full page as "there may be more" and requests
    // the next offset on demand, rather than this function running a
    // separate COUNT(*) query on every keystroke.
    hasMore: (data?.length ?? 0) === parsed.limit,
  });
});
