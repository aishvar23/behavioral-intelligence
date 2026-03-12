-- Behavioral Intelligence Platform — Database Schema (SQLite)

-- Raw game events from the mobile app
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL,         -- UUID per play session
  game_id     TEXT    NOT NULL,         -- 'exploration' | 'pattern' | 'puzzle'
  event_type  TEXT    NOT NULL,         -- 'move' | 'guess' | 'hint_request' | 'quit' | 'solved' | ...
  timestamp   INTEGER NOT NULL,         -- Unix ms
  data        TEXT    NOT NULL          -- JSON blob of event-specific fields
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_game    ON events(session_id, game_id);

-- Computed behavioral reports (cached after first generation)
CREATE TABLE IF NOT EXISTS reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT    NOT NULL UNIQUE,
  traits         TEXT    NOT NULL,      -- JSON: { curiosity, persistence, risk_tolerance, learning_speed }
  ai_report      TEXT    NOT NULL,      -- LLM-generated narrative
  thinking_style TEXT    NOT NULL,      -- Short summary line
  created_at     INTEGER NOT NULL       -- Unix ms
);
