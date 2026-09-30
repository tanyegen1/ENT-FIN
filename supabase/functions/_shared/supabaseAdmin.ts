// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — Deno-only module (Deno.env, npm: specifier); not part of
// the app's `tsc -b` build (see tsconfig.json — only src/ and
// vite.config.ts are checked) and not imported by any Vitest test, so this
// suppression can't hide a real app-code type error.
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * A service-role Supabase client — bypasses Row Level Security, so it's
 * only ever created inside an Edge Function (server-side, Deno runtime),
 * never shipped to or constructed by the browser. SUPABASE_SERVICE_ROLE_KEY
 * is one of the handful of env vars Supabase injects into every Edge
 * Function automatically; it is never read from a VITE_-prefixed variable
 * (those get bundled into client JS) and never logged.
 */
export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured for this Edge Function");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function getMassiveApiKey(): string | null {
  return Deno.env.get("MASSIVE_API_KEY") ?? null;
}

/** Seconds of quote delay this account's Massive plan is entitled to — 0 means real-time-entitled. Operator-set; never inferred from a response (see massiveClient.ts's computeFreshness). */
export function getConfiguredQuoteDelaySeconds(): number {
  const raw = Deno.env.get("MASSIVE_QUOTE_DELAY_SECONDS");
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
