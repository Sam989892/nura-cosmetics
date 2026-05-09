/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async headers() {
    // Dev: allow unsafe-eval for webpack HMR; Prod: wasm-unsafe-eval only.
    // MediaPipe FaceMesh compiles a WASM binary at runtime — without
    // 'wasm-unsafe-eval' the binary fails to compile silently in production,
    // so onResults never fires and face detection always returns null.
    // 'wasm-unsafe-eval' (CSP L3) permits only WebAssembly compilation, not
    // general JS eval, so it is strictly narrower than 'unsafe-eval'.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
      : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://cdn.jsdelivr.net ws://localhost:*; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
export default nextConfig;
