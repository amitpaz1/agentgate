// @agentgate/server - Authentication middleware

import type { Context, Next } from "hono";
import { validateApiKey } from "../lib/api-keys.js";
import type { ApiKey } from "../db/index.js";

// Type for context variables
export type AuthVariables = {
  apiKey: ApiKey;
};

/**
 * Authentication middleware
 * Extracts Bearer token from Authorization header and validates against database
 */
export async function authMiddleware(
  c: Context,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  // Check for missing header
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  // Check for valid Bearer format
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Invalid Authorization format" }, 401);
  }

  // Extract the key
  const key = authHeader.slice(7); // Remove "Bearer " prefix

  if (!key) {
    return c.json({ error: "Invalid Authorization format" }, 401);
  }

  // Validate the API key (also updates last_used_at)
  const apiKeyRecord = await validateApiKey(key);

  if (!apiKeyRecord) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  // Attach API key record to context
  c.set("apiKey", apiKeyRecord);

  await next();
}

/**
 * Scope-checking middleware factory
 * Returns middleware that checks if the authenticated API key has the required scope
 * @param scope - The required scope (e.g., "request:create", "admin")
 */
export function requireScope(scope: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const apiKey = c.get("apiKey") as ApiKey;
    const scopes = JSON.parse(apiKey.scopes) as string[];

    if (!scopes.includes(scope) && !scopes.includes("admin")) {
      return c.json({ error: `Missing required scope: ${scope}` }, 403);
    }

    await next();
  };
}
