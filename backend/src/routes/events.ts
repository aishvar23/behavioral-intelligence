import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { calculateTraits } from '../services/traitEngine';
import { generateBehaviorReport } from '../services/llmAnalysis';

const router = Router();

// POST /event — log a single game event
router.post('/event', (req: Request, res: Response) => {
  const { sessionId, gameId, eventType, timestamp, data } = req.body;

  if (!sessionId || !gameId || !eventType || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO events (session_id, game_id, event_type, timestamp, data)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, gameId, eventType, timestamp, JSON.stringify(data ?? {}));

  return res.status(201).json({ ok: true });
});

// GET /report/:sessionId — compute traits + generate LLM report
router.get('/report/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const db = getDb();

  // Return cached report if available
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

  // Fetch all events for this session
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
    // Continue with fallback text
  }

  // Cache the report
  db.prepare(
    `INSERT OR REPLACE INTO reports (session_id, traits, ai_report, thinking_style, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, JSON.stringify(traits), aiReport, thinkingStyle, Date.now());

  return res.json({ traits, aiReport, thinkingStyle });
});

export default router;
