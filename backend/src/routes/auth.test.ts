/**
 * Integration tests for routes/auth.ts
 *
 * Uses a real better-sqlite3 in-memory database (via createAuthRouter(db)).
 * Only external calls are mocked: Google OAuth2Client.verifyIdToken and
 * the global fetch used for Facebook Graph API.
 *
 * Rate limiting is disabled via jest.mock so tests don't get 429.
 */

// Disable rate limiting before any imports
jest.mock('express-rate-limit', () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { initSchema } from '../db/database';
import { createAuthRouter } from './auth';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ── Env setup ─────────────────────────────────────────────────────────────────

const ACCESS_SECRET  = 'test-access-secret-32-characters!!';
const REFRESH_SECRET = 'test-refresh-secret-32-characters!';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET  = ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
  process.env.GOOGLE_CLIENT_ID   = 'test-google-client-id';
  process.env.FACEBOOK_APP_ID    = 'test-facebook-app-id';
});

afterAll(() => {
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.FACEBOOK_APP_ID;
});

// ── In-memory DB factory ──────────────────────────────────────────────────────

function makeTestDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}

// ── App factory ───────────────────────────────────────────────────────────────

function makeApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(db));
  return app;
}

// ── Google mock helpers ───────────────────────────────────────────────────────

function mockGoogleVerify(sub: string, email: string, name: string, picture = '') {
  const mockGetPayload = jest.fn().mockReturnValue({ sub, email, name, picture });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (OAuth2Client.prototype.verifyIdToken as any) = jest.fn().mockResolvedValueOnce({
    getPayload: mockGetPayload,
  });
}

function mockGoogleVerifyFail() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (OAuth2Client.prototype.verifyIdToken as any) = jest.fn().mockRejectedValueOnce(new Error('Invalid token'));
}

// ── Facebook mock helpers ─────────────────────────────────────────────────────

function mockFacebookSuccess(id: string, name: string, email: string, pictureUrl = '') {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id, name, email, picture: { data: { url: pictureUrl } } }),
  } as unknown as Response);
}

function mockFacebookFail() {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: { message: 'Invalid OAuth access token' } }),
  } as unknown as Response);
}

// ── SHA256 helper (for verifying token revocation) ────────────────────────────

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/register
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('201 on valid new user — returns accessToken, refreshToken, user', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).post('/auth/register').send({
      email:       'alice@example.com',
      password:    'password123',
      displayName: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toMatchObject({
      email:       'alice@example.com',
      displayName: 'Alice',
    });
    expect(typeof res.body.user.id).toBe('number');
  });

  it('409 on duplicate email', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    await request(app).post('/auth/register').send({
      email:       'dup@example.com',
      password:    'password123',
      displayName: 'Dup User',
    });

    const res = await request(app).post('/auth/register').send({
      email:       'dup@example.com',
      password:    'anotherpass',
      displayName: 'Another User',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it('400 on missing fields', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).post('/auth/register').send({
      email: 'incomplete@example.com',
      // missing password and displayName
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('400 on password too short (< 8 chars)', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).post('/auth/register').send({
      email:       'short@example.com',
      password:    'abc',
      displayName: 'Short Pass',
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  async function registerUser(app: express.Express, email: string, password: string, displayName: string) {
    return request(app).post('/auth/register').send({ email, password, displayName });
  }

  it('200 on valid credentials', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    await registerUser(app, 'login@example.com', 'validpass', 'Login User');

    const res = await request(app).post('/auth/login').send({
      email:    'login@example.com',
      password: 'validpass',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('login@example.com');
  });

  it('401 on wrong password — same error message', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    await registerUser(app, 'wrongpass@example.com', 'correctpass', 'Test User');

    const res = await request(app).post('/auth/login').send({
      email:    'wrongpass@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('401 on unknown email — same error message', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).post('/auth/login').send({
      email:    'unknown@example.com',
      password: 'anypassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  async function registerAndGetTokens(app: express.Express) {
    const res = await request(app).post('/auth/register').send({
      email:       `refresh_${Date.now()}@example.com`,
      password:    'password123',
      displayName: 'Refresh User',
    });
    return { accessToken: res.body.accessToken as string, refreshToken: res.body.refreshToken as string };
  }

  it('200 returns new accessToken', async () => {
    const db = makeTestDb();
    const app = makeApp(db);
    const { refreshToken } = await registerAndGetTokens(app);

    const res = await request(app).post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('401 on tampered token', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).post('/auth/refresh').send({
      refreshToken: 'tampered.token.value',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired refresh token');
  });

  it('401 on expired token', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    // Create a user so we can reference a valid userId
    const registerRes = await request(app).post('/auth/register').send({
      email:       'expired@example.com',
      password:    'password123',
      displayName: 'Expired User',
    });
    const userId = registerRes.body.user.id as number;

    // Craft an expired refresh token
    const expiredToken = jwt.sign(
      { sub: userId.toString(), jti: crypto.randomUUID() },
      REFRESH_SECRET,
      { expiresIn: 0 }
    );

    const res = await request(app).post('/auth/refresh').send({
      refreshToken: expiredToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired refresh token');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('200 and token is revoked — subsequent refresh returns 401', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const registerRes = await request(app).post('/auth/register').send({
      email:       'logout@example.com',
      password:    'password123',
      displayName: 'Logout User',
    });

    const { accessToken, refreshToken } = registerRes.body as { accessToken: string; refreshToken: string };

    // Logout
    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ ok: true });

    // Verify token is revoked — refresh should now fail
    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: GET /auth/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('200 returns user profile', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const registerRes = await request(app).post('/auth/register').send({
      email:       'me@example.com',
      password:    'password123',
      displayName: 'Me User',
    });

    const { accessToken } = registerRes.body as { accessToken: string };

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email:       'me@example.com',
      displayName: 'Me User',
    });
    expect(typeof res.body.id).toBe('number');
    expect(res.body.provider).toBe('email');
  });

  it('401 without token', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/google
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/google', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('200 creates new user on first call', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    mockGoogleVerify('google_sub_001', 'alice@gmail.com', 'Alice Google', 'https://photo.url');

    const res = await request(app).post('/auth/google').send({ idToken: 'fake-id-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('alice@gmail.com');
  });

  it('200 returns same userId on second call with same Google sub', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    mockGoogleVerify('google_sub_002', 'bob@gmail.com', 'Bob', '');
    const res1 = await request(app).post('/auth/google').send({ idToken: 'fake-token-1' });
    expect(res1.status).toBe(200);
    const userId1 = res1.body.user.id as number;

    mockGoogleVerify('google_sub_002', 'bob@gmail.com', 'Bob', '');
    const res2 = await request(app).post('/auth/google').send({ idToken: 'fake-token-2' });
    expect(res2.status).toBe(200);
    const userId2 = res2.body.user.id as number;

    expect(userId1).toBe(userId2);
  });

  it('200 links account when same email exists from email/password registration', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    // Register via email first
    const emailRegRes = await request(app).post('/auth/register').send({
      email:       'linked@example.com',
      password:    'password123',
      displayName: 'Linked User',
    });
    const emailUserId = emailRegRes.body.user.id as number;

    // Now sign in via Google with the same email
    mockGoogleVerify('google_sub_linked', 'linked@example.com', 'Linked User Google', '');
    const googleRes = await request(app).post('/auth/google').send({ idToken: 'link-token' });

    expect(googleRes.status).toBe(200);
    expect(googleRes.body.user.id).toBe(emailUserId);
  });

  it('401 on invalid Google token', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    mockGoogleVerifyFail();

    const res = await request(app).post('/auth/google').send({ idToken: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid Google token');
  });

  it('503 when GOOGLE_CLIENT_ID not set', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await request(app).post('/auth/google').send({ idToken: 'any-token' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Google auth not configured');

    process.env.GOOGLE_CLIENT_ID = saved;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /auth/facebook
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/facebook', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('200 creates new user', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    mockFacebookSuccess('fb_id_001', 'Carol Facebook', 'carol@fb.com', 'https://fb-photo.url');

    const res = await request(app).post('/auth/facebook').send({ accessToken: 'fake-fb-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('carol@fb.com');
  });

  it('401 on invalid Facebook token', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    mockFacebookFail();

    const res = await request(app).post('/auth/facebook').send({ accessToken: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid Facebook token');
  });

  it('503 when FACEBOOK_APP_ID not set', async () => {
    const db = makeTestDb();
    const app = makeApp(db);

    const saved = process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_ID;

    const res = await request(app).post('/auth/facebook').send({ accessToken: 'any-token' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Facebook auth not configured');

    process.env.FACEBOOK_APP_ID = saved;
  });
});
