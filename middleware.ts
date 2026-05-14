// NURA — Edge middleware
// ───────────────────────
// Sets baseline security and privacy headers on every response, including
// the strict cache-store directives for /api routes that touch personal
// data and a defence-in-depth Content-Security-Policy.

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // ── Common security headers (every response) ────────────────────────────
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    // Camera/microphone allowed (the live try-on uses them) but for the
    // current page's origin only — never via embedded iframes.
    "camera=(self), microphone=(), geolocation=(), browsing-topics=()"
  );
  // HSTS — opt browsers into HTTPS for 6 months. Only meaningful in prod.
  res.headers.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");

  // ── Content Security Policy ─────────────────────────────────────────────
  // We have to allow the MediaPipe CDN (jsdelivr.net) for the try-on
  // engine. Everything else is locked down to self.
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // 'unsafe-eval' required by MediaPipe wasm loader.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "connect-src 'self' https://cdn.jsdelivr.net",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  // ── No-store on PII routes ──────────────────────────────────────────────
  if (
    pathname.startsWith("/api/checkout") ||
    pathname.startsWith("/api/contact") ||
    pathname.startsWith("/api/analyze") ||
    pathname.startsWith("/api/data")
  ) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.headers.set("Pragma", "no-cache");
  }

  return res;
}

// Apply to every route except Next.js internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
