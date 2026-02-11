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
    expect(json.length).toBeGreaterThan(0);
    expect(json[0].name).toBe("Test Policy");
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
