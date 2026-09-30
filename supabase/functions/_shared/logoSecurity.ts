const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

export function isAllowedImageContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(base);
}

export function isWithinSizeLimit(byteLength: number): boolean {
  return byteLength > 0 && byteLength <= MAX_LOGO_BYTES;
}

/**
 * A conservative, regex-based strip of the most common SVG XSS vectors —
 * inline <script>, on*="" event-handler attributes, javascript: URIs, and
 * <foreignObject> (which can embed arbitrary HTML/script). This is a basic
 * mitigation appropriate for a narrow, provider-controlled input (branding
 * assets from one configured data provider); it is not a substitute for a
 * full SVG sanitizer library in a context that accepts arbitrary
 * user-uploaded SVGs.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
}
