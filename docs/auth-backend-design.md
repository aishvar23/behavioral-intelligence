# Auth — Backend Design

## Overview

Add authentication so users can sign in with Google, Facebook, or email/password.
Authenticated users get persistent trait history and personalised reports across sessions.
Unauthenticated (guest) flow continues to work as today — no breaking change.

---

## Auth Strategy

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Social sign-in | Verify provider ID tokens server-side | Keeps secrets out of the mobile app |
| Session tokens | Stateless JWT (access + refresh) | No server-side session store needed |
| Password storage | bcrypt (cost factor 12) | Industry standard |
| Token transport | `Authorization: Bearer <token>` header | Standard, works with existing axios setup |
| Refresh tokens | Stored in `refresh_tokens` table (one row per device) | Allows per-device revocation |
| Guest accounts | Existing `username`-based `users` table remains | Backward compatible |

**Why not Azure AD B2C / Firebase?**
Both are viable but add an external dependency and cost. Given the app is early-stage and already on Azure, a lightweight custom implementation is easier to iterate on. Can migrate to B2C later if user scale demands it.

---

## Database Changes

### Extend `users` table

```sql
ALTER TABLE users ADD COLUMN email          TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash  TEXT;          -- null for social-only accounts
ALTER TABLE users ADD COLUMN provider       TEXT;          -- 'google' | 'facebook' | 'email' | null (guest)
ALTER TABLE users ADD COLUMN provider_id    TEXT;          -- Google sub / Facebook id
ALTER TABLE users ADD COLUMN display_name   TEXT;
ALTER TABLE users ADD COLUMN avatar_url     TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
```

Add unique index: `(provider, provider_id)` — prevents duplicate accounts per social provider.

### New `refresh_tokens` table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,   -- SHA-256 of the raw token
  device_hint TEXT,                      -- e.g. "android", "ios" for display
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
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
| `JWT_ACCESS_SECRET` | Signs access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (different key) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console (OAuth 2.0 client) |
| `FACEBOOK_APP_ID` | From Meta Developer Console |
| `FACEBOOK_APP_SECRET` | From Meta Developer Console |

---

## API Endpoints

All auth endpoints are under `/auth`. No authentication required unless stated.

### POST `/auth/google`
Verify a Google ID token obtained by the mobile app and return JWTs.

**Request**
```json
{ "idToken": "<Google ID token from GoogleSignIn>" }
```

**Flow**
1. Verify `idToken` with `google-auth-library` using `GOOGLE_CLIENT_ID`
2. Extract `sub` (provider_id), `email`, `name`, `picture`
3. `upsertSocialUser('google', sub, email, name, picture)`
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
Verify a Facebook access token and return JWTs.

**Request**
```json
{ "accessToken": "<Facebook access token from FBSDK>" }
```

**Flow**
1. Call `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=<token>`
2. Validate response (HTTP 200 + has `id`)
3. `upsertSocialUser('facebook', id, email, name, picture_url)`
4. Issue access + refresh tokens

---

### POST `/auth/register`
Email + password registration.

**Request**
```json
{
  "email": "alice@example.com",
  "password": "Min8chars!",
  "displayName": "Alice"
}
```

**Validation**
- Email: valid format, not already registered
- Password: minimum 8 characters
- displayName: 2–50 characters

**Flow**
1. Check email not already in use
2. Hash password with bcrypt (cost 12)
3. Insert user with `provider = 'email'`, `email_verified = 0`
4. Issue access + refresh tokens

---

### POST `/auth/login`
Email + password sign-in.

**Request**
```json
{ "email": "alice@example.com", "password": "Min8chars!" }
```

**Flow**
1. Look up user by email
2. `bcrypt.compare(password, password_hash)`
3. Issue access + refresh tokens

**Error responses**
- `401` for invalid credentials (same message for both — no username enumeration)

---

### POST `/auth/refresh`
Exchange a refresh token for a new access token.

**Request**
```json
{ "refreshToken": "eyJ..." }
```

**Flow**
1. Verify JWT signature with `JWT_REFRESH_SECRET`
2. Look up `SHA256(token)` in `refresh_tokens` table
3. Check `expires_at`
4. Issue new access token (refresh token is NOT rotated — single device use)

---

### POST `/auth/logout`
Revoke the current refresh token.

**Request** — requires `Authorization: Bearer <accessToken>`
```json
{ "refreshToken": "eyJ..." }
```

**Flow**
1. Authenticate user from access token
2. Delete row from `refresh_tokens` where `token_hash = SHA256(refreshToken)`

---

### GET `/auth/me`
Return current user profile. Requires `Authorization: Bearer <accessToken>`.

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
{
  "sub": "42",
  "email": "alice@gmail.com",
  "iat": 1700000000,
  "exp": 1700000900
}
```

### Refresh Token (30 days)
```json
{
  "sub": "42",
  "jti": "<uuid>",
  "iat": 1700000000,
  "exp": 1702592000
}
```

---

## Middleware

### `authenticateJWT` (optional middleware)
Applied to routes that benefit from user identity but also work as guest.

```typescript
// If valid Bearer token → attaches req.userId
// If missing/invalid → req.userId = undefined (guest mode)
```

Applied to: `POST /career-report`, `POST /select-games`

### `requireAuth` (strict middleware)
Applied to routes that require a logged-in user.

Applied to: `GET /auth/me`, `POST /auth/logout`

---

## Changes to Existing Routes

| Route | Change |
|-------|--------|
| `POST /career-report` | Add optional `authenticateJWT` — removes need to send `userId` in request body |
| `POST /select-games` | Same — userId from token, not body |
| `POST /user` | Keep for backward compat (guest profile creation) |

---

## Security Notes

- Refresh tokens stored as SHA-256 hashes — raw token never persisted
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different keys
- All auth endpoints rate-limited: 10 req/min per IP
- Password min length enforced at Zod + bcrypt layer
- Social tokens verified server-side — client never touches secrets
