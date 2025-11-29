import { Hono } from 'hono';
import type { Env } from './types.js';
import type { ScheduledController, MessageBatch } from '@cloudflare/workers-types';
import type { ChainSyncMessage } from './types.js';
import { healthHandler } from './routes/health.js';
import { searchHandler } from './routes/search.js';
import { validateSearchRequest } from './middleware/validation.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { createErrorResponse, ErrorCode } from './utils/errors.js';
// Import the scheduled handler implementation
import { scheduled as scheduledHandlerImpl } from './scheduled.js';
// Import the queue handler implementation
import { queue as queueHandlerImpl } from './queue.js';

const app = new Hono<{ Bindings: Env }>();

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
});

// CORS middleware
app.use('*', async (c, next) => {
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.json({}, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  }
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
});

// Error handling middleware
app.onError((err, c) => {
  console.error('Error:', err);
  const status = (err as any).status || 500;
  const errorResponse = createErrorResponse(err, status);
  return c.json(errorResponse, status);
});

// Health check route
app.get('/health', healthHandler);

// Search route with validation and rate limiting
app.post('/api/search', rateLimitMiddleware, validateSearchRequest, searchHandler);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Export default handler that wraps Hono app
// Using ExportedHandler pattern - ALL handlers must be on this object
// Cloudflare Workers will look for fetch, scheduled, and queue on the default export
const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return scheduledHandlerImpl(controller, env, ctx);
  },
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Cast to our specific message type
    return queueHandlerImpl(batch as MessageBatch<ChainSyncMessage>, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export default handler;
