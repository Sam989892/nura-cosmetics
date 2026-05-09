"use client";

import Link from "next/link";
import { useEffect } from "react";

// Route-level error boundary. Catches render errors inside any segment below
// the root layout so the Nav + Footer + CartProvider stay mounted and the
// user doesn't land on a raw Next.js error screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Placeholder for consented error telemetry. Wire to Sentry/PostHog behind
    // the cookie-consent gate once Wave 2 of LAUNCH_CHECKLIST.md lands.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[nura:error-boundary]", error);
    }
  }, [error]);

  return (
    <div
      className="container section text-center"
      role="alert"
      aria-live="assertive"
      style={{ paddingTop: 80, paddingBottom: 80 }}
    >
      <div style={{ fontSize: "3rem", color: "var(--nura-gold)" }}>✦</div>
      <h1>Something came loose.</h1>
      <p className="text-mute" style={{ maxWidth: 480, margin: "12px auto 24px" }}>
        A part of this page couldn&apos;t render. Your cart and account are unaffected.
      </p>
      <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Back to home
        </Link>
      </div>
      {error.digest && (
        <p className="text-mute" style={{ fontSize: "0.8rem", marginTop: 24, opacity: 0.6 }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
