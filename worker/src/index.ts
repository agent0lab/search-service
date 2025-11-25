import { Hono } from 'hono';
import type { Env } from './types.js';

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

// Health check route (will be implemented in next commit)
app.get('/health', async (c) => {
  return c.json({ status: 'ok' });
});

// Search route (will be implemented in later commit)
app.post('/api/search', async (c) => {
  return c.json({ message: 'Not implemented yet' }, 501);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;

