import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { hashPassword } from '../lib/passwords.js';

const defaultSqliteUrl = 'file:./data/sidebets.db';
const databaseUrl = process.env.DATABASE_URL ?? defaultSqliteUrl;
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);

if (isPostgres) {
  throw new Error(
    [
      'This scaffold is wired for SQLite at runtime today.',
      'To switch to Postgres, keep the same Drizzle-friendly route layer and replace the SQLite connection below.',
      'Suggested next step:',
      '// import { Pool } from "pg";',
      '// import { drizzle } from "drizzle-orm/node-postgres";',
      '// const pool = new Pool({ connectionString: process.env.DATABASE_URL });',
      '// export const db = drizzle(pool, { schema });'
    ].join('\n')
  );
}

const sqlitePath = databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;

if (sqlitePath !== ':memory:') {
  mkdirSync(path.dirname(sqlitePath), { recursive: true });
}

export const sqlite = new Database(sqlitePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    blind INTEGER NOT NULL DEFAULT 0,
    winner_option_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    settled_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS bet_hidden (
    bet_id INTEGER NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (bet_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS bet_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_id INTEGER NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id INTEGER REFERENCES bet_options(id) ON DELETE SET NULL,
    joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE (bet_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_bets_group ON bets(group_id);
  CREATE INDEX IF NOT EXISTS idx_bet_hidden_user ON bet_hidden(user_id);
  CREATE INDEX IF NOT EXISTS idx_bet_options_bet ON bet_options(bet_id);
  CREATE INDEX IF NOT EXISTS idx_picks_bet ON picks(bet_id);
`);

export const db = drizzle(sqlite, { schema });

type SeedCountRow = { count: number };
type SeedInsertRow = { lastInsertRowid: number | bigint };

function seedDemoData() {
  const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as SeedCountRow;

  if (countRow.count > 0) {
    return;
  }

  const insertUser = sqlite.prepare(`
    INSERT INTO users (username, display_name, password_hash, is_admin)
    VALUES (?, ?, ?, ?)
  `);

  insertUser.run('alex', 'Alex', hashPassword('demo-password'), 0);
  insertUser.run('sam', 'Sam', hashPassword('demo-password'), 0);
  insertUser.run('jamie', 'Jamie', hashPassword('demo-password'), 0);
  insertUser.run('taylor', 'Taylor', hashPassword('demo-password'), 0);
  insertUser.run('admin', 'Admin', hashPassword('demo-password'), 1);

  const groupRow = sqlite
    .prepare(`
      INSERT INTO groups (name, created_by)
      VALUES (?, ?)
    `)
    .run('Weekend Crew', 1) as SeedInsertRow;

  const groupId = Number(groupRow.lastInsertRowid);
  const insertMember = sqlite.prepare(`
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (?, ?, ?)
  `);

  insertMember.run(groupId, 1, 'group_admin');
  insertMember.run(groupId, 2, 'member');
  insertMember.run(groupId, 3, 'member');
  insertMember.run(groupId, 4, 'member');

  const yesNoBetRow = sqlite
    .prepare(`
      INSERT INTO bets (group_id, created_by, title, description, type, blind)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      groupId,
      1,
      'Will it rain on Saturday?',
      'Winner gets bragging rights for checking the forecast.',
      'yes_no',
      0
    ) as SeedInsertRow;

  const yesNoBetId = Number(yesNoBetRow.lastInsertRowid);
  const insertOption = sqlite.prepare(`
    INSERT INTO bet_options (bet_id, label, is_custom, created_by)
    VALUES (?, ?, ?, ?)
  `);

  const yesOptionRow = insertOption.run(yesNoBetId, 'Yes', 0, 1) as SeedInsertRow;
  const noOptionRow = insertOption.run(yesNoBetId, 'No', 0, 1) as SeedInsertRow;

  sqlite
    .prepare(`
      INSERT INTO picks (bet_id, user_id, option_id)
      VALUES (?, ?, ?)
    `)
    .run(yesNoBetId, 2, Number(yesOptionRow.lastInsertRowid));
  sqlite
    .prepare(`
      INSERT INTO picks (bet_id, user_id, option_id)
      VALUES (?, ?, ?)
    `)
    .run(yesNoBetId, 3, Number(noOptionRow.lastInsertRowid));

  const blindBetRow = sqlite
    .prepare(`
      INSERT INTO bets (group_id, created_by, title, description, type, blind)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      groupId,
      2,
      'When will Jamie arrive tonight?',
      'Blind mode until Sam settles it.',
      'open_value',
      1
    ) as SeedInsertRow;

  const blindBetId = Number(blindBetRow.lastInsertRowid);
  const option1 = insertOption.run(blindBetId, '19:30', 1, 2) as SeedInsertRow;
  const option2 = insertOption.run(blindBetId, '19:45', 1, 3) as SeedInsertRow;

  sqlite
    .prepare(`
      INSERT INTO picks (bet_id, user_id, option_id)
      VALUES (?, ?, ?)
    `)
    .run(blindBetId, 2, Number(option1.lastInsertRowid));
  sqlite
    .prepare(`
      INSERT INTO picks (bet_id, user_id, option_id)
      VALUES (?, ?, ?)
    `)
    .run(blindBetId, 3, Number(option2.lastInsertRowid));
  sqlite
    .prepare(`
      INSERT INTO bet_hidden (bet_id, user_id)
      VALUES (?, ?)
    `)
    .run(blindBetId, 4);
}

seedDemoData();

sqlite
  .prepare(
    `
      INSERT INTO users (username, display_name, password_hash, is_admin)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(username) DO UPDATE SET
        display_name = excluded.display_name,
        password_hash = excluded.password_hash,
        is_admin = 1
    `
  )
  .run('nick', 'Nick', hashPassword('n0._GrTSx928'));
