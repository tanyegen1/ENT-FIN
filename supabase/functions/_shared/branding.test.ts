import { describe, expect, it } from "vitest";
import { BRANDING_RECHECK_INTERVAL_MS, deriveWebsiteDomain, extractBranding, shouldAttemptBrandingEnrichment } from "./branding.ts";

describe("deriveWebsiteDomain", () => {
  it("strips a www. prefix and lowercases the host", () => {
    expect(deriveWebsiteDomain("https://WWW.Example.com/about")).toBe("example.com");
  });

  it("keeps a host with no www. prefix", () => {
    expect(deriveWebsiteDomain("https://apple.com")).toBe("apple.com");
  });

  it("returns null for an invalid URL", () => {
    expect(deriveWebsiteDomain("not a url")).toBeNull();
  });

  it("returns null for null/undefined/empty input", () => {
    expect(deriveWebsiteDomain(null)).toBeNull();
    expect(deriveWebsiteDomain(undefined)).toBeNull();
    expect(deriveWebsiteDomain("")).toBeNull();
  });
});

describe("extractBranding", () => {
  it("marks verified when both logo and icon are present", () => {
    const result = extractBranding({
      branding: { logo_url: "https://api.massive.com/logo.svg", icon_url: "https://api.massive.com/icon.png" },
      homepage_url: "https://www.apple.com",
    });
    expect(result).toEqual({
      logoUrl: "https://api.massive.com/logo.svg",
      iconUrl: "https://api.massive.com/icon.png",
      websiteDomain: "apple.com",
      brandingVerified: true,
    });
  });

  it("marks verified when only a logo is present", () => {
    const result = extractBranding({
      branding: { logo_url: "https://api.massive.com/logo.svg", icon_url: null },
      homepage_url: null,
    });
    expect(result.brandingVerified).toBe(true);
    expect(result.iconUrl).toBeNull();
    expect(result.websiteDomain).toBeNull();
  });

  it("marks verified when only an icon is present", () => {
    const result = extractBranding({
      branding: { logo_url: null, icon_url: "https://api.massive.com/icon.png" },
      homepage_url: undefined,
    });
    expect(result.brandingVerified).toBe(true);
    expect(result.logoUrl).toBeNull();
  });

  it("marks unverified with both fields null when branding is absent", () => {
    const result = extractBranding({ branding: null, homepage_url: null });
    expect(result).toEqual({
      logoUrl: null,
      iconUrl: null,
      websiteDomain: null,
      brandingVerified: false,
    });
  });

  it("derives websiteDomain independently of branding fields", () => {
    const result = extractBranding({ branding: null, homepage_url: "https://investor.example.com" });
    expect(result.websiteDomain).toBe("investor.example.com");
    expect(result.brandingVerified).toBe(false);
  });
});

describe("shouldAttemptBrandingEnrichment", () => {
  const now = new Date("2026-09-30T12:00:00.000Z").getTime();

  it("attempts enrichment when never checked before", () => {
    expect(shouldAttemptBrandingEnrichment(null, now)).toBe(true);
    expect(shouldAttemptBrandingEnrichment(undefined, now)).toBe(true);
  });

  it("attempts enrichment when the stored timestamp is unparseable", () => {
    expect(shouldAttemptBrandingEnrichment("not a date", now)).toBe(true);
  });

  it("does not re-attempt within the recheck interval", () => {
    const checkedAt = new Date(now - 60_000).toISOString();
    expect(shouldAttemptBrandingEnrichment(checkedAt, now)).toBe(false);
  });

  it("re-attempts once the recheck interval has elapsed", () => {
    const checkedAt = new Date(now - BRANDING_RECHECK_INTERVAL_MS - 1000).toISOString();
    expect(shouldAttemptBrandingEnrichment(checkedAt, now)).toBe(true);
  });
});
