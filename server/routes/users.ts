import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { UserSummary } from '../../src/lib/types.js';
import { getCurrentUser, requireAdmin } from '../lib/auth.js';
import { hashPassword } from '../lib/passwords.js';

const usersRoutes = new Hono();
const MAX_STATUS_LENGTH = 140;
const MAX_AVATAR_DATA_URL_LENGTH = 450_000;

function sanitizeStatus(status: unknown) {
  if (typeof status !== 'string') {
    return '';
  }

  return status.trim();
}

function sanitizeAvatarDataUrl(avatarDataUrl: unknown) {
  if (avatarDataUrl == null || avatarDataUrl === '') {
    return '';
  }

  if (typeof avatarDataUrl !== 'string') {
    return null;
  }

  const normalized = avatarDataUrl.trim();

  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(normalized)) {
    return null;
  }

  if (normalized.length > MAX_AVATAR_DATA_URL_LENGTH) {
    return false;
  }

  return normalized;
}

function serializeUser(user: typeof users.$inferSelect): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.username,
    status: user.status,
    avatarUrl: user.avatarDataUrl || null,
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
    status?: string;
    avatarUrl?: string | null;
  };

  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? '';
  const status = sanitizeStatus(body.status);
  const avatarDataUrl = sanitizeAvatarDataUrl(body.avatarUrl);

  if (!username || !/^[a-z0-9_]+$/i.test(username)) {
    return c.json({ error: 'Username is required and may only contain letters, numbers, and underscores.' }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  if (status.length > MAX_STATUS_LENGTH) {
    return c.json({ error: `Status must be ${MAX_STATUS_LENGTH} characters or fewer.` }, 400);
  }

  if (avatarDataUrl === null) {
    return c.json({ error: 'Profile photos must be PNG, JPEG, or WebP images.' }, 400);
  }

  if (avatarDataUrl === false) {
    return c.json({ error: 'Profile photos are too large. Please choose a smaller image.' }, 400);
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
      status,
      avatarDataUrl,
      passwordHash: hashPassword(password),
      isAdmin: Boolean(body.isAdmin)
    })
    .returning()
    .get();

  return c.json({ user: serializeUser(createdUser) }, 201);
});

usersRoutes.patch('/me', async (c) => {
  const currentUser = getCurrentUser(c);
  const body = (await c.req.json()) as {
    username?: string;
    status?: string;
    avatarUrl?: string | null;
  };

  const existingUser = db.select().from(users).where(eq(users.id, currentUser.id)).get();

  if (!existingUser) {
    return c.json({ error: 'User not found.' }, 404);
  }

  const hasUsernameField = typeof body.username === 'string';
  const username = body.username?.trim().toLowerCase();
  const status = typeof body.status === 'string' ? sanitizeStatus(body.status) : existingUser.status;
  const avatarDataUrlInput = body.avatarUrl === undefined ? existingUser.avatarDataUrl : sanitizeAvatarDataUrl(body.avatarUrl);

  if (hasUsernameField && !username) {
    return c.json({ error: 'Username is required.' }, 400);
  }

  if (username && !/^[a-z0-9_]+$/i.test(username)) {
    return c.json({ error: 'Username may only contain letters, numbers, and underscores.' }, 400);
  }

  if (status.length > MAX_STATUS_LENGTH) {
    return c.json({ error: `Status must be ${MAX_STATUS_LENGTH} characters or fewer.` }, 400);
  }

  if (avatarDataUrlInput === null) {
    return c.json({ error: 'Profile photos must be PNG, JPEG, or WebP images.' }, 400);
  }

  if (avatarDataUrlInput === false) {
    return c.json({ error: 'Profile photos are too large. Please choose a smaller image.' }, 400);
  }

  if (username && username !== existingUser.username) {
    const taken = db.select().from(users).where(eq(users.username, username)).get();

    if (taken) {
      return c.json({ error: 'That username is already taken.' }, 400);
    }
  }

  db.update(users)
    .set({
      username: username ?? existingUser.username,
      displayName: username ?? existingUser.username,
      status,
      avatarDataUrl: avatarDataUrlInput
    })
    .where(eq(users.id, currentUser.id))
    .run();

  const updatedUser = db.select().from(users).where(eq(users.id, currentUser.id)).get();
  return c.json({ user: serializeUser(updatedUser!) });
});

usersRoutes.patch('/me/password', async (c) => {
  const currentUser = getCurrentUser(c);
  const body = (await c.req.json()) as {
    password?: string;
  };

  const existingUser = db.select().from(users).where(eq(users.id, currentUser.id)).get();

  if (!existingUser) {
    return c.json({ error: 'User not found.' }, 404);
  }

  const password = body.password ?? '';

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  db.update(users)
    .set({
      passwordHash: hashPassword(password)
    })
    .where(eq(users.id, currentUser.id))
    .run();

  const updatedUser = db.select().from(users).where(eq(users.id, currentUser.id)).get();
  return c.json({ user: serializeUser(updatedUser!) });
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
    status?: string;
    avatarUrl?: string | null;
  };

  const existingUser = db.select().from(users).where(eq(users.id, userId)).get();

  if (!existingUser) {
    return c.json({ error: 'User not found.' }, 404);
  }

  const hasUsernameField = typeof body.username === 'string';
  const username = body.username?.trim().toLowerCase();
  const nextIsAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : existingUser.isAdmin;
  const password = body.password;
  const status = typeof body.status === 'string' ? sanitizeStatus(body.status) : existingUser.status;
  const avatarDataUrlInput = body.avatarUrl === undefined ? existingUser.avatarDataUrl : sanitizeAvatarDataUrl(body.avatarUrl);

  if (hasUsernameField && !username) {
    return c.json({ error: 'Username is required.' }, 400);
  }

  if (username && !/^[a-z0-9_]+$/i.test(username)) {
    return c.json({ error: 'Username may only contain letters, numbers, and underscores.' }, 400);
  }

  if (typeof password === 'string' && password.length > 0 && password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  if (status.length > MAX_STATUS_LENGTH) {
    return c.json({ error: `Status must be ${MAX_STATUS_LENGTH} characters or fewer.` }, 400);
  }

  if (avatarDataUrlInput === null) {
    return c.json({ error: 'Profile photos must be PNG, JPEG, or WebP images.' }, 400);
  }

  if (avatarDataUrlInput === false) {
    return c.json({ error: 'Profile photos are too large. Please choose a smaller image.' }, 400);
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
      status,
      avatarDataUrl: avatarDataUrlInput,
      isAdmin: nextIsAdmin,
      passwordHash: typeof password === 'string' && password.length > 0 ? hashPassword(password) : existingUser.passwordHash
    })
    .where(eq(users.id, userId))
    .run();

  const updatedUser = db.select().from(users).where(eq(users.id, userId)).get();
  return c.json({ user: serializeUser(updatedUser!) });
});

export default usersRoutes;
