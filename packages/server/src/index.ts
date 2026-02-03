import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import requestsRouter from "./routes/requests.js";
import policiesRouter from "./routes/policies.js";

// Create Hono app
const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.route("/api/requests", requestsRouter);
app.route("/api/policies", policiesRouter);

// Global error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Start server
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Starting AgentGate server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`AgentGate server running at http://localhost:${port}`);

export default app;
