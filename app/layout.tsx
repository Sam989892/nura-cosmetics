import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/mobile.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { CartProvider } from "@/lib/cart";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-cormorant",
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nuracosmetics.co.uk"),
  title: "NURA Cosmetics — Halal Beauty. Real You.",
  description:
    "UK-based halal cosmetics for British Muslim women. MUI Halal certified, wudu-friendly, permissible for Hajj & Umrah. Official UK partner of Wardah.",
  keywords: ["halal cosmetics", "wudu-friendly", "Wardah UK", "British Muslim beauty", "halal makeup"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "NURA Cosmetics — Halal Beauty. Real You.",
    description: "Halal, wudu-friendly beauty for the British Muslim woman.",
    type: "website",
    images: [{ url: "/images/site/hero-model.png", width: 1200, height: 1200, alt: "NURA brand campaign" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#4a1e3a" />
        {/*
          MediaPipe noise suppressor. Must run before Next.js dev overlay
          registers its own error listeners, otherwise the overlay grabs
          the FaceMesh wasm/loader exceptions first and our useEffect
          listener can't stop the dev modal. Inlined synchronously in the
          document head so it executes before any module bundle.
        */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  if (typeof window === 'undefined') return;
  if (window.__nuraMpSuppressorInstalled) return;
  window.__nuraMpSuppressorInstalled = true;

  var NOISE = [
    'face_mesh_solution_packed_assets_loader.js',
    'face_mesh_solution_simd_wasm_bin.js',
    'face_mesh_solution_wasm_bin.js',
    'hands_solution_packed_assets_loader.js',
    'hands_solution_simd_wasm_bin.js',
    'hands_solution_wasm_bin.js',
    '@mediapipe/face_mesh',
    '@mediapipe/hands'
  ];

  function looksLikeMpNoise(text) {
    if (!text) return false;
    for (var i = 0; i < NOISE.length; i++) {
      if (text.indexOf(NOISE[i]) !== -1) return true;
    }
    return false;
  }

  function errText(e) {
    var parts = [];
    try { if (e && e.filename) parts.push(String(e.filename)); } catch (_) {}
    try { if (e && e.message) parts.push(String(e.message)); } catch (_) {}
    try { if (e && e.error && e.error.stack) parts.push(String(e.error.stack)); } catch (_) {}
    try {
      if (e && e.reason) {
        var r = e.reason;
        if (r && r.stack) parts.push(String(r.stack));
        else parts.push(String(r));
      }
    } catch (_) {}
    return parts.join('\\n');
  }

  // Capture-phase listeners installed FIRST so they win the registration
  // order race against Next.js dev overlay listeners.
  window.addEventListener('error', function (e) {
    if (looksLikeMpNoise(errText(e))) {
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    if (looksLikeMpNoise(errText(e))) {
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      return false;
    }
  }, true);

  // Wrap any FUTURE error / unhandledrejection listener registrations so
  // they short-circuit on MediaPipe noise even if they were added after
  // our own (e.g. by HMR re-mounts of the dev overlay).
  var origAdd = window.addEventListener;
  window.addEventListener = function (type, listener, options) {
    if ((type === 'error' || type === 'unhandledrejection') && typeof listener === 'function') {
      var wrapped = function (ev) {
        try {
          if (looksLikeMpNoise(errText(ev))) return;
        } catch (_) {}
        return listener.apply(this, arguments);
      };
      try { listener.__nuraWrapped = wrapped; } catch (_) {}
      return origAdd.call(this, type, wrapped, options);
    }
    return origAdd.call(this, type, listener, options);
  };

  // Console.error filter — Next.js dev surfaces some of these via console too.
  var origConsoleError = console.error;
  console.error = function () {
    try {
      var text = '';
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        if (a && typeof a === 'object') {
          if (a.stack) text += String(a.stack) + ' ';
          else if (a.message) text += String(a.message) + ' ';
          else { try { text += JSON.stringify(a) + ' '; } catch (_) { text += String(a) + ' '; } }
        } else {
          text += String(a) + ' ';
        }
      }
      if (looksLikeMpNoise(text)) return;
    } catch (_) {}
    return origConsoleError.apply(this, arguments);
  };

  // window.onerror as last belt-and-braces.
  var origOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    var text = (source || '') + '\\n' + (message || '') + '\\n' + ((error && error.stack) || '');
    if (looksLikeMpNoise(text)) return true; // swallow
    if (typeof origOnError === 'function') {
      return origOnError.apply(this, arguments);
    }
    return false;
  };
})();
            `.trim(),
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <CartProvider>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
          <CookieConsent />
        </CartProvider>
      </body>
    </html>
  );
}
