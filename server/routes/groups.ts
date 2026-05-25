import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { groupMembers, groups, users } from '../db/schema.js';
import type { GroupDetail, GroupMember, GroupSummary } from '../../src/lib/types.js';
import { getCurrentUser, requireGroupAccess, requireGroupManager, toIsoString } from '../lib/auth.js';

const groupsRoutes = new Hono();

function serializeMember(row: {
  userId: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  role: 'member' | 'group_admin';
}): GroupMember {
  return {
    id: row.userId,
    username: row.username,
    displayName: row.username,
    isAdmin: row.isAdmin,
    role: row.role
  };
}

function buildGroupSummary(group: typeof groups.$inferSelect, members: GroupMember[]): GroupSummary {
  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    createdAt: toIsoString(group.createdAt) ?? new Date().toISOString(),
    memberCount: members.length
  };
}

function getMembersForGroupIds(groupIds: number[]) {
  if (groupIds.length === 0) {
    return new Map<number, GroupMember[]>();
  }

  const memberRows = db
    .select({
      groupId: groupMembers.groupId,
      userId: users.id,
      username: users.username,
      displayName: users.username,
      isAdmin: users.isAdmin,
      role: groupMembers.role
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(inArray(groupMembers.groupId, groupIds))
    .all();

  const memberMap = new Map<number, GroupMember[]>();

  for (const row of memberRows) {
    const entry = serializeMember(row);
    const list = memberMap.get(row.groupId) ?? [];
    list.push(entry);
    memberMap.set(row.groupId, list);
  }

  return memberMap;
}

groupsRoutes.get('/', (c) => {
  const user = getCurrentUser(c);

  const groupRows = user.isAdmin
    ? db.select().from(groups).all()
    : db
        .select({
          id: groups.id,
          name: groups.name,
          createdBy: groups.createdBy,
          createdAt: groups.createdAt
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(eq(groupMembers.userId, user.id))
        .all();

  const groupIds = groupRows.map((group) => group.id);
  const memberMap = getMembersForGroupIds(groupIds);

  const payload = groupRows.map((group) => buildGroupSummary(group, memberMap.get(group.id) ?? []));
  return c.json({ groups: payload });
});

groupsRoutes.get('/:groupId', (c) => {
  const user = getCurrentUser(c);
  const groupId = Number(c.req.param('groupId'));
  const group = requireGroupAccess(groupId, user);
  const memberMap = getMembersForGroupIds([groupId]);
  const members = memberMap.get(groupId) ?? [];

  const payload: GroupDetail = {
    ...buildGroupSummary(group, members),
    members
  };

  return c.json({ group: payload });
});

groupsRoutes.post('/', async (c) => {
  const user = getCurrentUser(c);
  const body = (await c.req.json()) as { name?: string; memberIds?: number[] };
  const name = body.name?.trim();
  const memberIds = Array.from(new Set((body.memberIds ?? []).filter((value) => Number.isInteger(value))));

  if (!name) {
    return c.json({ error: 'Group name is required.' }, 400);
  }

  const uniqueMembers = Array.from(new Set([user.id, ...memberIds]));

  if (uniqueMembers.length > 0) {
    const knownUsers = db.select({ id: users.id }).from(users).where(inArray(users.id, uniqueMembers)).all();
    const knownUserIds = new Set(knownUsers.map((entry) => entry.id));

    for (const memberId of uniqueMembers) {
      if (!knownUserIds.has(memberId)) {
        return c.json({ error: `User ${memberId} does not exist.` }, 400);
      }
    }
  }

  const createdGroup = db
    .insert(groups)
    .values({
      name,
      createdBy: user.id
    })
    .returning()
    .get();

  if (uniqueMembers.length > 0) {
    db.insert(groupMembers)
      .values(
        uniqueMembers.map((memberId) => ({
          groupId: createdGroup.id,
          userId: memberId,
          role: memberId === user.id ? 'group_admin' : 'member'
        }))
      )
      .run();
  }

  const members = getMembersForGroupIds([createdGroup.id]).get(createdGroup.id) ?? [];

  return c.json(
    {
      group: {
        ...buildGroupSummary(createdGroup, members),
        members
      } satisfies GroupDetail
    },
    201
  );
});

groupsRoutes.post('/:groupId/members', async (c) => {
  const user = getCurrentUser(c);
  const groupId = Number(c.req.param('groupId'));
  requireGroupManager(groupId, user);

  const body = (await c.req.json()) as { userId?: number; role?: 'member' | 'group_admin' };
  const memberId = Number(body.userId);
  const role = body.role === 'group_admin' ? 'group_admin' : 'member';

  if (!Number.isInteger(memberId) || memberId <= 0) {
    return c.json({ error: 'A valid userId is required.' }, 400);
  }

  const existingUser = db.select().from(users).where(eq(users.id, memberId)).get();

  if (!existingUser) {
    return c.json({ error: 'User not found.' }, 404);
  }

  db.insert(groupMembers)
    .values({
      groupId,
      userId: memberId,
      role
    })
    .onConflictDoNothing()
    .run();

  const group = requireGroupAccess(groupId, user);
  const members = getMembersForGroupIds([groupId]).get(groupId) ?? [];

  return c.json({
    group: {
      ...buildGroupSummary(group, members),
      members
    } satisfies GroupDetail
  });
});

groupsRoutes.delete('/:groupId/members/:userId', (c) => {
  const user = getCurrentUser(c);
  const groupId = Number(c.req.param('groupId'));
  const memberId = Number(c.req.param('userId'));
  const group = requireGroupManager(groupId, user);

  if (!Number.isInteger(memberId) || memberId <= 0) {
    return c.json({ error: 'A valid userId is required.' }, 400);
  }

  if (group.createdBy === memberId) {
    return c.json({ error: 'The group creator cannot be removed.' }, 400);
  }

  db.delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)))
    .run();

  const members = getMembersForGroupIds([groupId]).get(groupId) ?? [];

  return c.json({
    group: {
      ...buildGroupSummary(group, members),
      members
    } satisfies GroupDetail
  });
});

export default groupsRoutes;
