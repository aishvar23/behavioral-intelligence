import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { upsertUser } from '../db/database';

const router = Router();

const UserSchema = z.object({
  username:  z.string().min(2).max(50),
  age:       z.string().optional().default(''),
  country:   z.string().optional().default(''),
  lifeStage: z.string().optional().default(''),
});

// POST /user — register or update a user, returns userId
// username is the unique identifier stored in DB only — never sent to LLM
router.post('/user', (req: Request, res: Response) => {
  try {
    const result = UserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    }

    const { username, age, country, lifeStage } = result.data;
    const user = upsertUser(username.trim(), age, country, lifeStage);
    return res.json({ userId: user.id });
  } catch (err) {
    console.error('POST /user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
