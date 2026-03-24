import { Router, IRouter, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import Database from 'better-sqlite3';
import { getDb } from '../db/database';
import {
  issueTokens,
  storeRefreshToken,
  revokeRefreshToken,
  verifyRefreshToken,
  upsertSocialUser,
} from '../services/auth';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Create a router that uses the given db instance.
 * When db is omitted it defaults to the real singleton — production path.
 * Tests pass an in-memory db so no mocking of the database module is needed.
 */
export function createAuthRouter(db: Database.Database = getDb()): Router {
  const router = Router();

  // ── Zod schemas ─────────────────────────────────────────────────────────────

  const RegisterSchema = z.object({
    email:       z.string().email(),
    password:    z.string().min(8),
    displayName: z.string().min(2).max(50),
  });

  const LoginSchema = z.object({
    email:    z.string().email(),
    password: z.string(),
  });

  const RefreshSchema = z.object({
    refreshToken: z.string(),
  });

  const LogoutSchema = z.object({
    refreshToken: z.string(),
  });

  const GoogleSchema = z.object({
    idToken: z.string(),
  });

  const FacebookSchema = z.object({
    accessToken: z.string(),
  });

  // ── POST /register ───────────────────────────────────────────────────────────

  router.post('/register', async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { email, password, displayName } = parsed.data;

    // Check for duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = Date.now();

    // Generate a unique username for the users table
    const username = `email_${email.replace(/[^a-z0-9]/gi, '_')}_${now}`;

    const result = db.prepare(
      `INSERT INTO users (username, email, password_hash, display_name, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(username, email, passwordHash, displayName, now, now);

    const userId = result.lastInsertRowid as number;

    // Insert email identity row
    db.prepare(
      `INSERT INTO user_identities (user_id, provider, provider_id, created_at)
       VALUES (?, 'email', ?, ?)`
    ).run(userId, email, now);

    const tokens = issueTokens(userId, db);
    storeRefreshToken(userId, tokens.refreshToken, undefined, db);

    return res.status(201).json({
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: userId, displayName, email },
    });
  });

  // ── POST /login ──────────────────────────────────────────────────────────────

  router.post('/login', async (req: Request, res: Response) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { email, password } = parsed.data;

    const user = db.prepare(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = ?'
    ).get(email) as { id: number; email: string; password_hash: string | null; display_name: string | null } | undefined;

    const INVALID_MSG = 'Invalid email or password';

    if (!user || !user.password_hash) {
      // Perform a dummy bcrypt compare to prevent timing attacks
      await bcrypt.compare(password, '$2a$12$invalidhashpaddingtostoptimingattacks.XXXXXXXXXXXX');
      return res.status(401).json({ error: INVALID_MSG });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: INVALID_MSG });
    }

    const tokens = issueTokens(user.id, db);
    storeRefreshToken(user.id, tokens.refreshToken, undefined, db);

    return res.json({
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, displayName: user.display_name, email: user.email },
    });
  });

  // ── GET /me ──────────────────────────────────────────────────────────────────

  router.get('/me', requireAuth, (req: Request, res: Response) => {
    const user = db.prepare(
      `SELECT u.id, u.display_name, u.email, u.avatar_url, u.created_at,
              (SELECT provider FROM user_identities WHERE user_id = u.id LIMIT 1) AS provider
       FROM users u WHERE u.id = ?`
    ).get(req.userId) as {
      id: number;
      display_name: string | null;
      email: string | null;
      avatar_url: string | null;
      created_at: number;
      provider: string | null;
    } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id:          user.id,
      displayName: user.display_name,
      email:       user.email,
      provider:    user.provider,
      avatarUrl:   user.avatar_url,
      createdAt:   user.created_at,
    });
  });

  // ── POST /logout ─────────────────────────────────────────────────────────────

  router.post('/logout', requireAuth, (req: Request, res: Response) => {
    const parsed = LogoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    revokeRefreshToken(parsed.data.refreshToken, db);
    return res.json({ ok: true });
  });

  // ── POST /refresh ────────────────────────────────────────────────────────────

  router.post('/refresh', (req: Request, res: Response) => {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { refreshToken } = parsed.data;
    const INVALID_MSG = 'Invalid or expired refresh token';

    let userId: number;
    try {
      const payload = verifyRefreshToken(refreshToken);
      userId = payload.userId;
    } catch {
      return res.status(401).json({ error: INVALID_MSG });
    }

    // Look up hashed token in DB
    const tokenHash = sha256(refreshToken);
    const row = db.prepare(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?'
    ).get(tokenHash) as { user_id: number; expires_at: number } | undefined;

    if (!row) {
      return res.status(401).json({ error: INVALID_MSG });
    }

    if (row.expires_at < Date.now()) {
      return res.status(401).json({ error: INVALID_MSG });
    }

    // Issue new access token only — refresh token is NOT rotated
    const tokens = issueTokens(userId, db);
    return res.json({ accessToken: tokens.accessToken });
  });

  // ── POST /google ─────────────────────────────────────────────────────────────

  router.post('/google', async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Google auth not configured' });
    }

    const parsed = GoogleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const client = new OAuth2Client(clientId);

    try {
      const ticket = await client.verifyIdToken({
        idToken:  parsed.data.idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }

      const { sub, email, name, picture } = payload;

      const result = upsertSocialUser(
        'google',
        sub,
        email ?? null,
        name ?? null,
        picture ?? null,
        db,
      );

      const tokens = issueTokens(result.userId, db);
      storeRefreshToken(result.userId, tokens.refreshToken, undefined, db);

      const user = db.prepare('SELECT id, display_name, email, avatar_url FROM users WHERE id = ?').get(result.userId) as {
        id: number; display_name: string | null; email: string | null; avatar_url: string | null;
      };

      return res.json({
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, displayName: user.display_name, email: user.email, avatarUrl: user.avatar_url },
      });
    } catch {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
  });

  // ── POST /facebook ───────────────────────────────────────────────────────────

  router.post('/facebook', async (req: Request, res: Response) => {
    if (!process.env.FACEBOOK_APP_ID) {
      return res.status(503).json({ error: 'Facebook auth not configured' });
    }

    const parsed = FacebookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { accessToken } = parsed.data;

    try {
      const url = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`;
      const fbRes = await fetch(url);

      if (!fbRes.ok) {
        return res.status(401).json({ error: 'Invalid Facebook token' });
      }

      const fbData = await fbRes.json() as {
        id?: string;
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
        error?: unknown;
      };

      if (!fbData.id || fbData.error) {
        return res.status(401).json({ error: 'Invalid Facebook token' });
      }

      const pictureUrl = fbData.picture?.data?.url ?? null;

      const result = upsertSocialUser(
        'facebook',
        fbData.id,
        fbData.email ?? null,
        fbData.name ?? null,
        pictureUrl,
        db,
      );

      const tokens = issueTokens(result.userId, db);
      storeRefreshToken(result.userId, tokens.refreshToken, undefined, db);

      const user = db.prepare('SELECT id, display_name, email, avatar_url FROM users WHERE id = ?').get(result.userId) as {
        id: number; display_name: string | null; email: string | null; avatar_url: string | null;
      };

      return res.json({
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, displayName: user.display_name, email: user.email, avatarUrl: user.avatar_url },
      });
    } catch {
      return res.status(401).json({ error: 'Invalid Facebook token' });
    }
  });

  return router;
}

// Default export: real router using the singleton DB
// We create a wrapper router that lazily initialises the real router on first
// request — this avoids calling getDb() at module import time (which would
// fail in test environments that don't have the data/ directory).
const _lazyRouter = Router();
let _realRouter: IRouter | undefined;

_lazyRouter.use((req, res, next) => {
  if (!_realRouter) {
    _realRouter = createAuthRouter(getDb());
  }
  _realRouter(req, res, next);
});

export default _lazyRouter;
