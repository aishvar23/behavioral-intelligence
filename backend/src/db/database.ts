import Database from 'better-sqlite3';
import path from 'path';

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
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT    NOT NULL UNIQUE,
      traits        TEXT    NOT NULL,
      ai_report     TEXT    NOT NULL,
      thinking_style TEXT   NOT NULL,
      created_at    INTEGER NOT NULL
    );
  `);
}
