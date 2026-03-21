import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth';

// Extend Express Request to carry an authenticated userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

/**
 * requireAuth — strict middleware.
 * Returns 401 if no valid Bearer token is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * authenticateJWT — optional middleware.
 * Attaches req.userId if a valid Bearer token is present.
 * Never rejects — missing or invalid tokens result in req.userId = undefined.
 */
export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.userId = payload.userId;
    } catch {
      // Invalid token — proceed as guest (req.userId stays undefined)
    }
  }
  next();
}
