import { describe, expect, it } from "vitest";
import { isAllowedImageContentType, isWithinSizeLimit, sanitizeSvg } from "./logoSecurity.ts";

describe("isAllowedImageContentType", () => {
  it("accepts common image types", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]) {
      expect(isAllowedImageContentType(t)).toBe(true);
    }
  });

  it("accepts a type with a charset suffix", () => {
    expect(isAllowedImageContentType("image/svg+xml; charset=utf-8")).toBe(true);
  });

  it("rejects non-image types and missing content-type", () => {
    expect(isAllowedImageContentType("text/html")).toBe(false);
    expect(isAllowedImageContentType("application/javascript")).toBe(false);
    expect(isAllowedImageContentType(null)).toBe(false);
    expect(isAllowedImageContentType(undefined)).toBe(false);
    expect(isAllowedImageContentType("")).toBe(false);
  });
});

describe("isWithinSizeLimit", () => {
  it("accepts a normal logo size", () => {
    expect(isWithinSizeLimit(50_000)).toBe(true);
  });

  it("rejects zero, negative, and oversized payloads", () => {
    expect(isWithinSizeLimit(0)).toBe(false);
    expect(isWithinSizeLimit(-1)).toBe(false);
    expect(isWithinSizeLimit(3 * 1024 * 1024)).toBe(false);
  });
});

describe("sanitizeSvg", () => {
  it("strips an inline <script> tag", () => {
    const result = sanitizeSvg('<svg><script>alert(1)</script><circle r="1"/></svg>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<circle");
  });

  it("strips on*= event handler attributes", () => {
    const result = sanitizeSvg('<svg onload="alert(1)"><rect onclick=\'evil()\'/></svg>');
    expect(result).not.toMatch(/on\w+\s*=/i);
  });

  it("strips javascript: URIs", () => {
    const result = sanitizeSvg('<svg><a href="javascript:alert(1)">x</a></svg>');
    expect(result).not.toContain("javascript:");
  });

  it("strips <foreignObject> content", () => {
    const result = sanitizeSvg("<svg><foreignObject><div>hi</div></foreignObject></svg>");
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("<div>");
  });

  it("leaves an ordinary clean SVG untouched in structure", () => {
    const input = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#000"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });
});
