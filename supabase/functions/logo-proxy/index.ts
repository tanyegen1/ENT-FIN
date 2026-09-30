// @ts-nocheck — Deno Edge Function entrypoint; see catalogue-sync/index.ts's
// header note.
//
// Securely proxies a verified branding asset so the Massive API key never
// appears in a client-visible <img> URL (spec section 5). Looks up the
// instrument's stored branding URL (populated only once verified against
// the issuer — see catalogue-sync), fetches it server-side with the key
// appended, validates content-type and size, sanitizes SVGs, and returns
// the bytes with a long cache lifetime. Any failure — no instrument, no
// branding on file, fetch error, disallowed type — is a 404, so the
// client's existing initials-placeholder fallback takes over gracefully
// rather than the page breaking on a broken <img> src.

import { createAdminClient, getMassiveApiKey } from "../_shared/supabaseAdmin.ts";
import { isAllowedImageContentType, isWithinSizeLimit, sanitizeSvg } from "../_shared/logoSecurity.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const kind = url.searchParams.get("kind") === "icon" ? "icon_url" : "logo_url";
  if (!ticker) {
    return new Response("missing ticker", { status: 400 });
  }

  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    return new Response("branding proxy unavailable — MASSIVE_API_KEY not configured", { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: instrument } = await supabase
    .from("instruments")
    .select("logo_url, icon_url, branding_verified")
    .eq("ticker", ticker)
    .eq("active", true)
    .maybeSingle();

  const brandingUrl = instrument?.[kind] as string | null | undefined;
  if (!instrument || !instrument.branding_verified || !brandingUrl) {
    // No verified branding on file — never guess or substitute. The
    // client's placeholder-initials logo takes over for this response.
    return new Response("no verified branding on file for this instrument", { status: 404 });
  }

  let upstream: Response;
  try {
    const withKey = `${brandingUrl}${brandingUrl.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(apiKey)}`;
    upstream = await fetch(withKey);
  } catch {
    return new Response("branding asset fetch failed", { status: 502 });
  }
  if (!upstream.ok) {
    return new Response("branding asset fetch failed", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type");
  if (!isAllowedImageContentType(contentType)) {
    return new Response("branding asset rejected: unsupported content-type", { status: 415 });
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (!isWithinSizeLimit(bytes.byteLength)) {
    return new Response("branding asset rejected: size out of bounds", { status: 413 });
  }

  const isSvg = (contentType ?? "").toLowerCase().includes("svg");
  const body = isSvg ? new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(bytes))) : bytes;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType!,
      // Branding rarely changes — cache aggressively both at the edge and
      // in the browser rather than re-fetching/re-proxying on every view.
      "cache-control": "public, max-age=86400, immutable",
    },
  });
});
