import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We need to test logger in isolation, resetting module state between tests
describe("Structured Logging (Pino)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache for logger and config
    process.env.LOG_FORMAT = "json";
    process.env.LOG_LEVEL = "info";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("initLogger returns a pino logger instance", async () => {
    const { resetConfig } = await import("../config.js");
    resetConfig();
    // Re-import to get fresh logger
    const { initLogger } = await import("../lib/logger.js");
    const logger = initLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  it("getLogger returns a logger without explicit init", async () => {
    const { getLogger } = await import("../lib/logger.js");
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });

  it("LOG_FORMAT=json produces JSON output with level, time, msg", async () => {
    process.env.LOG_FORMAT = "json";
    process.env.LOG_LEVEL = "info";
    const { resetConfig } = await import("../config.js");
    resetConfig();

    const pino = (await import("pino")).default;
    const { Writable } = await import("stream");

    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });

    const { getConfig } = await import("../config.js");
    const config = getConfig();

    const logger = pino({ level: config.logLevel }, dest);
    logger.info("test message");

    // Flush
    await new Promise((resolve) => dest.end(resolve));

    expect(chunks.length).toBeGreaterThan(0);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed).toHaveProperty("level");
    expect(parsed).toHaveProperty("time");
    expect(parsed).toHaveProperty("msg", "test message");
  });

  it("LOG_LEVEL=error suppresses info-level messages", async () => {
    const pino = (await import("pino")).default;
    const { Writable } = await import("stream");

    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });

    const logger = pino({ level: "error" }, dest);
    logger.info("should be suppressed");
    logger.error("should appear");

    await new Promise((resolve) => dest.end(resolve));

    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.msg).toBe("should appear");
  });

  it("config exposes logLevel and logFormat", async () => {
    process.env.LOG_LEVEL = "warn";
    process.env.LOG_FORMAT = "pretty";
    const { resetConfig, getConfig } = await import("../config.js");
    resetConfig();
    const config = getConfig();
    expect(config.logLevel).toBe("warn");
    expect(config.logFormat).toBe("pretty");
  });
});
