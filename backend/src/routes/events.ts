import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getDb, getPgPool, isPostgres } from '../db/database';
import { calculateTraits } from '../services/traitEngine';
import { generateBehaviorReport, generateCareerReport, selectGamesForUser } from '../services/llmAnalysis';
import { extractStructuredBehaviorData } from '../services/behavioralSignals';

const router = Router();

// Rate limiters
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const careerReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// Zod schemas
const EventSchema = z.object({
  sessionId: z.string().uuid(),
  gameId:    z.string(),
  eventType: z.string(),
  timestamp: z.number().int(),
  data:      z.record(z.unknown()),
});

const CareerReportSchema = z.object({
  sessionId: z.string().uuid(),
  userProfile: z.object({
    age:             z.string(),
    occupation:      z.string(),
    occupationTitle: z.string(),
    occupationEmoji: z.string(),
    interests:       z.string(),
  }),
  gameResults: z.array(
    z.object({
      configId:  z.string(),
      gameType:  z.string(),
      title:     z.string(),
      emoji:     z.string(),
      score:     z.number(),
    })
  ),
});

// POST /event — log a single game event
router.post('/event', eventLimiter, async (req: Request, res: Response) => {
  try {
  const result = EventSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
  }

  const { sessionId, gameId, eventType, timestamp, data } = result.data;

  if (isPostgres()) {
    const pool = getPgPool();

    const countResult = await pool.query(
      'SELECT COUNT(*) AS count FROM events WHERE session_id = $1',
      [sessionId]
    );
    const count = parseInt(countResult.rows[0].count, 10);

    if (count >= 500) {
      return res.status(429).json({ error: 'Session event limit reached' });
    }

    await pool.query(
      `INSERT INTO events (session_id, game_id, event_type, timestamp, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, gameId, eventType, timestamp, data ?? {}]
    );
  } else {
    const db = getDb();

    // 500-event cap per session
    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM events WHERE session_id = ?')
      .get(sessionId) as { count: number };

    if (countRow.count >= 500) {
      return res.status(429).json({ error: 'Session event limit reached' });
    }

    db.prepare(
      `INSERT INTO events (session_id, game_id, event_type, timestamp, data)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, gameId, eventType, timestamp, JSON.stringify(data ?? {}));
  }

  return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /event error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /report/:sessionId — compute traits + generate LLM report (legacy endpoint)
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  try {
  const { sessionId } = req.params;

  if (isPostgres()) {
    const pool = getPgPool();

    const cachedResult = await pool.query(
      'SELECT traits, ai_report, thinking_style FROM reports WHERE session_id = $1',
      [sessionId]
    );

    if (cachedResult.rows.length > 0) {
      const cached = cachedResult.rows[0];
      return res.json({
        traits: cached.traits,
        aiReport: cached.ai_report,
        thinkingStyle: cached.thinking_style,
      });
    }

    const eventsResult = await pool.query(
      'SELECT game_id, event_type, timestamp, data FROM events WHERE session_id = $1',
      [sessionId]
    );

    if (eventsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No events found for session' });
    }

    const events = eventsResult.rows.map((r: { game_id: string; event_type: string; timestamp: number; data: Record<string, unknown> }) => ({
      game_id: r.game_id,
      event_type: r.event_type,
      timestamp: r.timestamp,
      data: r.data,
    }));

    const traits = calculateTraits(events);

    let aiReport = 'Behavioral analysis complete.';
    let thinkingStyle = 'Analytical and adaptive thinker.';

    try {
      const llmResult = await generateBehaviorReport(traits);
      aiReport = llmResult.aiReport;
      thinkingStyle = llmResult.thinkingStyle;
    } catch (err) {
      console.error('LLM generation failed:', err);
    }

    await pool.query(
      `INSERT INTO reports (session_id, traits, ai_report, thinking_style, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id) DO UPDATE
         SET traits = EXCLUDED.traits,
             ai_report = EXCLUDED.ai_report,
             thinking_style = EXCLUDED.thinking_style,
             created_at = EXCLUDED.created_at`,
      [sessionId, traits, aiReport, thinkingStyle, Date.now()]
    );

    return res.json({ traits, aiReport, thinkingStyle });
  } else {
    const db = getDb();

    const cached = db
      .prepare('SELECT traits, ai_report, thinking_style FROM reports WHERE session_id = ?')
      .get(sessionId) as { traits: string; ai_report: string; thinking_style: string } | undefined;

    if (cached) {
      return res.json({
        traits: JSON.parse(cached.traits),
        aiReport: cached.ai_report,
        thinkingStyle: cached.thinking_style,
      });
    }

    const rows = db
      .prepare('SELECT game_id, event_type, timestamp, data FROM events WHERE session_id = ?')
      .all(sessionId) as Array<{ game_id: string; event_type: string; timestamp: number; data: string }>;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No events found for session' });
    }

    const events = rows.map(r => ({
      game_id: r.game_id,
      event_type: r.event_type,
      timestamp: r.timestamp,
      data: JSON.parse(r.data),
    }));

    const traits = calculateTraits(events);

    let aiReport = 'Behavioral analysis complete.';
    let thinkingStyle = 'Analytical and adaptive thinker.';

    try {
      const llmResult = await generateBehaviorReport(traits);
      aiReport = llmResult.aiReport;
      thinkingStyle = llmResult.thinkingStyle;
    } catch (err) {
      console.error('LLM generation failed:', err);
    }

    db.prepare(
      `INSERT OR REPLACE INTO reports (session_id, traits, ai_report, thinking_style, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, JSON.stringify(traits), aiReport, thinkingStyle, Date.now());

    return res.json({ traits, aiReport, thinkingStyle });
  }
  } catch (err) {
    console.error('GET /report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /select-games — LLM picks 3 assessment games based on user profile + occupation
router.post('/select-games', async (req: Request, res: Response) => {
  try {
    const { userProfile } = req.body;
    if (!userProfile || !userProfile.occupationTitle) {
      return res.status(400).json({ error: 'Missing userProfile' });
    }

    const result = await selectGamesForUser(userProfile);
    return res.json(result);
  } catch (err) {
    console.error('POST /select-games error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /career-report — generate occupation-aware report with user profile
router.post('/career-report', careerReportLimiter, async (req: Request, res: Response) => {
  try {
  const parseResult = CareerReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
  }

  const { sessionId, userProfile, gameResults } = parseResult.data;

  let events: Array<{ game_id: string; event_type: string; timestamp: number; data: Record<string, unknown> }>;

  if (isPostgres()) {
    const pool = getPgPool();
    const eventsResult = await pool.query(
      'SELECT game_id, event_type, timestamp, data FROM events WHERE session_id = $1',
      [sessionId]
    );
    events = eventsResult.rows.map((r: { game_id: string; event_type: string; timestamp: number; data: Record<string, unknown> }) => ({
      game_id: r.game_id,
      event_type: r.event_type,
      timestamp: r.timestamp,
      data: r.data,
    }));
  } else {
    const db = getDb();
    const rows = db
      .prepare('SELECT game_id, event_type, timestamp, data FROM events WHERE session_id = ?')
      .all(sessionId) as Array<{ game_id: string; event_type: string; timestamp: number; data: string }>;

    events = rows.map(r => ({
      game_id: r.game_id,
      event_type: r.event_type,
      timestamp: r.timestamp,
      data: JSON.parse(r.data),
    }));
  }

  const traits = calculateTraits(events);
  const gameBehaviorData = extractStructuredBehaviorData(events, gameResults);

  try {
    const llmResult = await generateCareerReport(traits, userProfile, gameResults, gameBehaviorData);
    return res.json({
      traits,
      gameResults,
      thinkingStyle: llmResult.thinkingStyle,
      aiReport: llmResult.aiReport,
      occupationFit: llmResult.occupationFit,
      aiRecommendedCareers: llmResult.aiRecommendedCareers,
      observations: llmResult.observations,
      skillDevelopment: llmResult.skillDevelopment,
    });
  } catch (err) {
    console.error('Career report failed:', err);
    return res.status(500).json({ error: 'Failed to generate career report' });
  }
  } catch (err) {
    console.error('POST /career-report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
