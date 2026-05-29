import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { betHidden, bets, groupMembers, groups, sessions, users } from '../db/schema.js';

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toCurrentUser(user: typeof users.$inferSelect): CurrentUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.username,
    status: user.status,
    avatarUrl: user.avatarDataUrl || null,
    isAdmin: user.isAdmin
  };
}

export function getSessionToken(c: Context): string {
  const authHeader = c.req.header('authorization') ?? '';

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();

    if (token) {
      return token;
    }
  }

  const fallbackToken = c.req.header('x-session-token')?.trim();

  if (fallbackToken) {
    return fallbackToken;
  }

  throw new HTTPException(401, { message: 'You must log in first.' });
}

export function getCurrentUser(c: Context): CurrentUser {
  const token = getSessionToken(c);

  const session = db.select().from(sessions).where(eq(sessions.token, token)).get();

  if (!session) {
    throw new HTTPException(401, { message: 'Your session is no longer valid. Please log in again.' });
  }

  const user = db.select().from(users).where(eq(users.id, session.userId)).get();

  if (!user) {
    throw new HTTPException(401, { message: 'User not found.' });
  }

  return toCurrentUser(user);
}

export function requireGroupAccess(groupId: number, user: CurrentUser) {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();

  if (!group) {
    throw new HTTPException(404, { message: 'Group not found.' });
  }

  if (user.isAdmin) {
    return group;
  }

  const membership = db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .get();

  if (!membership) {
    throw new HTTPException(403, { message: 'You are not a member of this group.' });
  }

  return group;
}

export function requireGroupManager(groupId: number, user: CurrentUser) {
  const group = requireGroupAccess(groupId, user);

  if (user.isAdmin || group.createdBy === user.id) {
    return group;
  }

  const membership = db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .get();

  if (!membership || membership.role !== 'group_admin') {
    throw new HTTPException(403, { message: 'Only group managers can change membership.' });
  }

  return group;
}

export function requireVisibleBet(betId: number, user: CurrentUser) {
  const bet = db.select().from(bets).where(eq(bets.id, betId)).get();

  if (!bet) {
    throw new HTTPException(404, { message: 'Bet not found.' });
  }

  requireGroupAccess(bet.groupId, user);

  if (!user.isAdmin) {
    const hidden = db
      .select()
      .from(betHidden)
      .where(and(eq(betHidden.betId, betId), eq(betHidden.userId, user.id)))
      .get();

    if (hidden) {
      throw new HTTPException(404, { message: 'Bet not found.' });
    }
  }

  return bet;
}

export function requireAdmin(user: CurrentUser) {
  if (!user.isAdmin) {
    throw new HTTPException(403, { message: 'Admin access is required.' });
  }
}
