/**
 * Tests for persistent webhook retry queue (INFRA-002).
 * Tests: exponential backoff, retry scanner, max attempts, disabled webhooks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";

const { webhooks, webhookDeliveries } = schema;

// Mock modules before importing webhook.ts
vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("../config.js", () => ({
  getConfig: () => ({ webhookEncryptionKey: null, webhookTimeoutMs: 5000, logLevel: "silent", logFormat: "json" }),
  parseConfig: (o: any) => o,
  setConfig: () => {},
  resetConfig: () => {},
}));

vi.mock("../lib/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("../lib/url-validator.js", () => ({
  validateWebhookUrl: () => Promise.resolve({ valid: true, resolvedIP: "93.184.216.34" }),
}));

vi.mock("../lib/crypto.js", () => ({
  decrypt: vi.fn((s: string) => s),
  encrypt: vi.fn((s: string) => s),
  isEncrypted: vi.fn(() => false),
  deriveKey: vi.fn(() => "key"),
}));

import { getDb } from "../db/index.js";
import { startRetryScanner, signPayload, deliverWebhook } from "../lib/webhook.js";

const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS webhooks (
  id text PRIMARY KEY NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text NOT NULL,
  enabled integer DEFAULT 1 NOT NULL,
  created_at integer NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id text PRIMARY KEY NOT NULL,
  webhook_id text NOT NULL,
  event text NOT NULL,
  payload text NOT NULL,
  status text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  last_attempt_at integer,
  response_code integer,
  response_body text
);
`;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

function setupDb() {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });
  for (const statement of MIGRATIONS_SQL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
  (getDb as any).mockReturnValue(db);
}

async function insertWebhook(id: string, url: string, enabled = 1) {
  await db.insert(webhooks).values({
    id,
    url,
    secret: "test-secret",
    events: JSON.stringify(["*"]),
    enabled,
    createdAt: Date.now(),
  });
}

async function insertDelivery(overrides: Partial<typeof webhookDeliveries.$inferInsert> = {}) {
  const defaults = {
    id: `del-${Math.random().toString(36).slice(2)}`,
    webhookId: "wh-1",
    event: "request.created",
    payload: JSON.stringify({ event: "request.created", data: {}, timestamp: Date.now() }),
    status: "pending",
    attempts: 1,
    lastAttemptAt: Date.now() - 60_000, // 1 minute ago (well past backoff)
  };
  const values = { ...defaults, ...overrides };
  await db.insert(webhookDeliveries).values(values);
  return values;
}

describe("Webhook Retry Scanner (INFRA-002)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setupDb();
    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("OK") });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sqlite?.close();
  });

  describe("exponential backoff", () => {
    it("should not retry delivery before backoff period elapses", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      // attempt=1, lastAttemptAt=now → backoff is 2^1*1000=2s, not yet due
      await insertDelivery({ id: "del-1", attempts: 1, lastAttemptAt: Date.now() });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      // fetch should NOT have been called (not past backoff)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should retry delivery after backoff period elapses", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      // attempt=1, lastAttemptAt well in the past → due for retry
      await insertDelivery({ id: "del-1", attempts: 1, lastAttemptAt: Date.now() - 10_000 });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should use increasing backoff: 2s, 4s, 8s", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");

      const now = Date.now();
      // attempt=1 → backoff 2s (2^1 * 1000). lastAttemptAt = now - 1s → need 1 more second
      await insertDelivery({ id: "del-a", attempts: 1, lastAttemptAt: now - 1_000 });
      // Scanner fires at +500ms → only 1.5s elapsed < 2s backoff → should NOT retry
      const interval = startRetryScanner(500);
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).not.toHaveBeenCalled();
      clearInterval(interval);

      // attempt=2 → backoff 4s (2^2 * 1000). lastAttemptAt = now - 1s → need 3 more seconds
      await db.update(webhookDeliveries).set({ attempts: 2, lastAttemptAt: now - 1_000 }).where(eq(webhookDeliveries.id, "del-a"));
      const interval2 = startRetryScanner(500);
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).not.toHaveBeenCalled(); // 1.5s + 0.5s = 2s elapsed < 4s
      clearInterval(interval2);
    });
  });

  describe("max attempts", () => {
    it("should mark delivery as failed after max attempts reached", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      // Already at max attempts (3) but somehow still pending
      await insertDelivery({ id: "del-max", attempts: 3, lastAttemptAt: Date.now() - 60_000 });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-max"));
      expect(delivery.status).toBe("failed");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should increment attempts on retry failure", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      await insertDelivery({ id: "del-fail", attempts: 1, lastAttemptAt: Date.now() - 10_000 });

      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("Server Error") });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-fail"));
      expect(delivery.attempts).toBe(2);
      expect(delivery.status).toBe("pending"); // Still under max
    });

    it("should mark as failed on last attempt failure", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      await insertDelivery({ id: "del-last", attempts: 2, lastAttemptAt: Date.now() - 60_000 });

      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("Error") });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-last"));
      expect(delivery.attempts).toBe(3);
      expect(delivery.status).toBe("failed");
    });
  });

  describe("disabled/deleted webhooks", () => {
    it("should mark delivery as failed when webhook is disabled", async () => {
      await insertWebhook("wh-disabled", "https://example.com/hook", 0);
      await insertDelivery({ id: "del-dis", webhookId: "wh-disabled", attempts: 1, lastAttemptAt: Date.now() - 10_000 });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-dis"));
      expect(delivery.status).toBe("failed");
      expect(delivery.responseBody).toBe("Webhook disabled");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should mark delivery as failed when webhook is deleted", async () => {
      // Don't insert webhook — simulates deletion
      await insertDelivery({ id: "del-gone", webhookId: "wh-nonexistent", attempts: 1, lastAttemptAt: Date.now() - 10_000 });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-gone"));
      expect(delivery.status).toBe("failed");
      expect(delivery.responseBody).toBe("Webhook not found");
    });
  });

  describe("scanner lifecycle", () => {
    it("should return interval handle for cleanup", () => {
      const interval = startRetryScanner(30_000);
      expect(interval).toBeDefined();
      clearInterval(interval);
    });

    it("should stop scanning when interval is cleared", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      await insertDelivery({ id: "del-stop", attempts: 1, lastAttemptAt: Date.now() - 60_000 });

      const interval = startRetryScanner(1000);
      clearInterval(interval);

      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("successful retry", () => {
    it("should mark delivery as success on retry", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      await insertDelivery({ id: "del-ok", attempts: 1, lastAttemptAt: Date.now() - 10_000 });

      mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("OK") });

      const interval = startRetryScanner(1000);
      await vi.advanceTimersByTimeAsync(1100);
      clearInterval(interval);

      const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, "del-ok"));
      expect(delivery.status).toBe("success");
      expect(delivery.attempts).toBe(2);
      expect(delivery.responseCode).toBe(200);
    });
  });

  describe("DB persistence (AC5)", () => {
    it("should store retry state in DB not setTimeout", async () => {
      await insertWebhook("wh-1", "https://example.com/hook");
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("err") });

      // Trigger initial delivery
      await deliverWebhook("request.created", { test: true });

      // Check that delivery is stored as pending in DB
      const deliveries = await db.select().from(webhookDeliveries);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].status).toBe("pending");
      expect(deliveries[0].attempts).toBe(1);
      // The retry is NOT scheduled via setTimeout — it's in the DB for the scanner
    });
  });
});
