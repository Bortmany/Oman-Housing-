import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ---------------------------------------------------------------------------
// Security headers — sent with every response.
//
// The Content-Security-Policy is written so MapLibre GL keeps working: the map
// runs its tile workers from blob: URLs and fetches raster tiles from the tile
// server, so blob: and the tile origin must be allowed. The tile origin is
// derived from NEXT_PUBLIC_MAP_TILE_URL (default: OpenStreetMap), so swapping
// tile providers stays a config change — no code edit needed.
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === "development";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** "https://tile.openstreetmap.org/{z}/{x}/{y}.png" → "https://tile.openstreetmap.org".
 *  A "{s}" subdomain placeholder becomes a "*" wildcard, which CSP understands. */
function tileOrigin(url: string): string {
  const match = url.match(/^(https?:\/\/[^/]+)/);
  return match ? match[1].replace("{s}", "*") : "https://tile.openstreetmap.org";
}

const mapTileOrigin = tileOrigin(
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? DEFAULT_TILE_URL,
);

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js needs inline scripts; the dev server additionally needs eval
  // and a WebSocket for fast refresh (dev only — never in production).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mapTileOrigin}`,
  `connect-src 'self' ${mapTileOrigin}${isDev ? " ws:" : ""}`,
  // MapLibre GL runs its workers from blob: URLs (child-src is the fallback
  // directive older browsers use for workers).
  "worker-src 'self' blob:",
  "child-src blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app never asks for the camera, microphone, or device location
  // (the map centers on stored coordinates, not on the visitor).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Tell browsers to always use HTTPS — production only, so local dev
  // over plain http keeps working.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
