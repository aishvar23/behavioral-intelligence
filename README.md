# Behavioral Intelligence Platform — MVP

A mobile app that analyzes cognitive and personality traits through 3 short games,
then generates a behavioral report using an LLM.

---

## Project Structure

```
behavioral-intelligence/
├── mobile/          # React Native app (iOS + Android)
│   └── src/
│       ├── navigation/     AppNavigator.tsx
│       ├── screens/        HomeScreen, GameScreen, ReportScreen
│       ├── components/
│       │   ├── games/      ExplorationIsland, HiddenPatternGame, ImpossiblePuzzle
│       │   └── report/     BehavioralReportCard
│       ├── services/       api.ts, session.ts
│       └── utils/          eventLogger.ts
└── backend/         # Node.js + Express + SQLite
    └── src/
        ├── routes/         events.ts  (POST /event, GET /report/:sessionId)
        ├── db/             database.ts, schema.sql
        └── services/       traitEngine.ts, llmAnalysis.ts
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v18 or v20 LTS (**not v24+**) |
| npm | ≥ 9 |
| React Native CLI | latest |
| Xcode (iOS) | ≥ 14 |
| Android Studio | latest |
| CocoaPods (iOS) | latest |

> **Windows users** — `better-sqlite3` is a native addon that requires compilation. Before running `npm install` in the backend, ensure you have:
> - **Python 3.x** — [python.org](https://www.python.org/downloads/) — check "Add Python to PATH" during install
> - **Visual Studio Build Tools** with "Desktop development with C++":
>   ```powershell
>   winget install Microsoft.VisualStudio.2022.BuildTools
>   ```
> - **Node v20 LTS** (v24+ has no prebuilt binaries for `better-sqlite3`):
>   ```powershell
>   # Using nvm-windows
>   nvm install 20 && nvm use 20
>   ```

---

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
npm run dev
# Server starts at http://localhost:3000
```

The SQLite database file is created automatically at `backend/data/behavioral.db`.

---

## Mobile App Setup

```bash
cd mobile
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

> For a physical device, update `BASE_URL` in `src/services/api.ts`
> to your machine's local IP (e.g., `http://192.168.1.x:3000`).

---

## API Reference

### POST /event
Log a behavioral event from the mobile app.

```json
{
  "sessionId": "uuid",
  "gameId": "exploration | pattern | puzzle",
  "eventType": "move | guess | hint_request | quit | solved",
  "timestamp": 1710000000000,
  "data": { }
}
```

### GET /report/:sessionId
Returns computed trait scores + LLM behavioral report.

```json
{
  "traits": {
    "curiosity": 0.82,
    "persistence": 0.74,
    "risk_tolerance": 0.31,
    "learning_speed": 0.65
  },
  "thinkingStyle": "Cautious but deeply curious analytical explorer.",
  "aiReport": "This user demonstrates high curiosity..."
}
```

---

## Trait Scoring Logic

| Trait | Formula |
|-------|---------|
| Curiosity | `explored_tiles / total_tiles` (Exploration Island) |
| Persistence | `moves_after_failure` (Impossible Puzzle) |
| Risk Tolerance | `traps_entered / total_moves` (Exploration Island) |
| Learning Speed | `1 - (adaptation_rounds - 1) / 4` (Hidden Pattern Game) |

---

## Extending the MVP

- Add user auth (JWT) to link sessions to accounts
- Replace SQLite with PostgreSQL for multi-user scale
- Add a dashboard web UI to review session analytics
- Stream the LLM report generation for faster perceived load time
