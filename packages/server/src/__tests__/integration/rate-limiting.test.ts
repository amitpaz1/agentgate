import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("Rate Limiting", () => {
  it("should allow requests when no rate limit is set", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await ctx.app.request("/api/requests", {
        headers: authHeader(ctx.adminKey),
      });
      expect(res.status).toBe(200);
    }
  });

  it("should return 429 when rate limit is exceeded", async () => {
    const { key: limitedKey } = await ctx.createApiKeyInDb("rate-limited-key", ["admin"], 3);

    for (let i = 0; i < 3; i++) {
      const res = await ctx.app.request("/api/requests", {
        headers: { Authorization: `Bearer ${limitedKey}` },
      });
      expect(res.status).toBe(200);
    }

    const res = await ctx.app.request("/api/requests", {
      headers: { Authorization: `Bearer ${limitedKey}` },
    });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Rate limit exceeded");
  });

  it("should include X-RateLimit-* headers on successful responses", async () => {
    const { key: limitedKey } = await ctx.createApiKeyInDb("headers-test-key", ["admin"], 10);

    const res = await ctx.app.request("/api/requests", {
      headers: { Authorization: `Bearer ${limitedKey}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should include Retry-After header on 429 response", async () => {
    const { key: limitedKey } = await ctx.createApiKeyInDb("retry-after-key", ["admin"], 1);

    await ctx.app.request("/api/requests", {
      headers: { Authorization: `Bearer ${limitedKey}` },
    });

    const res = await ctx.app.request("/api/requests", {
      headers: { Authorization: `Bearer ${limitedKey}` },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
    const retryAfter = parseInt(res.headers.get("Retry-After")!, 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("should decrement remaining count with each request", async () => {
    const { key: limitedKey } = await ctx.createApiKeyInDb("decrement-key", ["admin"], 5);

    for (let i = 4; i >= 0; i--) {
      const res = await ctx.app.request("/api/requests", {
        headers: { Authorization: `Bearer ${limitedKey}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(i.toString());
    }
  });

  it("should not include rate limit headers when no limit is set", async () => {
    const res = await ctx.app.request("/api/requests", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(res.headers.get("X-RateLimit-Remaining")).toBeNull();
  });

  it("should allow creating API key with rate limit", async () => {
    const res = await ctx.app.request("/api/api-keys", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Rate Limited Key",
        scopes: ["request:read"],
        rateLimit: 100,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rateLimit).toBe(100);
  });

  it("should list API keys with rate limit info", async () => {
    await ctx.createApiKeyInDb("list-rate-limit-key", ["admin"], 50);

    const res = await ctx.app.request("/api/api-keys", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    const key = json.keys.find((k: any) => k.name === "list-rate-limit-key");
    expect(key).toBeDefined();
    expect(key.rateLimit).toBe(50);
  });

  it("should update API key rate limit", async () => {
    const { id } = await ctx.createApiKeyInDb("update-rate-limit-key", ["admin"], 10);

    const res = await ctx.app.request(`/api/api-keys/${id}`, {
      method: "PATCH",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rateLimit: 200,
      }),
    });

    expect(res.status).toBe(200);

    const listRes = await ctx.app.request("/api/api-keys", {
      headers: authHeader(ctx.adminKey),
    });
    const listJson = await listRes.json();
    const updated = listJson.keys.find((k: any) => k.id === id);
    expect(updated.rateLimit).toBe(200);
  });

  it("should allow removing rate limit by setting to null", async () => {
    const { id } = await ctx.createApiKeyInDb("remove-rate-limit-key", ["admin"], 10);

    const res = await ctx.app.request(`/api/api-keys/${id}`, {
      method: "PATCH",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rateLimit: null,
      }),
    });

    expect(res.status).toBe(200);

    const listRes = await ctx.app.request("/api/api-keys", {
      headers: authHeader(ctx.adminKey),
    });
    const listJson = await listRes.json();
    const updated = listJson.keys.find((k: any) => k.id === id);
    expect(updated.rateLimit).toBeNull();
  });
});
