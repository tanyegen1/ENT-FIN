import type { MassiveTickerDetails } from "./types.ts";

/**
 * A verified logo/website for an instrument means "attributed by the data
 * provider to this specific instrument's own record" — never a ticker-to-
 * domain guess, never a name-similarity match, never an image-search
 * result (spec section 5). Massive/Polygon's ticker-details response
 * carries `homepage_url` and `branding.{logo_url,icon_url}` directly tied
 * to the CIK/FIGI-identified company behind this ticker, which is what
 * "verified" means here — this function just normalizes that data, it
 * never invents or substitutes it.
 */
export function deriveWebsiteDomain(homepageUrl: string | null | undefined): string | null {
  if (!homepageUrl) return null;
  try {
    const parsed = new URL(homepageUrl);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export interface BrandingUpdate {
  logoUrl: string | null;
  iconUrl: string | null;
  websiteDomain: string | null;
  brandingVerified: boolean;
}

/** Whether `details` actually supplied verified branding — never true on missing/empty data, so a caller never marks an instrument as having a "verified" logo it doesn't actually have. */
export function extractBranding(details: Pick<MassiveTickerDetails, "branding" | "homepage_url">): BrandingUpdate {
  const logoUrl = details.branding?.logo_url ?? null;
  const iconUrl = details.branding?.icon_url ?? null;
  const websiteDomain = deriveWebsiteDomain(details.homepage_url);
  return {
    logoUrl,
    iconUrl,
    websiteDomain,
    brandingVerified: Boolean(logoUrl || iconUrl),
  };
}

/**
 * Lazy per-ticker enrichment (spec section 5) only calls Massive's
 * single-ticker details endpoint the first time a stock page is opened for
 * that instrument, and then not again for `BRANDING_RECHECK_INTERVAL_MS` —
 * including when the first attempt found no branding at all. Without this
 * cooldown, a thinly-traded instrument with genuinely no provider branding
 * would re-hit the details endpoint on every single page view.
 */
export const BRANDING_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export function shouldAttemptBrandingEnrichment(brandingCheckedAt: string | null | undefined, nowMs: number): boolean {
  if (!brandingCheckedAt) return true;
  const checkedMs = new Date(brandingCheckedAt).getTime();
  if (!Number.isFinite(checkedMs)) return true;
  return nowMs - checkedMs > BRANDING_RECHECK_INTERVAL_MS;
}
