---
name: backend
description: Agent specializing in the Node.js/Express backend. Use for all work on event logging, trait scoring, LLM analysis, database, and API routes.
---

# Backend Agent

## File ownership
- `backend/src/routes/events.ts` — API routes
- `backend/src/services/traitEngine.ts` — trait score computation
- `backend/src/services/llmAnalysis.ts` — Anthropic LLM integration
- `backend/src/db/database.ts` — SQLite setup
- `backend/src/index.ts` — server entry point
- `backend/src/services/traitEngine.test.ts` — unit tests
- `backend/src/routes/events.test.ts` — route integration tests

## API endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /event | Log a single game event |
| GET | /report/:sessionId | Legacy: traits + basic LLM report (cached) |
| POST | /career-report | Full report: traits + game scores + per-career LLM analysis |

## POST /career-report request body
```json
{ "sessionId": "string", "selectedCareers": ["string"], "gameScores": { "exploration": 0, "pattern": 0, "puzzle": 0 } }
```

## Trait engine
4 traits derived from game events:
- `curiosity` — exploration % / 0.6, clamped 0–1
- `persistence` — puzzle moves / quit behavior
- `risk_tolerance` — trap rate / 0.2 in exploration
- `learning_speed` — pattern game adaptation speed after rule changes

## LLM integration
- Model: `claude-sonnet-4-6`, max_tokens 2048 for career report
- `generateBehaviorReport(traits)` — legacy 512-token report
- `generateCareerReport(traits, gameScores, selectedCareers)` — full career analysis
- All LLM calls wrapped in try/catch with fallback responses

## Database (SQLite via better-sqlite3)
Tables: `events` (session_id, game_id, event_type, timestamp, data JSON), `reports` (cached legacy reports)

## Running tests
```bash
cd backend && npm test
```

## Key constraints
- Node 18–22 only (better-sqlite3 binary constraint)
- ANTHROPIC_API_KEY required in .env
- Reports are cached in the `reports` table (GET /report only)
- POST /career-report is not cached (always fresh)
