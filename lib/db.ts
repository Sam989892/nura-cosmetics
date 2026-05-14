// NURA — Lightweight persistence layer.
// ─────────────────────────────────────
// Storage strategy:
//   • Local dev / self-hosted Node servers → JSON file persistence under
//     `.nura-data/` (gitignored). Synchronous, atomic-write, suitable for
//     a small UK Shopify-style boutique storefront.
//   • Vercel / serverless deployments → swap `storage` for a Postgres or
//     Vercel KV adapter (see PRODUCTION MIGRATION at bottom). The serverless
//     filesystem is ephemeral so the JSON adapter MUST NOT be used in
//     production.
//
// UK GDPR notes (see /privacy):
//   • Records carry `consentVersion` and `consentAt` so we can prove lawful
//     basis at the time of collection.
//   • `retainUntil` is computed per record-type so the cleanup job can
//     prune expired data automatically.
//   • Personal data is keyed by an opaque ID; we never use email as a
//     primary key in case the data subject changes address.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConsentRecord = {
  version: string;        // privacy notice version at the time of capture
  acceptedAt: string;     // ISO timestamp
  ip?: string;            // hashed (sha256), never raw
  userAgent?: string;     // truncated to 200 chars
  marketing: boolean;     // explicit opt-in for marketing email
  analytics: boolean;     // explicit opt-in for analytics cookies
};

export type OrderItem = {
  slug: string;
  name: string;
  shadeName: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;             // public order id (e.g. NURA-XXX-XXXX)
  placedAt: string;       // ISO timestamp
  // Customer PII — encrypted at rest in production. See lib/crypto.ts.
  customer: {
    name: string;
    email: string;
    phone?: string;
    address1: string;
    address2?: string;
    city: string;
    postcode: string;
  };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  grandTotal: number;
  delivery: "standard" | "express" | "collect";
  paymentStatus: "simulated_paid" | "pending" | "paid" | "refunded";
  consent: ConsentRecord;
  // Retention: UK HMRC requires order/tax records for 6 years. We keep
  // checkout records this long, then anonymise (strip PII) and keep just
  // the financial record.
  retainUntil: string;    // ISO timestamp
};

export type ContactTicket = {
  id: string;             // public ticket id (NURA-MSG-XXX)
  receivedAt: string;     // ISO timestamp
  name: string;
  email: string;
  subject?: string;
  message: string;
  consent: ConsentRecord;
  // Retention: 2 years for customer-service correspondence. Pruned on
  // schedule by the cleanup job.
  retainUntil: string;
};

// ─── Storage interface ────────────────────────────────────────────────────────
// All adapters implement this. In production swap fileStorage() for a
// Postgres or Vercel KV adapter that satisfies the same contract.

export interface Storage {
  orders: {
    insert(order: Order): Promise<void>;
    get(id: string): Promise<Order | null>;
    findByEmail(emailHash: string): Promise<Order[]>;
    deleteByEmail(emailHash: string): Promise<number>;
    anonymiseByEmail(emailHash: string): Promise<number>;
  };
  tickets: {
    insert(ticket: ContactTicket): Promise<void>;
    get(id: string): Promise<ContactTicket | null>;
    findByEmail(emailHash: string): Promise<ContactTicket[]>;
    deleteByEmail(emailHash: string): Promise<number>;
  };
}

// ─── File-based adapter (development / self-hosted only) ─────────────────────

const DATA_DIR = process.env.NURA_DATA_DIR ?? path.join(process.cwd(), ".nura-data");

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  } catch {}
}

function readJson<T>(file: string, fallback: T): T {
  try {
    ensureDataDir();
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(file: string, data: T) {
  ensureDataDir();
  const p = path.join(DATA_DIR, file);
  // Atomic-ish: write to a temp file then rename.
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, p);
}

function fileStorage(): Storage {
  return {
    orders: {
      async insert(order) {
        const all = readJson<Order[]>("orders.json", []);
        all.push(order);
        writeJson("orders.json", all);
      },
      async get(id) {
        const all = readJson<Order[]>("orders.json", []);
        return all.find((o) => o.id === id) ?? null;
      },
      async findByEmail(emailHash) {
        const all = readJson<Order[]>("orders.json", []);
        return all.filter((o) => hashEmail(o.customer.email) === emailHash);
      },
      async deleteByEmail(emailHash) {
        const all = readJson<Order[]>("orders.json", []);
        const remaining = all.filter((o) => hashEmail(o.customer.email) !== emailHash);
        const deleted = all.length - remaining.length;
        writeJson("orders.json", remaining);
        return deleted;
      },
      async anonymiseByEmail(emailHash) {
        const all = readJson<Order[]>("orders.json", []);
        let n = 0;
        for (const o of all) {
          if (hashEmail(o.customer.email) === emailHash) {
            o.customer = {
              name: "[redacted]",
              email: `[redacted-${o.id}]`,
              address1: "[redacted]",
              city: "[redacted]",
              postcode: "[redacted]",
            };
            n++;
          }
        }
        writeJson("orders.json", all);
        return n;
      },
    },
    tickets: {
      async insert(ticket) {
        const all = readJson<ContactTicket[]>("tickets.json", []);
        all.push(ticket);
        writeJson("tickets.json", all);
      },
      async get(id) {
        const all = readJson<ContactTicket[]>("tickets.json", []);
        return all.find((t) => t.id === id) ?? null;
      },
      async findByEmail(emailHash) {
        const all = readJson<ContactTicket[]>("tickets.json", []);
        return all.filter((t) => hashEmail(t.email) === emailHash);
      },
      async deleteByEmail(emailHash) {
        const all = readJson<ContactTicket[]>("tickets.json", []);
        const remaining = all.filter((t) => hashEmail(t.email) !== emailHash);
        const deleted = all.length - remaining.length;
        writeJson("tickets.json", remaining);
        return deleted;
      },
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL_SALT = process.env.NURA_EMAIL_SALT ?? "nura-uk-v1";

/**
 * Hash an email address to a stable opaque token. Used as the lookup key
 * for DSAR and erasure requests so we never store raw email in indexes.
 * SHA-256 with a server-side salt is a reasonable pseudonymisation choice
 * for the UK GDPR Art.4(5) definition.
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase() + EMAIL_SALT)
    .digest("hex");
}

/** Hash an IP for storage. We never persist raw IPs. */
export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip + EMAIL_SALT).digest("hex");
}

/** Compute the retention horizon for an order (HMRC 6 years). */
export function orderRetainUntil(now = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() + 6);
  return d.toISOString();
}

/** Compute the retention horizon for a support ticket (2 years). */
export function ticketRetainUntil(now = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString();
}

// ─── Default export — single shared adapter ──────────────────────────────────

let _storage: Storage | null = null;
export function getStorage(): Storage {
  if (!_storage) _storage = fileStorage();
  return _storage;
}

// ─── PRODUCTION MIGRATION ────────────────────────────────────────────────────
// To deploy to Vercel (or any serverless host) replace fileStorage() with a
// Postgres adapter. The cleanest options:
//
//   • Vercel Postgres (Neon)  – npm i @vercel/postgres
//   • Supabase                – npm i @supabase/supabase-js
//   • Upstash Redis (KV only) – npm i @upstash/redis
//
// Required schema (Postgres):
//
//   CREATE TABLE orders (
//     id              TEXT PRIMARY KEY,
//     placed_at       TIMESTAMPTZ NOT NULL,
//     email_hash      TEXT NOT NULL,
//     customer_pgp    BYTEA NOT NULL,         -- encrypted customer JSON
//     items           JSONB NOT NULL,
//     subtotal_pence  INTEGER NOT NULL,
//     shipping_pence  INTEGER NOT NULL,
//     total_pence     INTEGER NOT NULL,
//     delivery        TEXT NOT NULL,
//     payment_status  TEXT NOT NULL,
//     consent         JSONB NOT NULL,
//     retain_until    TIMESTAMPTZ NOT NULL
//   );
//   CREATE INDEX orders_email_hash_idx ON orders (email_hash);
//   CREATE INDEX orders_retain_until_idx ON orders (retain_until);
//
//   CREATE TABLE tickets (
//     id            TEXT PRIMARY KEY,
//     received_at   TIMESTAMPTZ NOT NULL,
//     email_hash    TEXT NOT NULL,
//     payload_pgp   BYTEA NOT NULL,           -- encrypted name/email/message
//     consent       JSONB NOT NULL,
//     retain_until  TIMESTAMPTZ NOT NULL
//   );
//   CREATE INDEX tickets_email_hash_idx ON tickets (email_hash);
//
// Customer PII (customer_pgp / payload_pgp) is encrypted at rest using
// pgp_sym_encrypt with NURA_PII_KEY from the environment.  See ICO guidance
// on encryption of personal data at rest:
//   https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/security/encryption/
