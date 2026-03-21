# Auth — Backend Design

## Overview

Add authentication so users can sign in with Google, Facebook, or email/password.
Authenticated users get persistent trait history and personalised reports across sessions.
Unauthenticated (guest) flow continues to work as today — no breaking change.

---

## Auth Model — What This Is (and Is Not)

This is **federated identity with custom token issuance** — the standard approach for mobile apps:

1. The mobile SDK (Google Sign-In / Facebook SDK) authenticates the user with the provider.
2. The provider returns an ID token / access token to the mobile app.
3. The mobile app sends that token to **our** backend for server-side verification.
4. Our backend issues its own JWTs. All subsequent calls use our tokens only.

This is **not** a full OAuth 2.0 authorization code flow (that would be needed if third parties were building integrations on top of our API — not needed here).

---

## Auth Strategy

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Social sign-in | Verify provider tokens server-side | Keeps secrets out of the mobile app |
| Session tokens | Stateless JWT (access + refresh) | No server-side session store needed |
| Password storage | bcrypt (cost factor 12) | Industry standard |
| Token transport | `Authorization: Bearer <token>` header | Standard, works with existing axios setup |
| Refresh tokens | Stored in `refresh_tokens` table (one row per device) | Allows per-device revocation |
| Guest accounts | Existing `username`-based `users` table remains | Backward compatible |
| Account linking | `user_identities` table (one row per provider per user) | Handles same-email across Google + Facebook |

**Why not Azure AD B2C / Firebase Auth?**
Both are viable but add an external dependency and cost. Given the app is early-stage, a lightweight custom implementation is easier to iterate on. Can migrate to B2C later if user scale demands it.

---

## Data Residency

Auth introduces PII: email, display name, avatar URL. This makes data residency a real concern.

**Recommendation (early stage):**
- Deploy the backend and database to **one Azure region** that matches your primary user base (e.g., `West Europe` for EU users, `East US` for US users).
- The `country` column already on `users` enables future geo-partitioning but is not used for routing yet.
- Document the region choice. If you have EU users, ensure the chosen region satisfies GDPR adequacy requirements.

**What to avoid now:** Multi-region database sharding is premature. Revisit when you have a legal requirement or 100k+ active users.

---

## Account Linking (Same Email, Different Providers)

A user who signs in with Google (alice@gmail.com) and later tries Facebook (same email) must land on the **same account** — not create a duplicate.

The `user_identities` table handles this:

```
Flow when Facebook presents alice@gmail.com:
1. Look up user_identities (provider='facebook', provider_id=fb_id) → NOT FOUND
2. Look up users by email='alice@gmail.com' → FOUND (user_id=42, from Google)
3. INSERT user_identities (user_id=42, provider='facebook', provider_id=fb_id)
4. Return userId=42 — same account, now linked to both providers
```

If neither match (genuinely new user) → create new `users` row + `user_identities` row.

---

## Session Tracking

Every session (completed, abandoned, or expired) is saved against a `user_id` in a `sessions` table. This enables:
- Full timeline of all assessments per user
- `user_trait_history` rows reference `session_id` (already exists)
- `events` rows can be joined back to a user via `session_id → sessions.id`

Guest sessions have `user_id = NULL`.

---

## Database Schema

### Existing tables (unchanged)
- `events` — raw game events, keyed by `session_id`
- `reports` — basic trait scores per session
- `llm_calls` — LLM cost tracking
- `user_trait_history` — trait snapshots per user per session (already has `user_id FK`)

### `users` table (extend existing)

```sql
-- Existing columns: id, username, age, country, life_stage, created_at, updated_at
ALTER TABLE users ADD COLUMN email        TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash TEXT;       -- null for social-only accounts
ALTER TABLE users ADD COLUMN display_name  TEXT;
ALTER TABLE users ADD COLUMN avatar_url    TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
```

### New: `user_identities` table

```sql
CREATE TABLE IF NOT EXISTS user_identities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL,   -- 'google' | 'facebook' | 'email'
  provider_id TEXT    NOT NULL,   -- Google sub / Facebook id / email address
  created_at  INTEGER NOT NULL,
  UNIQUE(provider, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);
```

### New: `sessions` table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,  -- the UUID sessionId from the mobile app
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- null = guest
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,              -- null until closed or abandoned
  status     TEXT    NOT NULL DEFAULT 'active'  -- 'active' | 'completed' | 'abandoned'
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

### New: `refresh_tokens` table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,   -- SHA-256 of the raw token
  device_hint TEXT,                      -- 'android' | 'ios'
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
```

---

## E2E Flow Diagrams

### Social Sign-In (Google)

```
Mobile App              Our Backend                  Google
──────────              ───────────                  ──────
Tap "Sign in
with Google"
                                                     GoogleSignIn SDK
                                                     prompts user consent
                                                     Returns ID token
POST /auth/google
{ idToken }
                        Verify idToken ─────────────► Google public keys
                        (JWT verification,            (no round-trip needed
                         no network call)              after key cache)
                        Extract sub, email,
                        name, picture

                        Look up user_identities
                        (provider='google', id=sub)
                        ┌─ FOUND → return user_id
                        └─ NOT FOUND → check email
                             ┌─ email exists → link
                             └─ new → create user

                        INSERT refresh_tokens (hash)
                        Return accessToken (15m)
                               refreshToken (30d)
                               user profile
Store in SecureStore
Navigate to Home ✓
```

### Subsequent API Calls

```
Mobile App              Our Backend
──────────              ───────────
POST /career-report
Authorization: Bearer <accessToken>
                        authenticateJWT middleware
                        - verify JWT signature
                        - extract userId = 42
                        - req.userId = 42
                        - after report: saveUserTraitHistory(42, sessionId, ...)
                        - UPDATE sessions SET status='completed', ended_at=now
← FullReport + progressSummary (built from user_trait_history)
```

### Token Refresh

```
Mobile App              Our Backend
──────────              ───────────
Any API call
← 401 (access token expired)
Axios interceptor:
POST /auth/refresh
{ refreshToken }
                        Verify JWT signature
                        SHA256(token) → lookup refresh_tokens
                        Check expires_at
                        Issue new accessToken
← { accessToken }
Retry original request ✓
```

---

## New Dependencies

```json
"bcryptjs": "^2.4.3",
"jsonwebtoken": "^9.0.0",
"google-auth-library": "^9.0.0"
```

Facebook tokens are verified via a plain HTTP call to the Graph API — no SDK needed.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_ACCESS_SECRET` | Signs access tokens (min 32 chars, different from refresh secret) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (OAuth 2.0 client) |
| `FACEBOOK_APP_ID` | From Meta Developer Console |
| `FACEBOOK_APP_SECRET` | From Meta Developer Console |

---

## API Endpoints

All auth endpoints are under `/auth`. Rate-limited to 10 req/min per IP.

### POST `/auth/google`

**Request**
```json
{ "idToken": "<Google ID token from GoogleSignIn SDK>" }
```

**Flow**
1. Verify `idToken` with `google-auth-library` using `GOOGLE_CLIENT_ID`
2. Extract `sub`, `email`, `name`, `picture`
3. `upsertSocialUser('google', sub, email, name, picture)` — handles create/link
4. Issue access token (15 min) + refresh token (30 days)
5. Return tokens + user profile

**Response**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": 42, "displayName": "Alice", "email": "alice@gmail.com", "avatarUrl": "..." }
}
```

---

### POST `/auth/facebook`

**Request**
```json
{ "accessToken": "<Facebook access token from FBSDK>" }
```

**Flow**
1. `GET https://graph.facebook.com/me?fields=id,name,email,picture&access_token=<token>`
2. Validate HTTP 200 + has `id`
3. `upsertSocialUser('facebook', id, email, name, picture_url)`
4. Issue access + refresh tokens

---

### POST `/auth/register`

**Request**
```json
{
  "email": "alice@example.com",
  "password": "Min8chars!",
  "displayName": "Alice"
}
```

**Validation**: valid email, not in use; password min 8 chars; displayName 2–50 chars

**Flow**
1. Check email not already in `users`
2. Hash password with bcrypt (cost 12)
3. Insert user row + `user_identities` row (`provider='email'`)
4. Issue access + refresh tokens

---

### POST `/auth/login`

**Request**
```json
{ "email": "alice@example.com", "password": "Min8chars!" }
```

**Flow**
1. Look up user by email
2. `bcrypt.compare(password, password_hash)`
3. Issue access + refresh tokens

**Errors**: `401` for both wrong email and wrong password (same message — prevents enumeration)

---

### POST `/auth/refresh`

**Request**
```json
{ "refreshToken": "eyJ..." }
```

**Flow**
1. Verify JWT signature with `JWT_REFRESH_SECRET`
2. Look up `SHA256(token)` in `refresh_tokens`
3. Check `expires_at`
4. Issue new access token (refresh token NOT rotated)

---

### POST `/auth/logout`

Requires `Authorization: Bearer <accessToken>`

**Request**
```json
{ "refreshToken": "eyJ..." }
```

**Flow**: Delete row from `refresh_tokens` where `token_hash = SHA256(refreshToken)`

---

### GET `/auth/me`

Requires `Authorization: Bearer <accessToken>`

**Response**
```json
{
  "id": 42,
  "displayName": "Alice",
  "email": "alice@gmail.com",
  "provider": "google",
  "avatarUrl": "https://...",
  "createdAt": 1700000000000
}
```

---

## JWT Token Spec

### Access Token (15 min)
```json
{ "sub": "42", "email": "alice@gmail.com", "iat": 1700000000, "exp": 1700000900 }
```

### Refresh Token (30 days)
```json
{ "sub": "42", "jti": "<uuid>", "iat": 1700000000, "exp": 1702592000 }
```

---

## Middleware

### `authenticateJWT` (optional)
Applied to routes that work for both guests and authenticated users.
- Valid Bearer token → `req.userId = 42`
- Missing or invalid token → `req.userId = undefined` (guest mode, not rejected)

Applied to: `POST /career-report`, `POST /select-games`

### `requireAuth` (strict)
Returns `401` if no valid token.

Applied to: `GET /auth/me`, `POST /auth/logout`

---

## Changes to Existing Routes

| Route | Change |
|-------|--------|
| `POST /career-report` | Add `authenticateJWT`; saves session row to `sessions` table on completion |
| `POST /select-games` | Add `authenticateJWT` |
| `POST /user` | Keep for backward compat (guest profile creation) |
| `POST /event` | Optionally accept `userId` to register session in `sessions` table |

---

## Security Notes

- Refresh tokens stored as SHA-256 hashes — raw token never persisted server-side
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different keys
- All auth endpoints rate-limited: 10 req/min per IP
- Password minimum length enforced at Zod layer before bcrypt
- Social tokens verified server-side — client never touches provider secrets
- Same error message for wrong email and wrong password (prevents user enumeration)
