import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("API Keys API", () => {
  it("should create a new API key", async () => {
    const res = await ctx.app.request("/api/api-keys", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "New Test Key",
        scopes: ["request:read", "request:create"],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.key).toMatch(/^agk_/);
    expect(json.name).toBe("New Test Key");
    expect(json.scopes).toEqual(["request:read", "request:create"]);
    expect(json.message).toContain("Save this key");
  });

  it("should list API keys without exposing keys", async () => {
    const res = await ctx.app.request("/api/api-keys", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys).toBeDefined();
    expect(json.keys.length).toBeGreaterThan(0);
    expect(json.keys[0].key).toBeUndefined();
    expect(json.keys[0].keyHash).toBeUndefined();
  });

  it("should revoke an API key", async () => {
    const createRes = await ctx.app.request("/api/api-keys", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "To Revoke", scopes: ["admin"] }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/api-keys/${created.id}`, {
      method: "DELETE",
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const verifyRes = await ctx.app.request("/api/requests", {
      headers: { Authorization: `Bearer ${created.key}` },
    });
    expect(verifyRes.status).toBe(401);
  });
});
