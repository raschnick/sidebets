import { existsSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import authRoutes from './routes/auth.js';
import groupsRoutes from './routes/groups.js';
import betsRoutes from './routes/bets.js';
import picksRoutes from './routes/picks.js';
import usersRoutes from './routes/users.js';

const app = new Hono();

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    timestamp: new Date().toISOString()
  })
);

app.route('/api/auth', authRoutes);
app.route('/api/groups', groupsRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/bets', betsRoutes);
app.route('/api/bets', picksRoutes);

const clientDist = path.join(process.cwd(), 'dist', 'client');
const hasBuiltClient = existsSync(path.join(clientDist, 'index.html'));

if (hasBuiltClient) {
  app.use('/assets/*', serveStatic({ root: clientDist }));
  app.use('/manifest.webmanifest', serveStatic({ root: clientDist }));
  app.use('/registerSW.js', serveStatic({ root: clientDist }));
  app.use('/sw.js', serveStatic({ root: clientDist }));
  app.use('/workbox-*.js', serveStatic({ root: clientDist }));
  app.use('/icon-192.svg', serveStatic({ root: clientDist }));
  app.use('/icon-512.svg', serveStatic({ root: clientDist }));
  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api')) {
      return c.json({ error: 'Not found.' }, 404);
    }

    return serveStatic({ root: clientDist, path: 'index.html' })(c, next);
  });
} else {
  app.get('*', (c) =>
    c.json({
      message: 'SideBets API is running. Build the client bundle to serve the PWA from this process.'
    })
  );
}

const port = Number(process.env.PORT ?? '3000');

serve({
  fetch: app.fetch,
  port
});

console.log(`SideBets server listening on http://localhost:${port}`);
