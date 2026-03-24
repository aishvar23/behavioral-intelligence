/**
 * Unit tests for services/auth.ts
 *
 * Uses a real better-sqlite3 in-memory database — no DB mocking — because
 * these tests exercise the actual SQL logic (account linking, session tracking).
 */

import Database from 'better-sqlite3';
import { initSchema } from '../db/database';
import {
  issueTokens,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  upsertSocialUser,
  startSession,
  endSession,
} from './auth';

// ── Test env setup ─────────────────────────────────────────────────────────────

const ACCESS_SECRET  = 'test-access-secret-32-characters!!';
const REFRESH_SECRET = 'test-refresh-secret-32-characters!';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET  = ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

// ── In-memory DB factory ───────────────────────────────────────────────────────

function makeTestDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}

/** Insert a minimal user row and return its id. */
function insertUser(db: Database.Database, email: string | null = null): number {
  const now = Date.now();
  const username = `user_${Math.random().toString(36).slice(2)}`;
  const result = db.prepare(
    `INSERT INTO users (username, email, created_at, updated_at) VALUES (?, ?, ?, ?)`
  ).run(username, email, now, now);
  return result.lastInsertRowid as number;
}

// ── issueTokens + verifyAccessToken ───────────────────────────────────────────

describe('issueTokens + verifyAccessToken', () => {
  it('happy path: issued access token verifies correctly', () => {
    const db = makeTestDb();
    const userId = insertUser(db, 'alice@example.com');

    const { accessToken } = issueTokens(userId, db);
    const payload = verifyAccessToken(accessToken);

    expect(payload.userId).toBe(userId);
    expect(payload.email).toBe('alice@example.com');
  });

  it('access token payload contains empty string email when user has no email', () => {
    const db = makeTestDb();
    const userId = insertUser(db, null);

    const { accessToken } = issueTokens(userId, db);
    const payload = verifyAccessToken(accessToken);

    expect(payload.userId).toBe(userId);
    expect(payload.email).toBe('');
  });

  it('verifyAccessToken throws when token is signed with wrong secret', () => {
    const db = makeTestDb();
    const userId = insertUser(db);

    const jwt = require('jsonwebtoken');
    const badToken = jwt.sign({ sub: userId.toString(), email: '' }, 'wrong-secret', { expiresIn: '15m' });

    expect(() => verifyAccessToken(badToken)).toThrow();
  });

  it('verifyAccessToken throws when token is expired', () => {
    const db = makeTestDb();
    const userId = insertUser(db);

    const jwt = require('jsonwebtoken');
    // expiresIn: 0 means expired immediately
    const expiredToken = jwt.sign(
      { sub: userId.toString(), email: '' },
      ACCESS_SECRET,
      { expiresIn: 0 }
    );

    // Give JWT one tick to expire
    expect(() => verifyAccessToken(expiredToken)).toThrow(/jwt expired/i);
  });
});

// ── verifyRefreshToken ─────────────────────────────────────────────────────────

describe('verifyRefreshToken', () => {
  it('happy path: issued refresh token verifies correctly', () => {
    const db = makeTestDb();
    const userId = insertUser(db);

    const { refreshToken } = issueTokens(userId, db);
    const payload = verifyRefreshToken(refreshToken);

    expect(payload.userId).toBe(userId);
    expect(typeof payload.jti).toBe('string');
    expect(payload.jti.length).toBeGreaterThan(0);
  });

  it('verifyRefreshToken throws when signed with wrong secret', () => {
    const jwt = require('jsonwebtoken');
    const badToken = jwt.sign({ sub: '1', jti: 'some-jti' }, 'wrong-secret', { expiresIn: '30d' });
    expect(() => verifyRefreshToken(badToken)).toThrow();
  });
});

// ── storeRefreshToken + revokeRefreshToken ─────────────────────────────────────

describe('storeRefreshToken + revokeRefreshToken', () => {
  it('stores a token hash row and removes it on revocation', () => {
    const db = makeTestDb();
    const userId = insertUser(db);

    const { refreshToken } = issueTokens(userId, db);
    storeRefreshToken(userId, refreshToken, 'android', db);

    // Row should exist
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?').get(userId);
    expect(row).toBeDefined();

    // Revoke it
    revokeRefreshToken(refreshToken, db);

    const rowAfter = db.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?').get(userId);
    expect(rowAfter).toBeUndefined();
  });

  it('stores token without device_hint', () => {
    const db = makeTestDb();
    const userId = insertUser(db);
    const { refreshToken } = issueTokens(userId, db);

    storeRefreshToken(userId, refreshToken, undefined, db);

    const row = db.prepare('SELECT device_hint FROM refresh_tokens WHERE user_id = ?').get(userId) as { device_hint: string | null };
    expect(row).toBeDefined();
    expect(row.device_hint).toBeNull();
  });

  it('revokeRefreshToken is idempotent (no error on missing row)', () => {
    const db = makeTestDb();
    const userId = insertUser(db);
    const { refreshToken } = issueTokens(userId, db);

    // Never stored — should not throw
    expect(() => revokeRefreshToken(refreshToken, db)).not.toThrow();
  });
});

// ── upsertSocialUser ───────────────────────────────────────────────────────────

describe('upsertSocialUser', () => {
  it('creates a new user and identity row on first sign-in', () => {
    const db = makeTestDb();

    const result = upsertSocialUser('google', 'google_sub_001', 'bob@gmail.com', 'Bob Smith', null, db);

    expect(result.isNew).toBe(true);
    expect(typeof result.userId).toBe('number');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId) as Record<string, unknown>;
    expect(user).toBeDefined();
    expect(user.email).toBe('bob@gmail.com');

    const identity = db.prepare(
      'SELECT * FROM user_identities WHERE user_id = ? AND provider = ?'
    ).get(result.userId, 'google');
    expect(identity).toBeDefined();
  });

  it('returns the same user on repeated sign-in with same provider + id', () => {
    const db = makeTestDb();

    const first  = upsertSocialUser('google', 'google_sub_002', 'carol@gmail.com', 'Carol', null, db);
    const second = upsertSocialUser('google', 'google_sub_002', 'carol@gmail.com', 'Carol', null, db);

    expect(second.isNew).toBe(false);
    expect(second.userId).toBe(first.userId);

    // Only one identity row should exist
    const count = (db.prepare(
      'SELECT COUNT(*) as cnt FROM user_identities WHERE provider = ? AND provider_id = ?'
    ).get('google', 'google_sub_002') as { cnt: number }).cnt;
    expect(count).toBe(1);
  });

  it('links Facebook account to existing Google account when emails match', () => {
    const db = makeTestDb();

    // User already exists via Google
    const googleResult = upsertSocialUser('google', 'google_sub_003', 'dave@gmail.com', 'Dave', null, db);
    expect(googleResult.isNew).toBe(true);

    // Same email now via Facebook
    const facebookResult = upsertSocialUser('facebook', 'fb_id_003', 'dave@gmail.com', 'Dave FB', null, db);

    expect(facebookResult.isNew).toBe(false);
    expect(facebookResult.userId).toBe(googleResult.userId);

    // Two identity rows for the same user
    const identities = db.prepare(
      'SELECT provider FROM user_identities WHERE user_id = ?'
    ).all(googleResult.userId) as Array<{ provider: string }>;
    const providers = identities.map(i => i.provider).sort();
    expect(providers).toEqual(['facebook', 'google']);
  });

  it('creates separate accounts when different emails and different provider ids', () => {
    const db = makeTestDb();

    const a = upsertSocialUser('google', 'google_sub_a', 'a@example.com', 'A', null, db);
    const b = upsertSocialUser('google', 'google_sub_b', 'b@example.com', 'B', null, db);

    expect(a.userId).not.toBe(b.userId);
    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(true);
  });

  it('creates a new user with null email when no email is provided', () => {
    const db = makeTestDb();

    const result = upsertSocialUser('facebook', 'fb_no_email', null, 'Anonymous', null, db);

    expect(result.isNew).toBe(true);
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(result.userId) as { email: string | null };
    expect(user.email).toBeNull();
  });
});

// ── startSession + endSession ──────────────────────────────────────────────────

describe('startSession + endSession', () => {
  it('inserts a session row with status=active', () => {
    const db = makeTestDb();
    const sid = 'sess-0001';

    startSession(sid, undefined, db);

    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.status).toBe('active');
    expect(row.user_id).toBeNull();
    expect(row.ended_at).toBeNull();
  });

  it('associates the session with a user_id when provided', () => {
    const db = makeTestDb();
    const userId = insertUser(db);
    const sid = 'sess-0002';

    startSession(sid, userId, db);

    const row = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sid) as { user_id: number };
    expect(row.user_id).toBe(userId);
  });

  it('endSession sets status and ended_at', () => {
    const db = makeTestDb();
    const sid = 'sess-0003';

    startSession(sid, undefined, db);
    endSession(sid, 'completed', db);

    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) as Record<string, unknown>;
    expect(row.status).toBe('completed');
    expect(typeof row.ended_at).toBe('number');
  });

  it('endSession with abandoned status works', () => {
    const db = makeTestDb();
    const sid = 'sess-0004';

    startSession(sid, undefined, db);
    endSession(sid, 'abandoned', db);

    const row = db.prepare('SELECT status FROM sessions WHERE id = ?').get(sid) as { status: string };
    expect(row.status).toBe('abandoned');
  });

  it('startSession is idempotent — second call is silently ignored', () => {
    const db = makeTestDb();
    const sid = 'sess-0005';

    startSession(sid, undefined, db);
    startSession(sid, undefined, db); // should not throw or duplicate

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE id = ?').get(sid) as { cnt: number }).cnt;
    expect(count).toBe(1);
  });
});
