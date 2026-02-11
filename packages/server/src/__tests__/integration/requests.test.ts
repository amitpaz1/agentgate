import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("Requests API", () => {
  it("should create a new approval request", async () => {
    const res = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "file.delete",
        params: { path: "/important/file.txt" },
        context: { user: "test-user" },
        urgency: "high",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.action).toBe("file.delete");
    expect(json.params.path).toBe("/important/file.txt");
    expect(json.context.user).toBe("test-user");
    expect(json.urgency).toBe("high");
    expect(json.status).toBe("pending");
    expect(json.policyDecision).toBeDefined();
  });

  it("should reject request without action", async () => {
    const res = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params: {} }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("action is required");
  });

  it("should get a request by ID", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.action" }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/requests/${created.id}`, {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(created.id);
    expect(json.action).toBe("test.action");
  });

  it("should return 404 for non-existent request", async () => {
    const res = await ctx.app.request("/api/requests/nonexistent123", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(404);
  });

  it("should list requests with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.app.request("/api/requests", {
        method: "POST",
        headers: {
          ...authHeader(ctx.adminKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: `test.action.${i}` }),
      });
    }

    const res = await ctx.app.request("/api/requests?limit=3", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requests).toHaveLength(3);
    expect(json.pagination.total).toBe(5);
    expect(json.pagination.hasMore).toBe(true);
  });

  it("should filter requests by status", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.filter" }),
    });
    const created = await createRes.json();

    await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "approved",
        decidedBy: "admin",
        reason: "Test approval",
      }),
    });

    const res = await ctx.app.request("/api/requests?status=approved", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requests.length).toBeGreaterThan(0);
    expect(json.requests.every((r: any) => r.status === "approved")).toBe(true);
  });

  it("should approve a pending request", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.approve" }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "approved",
        decidedBy: "admin",
        reason: "Looks good",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("approved");
    expect(json.decidedBy).toBe("admin");
    expect(json.decisionReason).toBe("Looks good");
  });

  it("should deny a pending request", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.deny" }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "denied",
        decidedBy: "admin",
        reason: "Not allowed",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("denied");
    expect(json.decidedBy).toBe("admin");
  });

  it("should reject decision on already decided request", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.double" }),
    });
    const created = await createRes.json();

    await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "approved", decidedBy: "admin" }),
    });

    const res = await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "denied", decidedBy: "admin" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not pending");
  });

  it("should get audit trail for request", async () => {
    const createRes = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test.audit" }),
    });
    const created = await createRes.json();

    await ctx.app.request(`/api/requests/${created.id}/decide`, {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "approved", decidedBy: "admin" }),
    });

    const res = await ctx.app.request(`/api/requests/${created.id}/audit`, {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.length).toBeGreaterThanOrEqual(2);
    expect(json.some((e: any) => e.eventType === "created")).toBe(true);
    expect(json.some((e: any) => e.eventType === "approved")).toBe(true);
  });
});
