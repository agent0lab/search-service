/**
 * Request ID middleware for request tracing
 */
import type { Context, Next } from 'hono';

/**
 * Generate a UUID v4
 */
function generateRequestId(): string {
  // Use Web Crypto API (available in Cloudflare Workers and modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate a simple UUID-like string
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Middleware to extract or generate request ID and add it to context and response
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  // Extract request ID from header or generate one
  const requestId = c.req.header('X-Request-ID') || generateRequestId();

  // Store in context for use in handlers
  (c as any).set('requestId', requestId);

  // Add to response headers
  c.header('X-Request-ID', requestId);

  await next();
}

/**
 * Get request ID from context
 */
export function getRequestId(c: Context): string {
  return (c as any).get('requestId') || generateRequestId();
}

