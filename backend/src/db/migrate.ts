import { Pool } from 'pg';

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
      CREATE TABLE IF NOT EXISTS reports (
        id             SERIAL PRIMARY KEY,
        session_id     TEXT    NOT NULL UNIQUE,
        traits         JSONB   NOT NULL,
        ai_report      TEXT    NOT NULL,
        thinking_style TEXT    NOT NULL,
        created_at     BIGINT  NOT NULL
      )
    `);

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
