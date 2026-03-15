# Backend Deployment — Azure App Service

**Live URL:** https://bi-backend-dev.azurewebsites.net
**App Service:** bi-backend-dev (B1 tier, Linux, Node 20 LTS)
**Resource Group:** behavioral-intelligenceRG

---

## How deployment works

Pushes to `main` that touch `backend/**` automatically trigger the GitHub Actions workflow (`.github/workflows/deploy-backend.yml`):

1. `npm ci` — installs all dependencies (including devDeps for TypeScript)
2. `npx tsc` — compiles `src/` → `dist/`
3. Zips `dist/ + src/ + package.json + package-lock.json + tsconfig.json`
4. Uploads via Kudu `zipdeploy` API → Azure Oryx runs `npm install` server-side (compiles native modules like `better-sqlite3` for the Azure Linux environment)
5. App starts with `node dist/index.js`

**Typical deploy time: ~2 minutes.**

---

## Manual deployment (if needed)

```bash
cd backend

# 1. Compile
npm ci
npx tsc

# 2. Package
zip -r deploy.zip dist/ src/ package.json package-lock.json tsconfig.json

# 3. Deploy
KUDU_USER='$bi-backend-dev'
KUDU_PASS='<see GitHub secret AZURE_KUDU_PASS>'

curl -X POST \
  --max-time 120 \
  -u "$KUDU_USER:$KUDU_PASS" \
  -T deploy.zip \
  "https://bi-backend-dev.scm.azurewebsites.net/api/zipdeploy?isAsync=false" \
  -w "\nHTTP: %{http_code}\n"
```

---

## App Service configuration

| Setting | Value |
|---------|-------|
| Runtime | Node 20 LTS |
| Startup command | `node dist/index.js` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `ANTHROPIC_API_KEY` | set in App Settings |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` (Oryx runs `npm install`) |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{"status":"ok"}` |
| POST | `/event` | Log a game event |
| GET | `/report/:sessionId` | Get traits + AI behavioral report |
| POST | `/select-games` | LLM selects 3 games for a user profile |
| POST | `/career-report` | Full career analysis with game results |

---

## Key deployment constraints discovered

- **No `build` script in `package.json`** — Oryx detects `package.json` and runs `npm install` only (no `npm run build`). We ship pre-compiled `dist/` in the zip.
- **`better-sqlite3` must be compiled by Oryx** — the native `.node` binary compiled locally is not compatible with Azure's container. Oryx compiles it natively during `npm install`.
- **Use Kudu `zipdeploy` API directly** (`/api/zipdeploy`) — more reliable than `az webapp deploy` which can 502/504 on slow connections.
- **`SCM_DO_BUILD_DURING_DEPLOYMENT=true`** — required so Oryx runs `npm install` server-side even though we ship pre-built `dist/`.
- **`tsconfig.json`** — uses `"include": ["src"]` (not `"src/**/*"`) and `"exclude": [..., "src/**/*.test.ts"]` to avoid test file compilation errors.

---

## Checking logs

```bash
# Stream live logs
az webapp log tail \
  --name bi-backend-dev \
  --resource-group behavioral-intelligenceRG

# Check latest deployment status
az webapp deployment list \
  --name bi-backend-dev \
  --resource-group behavioral-intelligenceRG \
  --output table
```

Or via GitHub Actions: https://github.com/aishvar23/behavioral-intelligence/actions
