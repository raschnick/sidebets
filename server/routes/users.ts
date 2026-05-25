import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { UserSummary } from '../../src/lib/types.js';
import { getCurrentUser, requireAdmin } from '../lib/auth.js';
import { hashPassword } from '../lib/passwords.js';

const usersRoutes = new Hono();

function serializeUser(user: typeof users.$inferSelect): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.username,
    isAdmin: user.isAdmin
  };
}

function listUsers() {
  return db.select().from(users).orderBy(asc(users.username)).all();
}

usersRoutes.get('/bootstrap', (c) => {
  const currentUser = getCurrentUser(c);

  return c.json({
    currentUser,
    users: listUsers().map(serializeUser)
  });
});

usersRoutes.post('/', async (c) => {
  const currentUser = getCurrentUser(c);
  requireAdmin(currentUser);

  const body = (await c.req.json()) as {
    username?: string;
    isAdmin?: boolean;
    password?: string;
  };

  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!username || !/^[a-z0-9_]+$/i.test(username)) {
    return c.json({ error: 'Username is required and may only contain letters, numbers, and underscores.' }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  const existingUser = db.select().from(users).where(eq(users.username, username)).get();

  if (existingUser) {
    return c.json({ error: 'That username is already taken.' }, 400);
  }

  const createdUser = db
    .insert(users)
    .values({
      username,
      displayName: username,
      passwordHash: hashPassword(password),
      isAdmin: Boolean(body.isAdmin)
    })
    .returning()
    .get();

  return c.json({ user: serializeUser(createdUser) }, 201);
});

usersRoutes.patch('/:userId', async (c) => {
  const currentUser = getCurrentUser(c);
  requireAdmin(currentUser);

  const userId = Number(c.req.param('userId'));

  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: 'A valid userId is required.' }, 400);
  }

  const body = (await c.req.json()) as {
    username?: string;
    isAdmin?: boolean;
    password?: string;
  };

  const existingUser = db.select().from(users).where(eq(users.id, userId)).get();

  if (!existingUser) {
    return c.json({ error: 'User not found.' }, 404);
  }

  const username = body.username?.trim().toLowerCase();
  const nextIsAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : existingUser.isAdmin;
  const password = body.password;

  if (username && !/^[a-z0-9_]+$/i.test(username)) {
    return c.json({ error: 'Username may only contain letters, numbers, and underscores.' }, 400);
  }

  if (typeof password === 'string' && password.length > 0 && password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  if (username && username !== existingUser.username) {
    const taken = db.select().from(users).where(eq(users.username, username)).get();

    if (taken) {
      return c.json({ error: 'That username is already taken.' }, 400);
    }
  }

  if (currentUser.id === userId && !nextIsAdmin) {
    return c.json({ error: 'You cannot remove your own admin access.' }, 400);
  }

  db.update(users)
    .set({
      username: username ?? existingUser.username,
      displayName: username ?? existingUser.username,
      isAdmin: nextIsAdmin,
      passwordHash: typeof password === 'string' && password.length > 0 ? hashPassword(password) : existingUser.passwordHash
    })
    .where(eq(users.id, userId))
    .run();

  const updatedUser = db.select().from(users).where(eq(users.id, userId)).get();
  return c.json({ user: serializeUser(updatedUser!) });
});

export default usersRoutes;
