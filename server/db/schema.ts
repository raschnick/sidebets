import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default(''),
  avatarDataUrl: text('avatar_data_url').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
});

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['member', 'group_admin'] }).notNull().default('member'),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })]
);

export const bets = sqliteTable('bets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type', { enum: ['yes_no', 'open_value'] }).notNull(),
  status: text('status', { enum: ['open', 'settled'] }).notNull().default('open'),
  blind: integer('blind', { mode: 'boolean' }).notNull().default(false),
  winnerOptionId: integer('winner_option_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  settledAt: integer('settled_at', { mode: 'timestamp_ms' })
});

export const betHidden = sqliteTable(
  'bet_hidden',
  {
    betId: integer('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.betId, table.userId] })]
);

export const betOptions = sqliteTable('bet_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  betId: integer('bet_id')
    .notNull()
    .references(() => bets.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
});

export const picks = sqliteTable(
  'picks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    betId: integer('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    optionId: integer('option_id').references(() => betOptions.id, { onDelete: 'set null' }),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
  },
  (table) => [uniqueIndex('picks_bet_user_idx').on(table.betId, table.userId)]
);
