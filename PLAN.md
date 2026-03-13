# Productization Plan — Android + Azure

**Last updated:** 2026-03-13
**Target:** Google Play Store launch (Android)
**Infrastructure:** Azure App Service + PostgreSQL + Key Vault

---

## Suggested Timeline

| Week | Focus |
|------|-------|
| Week 1 | Backend: Postgres + Docker + deploy to Azure App Service |
| Week 1 | Mobile: prod URL, release build, real device test |
| Week 2 | Play Store setup, internal testing track, QA |
| Week 2 | LLM caching, rate limiting, error UX fixes |
| Week 3 | Play Store review submission |

---

## 1. Infrastructure (Azure)

### Resources to provision

| Resource | Tier | Purpose |
|----------|------|---------|
| Azure App Service (Linux) | B2 | Host Node.js/Express backend |
| Azure Database for PostgreSQL Flexible Server | Cheapest tier | Replace SQLite |
| Azure Key Vault | Standard | Store secrets (API key, DB credentials) |
| Azure Container Registry | Optional | Docker image registry if containerizing |
| Custom domain + TLS | Free (App Service managed cert) | Production URL |
| Azure App Insights | Free tier | Request logging, error tracking, latency |

### Setup steps

- [ ] Create Resource Group `behavioral-intelligence-prod`
- [ ] Provision PostgreSQL Flexible Server; note connection string
- [ ] Create Key Vault; add secrets: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`
- [ ] Create App Service (Linux, Node 20 stack); link to Key Vault via managed identity
- [ ] Set App Service env vars: `NODE_ENV=production`, Key Vault references
- [ ] Configure custom domain + enable managed TLS certificate
- [ ] Set up App Insights; paste instrumentation key into backend config

---

## 2. Backend: Production-Ready

### Database

- [ ] Add `pg` driver (`npm install pg`)
- [ ] Write migration script `backend/src/db/migrate.ts` — creates `events` + `reports` tables in Postgres
- [ ] Add `DATABASE_URL` env var; update `db/database.ts` to switch on `NODE_ENV`
- [ ] Test migration locally with a local Postgres container before deploying

### Security & Config

- [ ] Move all secrets to `.env` (dev) / Key Vault references (prod) — no hardcoded values
- [ ] Add `helmet` — sets secure HTTP headers
- [ ] Add `cors` — whitelist only the mobile app origin (for future web client) or leave open for mobile
- [ ] Add `express-rate-limit` on `POST /event` (e.g. 60 req/min) and `POST /career-report` (e.g. 5 req/min)
- [ ] Add request validation with `zod` on all POST endpoints

```typescript
// Example: event schema validation
const EventSchema = z.object({
  sessionId:  z.string().uuid(),
  gameId:     z.string(),
  eventType:  z.string(),
  timestamp:  z.number().int(),
  data:       z.record(z.unknown()),
});
```

### Middleware & Observability

- [ ] Add `morgan` for HTTP request logging (or Azure App Insights SDK)
- [ ] Add `compression` middleware for gzip responses
- [ ] Ensure `GET /health` returns `{ status: "ok", timestamp: Date.now() }` — required for App Service probes
- [ ] Set `NODE_ENV=production` in App Service configuration

### Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] Add `npm run build` script (tsc → `dist/`)
- [ ] Add `.dockerignore` (node_modules, src, *.ts)
- [ ] Build and push image to Azure Container Registry (or deploy via App Service zip deploy)

### Session Management

- [ ] Add `POST /session` endpoint — explicitly registers a new session, returns `sessionId`
- [ ] Add event cap per session in DB (e.g. max 500 events) to prevent abuse

---

## 3. Mobile App: Android Release Build

### Config

- [ ] Create `mobile/.env` with `API_BASE_URL=https://your-app.azurewebsites.net`
- [ ] Install `react-native-config` and replace hardcoded `10.0.2.2:3000` in `services/api.ts`
- [ ] Persist `sessionId` in `AsyncStorage` — returning users keep their ID across app restarts

### Signing

- [ ] Generate keystore: `keytool -genkey -v -keystore behavioral-intelligence.keystore -alias bi-key -keyalg RSA -keysize 2048 -validity 10000`
- [ ] Store keystore + passwords in a safe location (NOT in git)
- [ ] Configure `android/app/build.gradle` with signing config (read from env vars or `~/.gradle/gradle.properties`)

### Release Build

- [ ] Set app name in `android/app/src/main/res/values/strings.xml`
- [ ] Add app icon (replace `mipmap-*` drawables in `android/app/src/main/res/`)
- [ ] Add splash screen (`react-native-splash-screen` or built-in)
- [ ] Bump `versionCode` and `versionName` in `android/app/build.gradle`
- [ ] Build release AAB: `cd android && ./gradlew bundleRelease`
- [ ] Test release APK on a real Android device (not just emulator)
- [ ] Verify prod backend URL is hit correctly (not `10.0.2.2`)

---

## 4. Google Play Store

### Account & Listing

- [ ] Create Google Play Console account ($25 one-time fee)
- [ ] Create new app — set package name (e.g. `com.behavioralintelligence.app`)
- [ ] Write store listing:
  - Title (≤30 chars)
  - Short description (≤80 chars)
  - Full description (≤4000 chars)
  - 3+ screenshots (required)
  - Feature graphic (1024×500 px)
  - App icon (512×512 px, PNG)

### Compliance

- [ ] Complete content rating questionnaire (likely "Everyone")
- [ ] Write privacy policy (one-pager — see template below)
- [ ] Host privacy policy at a public URL (GitHub Pages or simple static site)
- [ ] Enter privacy policy URL in Play Console

### Privacy Policy — Minimum Content

> This app collects anonymous behavioral signals (tap patterns, timing, game choices) during gameplay to generate a cognitive profile. No personally identifiable information is collected. No data is shared with third parties. Sessions are identified by a random UUID generated on your device. You can request deletion of your session data by contacting [email].

### Release Track

- [ ] Upload signed AAB to **internal testing** track first
- [ ] Add internal testers (yourself + QA devices)
- [ ] Promote to **closed testing (alpha)** after internal QA passes
- [ ] Promote to **production** after Play review approval (~3–7 days)

---

## 5. Session & Data

- [ ] Persist `sessionId` in `AsyncStorage` (survives app restarts)
- [ ] Call `POST /session` on first launch to register session explicitly
- [ ] Add event cap per session in DB (prevent runaway storage)
- [ ] Consider a `POST /session/delete` endpoint for GDPR-lite data deletion

---

## 6. LLM Cost Control

- [ ] Cache career report in `reports` table — key: `sessionId + SHA256(sorted careers)`
  - On `POST /career-report`: check cache first; only call Claude if cache miss
- [ ] Add 15s timeout on Claude API call
- [ ] Add 1 retry on timeout (exponential backoff)
- [ ] Create `llm_calls` table to log: `session_id`, `latency_ms`, `input_tokens`, `output_tokens`, `cost_usd`, `timestamp`
- [ ] Set a monthly spend alert in Anthropic Console

---

## 7. Monitoring & Stability

### Backend

- [ ] Azure App Insights SDK — install `applicationinsights` npm package; initialize at `index.ts` entry point
- [ ] Set Azure alerts:
  - 5xx error rate > 5% → email/SMS alert
  - Average response time > 5s → email/SMS alert
- [ ] Log all unhandled errors to App Insights

### Mobile

- [ ] Add Sentry React Native SDK (`@sentry/react-native`) — free tier
- [ ] Initialize Sentry in `App.tsx` with DSN from Sentry project
- [ ] Wrap `ReportScreen` LLM call in try/catch → capture exception to Sentry on failure

---

## 8. QA Before Launch

### Devices

- [ ] Test on 3+ real Android devices (vary screen sizes: small, medium, large)
- [ ] Test on Android 10, 12, 14 (cover ≥3 OS versions)

### Network

- [ ] Test on slow network (throttle to 3G via Android Dev Options)
- [ ] Verify ReportScreen handles 10s+ LLM wait gracefully (progress message cycling)
- [ ] Verify retry / back-to-career-selection flow when `/career-report` returns 500

### UX Fixes (from pending tasks)

- [ ] ReportScreen: replace plain spinner with cycling progress messages (e.g. "Analyzing your moves… Calculating traits… Generating report…")
- [ ] ReportScreen: add retry button + "Go back and reselect careers" option on error
- [ ] Delete `components/report/BehavioralReportCard.tsx` (legacy, unused)
- [ ] HomeScreen: add brief instructions or onboarding copy

### Release Checklist

- [ ] App name, icon, splash screen set (no RN defaults)
- [ ] `versionCode` + `versionName` bumped
- [ ] Release build tested on real device
- [ ] Prod backend URL verified in release build
- [ ] Privacy policy URL live and linked in Play Console
- [ ] All 3 games play through correctly on release build
- [ ] Report screen renders correctly on release build

---

## Open Questions / Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Anonymous vs. accounts | UUID per install (current) vs. Auth0/Cognito | Keep anonymous for MVP |
| iOS launch | Now or after Android? | After Android — separate provisioning profile + App Store review process |
| Monetization | Free / freemium / one-time purchase | Decide before Play listing; free for now |
| Data retention | Keep all sessions forever / TTL / user-controlled | Add 90-day TTL for MVP |
