/**
 * Security headers middleware tests
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { securityHeadersMiddleware } from "../middleware/security-headers.js";

describe("Security Headers Middleware", () => {
  const app = new Hono();
  app.use("*", securityHeadersMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  app.get("/html", (c) => c.html("<h1>Test</h1>"));

  it("should add X-Content-Type-Options header", async () => {
    const res = await app.request("/test");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should add X-Frame-Options header", async () => {
    const res = await app.request("/test");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should add X-XSS-Protection header", async () => {
    const res = await app.request("/test");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });

  it("should add Referrer-Policy header", async () => {
    const res = await app.request("/test");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("should add Content-Security-Policy header", async () => {
    const res = await app.request("/test");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBe("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  });

  it("should include unsafe-inline for styles in CSP", async () => {
    const res = await app.request("/html");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("should add all 5 security headers on every response", async () => {
    const res = await app.request("/test");
    
    const securityHeaders = [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Content-Security-Policy",
    ];

    for (const header of securityHeaders) {
      expect(res.headers.has(header), `Missing header: ${header}`).toBe(true);
    }
  });
});
