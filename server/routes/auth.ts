import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { getSessionToken, getCurrentUser, toCurrentUser } from '../lib/auth.js';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../lib/passwords.js';

const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json()) as { username?: string; password?: string };
  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!username || !password) {
    return c.json({ error: 'Username and password are required.' }, 400);
  }

  const user = db.select().from(users).where(eq(users.username, username)).get();

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return c.json({ error: 'Invalid username or password.' }, 401);
  }

  if (needsPasswordRehash(user.passwordHash)) {
    db.update(users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(users.id, user.id))
      .run();
  }

  const token = randomBytes(32).toString('hex');

  db.insert(sessions)
    .values({
      token,
      userId: user.id
    })
    .run();

  return c.json({
    token,
    user: toCurrentUser(user)
  });
});

authRoutes.post('/logout', (c) => {
  const token = getSessionToken(c);

  db.delete(sessions).where(eq(sessions.token, token)).run();

  return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
  const user = getCurrentUser(c);
  return c.json({ user });
});

export default authRoutes;
