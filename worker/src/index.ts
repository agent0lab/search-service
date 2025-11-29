import { Hono } from 'hono';
import type { Env } from './types.js';
import type { ScheduledController, MessageBatch } from '@cloudflare/workers-types';
import type { ChainSyncMessage } from './types.js';
import { healthHandler } from './routes/health.js';
import { searchHandler } from './routes/search.js';
// Import the scheduled handler implementation
import { scheduled as scheduledHandlerImpl } from './scheduled.js';
// Import the queue handler implementation
import { queue as queueHandlerImpl } from './queue.js';

const app = new Hono<{ Bindings: Env }>();

// Error handling middleware
app.onError((err, c) => {
  console.error('Error:', err);
  const status = (err as any).status || 500;
  return c.json(
    {
      error: err.message || 'Internal server error',
      status,
    },
    status
  );
});

// CORS middleware
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
});

// Health check route
app.get('/health', healthHandler);

// Search route
app.post('/api/search', searchHandler);

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
