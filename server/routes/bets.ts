import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { betHidden, betOptions, bets, groupMembers, picks, users } from '../db/schema.js';
import type {
  BetDetail,
  BetOption,
  BetPick,
  BetStatus,
  BetSettlementSummary,
  BetSummary,
  BetType
} from '../../src/lib/types.js';
import { getCurrentUser, requireGroupAccess, requireVisibleBet, toIsoString } from '../lib/auth.js';

const betsRoutes = new Hono();

function toOption(
  option: typeof betOptions.$inferSelect,
  pickCount: number | undefined,
  canRevealCounts: boolean
): BetOption {
  return {
    id: option.id,
    betId: option.betId,
    label: option.label,
    isCustom: option.isCustom,
    createdBy: option.createdBy,
    createdAt: toIsoString(option.createdAt) ?? new Date().toISOString(),
    pickCount: canRevealCounts ? pickCount ?? 0 : undefined
  };
}

function toPick(
  row: {
    id: number;
    betId: number;
    userId: number;
    optionId: number | null;
    joinedAt: Date;
    updatedAt: Date;
    displayName: string;
  }
): BetPick {
  return {
    id: row.id,
    betId: row.betId,
    userId: row.userId,
    optionId: row.optionId,
    displayName: row.displayName,
    joinedAt: toIsoString(row.joinedAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString()
  };
}

function getPickRowsForBetIds(betIds: number[]) {
  if (betIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: picks.id,
      betId: picks.betId,
      userId: picks.userId,
      optionId: picks.optionId,
      joinedAt: picks.joinedAt,
      updatedAt: picks.updatedAt,
      displayName: users.username
    })
    .from(picks)
    .innerJoin(users, eq(users.id, picks.userId))
    .where(inArray(picks.betId, betIds))
    .all();
}

function getOptionRowsForBetIds(betIds: number[]) {
  if (betIds.length === 0) {
    return [];
  }

  return db.select().from(betOptions).where(inArray(betOptions.betId, betIds)).all();
}

function getHiddenUsersForBet(betId: number) {
  return db
    .select({
      userId: betHidden.userId,
      username: users.username
    })
    .from(betHidden)
    .innerJoin(users, eq(users.id, betHidden.userId))
    .where(eq(betHidden.betId, betId))
    .all();
}

function canRevealAllPicks(
  bet: typeof bets.$inferSelect,
  currentUser: ReturnType<typeof getCurrentUser>
): boolean {
  if (currentUser.isAdmin) {
    return true;
  }

  if (!bet.blind) {
    return true;
  }

  if (bet.status === 'settled') {
    return true;
  }

  return bet.createdBy === currentUser.id;
}

function buildSettlementSummary(
  bet: typeof bets.$inferSelect,
  betPickRows: ReturnType<typeof getPickRowsForBetIds>
): BetSettlementSummary | null {
  if (bet.status !== 'settled' || !bet.winnerOptionId) {
    return null;
  }

  const totalPot = betPickRows.length;
  const winnerCount = betPickRows.filter((pick) => pick.optionId === bet.winnerOptionId).length;

  return {
    totalPot,
    winnerCount,
    payoutPerWinner: winnerCount > 0 ? totalPot / winnerCount : null
  };
}

function serializeBetSummary(
  bet: typeof bets.$inferSelect,
  currentUser: ReturnType<typeof getCurrentUser>,
  options: Array<typeof betOptions.$inferSelect>,
  pickRows: ReturnType<typeof getPickRowsForBetIds>
): BetSummary {
  const revealAll = canRevealAllPicks(bet, currentUser);
  const optionCounts = new Map<number, number>();
  const betPickRows = pickRows.filter((row) => row.betId === bet.id);

  if (revealAll) {
    for (const pick of betPickRows) {
      if (pick.optionId !== null) {
        optionCounts.set(pick.optionId, (optionCounts.get(pick.optionId) ?? 0) + 1);
      }
    }
  }

  const myPickRow = betPickRows.find((row) => row.userId === currentUser.id) ?? null;
  const myPick = myPickRow ? toPick(myPickRow) : null;

  return {
    id: bet.id,
    groupId: bet.groupId,
    title: bet.title,
    description: bet.description ?? '',
    type: bet.type as BetType,
    status: bet.status as BetStatus,
    blind: bet.blind,
    createdBy: bet.createdBy,
    createdAt: toIsoString(bet.createdAt) ?? new Date().toISOString(),
    settledAt: toIsoString(bet.settledAt),
    winnerOptionId: bet.winnerOptionId,
    participantCount: betPickRows.length,
    myPick,
    options: options
      .filter((option) => option.betId === bet.id)
      .map((option) => toOption(option, optionCounts.get(option.id), revealAll)),
    canSettle: bet.createdBy === currentUser.id && bet.status === 'open',
    settlement: buildSettlementSummary(bet, betPickRows)
  };
}

function serializeBetDetail(
  bet: typeof bets.$inferSelect,
  currentUser: ReturnType<typeof getCurrentUser>
): BetDetail {
  const revealAll = canRevealAllPicks(bet, currentUser);
  const options = db.select().from(betOptions).where(eq(betOptions.betId, bet.id)).all();
  const pickRows = getPickRowsForBetIds([bet.id]);
  const optionCounts = new Map<number, number>();

  for (const pick of pickRows) {
    if (pick.optionId !== null) {
      optionCounts.set(pick.optionId, (optionCounts.get(pick.optionId) ?? 0) + 1);
    }
  }

  const visiblePicks = revealAll ? pickRows : pickRows.filter((row) => row.userId === currentUser.id);
  const hiddenUsers =
    currentUser.isAdmin || currentUser.id === bet.createdBy ? getHiddenUsersForBet(bet.id) : [];
  const winners =
    bet.status === 'settled' && bet.winnerOptionId
      ? visiblePicks.filter((pick) => pick.optionId === bet.winnerOptionId).map(toPick)
      : [];

  return {
    ...serializeBetSummary(bet, currentUser, options, pickRows),
    options: options.map((option) => toOption(option, optionCounts.get(option.id), revealAll)),
    picks: visiblePicks.map(toPick),
    hiddenUserIds: hiddenUsers.map((entry) => entry.userId),
    hiddenUsernames: hiddenUsers.map((entry) => entry.username),
    winners
  };
}

function validateHiddenUsers(groupId: number, hiddenUserIds: number[]) {
  if (hiddenUserIds.length === 0) {
    return;
  }

  const groupUserRows = db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
    .all();

  const validIds = new Set(groupUserRows.map((entry) => entry.userId));

  for (const userId of hiddenUserIds) {
    if (!validIds.has(userId)) {
      throw new Error(`Hidden user ${userId} is not a member of this group.`);
    }
  }
}

betsRoutes.get('/group/:groupId', (c) => {
  const user = getCurrentUser(c);
  const groupId = Number(c.req.param('groupId'));
  requireGroupAccess(groupId, user);

  const allBets = db.select().from(bets).where(eq(bets.groupId, groupId)).orderBy(desc(bets.createdAt)).all();
  const hiddenIds = user.isAdmin
    ? new Set<number>()
    : new Set(
        db
          .select({ betId: betHidden.betId })
          .from(betHidden)
          .where(eq(betHidden.userId, user.id))
          .all()
          .map((entry) => entry.betId)
      );

  const visibleBets = user.isAdmin ? allBets : allBets.filter((bet) => !hiddenIds.has(bet.id));
  const betIds = visibleBets.map((bet) => bet.id);
  const options = getOptionRowsForBetIds(betIds);
  const pickRows = getPickRowsForBetIds(betIds);

  return c.json({
    bets: visibleBets.map((bet) => serializeBetSummary(bet, user, options, pickRows))
  });
});

betsRoutes.get('/:betId', (c) => {
  const user = getCurrentUser(c);
  const betId = Number(c.req.param('betId'));
  const bet = requireVisibleBet(betId, user);

  return c.json({ bet: serializeBetDetail(bet, user) });
});

betsRoutes.post('/', async (c) => {
  const user = getCurrentUser(c);
  const body = (await c.req.json()) as {
    groupId?: number;
    title?: string;
    description?: string;
    type?: BetType;
    blind?: boolean;
    hiddenUserIds?: number[];
    options?: string[];
  };

  const groupId = Number(body.groupId);
  const title = body.title?.trim();
  const description = body.description?.trim() ?? '';
  const type = body.type;
  const blind = Boolean(body.blind);
  const hiddenUserIds = Array.from(
    new Set((body.hiddenUserIds ?? []).filter((value) => Number.isInteger(value) && value > 0))
  );

  if (!Number.isInteger(groupId) || groupId <= 0) {
    return c.json({ error: 'A valid groupId is required.' }, 400);
  }

  requireGroupAccess(groupId, user);

  if (!title) {
    return c.json({ error: 'Bet title is required.' }, 400);
  }

  if (type !== 'yes_no' && type !== 'open_value') {
    return c.json({ error: 'Bet type must be yes_no or open_value.' }, 400);
  }

  if (hiddenUserIds.includes(user.id)) {
    return c.json({ error: 'The bet creator cannot hide the bet from themselves.' }, 400);
  }

  try {
    validateHiddenUsers(groupId, hiddenUserIds);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid hidden users.' }, 400);
  }

  const createdBet = db
    .insert(bets)
    .values({
      groupId,
      createdBy: user.id,
      title,
      description,
      type,
      blind
    })
    .returning()
    .get();

  const optionLabels =
    type === 'yes_no'
      ? ['Yes', 'No']
      : Array.from(new Set((body.options ?? []).map((value) => value.trim()).filter(Boolean)));

  if (optionLabels.length > 0) {
    db.insert(betOptions)
      .values(
        optionLabels.map((label) => ({
          betId: createdBet.id,
          label,
          isCustom: type === 'open_value',
          createdBy: user.id
        }))
      )
      .run();
  }

  if (hiddenUserIds.length > 0) {
    db.insert(betHidden)
      .values(hiddenUserIds.map((hiddenUserId) => ({ betId: createdBet.id, userId: hiddenUserId })))
      .run();
  }

  return c.json({ bet: serializeBetDetail(createdBet, user) }, 201);
});

betsRoutes.post('/:betId/settle', async (c) => {
  const user = getCurrentUser(c);
  const betId = Number(c.req.param('betId'));
  const bet = requireVisibleBet(betId, user);
  const body = (await c.req.json()) as { winnerOptionId?: number };
  const winnerOptionId = Number(body.winnerOptionId);

  if (bet.createdBy !== user.id) {
    return c.json({ error: 'Only the bet creator can settle this bet.' }, 403);
  }

  if (bet.status === 'settled') {
    return c.json({ error: 'This bet is already settled.' }, 400);
  }

  if (!Number.isInteger(winnerOptionId) || winnerOptionId <= 0) {
    return c.json({ error: 'A valid winnerOptionId is required.' }, 400);
  }

  const option = db
    .select()
    .from(betOptions)
    .where(and(eq(betOptions.id, winnerOptionId), eq(betOptions.betId, bet.id)))
    .get();

  if (!option) {
    return c.json({ error: 'Winner option not found for this bet.' }, 404);
  }

  db.update(bets)
    .set({
      winnerOptionId,
      status: 'settled',
      settledAt: new Date()
    })
    .where(eq(bets.id, bet.id))
    .run();

  const updatedBet = db.select().from(bets).where(eq(bets.id, bet.id)).get();
  return c.json({ bet: serializeBetDetail(updatedBet!, user) });
});

export default betsRoutes;
