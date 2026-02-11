import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("Webhooks API", () => {
  it("should create a webhook", async () => {
    const res = await ctx.app.request("/api/webhooks", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/webhook",
        events: ["request.approved", "request.denied"],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.url).toBe("https://example.com/webhook");
    expect(json.events).toEqual(["request.approved", "request.denied"]);
    expect(json.secret).toBeDefined();
    expect(json.enabled).toBe(true);
  });

  it("should list webhooks without exposing secrets", async () => {
    await ctx.app.request("/api/webhooks", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/hook",
        events: ["request.approved"],
      }),
    });

    const res = await ctx.app.request("/api/webhooks", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.webhooks).toBeDefined();
    expect(json.webhooks.length).toBeGreaterThan(0);
    expect(json.webhooks[0].secret).toBeUndefined();
  });

  it("should get webhook details with deliveries", async () => {
    const createRes = await ctx.app.request("/api/webhooks", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/details",
        events: ["request.approved"],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/webhooks/${created.id}`, {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(created.id);
    expect(json.url).toBe("https://example.com/details");
    expect(json.deliveries).toBeDefined();
  });

  it("should update a webhook", async () => {
    const createRes = await ctx.app.request("/api/webhooks", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/original",
        events: ["request.approved"],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/webhooks/${created.id}`, {
      method: "PATCH",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/updated",
        events: ["request.denied"],
        enabled: false,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should delete a webhook", async () => {
    const createRes = await ctx.app.request("/api/webhooks", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://example.com/delete",
        events: ["request.approved"],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/webhooks/${created.id}`, {
      method: "DELETE",
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
