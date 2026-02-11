import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("Policies API", () => {
  it("should create a new policy", async () => {
    const res = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Auto-approve reads",
        rules: [
          {
            match: { action: "file.read" },
            decision: "auto_approve",
          },
        ],
        priority: 10,
        enabled: true,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.name).toBe("Auto-approve reads");
    expect(json.rules).toHaveLength(1);
    expect(json.priority).toBe(10);
    expect(json.enabled).toBe(true);
  });

  it("should list policies", async () => {
    await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Policy",
        rules: [{ match: { action: "test" }, decision: "auto_approve" }],
      }),
    });

    const res = await ctx.app.request("/api/policies", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.policies.length).toBeGreaterThan(0);
    expect(json.policies[0].name).toBe("Test Policy");
    expect(json.pagination).toBeDefined();
    expect(json.pagination.total).toBeGreaterThan(0);
    expect(json.pagination.limit).toBe(50);
    expect(json.pagination.offset).toBe(0);
  });

  it("should update a policy", async () => {
    const createRes = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Original Name",
        rules: [{ match: { action: "test" }, decision: "auto_approve" }],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/policies/${created.id}`, {
      method: "PUT",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Updated Name",
        rules: [{ match: { action: "updated" }, decision: "auto_deny" }],
        priority: 5,
        enabled: false,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Updated Name");
    expect(json.rules[0].match.action).toBe("updated");
    expect(json.priority).toBe(5);
    expect(json.enabled).toBe(false);
  });

  it("should reject policy creation with unsafe regex (ReDoS)", async () => {
    const res = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Unsafe Regex Policy",
        rules: [{ match: { action: { $regex: "(a+)+$" } }, decision: "auto_approve" }],
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Unsafe regex");
  });

  it("should reject policy update with unsafe regex (ReDoS)", async () => {
    const createRes = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Safe Policy",
        rules: [{ match: { action: "test" }, decision: "auto_approve" }],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/policies/${created.id}`, {
      method: "PUT",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Now Unsafe",
        rules: [{ match: { action: { $regex: "(a+){10}$" } }, decision: "auto_approve" }],
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Unsafe regex");
  });

  it("should accept policy with safe regex", async () => {
    const res = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Safe Regex Policy",
        rules: [{ match: { action: { $regex: "^delete_.*" } }, decision: "route_to_human" }],
      }),
    });

    expect(res.status).toBe(201);
  });

  it("should delete a policy", async () => {
    const createRes = await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "To Delete",
        rules: [{ match: { action: "test" }, decision: "auto_approve" }],
      }),
    });
    const created = await createRes.json();

    const res = await ctx.app.request(`/api/policies/${created.id}`, {
      method: "DELETE",
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("should auto-approve based on policy", async () => {
    await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Auto-approve file.read",
        rules: [{ match: { action: "file.read" }, decision: "auto_approve" }],
        priority: 1,
        enabled: true,
      }),
    });

    const res = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "file.read" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe("approved");
    expect(json.decidedBy).toBe("policy");
    expect(json.policyDecision.decision).toBe("auto_approve");
  });

  it("should paginate policies with limit and offset", async () => {
    // Create 5 policies with ascending priority
    for (let i = 0; i < 5; i++) {
      await ctx.app.request("/api/policies", {
        method: "POST",
        headers: {
          ...authHeader(ctx.adminKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Paginate-${i}`,
          rules: [{ match: { action: "test" }, decision: "auto_approve" }],
          priority: i + 1,
        }),
      });
    }

    // Page 1: limit=2, offset=0
    const res1 = await ctx.app.request("/api/policies?limit=2&offset=0", {
      headers: authHeader(ctx.adminKey),
    });
    const json1 = await res1.json();
    expect(json1.policies).toHaveLength(2);
    expect(json1.pagination.limit).toBe(2);
    expect(json1.pagination.offset).toBe(0);
    expect(json1.pagination.total).toBeGreaterThanOrEqual(5);
    expect(json1.pagination.hasMore).toBe(true);

    // Page 2: limit=2, offset=2
    const res2 = await ctx.app.request("/api/policies?limit=2&offset=2", {
      headers: authHeader(ctx.adminKey),
    });
    const json2 = await res2.json();
    expect(json2.policies).toHaveLength(2);
    expect(json2.pagination.offset).toBe(2);
    expect(json2.pagination.hasMore).toBe(true);

    // Last page: offset past most items
    const total = json1.pagination.total;
    const res3 = await ctx.app.request(`/api/policies?limit=2&offset=${total - 1}`, {
      headers: authHeader(ctx.adminKey),
    });
    const json3 = await res3.json();
    expect(json3.policies).toHaveLength(1);
    expect(json3.pagination.hasMore).toBe(false);

    // Beyond range
    const res4 = await ctx.app.request(`/api/policies?limit=2&offset=${total + 10}`, {
      headers: authHeader(ctx.adminKey),
    });
    const json4 = await res4.json();
    expect(json4.policies).toHaveLength(0);
    expect(json4.pagination.hasMore).toBe(false);
  });

  it("should auto-deny based on policy", async () => {
    await ctx.app.request("/api/policies", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Auto-deny dangerous",
        rules: [{ match: { action: "system.shutdown" }, decision: "auto_deny" }],
        priority: 1,
        enabled: true,
      }),
    });

    const res = await ctx.app.request("/api/requests", {
      method: "POST",
      headers: {
        ...authHeader(ctx.adminKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "system.shutdown" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe("denied");
    expect(json.decidedBy).toBe("policy");
    expect(json.policyDecision.decision).toBe("auto_deny");
  });
});
