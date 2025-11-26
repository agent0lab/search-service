import { Hono } from 'hono';
import type { Env } from './types.js';
import { healthHandler } from './routes/health.js';
import { searchHandler } from './routes/search.js';
import { scheduled } from './scheduled.js';

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

export default app;

// Export scheduled handler for cron triggers
export { scheduled };

