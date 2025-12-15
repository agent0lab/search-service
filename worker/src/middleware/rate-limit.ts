import type { Context, Next } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types.js';
import { createErrorResponse, ErrorCode } from '../utils/errors.js';

const DEFAULT_REQUESTS_PER_MINUTE = 6;
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute

/**
 * Calculate reset timestamp (Unix epoch seconds)
 */
function getResetTimestamp(windowStart: Date): number {
  return Math.ceil((windowStart.getTime() + WINDOW_SIZE_MS) / 1000);
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context<{ Bindings: Env }>): string {
  // Cloudflare provides the client IP in the CF-Connecting-IP header
  const cfIP = c.req.header('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback to X-Forwarded-For header
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Last resort: use a default value (shouldn't happen in Cloudflare)
  return 'unknown';
}

/**
 * Clean up expired rate limit entries
 */
async function cleanupExpiredEntries(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare('DELETE FROM rate_limit_tracking WHERE expires_at < ?')
    .bind(now)
    .run();
}

/**
 * Middleware to enforce rate limiting per IP address
 */
export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const ipAddress = getClientIP(c);
    const db = c.env.DB;

    // Clean up expired entries periodically (every 100 requests on average)
    if (Math.random() < 0.01) {
      await cleanupExpiredEntries(db);
    }

    const now = new Date();
    const windowStartThreshold = new Date(now.getTime() - WINDOW_SIZE_MS);
    const expiresAt = new Date(now.getTime() + WINDOW_SIZE_MS);

    // Get or create rate limit entry for this IP
    const existing = await db
      .prepare('SELECT request_count, window_start FROM rate_limit_tracking WHERE ip_address = ?')
      .bind(ipAddress)
      .first<{ request_count: number; window_start: string }>();

    let requestCount: number;
    let shouldUpdateWindow = false;
    let actualWindowStart: Date;

    if (existing) {
      const existingWindowStart = new Date(existing.window_start);

      // Check if we're still in the same window
      if (existingWindowStart >= windowStartThreshold) {
        // Same window - increment count
        requestCount = existing.request_count + 1;
        actualWindowStart = existingWindowStart;
      } else {
        // New window - reset count
        requestCount = 1;
        shouldUpdateWindow = true;
        actualWindowStart = now;
      }
    } else {
      // First request from this IP
      requestCount = 1;
      shouldUpdateWindow = true;
      actualWindowStart = now;
    }

    // Calculate remaining requests and reset timestamp
    const remaining = Math.max(0, DEFAULT_REQUESTS_PER_MINUTE - requestCount);
    const resetTimestamp = getResetTimestamp(actualWindowStart);

    // Add rate limit headers
    c.header('X-RateLimit-Limit', DEFAULT_REQUESTS_PER_MINUTE.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetTimestamp.toString());

    // Check if limit exceeded
    if (requestCount > DEFAULT_REQUESTS_PER_MINUTE) {
      const retryAfter = Math.ceil(
        (WINDOW_SIZE_MS - (now.getTime() - actualWindowStart.getTime())) / 1000
      );

      c.header('Retry-After', retryAfter.toString());
      return c.json(
        createErrorResponse(
          new Error('Rate limit exceeded. Please try again later.'),
          429,
          ErrorCode.RATE_LIMIT_EXCEEDED
        ),
        429
      );
    }

    // Update or insert rate limit tracking
    if (shouldUpdateWindow) {
      await db
        .prepare(
          'INSERT INTO rate_limit_tracking (ip_address, request_count, window_start, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(ip_address) DO UPDATE SET request_count = ?, window_start = ?, expires_at = ?'
        )
        .bind(
          ipAddress,
          requestCount,
          actualWindowStart.toISOString(),
          expiresAt.toISOString(),
          requestCount,
          actualWindowStart.toISOString(),
          expiresAt.toISOString()
        )
        .run();
    } else {
      await db
        .prepare('UPDATE rate_limit_tracking SET request_count = ? WHERE ip_address = ?')
        .bind(requestCount, ipAddress)
        .run();
    }

    await next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // On error, allow the request through (fail open)
    // Log the error for monitoring
    await next();
  }
}

