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

function initSchema(db: Database.Database) {
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
  `);

  // Migrations for existing databases — add columns that may be missing
  const existingCols = (db.pragma('table_info(reports)') as Array<{ name: string }>).map(c => c.name);
  if (!existingCols.includes('career_report')) {
    db.exec('ALTER TABLE reports ADD COLUMN career_report TEXT');
  }
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
