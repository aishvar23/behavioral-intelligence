import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db/database';
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
router.post('/event', eventLimiter, (req: Request, res: Response) => {
  const result = EventSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
  }

  const { sessionId, gameId, eventType, timestamp, data } = result.data;

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

  return res.status(201).json({ ok: true });
});

// GET /report/:sessionId — compute traits + generate LLM report (legacy endpoint)
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
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
});

// POST /select-games — LLM picks 3 assessment games based on user profile + occupation
router.post('/select-games', async (req: Request, res: Response) => {
  const { userProfile } = req.body;
  if (!userProfile || !userProfile.occupationTitle) {
    return res.status(400).json({ error: 'Missing userProfile' });
  }

  const result = await selectGamesForUser(userProfile);
  return res.json(result);
});

// POST /career-report — generate occupation-aware report with user profile
router.post('/career-report', careerReportLimiter, async (req: Request, res: Response) => {
  const parseResult = CareerReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
  }

  const { sessionId, userProfile, gameResults } = parseResult.data;

  const db = getDb();
  const rows = db
    .prepare('SELECT game_id, event_type, timestamp, data FROM events WHERE session_id = ?')
    .all(sessionId) as Array<{ game_id: string; event_type: string; timestamp: number; data: string }>;

  const events = rows.map(r => ({
    game_id: r.game_id,
    event_type: r.event_type,
    timestamp: r.timestamp,
    data: JSON.parse(r.data),
  }));

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
});

export default router;
