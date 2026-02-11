import { describe, it, expect } from "vitest";
import { setupTestContext } from "./helpers.js";

const ctx = setupTestContext();

describe("Health Check", () => {
  it("should return 200 OK without auth", async () => {
    const res = await ctx.app.request("/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.timestamp).toBeDefined();
  });
});
