# Auth — Implementation Plan

## Prerequisites
- Review and approval of `docs/auth-backend-design.md` and `docs/auth-frontend-design.md`
- All existing tests passing on `feature/auth-flow` (confirm with `npx jest --runInBand`)
- Google Cloud Console OAuth 2.0 client ID created (Android + iOS)
- Meta Developer App created with Facebook Login product enabled

---

## Phase 1 — Backend: Database & Tokens

**Goal**: Extend the database schema and add JWT utilities. No new routes yet.

### Steps

1. **Install new dependencies**
   ```bash
   npm install bcryptjs jsonwebtoken google-auth-library
   npm install --save-dev @types/bcryptjs @types/jsonwebtoken
   ```

2. **Run DB migrations** — add columns to `users` table + create `refresh_tokens` table
   - SQLite: add migration to `database.ts` init block (idempotent `ALTER TABLE ... IF NOT EXISTS` pattern)
   - Postgres: add `ALTER TABLE` + `CREATE TABLE IF NOT EXISTS` to the Postgres init block

3. **Create `services/auth.ts`**
   - `issueTokens(userId)` — creates access + refresh JWT pair
   - `verifyAccessToken(token)` — returns `{ userId }` or throws
   - `verifyRefreshToken(token)` — returns `{ userId, jti }` or throws
   - `storeRefreshToken(userId, token, deviceHint)` — SHA-256 hashes token, inserts to DB
   - `revokeRefreshToken(tokenHash)` — deletes row
   - `rotateRefreshToken` — NOT used (refresh does not rotate per design)

4. **Add env var validation at startup** — warn if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` missing

**Tests**: unit tests for `issueTokens` / `verifyAccessToken` / `verifyRefreshToken` covering happy path + expired token + wrong secret.

---

## Phase 2 — Backend: Auth Routes

**Goal**: All 7 auth endpoints working, integration-tested.

### Steps

1. **Create `routes/auth.ts`** with routes in this order (simplest → hardest):
   - `POST /auth/register`
   - `POST /auth/login`
   - `GET /auth/me`
   - `POST /auth/logout`
   - `POST /auth/refresh`
   - `POST /auth/google`
   - `POST /auth/facebook`

2. **Create auth middleware** (`middleware/auth.ts`)
   - `requireAuth` — strict: 401 if no/invalid token
   - `authenticateJWT` — optional: attaches `req.userId` if valid token, otherwise undefined

3. **Mount in `index.ts`**
   ```typescript
   import authRouter from './routes/auth';
   app.use('/auth', authRouter);
   ```

4. **Apply optional middleware to existing routes**
   - `POST /career-report` — add `authenticateJWT`; remove `userId` from Zod schema body (read from `req.userId`)
   - `POST /select-games` — same

5. **Rate limit auth routes** — 10 req/min per IP (separate limiter, not the global one)

**Tests**: integration tests in `routes/auth.test.ts` covering register, login, refresh, logout, and error cases (duplicate email, wrong password, expired token).

---

## Phase 3 — Backend: Smoke Test Updates

**Goal**: Auth endpoints covered in smoke tests.

1. Add to `smoke/linux/smoke.sh` and `smoke/windows/smoke.ps1`:
   - `POST /auth/register` — 201
   - `POST /auth/login` — 200 with accessToken
   - `GET /auth/me` with Bearer token — 200
   - `POST /auth/logout` — 200
   - `POST /auth/login` bad password — 401

---

## Phase 4 — Mobile: AuthContext + Token Storage

**Goal**: Auth state wired up before any UI changes.

### Steps

1. **Install mobile dependencies**
   ```bash
   npx expo install expo-secure-store
   npm install @react-native-google-signin/google-signin
   npm install react-native-fbsdk-next
   ```

2. **Create `services/authStorage.ts`**
   - `saveTokens(accessToken, refreshToken, user)`
   - `loadTokens()` — returns stored tokens or null
   - `clearTokens()`

3. **Create `context/AuthContext.tsx`**
   - `AuthProvider` — reads SecureStore on mount, sets up in-memory token
   - `useAuth()` hook
   - All sign-in methods call `services/authApi.ts` then `saveTokens()`

4. **Create `services/authApi.ts`** — thin wrappers for auth endpoints
   - `loginWithGoogle(idToken)`
   - `loginWithFacebook(accessToken)`
   - `loginWithEmail(email, password)`
   - `register(email, password, displayName)`
   - `refreshAccessToken(refreshToken)`
   - `logout(refreshToken)`

5. **Add Axios interceptors to `services/api.ts`**
   - Request: attach Bearer token from memory
   - Response: refresh on 401, retry once

---

## Phase 5 — Mobile: Auth Screens

**Goal**: Users can register and sign in.

### Steps

1. **Create `screens/AuthScreen.tsx`** — landing screen with 3 social buttons + guest link
2. **Create `screens/LoginScreen.tsx`** — email/password form
3. **Create `screens/RegisterScreen.tsx`** — registration form with validation

4. **Update `navigation/AppNavigator.tsx`**
   - Wrap with `AuthProvider`
   - Add `AuthStack` (Auth, Login, Register)
   - Root navigator switches between `AuthStack` and `AppStack` based on `AuthContext`

5. **Update `screens/UserProfileScreen.tsx`**
   - Read `userId` from `AuthContext` instead of calling `registerUser()` for authenticated users
   - Keep `registerUser()` call for guest path

---

## Phase 6 — Native Config (Android + iOS)

**Goal**: Google and Facebook SDKs initialised correctly.

### Android
- `android/app/src/main/res/values/strings.xml` — add `facebook_app_id`, `fb_login_protocol_scheme`
- `android/app/src/main/AndroidManifest.xml` — add Facebook meta-data + activity
- `android/app/build.gradle` — Google Services plugin (if not already present for Firebase)
- `mobile/google-services.json` — download from Google Cloud Console

### iOS
- `ios/<App>/Info.plist` — add `CFBundleURLTypes` for Google and Facebook
- `ios/Podfile` — `pod install` picks up new native deps

> **Note**: Native config changes require a new Expo development build (`eas build --profile development`). Expo Go will not work after this phase.

---

## Phase 7 — Integration Testing & QA

1. End-to-end test on device:
   - Register with email → complete assessment → check report shows no progress summary (first session)
   - Complete second assessment → check progress summary appears
   - Sign in with Google → confirm same history visible
   - Logout → sign in again → history persists

2. Guest flow regression test — confirm existing flow unchanged

3. Run full backend test suite (`npx jest --runInBand --ci`)

4. Run smoke tests against dev backend (`./smoke.sh` or `smoke.ps1 -Target local`)

---

## Phase 8 — Deploy & Verify

1. Add new env vars to Azure App Service (dev environment):
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`

2. Push `feature/auth-flow` → merge to `main` → CI deploys to dev

3. Run smoke tests against `https://bi-backend-dev.azurewebsites.net`

4. Build new development APK with `eas build --profile preview`

5. Test on physical device against dev backend

---

## Dependency Order

```
Phase 1 (DB + tokens)
  └── Phase 2 (routes)
        └── Phase 3 (smoke tests)

Phase 4 (AuthContext + storage)    ← can start in parallel with Phase 2
  └── Phase 5 (screens)
        └── Phase 6 (native config)

Phase 7 (integration QA) — needs Phase 3 + Phase 6
  └── Phase 8 (deploy)
```

Phases 1-3 (backend) and Phases 4-5 (mobile logic) can be worked in parallel if backend API is mocked for mobile dev.

---

## New Files Summary

### Backend
| File | Purpose |
|------|---------|
| `backend/src/services/auth.ts` | JWT issue/verify, token DB helpers |
| `backend/src/routes/auth.ts` | All 7 auth endpoints |
| `backend/src/middleware/auth.ts` | `requireAuth` + `authenticateJWT` |
| `backend/src/routes/auth.test.ts` | Integration tests for auth routes |

### Mobile
| File | Purpose |
|------|---------|
| `mobile/src/context/AuthContext.tsx` | Auth state + actions |
| `mobile/src/services/authStorage.ts` | SecureStore read/write |
| `mobile/src/services/authApi.ts` | Auth endpoint wrappers |
| `mobile/src/screens/AuthScreen.tsx` | Landing / social sign-in |
| `mobile/src/screens/LoginScreen.tsx` | Email sign-in |
| `mobile/src/screens/RegisterScreen.tsx` | Registration form |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/db/database.ts` | DB schema migrations |
| `backend/src/index.ts` | Mount `/auth` router, env var check |
| `backend/src/routes/events.ts` | `authenticateJWT` on career-report + select-games |
| `mobile/src/navigation/AppNavigator.tsx` | Auth/App stack split, wrap AuthProvider |
| `mobile/src/services/api.ts` | Axios interceptors |
| `mobile/src/screens/UserProfileScreen.tsx` | Read userId from AuthContext |
| `mobile/src/config.ts` | Add `GOOGLE_CLIENT_ID` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Native SDK config breaking Expo Go workflow | Use `expo-auth-session` for Google (works in Expo Go) as interim; switch to native SDK for production build |
| Facebook SDK review process slow | Register app early; email-only auth works without Facebook approval |
| DB migration on live Postgres data | Migrations are additive only (ALTER TABLE ADD COLUMN) — no data loss risk |
| JWT secret rotation in production | Document rotation procedure: issue new secret, set env var, old tokens expire within 15 min naturally |
