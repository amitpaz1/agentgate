// @agentgate/server - Security headers middleware

import type { Context, Next } from "hono";

/**
 * Security headers middleware
 * Adds standard security headers to all responses
 */
export async function securityHeadersMiddleware(
  c: Context,
  next: Next
): Promise<void> {
  await next();

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  c.header("X-Frame-Options", "DENY");

  // Enable XSS filter (legacy browsers)
  c.header("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy - allows inline styles for HTML responses
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
}
