/**
 * Security headers middleware tests
 */

import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { securityHeadersMiddleware } from "../middleware/security-headers.js";
import { setConfig, resetConfig, parseConfig } from "../config.js";

describe("Security Headers Middleware", () => {
  afterEach(() => {
    resetConfig();
  });

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

  it("should not include HSTS header by default", async () => {
    resetConfig();
    setConfig(parseConfig({}));
    const res = await app.request("/test");
    expect(res.headers.has("Strict-Transport-Security")).toBe(false);
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

  describe("HSTS header", () => {
    it("should add HSTS header when hstsEnabled is true", async () => {
      resetConfig();
      setConfig(parseConfig({ hstsEnabled: true }));
      const hstsApp = new Hono();
      hstsApp.use("*", securityHeadersMiddleware);
      hstsApp.get("/test", (c) => c.json({ ok: true }));

      const res = await hstsApp.request("/test");
      expect(res.headers.get("Strict-Transport-Security")).toBe(
        "max-age=31536000; includeSubDomains"
      );
    });

    it("should not add HSTS header when hstsEnabled is false", async () => {
      resetConfig();
      setConfig(parseConfig({ hstsEnabled: false }));
      const noHstsApp = new Hono();
      noHstsApp.use("*", securityHeadersMiddleware);
      noHstsApp.get("/test", (c) => c.json({ ok: true }));

      const res = await noHstsApp.request("/test");
      expect(res.headers.has("Strict-Transport-Security")).toBe(false);
    });
  });
});
