/**
 * Body size limit middleware tests (SEC-010)
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

describe("Body Size Limit Middleware", () => {
  const app = new Hono();
  app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024 })); // 1MB
  app.post("/api/test", async (c) => {
    await c.req.text();
    return c.json({ ok: true });
  });
  app.post("/other", async (c) => {
    await c.req.text();
    return c.json({ ok: true });
  });

  it("should allow normal-sized requests to /api/*", async () => {
    const body = "x".repeat(1000);
    const res = await app.request("/api/test", {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain", "Content-Length": String(body.length) },
    });
    expect(res.status).toBe(200);
  });

  it("should reject oversized requests to /api/* with 413", async () => {
    const body = "x".repeat(1024 * 1024 + 1); // 1MB + 1 byte
    const res = await app.request("/api/test", {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain", "Content-Length": String(body.length) },
    });
    expect(res.status).toBe(413);
  });

  it("should not limit non-API routes", async () => {
    const body = "x".repeat(1024 * 1024 + 1);
    const res = await app.request("/other", {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain", "Content-Length": String(body.length) },
    });
    expect(res.status).toBe(200);
  });
});
