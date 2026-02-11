import { describe, it, expect } from "vitest";
import { setupTestContext, authHeader } from "./helpers.js";

const ctx = setupTestContext();

describe("404 Handler", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await ctx.app.request("/api/unknown", {
      headers: authHeader(ctx.adminKey),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Not Found");
    expect(json.message).toContain("/api/unknown");
  });
});
