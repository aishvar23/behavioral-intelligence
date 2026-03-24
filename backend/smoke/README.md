# Backend Smoke Tests

Quick end-to-end check that every API endpoint is alive and returning sane responses.
Runs in ~20–30 seconds (most of that is the LLM career-report call).

## Structure

```
smoke/
├── linux/
│   └── smoke.sh       # bash — macOS / Linux / WSL
└── windows/
    └── smoke.ps1      # PowerShell — Windows
```

## Prerequisites

| Platform | Requirement |
|----------|------------|
| Linux / macOS | `curl` (pre-installed) |
| Windows | PowerShell 5.1+ (pre-installed on Windows 10/11) |
| WSL | Use the `linux/` script |

## Usage

### Windows (PowerShell)

```powershell
# From repo root — Azure dev backend (default)
.\backend\smoke\windows\smoke.ps1

# Against local backend (npm run dev must be running)
.\backend\smoke\windows\smoke.ps1 -Target local

# Against an arbitrary URL
.\backend\smoke\windows\smoke.ps1 -Target https://bi-backend-prod.azurewebsites.net
```

> If you see _"running scripts is disabled"_, run once in an elevated PowerShell:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

### Linux / macOS / WSL

```bash
# From repo root — Azure dev backend (default)
./backend/smoke/linux/smoke.sh

# Against local backend
./backend/smoke/linux/smoke.sh local

# Against an arbitrary URL
BASE_URL=https://bi-backend-prod.azurewebsites.net ./backend/smoke/linux/smoke.sh
```

## What it tests

| # | Test | Endpoint | What is verified |
|---|------|----------|-----------------|
| 1 | Health check | `GET /health` | Returns `{"status":"ok"}` |
| 2 | Session creation | `POST /session` | Returns a `sessionId` UUID |
| 3 | Event logging (×3) | `POST /event` | Accepts move, explore, and attempt events |
| 4 | Game selection | `POST /select-games` | LLM returns a `selectedIds` array |
| 5 | Career report | `POST /career-report` | LLM returns `aiReport`, `thinkingStyle`, etc. |
| 6 | Cache hit | `POST /career-report` (repeat) | Same session returns instantly from cache |
| 7 | Input validation | `POST /event` with bad UUID | Returns HTTP 400 |
| 8a | Auth register | `POST /auth/register` | Creates new account, returns tokens (201) |
| 8b | Auth login | `POST /auth/login` | Valid credentials return tokens (200) |
| 8c | Auth me | `GET /auth/me` | Bearer token returns user profile (200) |
| 8d | Auth logout | `POST /auth/logout` | Revokes refresh token (200) |
| 8e | Auth bad password | `POST /auth/login` | Wrong password returns 401 |

## Exit codes

- `0` — all tests passed
- `1` — one or more tests failed (details printed inline)

## Common failures

| Symptom | Likely cause |
|---------|-------------|
| `/health` returns 503 or times out | App Service is stopped or cold-starting; wait 30s and retry |
| `/career-report` returns 500 | `ANTHROPIC_API_KEY` in App Service config is missing or revoked |
| `/select-games` returns 500 | Same as above |
| `/auth/register` returns 500 | `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` env vars not set in App Service |
| `curl: (28)` timeout (Linux) | Cold-start; retry after 30s |
| `The request was aborted` (Windows) | Same cold-start issue |
