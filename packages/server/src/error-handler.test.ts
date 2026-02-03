import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

describe("Global Error Handler", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });

  function createAppWithErrorHandler() {
    const app = new Hono();

    // Test route that throws an error
    app.get("/test-error", () => {
      throw new Error("Sensitive database connection string: postgres://user:pass@host");
    });

    // Global error handler (same as in index.ts)
    app.onError((err, c) => {
      console.error(`Error: ${err.message}`, err.stack);
      const isDev = process.env.NODE_ENV !== "production";
      return c.json(
        {
          error: "Internal Server Error",
          ...(isDev && { message: err.message }),
        },
        500
      );
    });

    return app;
  }

  it("should hide error details in production", async () => {
    process.env.NODE_ENV = "production";
    const app = createAppWithErrorHandler();

    const res = await app.request("/test-error");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
    expect(body.message).toBeUndefined();
    // Sensitive info should not leak
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });

  it("should show error details in development", async () => {
    process.env.NODE_ENV = "development";
    const app = createAppWithErrorHandler();

    const res = await app.request("/test-error");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
    expect(body.message).toBe("Sensitive database connection string: postgres://user:pass@host");
  });

  it("should show error details when NODE_ENV is not set", async () => {
    delete process.env.NODE_ENV;
    const app = createAppWithErrorHandler();

    const res = await app.request("/test-error");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.message).toBeDefined();
  });

  it("should always log full error server-side", async () => {
    process.env.NODE_ENV = "production";
    const app = createAppWithErrorHandler();

    await app.request("/test-error");

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCall = consoleErrorSpy.mock.calls[0];
    expect(logCall[0]).toContain("Sensitive database connection string");
    // Stack trace should be logged
    expect(logCall[1]).toBeDefined();
  });
});
