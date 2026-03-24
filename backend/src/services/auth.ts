import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../db/database';

// ── Secrets ────────────────────────────────────────────────────────────────────

function accessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
}

function refreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
}

// ── Exported types ─────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  userId: number;
  email: string;
}

export interface RefreshTokenPayload {
  userId: number;
  jti: string;
}

export interface UpsertSocialUserResult {
  userId: number;
  isNew: boolean;
}

// ── Token issue / verify ───────────────────────────────────────────────────────

/**
 * Issues a new access + refresh JWT pair.
 * The `db` param is injectable for tests; defaults to the real singleton.
 */
export function issueTokens(userId: number, db: Database.Database = getDb()): TokenPair {
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string | null } | undefined;
  const email = row?.email ?? '';

  const accessToken = jwt.sign(
    { sub: userId.toString(), email },
    accessSecret(),
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { sub: userId.toString(), jti: crypto.randomUUID() },
    refreshSecret(),
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, accessSecret()) as { sub: string; email: string };
  return { userId: parseInt(payload.sub, 10), email: payload.email };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, refreshSecret()) as { sub: string; jti: string };
  return { userId: parseInt(payload.sub, 10), jti: payload.jti };
}

// ── Refresh token DB helpers ───────────────────────────────────────────────────

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function storeRefreshToken(userId: number, rawToken: string, deviceHint?: string, db: Database.Database = getDb()): void {
  const tokenHash = sha256(rawToken);
  const decoded = jwt.decode(rawToken) as { exp?: number } | null;
  const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  db.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_hint, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, deviceHint ?? null, expiresAt, now);
}

export function revokeRefreshToken(rawToken: string, db: Database.Database = getDb()): void {
  const tokenHash = sha256(rawToken);
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

// ── Account linking ────────────────────────────────────────────────────────────

export function upsertSocialUser(
  provider: 'google' | 'facebook',
  providerId: string,
  email: string | null,
  displayName: string | null,
  avatarUrl: string | null,
  db: Database.Database = getDb(),
): UpsertSocialUserResult {
  const txn = db.transaction((): UpsertSocialUserResult => {
    const now = Date.now();

    // 1. Look up existing identity row
    const identity = db.prepare(
      'SELECT user_id FROM user_identities WHERE provider = ? AND provider_id = ?'
    ).get(provider, providerId) as { user_id: number } | undefined;

    if (identity) {
      return { userId: identity.user_id, isNew: false };
    }

    // 2. If email provided, look up user by email
    let userId: number | null = null;
    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
      if (existing) {
        userId = existing.id;
      }
    }

    // 3. If no user found, create a new one
    let isNew = false;
    if (userId === null) {
      isNew = true;
      const username = `${provider}_${providerId}`;
      const result = db.prepare(
        `INSERT INTO users (username, email, display_name, avatar_url, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).run(username, email, displayName, avatarUrl, now, now);
      userId = result.lastInsertRowid as number;
    } else {
      // Update display_name / avatar_url if we now have them and they were missing
      db.prepare(
        `UPDATE users SET
           display_name = COALESCE(display_name, ?),
           avatar_url   = COALESCE(avatar_url, ?),
           updated_at   = ?
         WHERE id = ?`
      ).run(displayName, avatarUrl, now, userId);
    }

    // Insert identity row
    db.prepare(
      `INSERT INTO user_identities (user_id, provider, provider_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(userId, provider, providerId, now);

    return { userId, isNew };
  });

  return txn();
}

// ── Session tracking ───────────────────────────────────────────────────────────

export function startSession(sessionId: string, userId?: number, db: Database.Database = getDb()): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, started_at, status)
     VALUES (?, ?, ?, 'active')
     ON CONFLICT(id) DO NOTHING`
  ).run(sessionId, userId ?? null, now);
}

export function endSession(sessionId: string, status: 'completed' | 'abandoned', db: Database.Database = getDb()): void {
  const now = Date.now();
  db.prepare(
    `UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?`
  ).run(status, now, sessionId);
}
