# Behavioral Intelligence Platform — Architecture

**Last updated:** 2026-03-13
**Status:** MVP complete, pre-production

---

## Overview

A mobile-first behavioral intelligence platform where users play three short cognitive games. Behavioral signals are logged in real-time, scored by a trait engine, and analyzed by an LLM to generate a personalized behavioral and career-fit report.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Native App                   │
│  (iOS + Android — single TypeScript codebase)       │
│                                                     │
│  HomeScreen → GameScreen (×3) → CareerSelection     │
│                                    → ReportScreen   │
└────────────────────────┬────────────────────────────┘
                         │ HTTP (REST)
                         ▼
┌─────────────────────────────────────────────────────┐
│              Node.js / Express Backend              │
│                                                     │
│  POST /event          — log behavioral event        │
│  POST /career-report  — trigger trait + LLM flow    │
│  GET  /report/:sid    — fetch cached report         │
│  GET  /health         — liveness probe              │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  SQLite (MVP)    │   │  Claude API (Anthropic)       │
│  PostgreSQL      │   │  generateCareerReport()       │
│  (production)    │   │  Model: claude-sonnet-4-6     │
└──────────────────┘   └──────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile | React Native + TypeScript | Single codebase, iOS + Android |
| Navigation | React Navigation | Stack navigator |
| Backend | Node.js + Express + TypeScript | REST API |
| Database | SQLite (MVP) → PostgreSQL (prod) | better-sqlite3 / pg driver |
| AI Layer | Anthropic Claude API | claude-sonnet-4-6 |
| Hosting (prod) | Azure App Service (Linux) | B2 tier to start |
| DB (prod) | Azure Database for PostgreSQL | Flexible Server |
| Secrets (prod) | Azure Key Vault | API keys, DB credentials |
| Monitoring (prod) | Azure App Insights + Sentry | Backend + mobile crash reporting |

---

## Mobile App

### Navigation Flow

```
HomeScreen
   └─→ GameScreen [game: exploration]
          └─→ GameScreen [game: pattern]
                 └─→ GameScreen [game: puzzle]
                        └─→ CareerSelectionScreen
                               └─→ ReportScreen
```

### Screens

| Screen | File | Purpose |
|--------|------|---------|
| HomeScreen | `screens/HomeScreen.tsx` | Creates session UUID, entry point |
| GameScreen | `screens/GameScreen.tsx` | Sequences the 3 games, carries scores via nav params |
| CareerSelectionScreen | `screens/CareerSelectionScreen.tsx` | 20-career grid, select up to 8 |
| ReportScreen | `screens/ReportScreen.tsx` | Game scores, trait bars, AI analysis, career cards |

### Game Components

| Game | File | Behavioral Signals |
|------|------|--------------------|
| Exploration Island | `components/games/ExplorationIsland.tsx` | tiles explored, time between moves, traps hit, repeated visits |
| Hidden Pattern Game | `components/games/HiddenPatternGame.tsx` | time to first guess, wrong guesses, rule-change adaptation, pass rate |
| Impossible Puzzle | `components/games/ImpossiblePuzzle.tsx` | attempt count, time spent, hints requested, quit behavior |

### Services

- `services/api.ts` — `logEvent()`, `getCareerReport()`, `FullReport` type
- API base URL: `http://10.0.2.2:3000` (dev) → Azure App Service URL (prod)

---

## Backend

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/event` | Log a behavioral event from the app |
| `POST` | `/career-report` | Run trait engine + LLM; return full report |
| `GET` | `/report/:sessionId` | Fetch a previously generated report |
| `GET` | `/health` | Liveness check (returns `{ status: "ok" }`) |

### Event Schema

```json
{
  "sessionId": "string",
  "gameId":    "string",
  "eventType": "string",
  "timestamp": "number",
  "data":      "object"
}
```

Event types: `move`, `guess`, `retry`, `hint_request`, `quit`, `pass`, `tile_reveal`

### Services

| File | Purpose |
|------|---------|
| `services/traitEngine.ts` | Calculates trait scores from raw event data |
| `services/llmAnalysis.ts` | Calls Claude API; strips JSON fences before parse |
| `routes/events.ts` | Route handlers for all endpoints |
| `db/database.ts` | SQLite setup; `events` + `reports` tables |

---

## Trait Engine

Trait scores are derived from aggregated behavioral events per session:

```
curiosity_score    = explored_tiles / total_tiles
persistence_score  = attempts_after_failure
risk_score         = traps_entered / total_moves
learning_speed     = 1 / time_to_rule_discovery  (normalized)
```

Output shape:
```json
{
  "curiosity":       0.82,
  "persistence":     0.74,
  "risk_tolerance":  0.31,
  "learning_speed":  0.65
}
```

---

## LLM Integration

- **Function:** `generateCareerReport(traits, selectedCareers)`
- **Model:** `claude-sonnet-4-6`
- **Prompt strategy:** Traits + selected career list → behavioral profile narrative + career-fit scores
- **Robustness:** Response fences (` ```json `) stripped before `JSON.parse`
- **Cost control (planned):** Cache result in DB per `sessionId + careers` hash; 15s timeout + 1 retry

---

## Database Schema (MVP — SQLite)

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL,
  game_id    TEXT    NOT NULL,
  event_type TEXT    NOT NULL,
  timestamp  INTEGER NOT NULL,
  data       TEXT    NOT NULL   -- JSON blob
);

CREATE TABLE reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL UNIQUE,
  report     TEXT    NOT NULL,  -- JSON blob
  created_at INTEGER NOT NULL
);
```

---

## Game Scoring

| Game | Score Formula | No-win Fallback |
|------|--------------|-----------------|
| Exploration Island | tile rewards (+10) and traps (−5), final tally | raw tally |
| Hidden Pattern | +10 / +5 / +2 / +0 per round by difficulty tier | — |
| Impossible Puzzle | `max(100, 1000 − moves×15) − hints×20` | `moves×3`; quit = 0 |

---

## Dev Environment

| Machine | Role |
|---------|------|
| Linux VM (`/home/azureuser/behavioral-intelligence/`) | Code + git push |
| Windows PC + Android Studio | Pull + test on Android emulator |

Android emulator maps `10.0.2.2` → host `localhost:3000`.

**Test terminals on Windows:**

| Terminal | Command |
|----------|---------|
| Backend | `cd backend && npm run dev` |
| Metro | `cd mobile && npx react-native start` |
| App | `cd mobile && npx react-native run-android` |

**Node version requirement:** Node 20 (better-sqlite3 has no prebuilt binaries for Node 24+)

---

## Known Gaps (Pre-Production)

- SQLite → PostgreSQL migration not yet written
- No request validation (zod/joi) on POST endpoints
- No rate limiting on `/event` or `/career-report`
- LLM response not cached — every report call hits Claude API
- ReportScreen loading UX is a plain spinner (no progress messages)
- No retry/back flow if `/career-report` returns 500
- `BehavioralReportCard.tsx` is legacy and unused — safe to delete
- App name, icon, and splash screen are React Native defaults
- No iOS testing done yet
