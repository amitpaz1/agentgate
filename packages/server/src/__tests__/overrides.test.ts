import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestContext } from "./setup.js";
import { nanoid } from "nanoid";
import { eq, gt, isNull, or } from "drizzle-orm";
import { overrides } from "../db/schema.js";

let ctx: TestContext;

beforeEach(() => {
  ctx = createTestDb();
});

afterEach(() => {
  ctx.cleanup();
});

// Inline matchToolPattern to avoid importing from routes (which triggers db/index side-effects)
function matchToolPattern(tool: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return tool === pattern;
  const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr).test(tool);
}

describe("Override CRUD", () => {
  it("creates an override with TTL and returns correct fields", async () => {
    const id = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300_000);

    await ctx.db.insert(overrides).values({
      id,
      agentId: "agent-1",
      toolPattern: "file.*",
      action: "require_approval",
      reason: "High error rate detected",
      createdAt: now,
      expiresAt,
    });

    const rows = await ctx.db.select().from(overrides);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(id);
    expect(rows[0]!.agentId).toBe("agent-1");
    expect(rows[0]!.toolPattern).toBe("file.*");
    expect(rows[0]!.action).toBe("require_approval");
    expect(rows[0]!.reason).toBe("High error rate detected");
    expect(rows[0]!.expiresAt).toBeTruthy();
  });

  it("creates an override without TTL (no expiry)", async () => {
    const id = nanoid();
    const now = new Date();

    await ctx.db.insert(overrides).values({
      id,
      agentId: "agent-2",
      toolPattern: "deploy",
      action: "require_approval",
      reason: null,
      createdAt: now,
      expiresAt: null,
    });

    const rows = await ctx.db.select().from(overrides);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.expiresAt).toBeNull();
  });

  it("deletes an override by id", async () => {
    const id = nanoid();
    const now = new Date();

    await ctx.db.insert(overrides).values({
      id,
      agentId: "agent-1",
      toolPattern: "*",
      action: "require_approval",
      reason: null,
      createdAt: now,
      expiresAt: null,
    });

    await ctx.db.delete(overrides).where(eq(overrides.id, id));

    const rows = await ctx.db.select().from(overrides);
    expect(rows).toHaveLength(0);
  });
});

describe("matchToolPattern", () => {
  it("matches exact tool names", () => {
    expect(matchToolPattern("file.read", "file.read")).toBe(true);
    expect(matchToolPattern("file.read", "file.write")).toBe(false);
  });

  it("matches wildcard patterns", () => {
    expect(matchToolPattern("file.read", "file.*")).toBe(true);
    expect(matchToolPattern("file.write", "file.*")).toBe(true);
    expect(matchToolPattern("network.fetch", "file.*")).toBe(false);
  });

  it("matches catch-all pattern", () => {
    expect(matchToolPattern("anything", "*")).toBe(true);
    expect(matchToolPattern("file.read", "*")).toBe(true);
  });
});

describe("Override filtering (active only)", () => {
  it("filters out expired overrides and keeps active ones", async () => {
    const now = new Date();

    // Expired override
    await ctx.db.insert(overrides).values({
      id: nanoid(),
      agentId: "agent-1",
      toolPattern: "file.*",
      action: "require_approval",
      reason: "expired",
      createdAt: new Date(now.getTime() - 600_000),
      expiresAt: new Date(now.getTime() - 60_000),
    });

    // Active override
    await ctx.db.insert(overrides).values({
      id: nanoid(),
      agentId: "agent-1",
      toolPattern: "deploy.*",
      action: "require_approval",
      reason: "active",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 300_000),
    });

    // No-expiry override
    await ctx.db.insert(overrides).values({
      id: nanoid(),
      agentId: "agent-1",
      toolPattern: "admin.*",
      action: "require_approval",
      reason: "permanent",
      createdAt: now,
      expiresAt: null,
    });

    const active = await ctx.db
      .select()
      .from(overrides)
      .where(or(isNull(overrides.expiresAt), gt(overrides.expiresAt, now)));

    expect(active).toHaveLength(2);
    expect(active.map((o) => o.reason).sort()).toEqual(["active", "permanent"]);
  });
});
