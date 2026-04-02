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

    CREATE TABLE IF NOT EXISTS trials (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       TEXT    NOT NULL,
      game_id          TEXT    NOT NULL,
      game_variant     TEXT,
      trial_index      INTEGER NOT NULL,
      difficulty       TEXT    NOT NULL DEFAULT 'normal',
      stimulus_json    TEXT    NOT NULL,
      response_json    TEXT    NOT NULL,
      is_correct       INTEGER NOT NULL DEFAULT 0,
      response_error   REAL    NOT NULL DEFAULT 0,
      response_time_ms INTEGER NOT NULL DEFAULT 0,
      timeout_extended INTEGER NOT NULL DEFAULT 0,
      skipped          INTEGER NOT NULL DEFAULT 0,
      created_at       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id);

    CREATE TABLE IF NOT EXISTS game_plays (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id         TEXT    NOT NULL,
      game_id            TEXT    NOT NULL,
      game_variant       TEXT,
      difficulty_adapted TEXT,
      strategy_json      TEXT,
      started_at         INTEGER NOT NULL,
      ended_at           INTEGER,
      created_at         INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_game_plays_session ON game_plays(session_id);

    -- Cognitive Mirror: profession-based adaptive assessments
    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT    NOT NULL UNIQUE,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      profession      TEXT    NOT NULL,
      traits_json     TEXT    NOT NULL,   -- JSON array of { id, name, isPrimary }
      baseline_rt_ms  REAL,              -- median reaction time from calibration
      baseline_device_ms REAL,           -- device latency from calibration
      archetype_json  TEXT,              -- final Archetype Card (set after completion)
      status          TEXT    NOT NULL DEFAULT 'active',  -- active | complete | abandoned
      created_at      INTEGER NOT NULL,
      completed_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id);

    CREATE TABLE IF NOT EXISTS assessment_level_results (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT    NOT NULL,
      trait_id        TEXT    NOT NULL,   -- T01, T04, …
      level           INTEGER NOT NULL,
      score           REAL    NOT NULL,   -- 0–100
      accuracy        REAL    NOT NULL,   -- 0.0–1.0
      avg_latency_ms  REAL    NOT NULL,
      outcome         TEXT    NOT NULL,   -- continue | skip | ceiling | complete
      level_config_json TEXT  NOT NULL,  -- snapshot of LevelConfig used
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_level_results_session ON assessment_level_results(session_id);
    CREATE INDEX IF NOT EXISTS idx_level_results_trait   ON assessment_level_results(session_id, trait_id);

    -- Per-user trait progress (persists across sessions — resume from last level)
    CREATE TABLE IF NOT EXISTS trait_progress (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      device_id   TEXT    NOT NULL,          -- stable ID for guests; same as userId key for auth'd users
      trait_id    TEXT    NOT NULL,
      next_level  INTEGER NOT NULL DEFAULT 1, -- level to play in the next session (1–10)
      best_score  REAL    NOT NULL DEFAULT 0,
      best_level  INTEGER NOT NULL DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'in_progress', -- in_progress | ceiling | complete
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trait_progress_device_trait ON trait_progress(device_id, trait_id);
    CREATE INDEX IF NOT EXISTS idx_trait_progress_user ON trait_progress(user_id);
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

/**
 * Returns the most recent trait snapshot for every user except the given one.
 * Used to compute cross-user percentile rankings.
 */
export function getAllLatestTraitsExcluding(excludeUserId: number): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT traits_json FROM user_trait_history
    WHERE id IN (
      SELECT MAX(id) FROM user_trait_history
      WHERE user_id != ?
      GROUP BY user_id
    )
  `).all(excludeUserId) as Array<{ traits_json: string }>;
  return rows.map(r => r.traits_json);
}

// ── Cognitive Mirror helpers ──────────────────────────────────────────────────

export interface AssessmentSessionRow {
  id: number;
  sessionId: string;
  userId: number | null;
  profession: string;
  traitsJson: string;
  baselineRtMs: number | null;
  baselineDeviceMs: number | null;
  archetypeJson: string | null;
  status: string;
  createdAt: number;
  completedAt: number | null;
}

export function createAssessmentSession(
  sessionId: string,
  userId: number | null,
  profession: string,
  traitsJson: string,
): AssessmentSessionRow {
  const db = getDb();
  // Return existing session if already created (handles retries / double-calls)
  const existing = getAssessmentSession(sessionId);
  if (existing) return existing;
  const now = Date.now();
  db.prepare(`
    INSERT INTO assessment_sessions (session_id, user_id, profession, traits_json, status, created_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(sessionId, userId ?? null, profession, traitsJson, now);
  return getAssessmentSession(sessionId)!;
}

export function getAssessmentSession(sessionId: string): AssessmentSessionRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assessment_sessions WHERE session_id = ?').get(sessionId) as {
    id: number; session_id: string; user_id: number | null; profession: string; traits_json: string;
    baseline_rt_ms: number | null; baseline_device_ms: number | null; archetype_json: string | null;
    status: string; created_at: number; completed_at: number | null;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id, sessionId: row.session_id, userId: row.user_id,
    profession: row.profession, traitsJson: row.traits_json,
    baselineRtMs: row.baseline_rt_ms, baselineDeviceMs: row.baseline_device_ms,
    archetypeJson: row.archetype_json, status: row.status,
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}

export function updateAssessmentBaseline(sessionId: string, rtMs: number, deviceMs: number): void {
  getDb().prepare('UPDATE assessment_sessions SET baseline_rt_ms = ?, baseline_device_ms = ? WHERE session_id = ?')
    .run(rtMs, deviceMs, sessionId);
}

export function completeAssessmentSession(sessionId: string, archetypeJson: string): void {
  getDb().prepare(`
    UPDATE assessment_sessions SET status = 'complete', archetype_json = ?, completed_at = ? WHERE session_id = ?
  `).run(archetypeJson, Date.now(), sessionId);
}

export interface LevelResultRow {
  sessionId: string;
  traitId: string;
  level: number;
  score: number;
  accuracy: number;
  avgLatencyMs: number;
  outcome: string;
  levelConfigJson: string;
  createdAt: number;
}

export function saveLevelResult(result: Omit<LevelResultRow, 'createdAt'>): void {
  getDb().prepare(`
    INSERT INTO assessment_level_results
      (session_id, trait_id, level, score, accuracy, avg_latency_ms, outcome, level_config_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    result.sessionId, result.traitId, result.level,
    result.score, result.accuracy, result.avgLatencyMs,
    result.outcome, result.levelConfigJson, Date.now()
  );
}

export function getLevelResults(sessionId: string, traitId?: string): LevelResultRow[] {
  const db = getDb();
  const rows = traitId
    ? db.prepare('SELECT * FROM assessment_level_results WHERE session_id = ? AND trait_id = ? ORDER BY level ASC').all(sessionId, traitId)
    : db.prepare('SELECT * FROM assessment_level_results WHERE session_id = ? ORDER BY trait_id, level ASC').all(sessionId);
  return (rows as Array<{
    session_id: string; trait_id: string; level: number; score: number; accuracy: number;
    avg_latency_ms: number; outcome: string; level_config_json: string; created_at: number;
  }>).map(r => ({
    sessionId: r.session_id, traitId: r.trait_id, level: r.level,
    score: r.score, accuracy: r.accuracy, avgLatencyMs: r.avg_latency_ms,
    outcome: r.outcome, levelConfigJson: r.level_config_json, createdAt: r.created_at,
  }));
}

// ── Trait Progress helpers ────────────────────────────────────────────────────

export interface TraitProgressRow {
  traitId: string;
  nextLevel: number;
  bestScore: number;
  bestLevel: number;
  status: string;
  updatedAt: number;
}

export function getTraitProgress(deviceId: string): TraitProgressRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM trait_progress WHERE device_id = ? ORDER BY trait_id')
    .all(deviceId) as Array<{
      trait_id: string; next_level: number; best_score: number;
      best_level: number; status: string; updated_at: number;
    }>;
  return rows.map(r => ({
    traitId: r.trait_id, nextLevel: r.next_level,
    bestScore: r.best_score, bestLevel: r.best_level,
    status: r.status, updatedAt: r.updated_at,
  }));
}

export function upsertTraitProgress(
  deviceId: string,
  userId: number | null,
  traitId: string,
  nextLevel: number,
  bestScore: number,
  bestLevel: number,
  status: string,
): void {
  getDb().prepare(`
    INSERT INTO trait_progress (device_id, user_id, trait_id, next_level, best_score, best_level, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(device_id, trait_id) DO UPDATE SET
      user_id    = excluded.user_id,
      next_level = excluded.next_level,
      best_score = excluded.best_score,
      best_level = excluded.best_level,
      status     = excluded.status,
      updated_at = unixepoch()
  `).run(deviceId, userId ?? null, traitId, nextLevel, bestScore, bestLevel, status);
}

export function getAssessmentHistory(userId: number, limit = 5): AssessmentSessionRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM assessment_sessions WHERE user_id = ? AND status = 'complete'
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit) as Array<{
    id: number; session_id: string; user_id: number | null; profession: string; traits_json: string;
    baseline_rt_ms: number | null; baseline_device_ms: number | null; archetype_json: string | null;
    status: string; created_at: number; completed_at: number | null;
  }>;
  return rows.map(r => ({
    id: r.id, sessionId: r.session_id, userId: r.user_id,
    profession: r.profession, traitsJson: r.traits_json,
    baselineRtMs: r.baseline_rt_ms, baselineDeviceMs: r.baseline_device_ms,
    archetypeJson: r.archetype_json, status: r.status,
    createdAt: r.created_at, completedAt: r.completed_at,
  }));
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
