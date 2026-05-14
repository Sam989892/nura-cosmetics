// NURA — Token-bucket rate limiter
// ──────────────────────────────────
// Per-instance in-memory limiter — sufficient for one Vercel function
// instance.  For a multi-instance deployment swap the Map for Upstash
// Redis (npm i @upstash/redis) using the same interface.
//
// Privacy: the key is a HASHED IP (sha256 + salt), never raw.

import { hashIp } from "./db";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
// Periodic GC to keep the map bounded (every 5 min).
let lastGc = Date.now();

export interface RateLimit {
  capacity: number;       // max tokens
  refillPerSec: number;   // tokens added per second
}

export function checkRateLimit(
  ip: string | null | undefined,
  route: string,
  limit: RateLimit
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  // GC every 5 min.
  if (now - lastGc > 5 * 60_000) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > 30 * 60_000) buckets.delete(k);
    }
    lastGc = now;
  }

  // Key by (route, hashed-ip) so different endpoints don't share buckets.
  const key = `${route}:${hashIp(ip) ?? "anon"}`;
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: limit.capacity, updatedAt: now };
    buckets.set(key, b);
  } else {
    const elapsed = (now - b.updatedAt) / 1000;
    b.tokens = Math.min(limit.capacity, b.tokens + elapsed * limit.refillPerSec);
    b.updatedAt = now;
  }

  if (b.tokens < 1) {
    const retryAfter = Math.ceil((1 - b.tokens) / limit.refillPerSec);
    return { ok: false, retryAfter };
  }
  b.tokens -= 1;
  return { ok: true };
}

/** Extract a best-effort client IP from a Next.js Request. */
export function getClientIp(req: Request): string | null {
  // Vercel sets x-forwarded-for; first IP in the comma list is the client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
