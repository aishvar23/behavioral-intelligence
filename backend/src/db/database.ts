import Database from 'better-sqlite3';
import path from 'path';
import { Pool } from 'pg';

const DB_PATH = path.join(__dirname, '../../data/behavioral.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    NOT NULL,
      game_id     TEXT    NOT NULL,
      event_type  TEXT    NOT NULL,
      timestamp   INTEGER NOT NULL,
      data        TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);

    CREATE TABLE IF NOT EXISTS reports (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     TEXT    NOT NULL UNIQUE,
      traits         TEXT    NOT NULL,
      ai_report      TEXT    NOT NULL,
      thinking_style TEXT    NOT NULL,
      career_report  TEXT,
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_calls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT    NOT NULL,
      latency_ms    INTEGER NOT NULL,
      input_tokens  INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd      REAL    NOT NULL,
      timestamp     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL UNIQUE,
      age            TEXT,
      country        TEXT,
      life_stage     TEXT,
      email          TEXT    UNIQUE,
      password_hash  TEXT,
      display_name   TEXT,
      avatar_url     TEXT,
      email_verified INTEGER DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_trait_history (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      session_id        TEXT    NOT NULL,
      traits_json       TEXT    NOT NULL,
      game_results_json TEXT    NOT NULL,
      occupation        TEXT    NOT NULL,
      created_at        INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trait_history_user ON user_trait_history(user_id);

    CREATE TABLE IF NOT EXISTS user_identities (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider    TEXT    NOT NULL,
      provider_id TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      UNIQUE(provider, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT    PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      started_at INTEGER NOT NULL,
      ended_at   INTEGER,
      status     TEXT    NOT NULL DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT    NOT NULL UNIQUE,
      device_hint TEXT,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  // Migrations for existing databases — add columns that may be missing
  const existingCols = (db.pragma('table_info(reports)') as Array<{ name: string }>).map(c => c.name);
  if (!existingCols.includes('career_report')) {
    db.exec('ALTER TABLE reports ADD COLUMN career_report TEXT');
  }

  // Auth migrations
  const userCols = (db.pragma('table_info(users)') as Array<{ name: string }>).map(c => c.name);
  if (!userCols.includes('email')) {
    // SQLite does not support ADD COLUMN ... UNIQUE — add the column then a partial unique index
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
  }
  if (!userCols.includes('password_hash'))  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!userCols.includes('display_name'))   db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  if (!userCols.includes('avatar_url'))     db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  if (!userCols.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
}

let pgPool: Pool | undefined;

export function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pgPool;
}

export function isPostgres(): boolean {
  return process.env.NODE_ENV === 'production' && !!process.env.DATABASE_URL;
}

export interface LlmCallLog {
  sessionId: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// ── User helpers ─────────────────────────────────────────────────────────────

export interface UserRecord {
  id: number;
  username: string;
  age: string | null;
  country: string | null;
  lifeStage: string | null;
  email: string | null;
  passwordHash: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: number;
}

export function upsertUser(username: string, age: string, country: string, lifeStage: string): UserRecord {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (username, age, country, life_stage, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      age        = excluded.age,
      country    = excluded.country,
      life_stage = excluded.life_stage,
      updated_at = excluded.updated_at
  `).run(username, age, country, lifeStage, now, now);
  const row = db.prepare('SELECT id, username, age, country, life_stage, email, password_hash, display_name, avatar_url, email_verified FROM users WHERE username = ?').get(username) as {
    id: number; username: string; age: string | null; country: string | null; life_stage: string | null;
    email: string | null; password_hash: string | null; display_name: string | null; avatar_url: string | null; email_verified: number;
  };
  return {
    id: row.id,
    username: row.username,
    age: row.age,
    country: row.country,
    lifeStage: row.life_stage,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    emailVerified: row.email_verified ?? 0,
  };
}

export interface TraitHistoryRow {
  traitsJson: string;
  gameResultsJson: string;
  occupation: string;
  createdAt: number;
}

export function getUserTraitHistory(userId: number, limit = 5): TraitHistoryRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT traits_json, game_results_json, occupation, created_at
    FROM user_trait_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as Array<{
    traits_json: string; game_results_json: string; occupation: string; created_at: number;
  }>;
  return rows.map(r => ({
    traitsJson: r.traits_json,
    gameResultsJson: r.game_results_json,
    occupation: r.occupation,
    createdAt: r.created_at,
  }));
}

export function saveUserTraitHistory(
  userId: number,
  sessionId: string,
  traitsJson: string,
  gameResultsJson: string,
  occupation: string
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_trait_history (user_id, session_id, traits_json, game_results_json, occupation, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, sessionId, traitsJson, gameResultsJson, occupation, Date.now());
}

export async function logLlmCall(log: LlmCallLog): Promise<void> {
  const ts = Date.now();
  try {
    if (isPostgres()) {
      await getPgPool().query(
        `INSERT INTO llm_calls (session_id, latency_ms, input_tokens, output_tokens, cost_usd, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [log.sessionId, log.latencyMs, log.inputTokens, log.outputTokens, log.costUsd, ts]
      );
    } else {
      getDb()
        .prepare(
          `INSERT INTO llm_calls (session_id, latency_ms, input_tokens, output_tokens, cost_usd, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(log.sessionId, log.latencyMs, log.inputTokens, log.outputTokens, log.costUsd, ts);
    }
  } catch (err) {
    console.error('logLlmCall failed:', err);
  }
}
