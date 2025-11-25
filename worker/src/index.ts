import { Hono } from 'hono';
import type { Env } from './types.js';
import { healthHandler } from './routes/health.js';
import { searchHandler } from './routes/search.js';

const app = new Hono<{ Bindings: Env }>();

// Error handling middleware
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: err.message || 'Internal server error',
      status: err.status || 500,
    },
    err.status || 500
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

