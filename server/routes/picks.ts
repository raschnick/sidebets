import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { betOptions, bets, picks } from '../db/schema.js';
import { getCurrentUser, requireVisibleBet, toIsoString } from '../lib/auth.js';

const picksRoutes = new Hono();

function serializeUserPick(pick: typeof picks.$inferSelect | null) {
  if (!pick) {
    return null;
  }

  return {
    id: pick.id,
    betId: pick.betId,
    userId: pick.userId,
    optionId: pick.optionId,
    joinedAt: toIsoString(pick.joinedAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(pick.updatedAt) ?? new Date().toISOString()
  };
}

function ensureOpenBet(betId: number, user: ReturnType<typeof getCurrentUser>) {
  const bet = requireVisibleBet(betId, user);

  if (bet.status !== 'open') {
    throw new HTTPException(400, { message: 'This bet is already settled.' });
  }

  return bet;
}

picksRoutes.post('/:betId/join', (c) => {
  const user = getCurrentUser(c);
  const betId = Number(c.req.param('betId'));
  const bet = ensureOpenBet(betId, user);

  const existingPick = db
    .select()
    .from(picks)
    .where(and(eq(picks.betId, bet.id), eq(picks.userId, user.id)))
    .get();

  if (!existingPick) {
    db.insert(picks)
      .values({
        betId: bet.id,
        userId: user.id,
        optionId: null
      })
      .run();
  }

  const pick = db
    .select()
    .from(picks)
    .where(and(eq(picks.betId, bet.id), eq(picks.userId, user.id)))
    .get();

  return c.json({ pick: serializeUserPick(pick) });
});

picksRoutes.post('/:betId/pick', async (c) => {
  const user = getCurrentUser(c);
  const betId = Number(c.req.param('betId'));
  const body = (await c.req.json()) as { optionId?: number };
  const optionId = Number(body.optionId);

  if (!Number.isInteger(optionId) || optionId <= 0) {
    return c.json({ error: 'A valid optionId is required.' }, 400);
  }

  const bet = ensureOpenBet(betId, user);

  const option = db
    .select()
    .from(betOptions)
    .where(and(eq(betOptions.id, optionId), eq(betOptions.betId, bet.id)))
    .get();

  if (!option) {
    return c.json({ error: 'Option not found for this bet.' }, 404);
  }

  db.insert(picks)
    .values({
      betId,
      userId: user.id,
      optionId,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [picks.betId, picks.userId],
      set: {
        optionId,
        updatedAt: new Date()
      }
    })
    .run();

  const pick = db
    .select()
    .from(picks)
    .where(and(eq(picks.betId, betId), eq(picks.userId, user.id)))
    .get();

  return c.json({ pick: serializeUserPick(pick) });
});

picksRoutes.post('/:betId/options', async (c) => {
  const user = getCurrentUser(c);
  const betId = Number(c.req.param('betId'));
  const body = (await c.req.json()) as { label?: string };
  const label = body.label?.trim();

  if (!label) {
    return c.json({ error: 'A custom option label is required.' }, 400);
  }

  const bet = ensureOpenBet(betId, user);

  if (bet.type !== 'open_value') {
    return c.json({ error: 'Custom options are only allowed for open value bets.' }, 400);
  }

  const existingOptions = db.select().from(betOptions).where(eq(betOptions.betId, betId)).all();

  if (existingOptions.some((option) => option.label.toLowerCase() === label.toLowerCase())) {
    return c.json({ error: 'That option already exists for this bet.' }, 400);
  }

  const option = db
    .insert(betOptions)
    .values({
      betId,
      label,
      isCustom: true,
      createdBy: user.id
    })
    .returning()
    .get();

  return c.json({
    option: {
      id: option.id,
      betId: option.betId,
      label: option.label,
      isCustom: option.isCustom,
      createdBy: option.createdBy,
      createdAt: toIsoString(option.createdAt) ?? new Date().toISOString()
    }
  });
});

export default picksRoutes;
