import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("Authentication", () => {
  it("should reject requests without Authorization header", async () => {
    const res = await ctx.app.request("/api/requests");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing Authorization header");
  });

  it("should reject requests with invalid Authorization format", async () => {
    const res = await ctx.app.request("/api/requests", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid Authorization format");
  });

  it("should reject requests with invalid API key", async () => {
    const res = await ctx.app.request("/api/requests", {
      headers: { Authorization: "Bearer invalid_key_12345" },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid API key");
  });

  it("should accept requests with valid API key", async () => {
    const res = await ctx.app.request("/api/requests", {
      headers: authHeader(ctx.adminKey),
    });
    expect(res.status).toBe(200);
  });

  it("should reject admin routes with non-admin scope", async () => {
    const res = await ctx.app.request("/api/api-keys", {
      headers: authHeader(ctx.readOnlyKey),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Missing required scope");
  });
});
