"use client";

import { useEffect } from "react";

// Last-resort error boundary. Only renders if the root layout itself throws
// (e.g. CartProvider or Nav crashes). Must define its own <html><body> because
// layout.tsx is no longer available by this point.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[nura:global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#fdfaf6",
          color: "#1f1a1c",
          fontFamily:
            'var(--font-inter, "Inter"), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }} role="alert" aria-live="assertive">
          <div style={{ fontSize: "3rem", color: "#c9a96e" }}>✦</div>
          <h1
            style={{
              fontFamily:
                'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
              fontWeight: 500,
              fontSize: "2rem",
              margin: "12px 0",
              color: "#3a1530",
            }}
          >
            We hit a snag.
          </h1>
          <p style={{ color: "#6b5f63", marginBottom: 24 }}>
            Something went wrong loading the site. Try refreshing in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#4a1e3a",
              color: "#fdfaf6",
              border: "none",
              padding: "12px 24px",
              borderRadius: 999,
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.95rem",
              letterSpacing: "0.02em",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: "0.8rem", marginTop: 24, opacity: 0.55 }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
