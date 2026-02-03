/**
 * CORS middleware integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseConfig, setConfig, resetConfig, type Config } from "../config.js";

/**
 * Creates a minimal test app with CORS configured the same way as index.ts
 */
function createTestApp(config: Config) {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: config.corsAllowedOrigins
        ? config.corsAllowedOrigins
        : config.isDevelopment
          ? "*"
          : (origin) => (origin ? null : origin),
      credentials: true,
    })
  );

  app.get("/test", (c) => c.json({ ok: true }));

  return app;
}

describe("CORS middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe("development mode (no origins configured)", () => {
    it("should allow any origin", async () => {
      const config = parseConfig({ nodeEnv: "development" });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        headers: { Origin: "https://evil.com" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should include credentials header", async () => {
      const config = parseConfig({ nodeEnv: "development" });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("production mode (no origins configured)", () => {
    it("should not set CORS headers for cross-origin requests", async () => {
      const config = parseConfig({ nodeEnv: "production" });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        headers: { Origin: "https://evil.com" },
      });

      expect(res.status).toBe(200);
      // In production without configured origins, cross-origin should be rejected
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("should work for same-origin requests (no Origin header)", async () => {
      const config = parseConfig({ nodeEnv: "production" });
      const app = createTestApp(config);

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe("with configured origins", () => {
    it("should allow requests from configured origin", async () => {
      const config = parseConfig({
        nodeEnv: "production",
        corsAllowedOrigins: "https://myapp.com",
      });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        headers: { Origin: "https://myapp.com" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://myapp.com"
      );
    });

    it("should reject requests from non-configured origin", async () => {
      const config = parseConfig({
        nodeEnv: "production",
        corsAllowedOrigins: "https://myapp.com",
      });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        headers: { Origin: "https://evil.com" },
      });

      expect(res.status).toBe(200); // Request succeeds but no CORS headers
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("should support multiple origins", async () => {
      const config = parseConfig({
        nodeEnv: "production",
        corsAllowedOrigins: "https://app.example.com,https://admin.example.com",
      });
      const app = createTestApp(config);

      // First origin
      const res1 = await app.request("/test", {
        headers: { Origin: "https://app.example.com" },
      });
      expect(res1.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.example.com"
      );

      // Second origin
      const res2 = await app.request("/test", {
        headers: { Origin: "https://admin.example.com" },
      });
      expect(res2.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://admin.example.com"
      );

      // Non-allowed origin
      const res3 = await app.request("/test", {
        headers: { Origin: "https://other.com" },
      });
      expect(res3.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("should handle preflight requests", async () => {
      const config = parseConfig({
        nodeEnv: "production",
        corsAllowedOrigins: "https://myapp.com",
      });
      const app = createTestApp(config);

      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "https://myapp.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://myapp.com"
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });
});
