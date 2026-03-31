import { Pool } from 'pg';

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Core event/session tables ─────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id          SERIAL PRIMARY KEY,
        session_id  TEXT    NOT NULL,
        game_id     TEXT    NOT NULL,
        event_type  TEXT    NOT NULL,
        timestamp   BIGINT  NOT NULL,
        data        JSONB   NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT    PRIMARY KEY,
        user_id    INTEGER,
        started_at BIGINT  NOT NULL,
        ended_at   BIGINT,
        status     TEXT    NOT NULL DEFAULT 'active'
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trials (
        id               SERIAL  PRIMARY KEY,
        session_id       TEXT    NOT NULL,
        game_id          TEXT    NOT NULL,
        game_variant     TEXT,
        trial_index      INTEGER NOT NULL,
        difficulty       TEXT    NOT NULL DEFAULT 'normal',
        stimulus_json    JSONB   NOT NULL,
        response_json    JSONB   NOT NULL,
        is_correct       BOOLEAN NOT NULL DEFAULT FALSE,
        response_error   REAL    NOT NULL DEFAULT 0,
        response_time_ms INTEGER NOT NULL DEFAULT 0,
        timeout_extended BOOLEAN NOT NULL DEFAULT FALSE,
        skipped          BOOLEAN NOT NULL DEFAULT FALSE,
        created_at       BIGINT  NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_plays (
        id                 SERIAL  PRIMARY KEY,
        session_id         TEXT    NOT NULL,
        game_id            TEXT    NOT NULL,
        game_variant       TEXT,
        difficulty_adapted TEXT,
        strategy_json      JSONB,
        started_at         BIGINT  NOT NULL,
        ended_at           BIGINT,
        created_at         BIGINT  NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_game_plays_session ON game_plays(session_id)`);

    // ── Report / LLM tables ───────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id             SERIAL PRIMARY KEY,
        session_id     TEXT    NOT NULL UNIQUE,
        traits         JSONB   NOT NULL,
        ai_report      TEXT    NOT NULL,
        thinking_style TEXT    NOT NULL,
        career_report  JSONB,
        created_at     BIGINT  NOT NULL
      )
    `);
    // Idempotent: add career_report if this is a pre-existing reports table
    await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS career_report JSONB`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS llm_calls (
        id            SERIAL PRIMARY KEY,
        session_id    TEXT    NOT NULL,
        latency_ms    INTEGER NOT NULL,
        input_tokens  INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd      NUMERIC(10,6) NOT NULL,
        timestamp     BIGINT  NOT NULL
      )
    `);

    // ── Auth tables ───────────────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id             SERIAL  PRIMARY KEY,
        username       TEXT    NOT NULL UNIQUE,
        age            TEXT,
        country        TEXT,
        life_stage     TEXT,
        email          TEXT    UNIQUE,
        password_hash  TEXT,
        display_name   TEXT,
        avatar_url     TEXT,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     BIGINT  NOT NULL,
        updated_at     BIGINT  NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_identities (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider    TEXT    NOT NULL,
        provider_id TEXT    NOT NULL,
        created_at  BIGINT  NOT NULL,
        UNIQUE(provider, provider_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          SERIAL  PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT    NOT NULL UNIQUE,
        device_hint TEXT,
        expires_at  BIGINT  NOT NULL,
        created_at  BIGINT  NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_trait_history (
        id                SERIAL  PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id),
        session_id        TEXT    NOT NULL,
        traits_json       JSONB   NOT NULL,
        game_results_json JSONB   NOT NULL,
        occupation        TEXT    NOT NULL,
        flow_type         TEXT,
        created_at        BIGINT  NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trait_history_user ON user_trait_history(user_id)`);
    await client.query(`ALTER TABLE user_trait_history ADD COLUMN IF NOT EXISTS flow_type TEXT`);

    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
