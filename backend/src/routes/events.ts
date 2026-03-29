import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getDb, getPgPool, isPostgres, getUserTraitHistory, saveUserTraitHistory, getAllLatestTraitsExcluding } from '../db/database';
import { calculateTraits, TraitScores, TrialRecord } from '../services/traitEngine';
import { generateBehaviorReport, generateCareerReport, selectGamesForUser, TraitHistoryEntry } from '../services/llmAnalysis';
import { extractStructuredBehaviorData } from '../services/behavioralSignals';
import { authenticateJWT } from '../middleware/auth';
import { startSession, endSession } from '../services/auth';

const router = Router();

// Rate limiters
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const trialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
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

const TrialSchema = z.object({
  sessionId:       z.string().uuid(),
  gameId:          z.string(),
  gameVariant:     z.string().nullable().optional(),
  trialIndex:      z.number().int().min(0),
  difficulty:      z.string().default('normal'),
  stimulus:        z.record(z.unknown()),
  response:        z.record(z.unknown()),
  isCorrect:       z.boolean(),
  responseError:   z.number().min(0).max(1).default(0),
  responseTimeMs:  z.number().int().min(0).default(0),
  timeoutExtended: z.boolean().default(false),
  skipped:         z.boolean().default(false),
});

const GamePlaySchema = z.object({
  sessionId:        z.string().uuid(),
  gameId:           z.string(),
  gameVariant:      z.string().nullable().optional(),
  difficultyAdapted:z.string().nullable().optional(),
  strategyJson:     z.record(z.unknown()).nullable().optional(),
  startedAt:        z.number().int(),
  endedAt:          z.number().int().nullable().optional(),
});

const CareerReportSchema = z.object({
  sessionId: z.string().uuid(),
  userId:    z.number().int().positive().optional(),
  flowType:  z.enum(['employed', 'career_guidance']).optional(),
  userProfile: z.object({
    age:              z.string(),
    occupations:      z.array(z.string()),
    occupationTitles: z.array(z.string()),
    occupationEmojis: z.array(z.string()),
    interests:        z.string(),
    ageRange:         z.string().optional(),
    gender:           z.string().optional(),
    employmentStatus: z.string().optional(),
    flowType:         z.enum(['employed', 'career_guidance']).optional(),
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

// ── Trait percentile computation ──────────────────────────────────────────────
const TRAIT_KEYS: (keyof TraitScores)[] = [
  'curiosity', 'persistence', 'risk_tolerance', 'learning_speed',
  'working_memory', 'processing_speed', 'impulse_control',
  'analytical_thinking', 'attention_to_detail', 'systematic_thinking',
];

/**
 * For each trait in `userTraits`, returns a percentile (0–100) representing
 * what fraction of `otherTraitsJson` entries scored strictly below this user.
 * Returns null percentiles when the pool is too small (<3 other users).
 */
function computeTraitPercentiles(
  userTraits: TraitScores,
  otherTraitsJson: string[]
): Record<string, number | null> {
  const pool = otherTraitsJson
    .map(j => { try { return JSON.parse(j) as TraitScores; } catch { return null; } })
    .filter((t): t is TraitScores => t !== null);

  const result: Record<string, number | null> = {};
  for (const key of TRAIT_KEYS) {
    if (pool.length < 3) {
      result[key] = null; // not enough data
    } else {
      const userVal = userTraits[key] ?? 0;
      const below = pool.filter(t => (t[key] ?? 0) < userVal).length;
      result[key] = Math.round((below / pool.length) * 100);
    }
  }
  return result;
}

// Helper: fetch TrialRecord[] for a session from SQLite
function getTrialsForSession(sessionId: string): TrialRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM trials WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId) as Array<{
      game_id: string; game_variant: string | null; trial_index: number;
      difficulty: string; stimulus_json: string; response_json: string;
      is_correct: number; response_error: number; response_time_ms: number;
      timeout_extended: number; skipped: number;
    }>;
  return rows.map(r => ({
    game_id:         r.game_id,
    game_variant:    r.game_variant,
    trial_index:     r.trial_index,
    difficulty:      r.difficulty,
    stimulus:        JSON.parse(r.stimulus_json),
    response:        JSON.parse(r.response_json),
    is_correct:      r.is_correct === 1,
    response_error:  r.response_error,
    response_time_ms:r.response_time_ms,
    timeout_extended:r.timeout_extended === 1,
    skipped:         r.skipped === 1,
  }));
}

// Helper: fetch TrialRecord[] for a session from Postgres
async function getTrialsForSessionPg(sessionId: string): Promise<TrialRecord[]> {
  const pool = getPgPool();
  const result = await pool.query(
    'SELECT * FROM trials WHERE session_id = $1 ORDER BY id ASC',
    [sessionId]
  );
  return result.rows.map((r: {
    game_id: string; game_variant: string | null; trial_index: number;
    difficulty: string; stimulus_json: string; response_json: string;
    is_correct: boolean | number; response_error: number; response_time_ms: number;
    timeout_extended: boolean | number; skipped: boolean | number;
  }) => ({
    game_id:         r.game_id,
    game_variant:    r.game_variant,
    trial_index:     r.trial_index,
    difficulty:      r.difficulty,
    stimulus:        typeof r.stimulus_json === 'string' ? JSON.parse(r.stimulus_json) : r.stimulus_json,
    response:        typeof r.response_json === 'string' ? JSON.parse(r.response_json) : r.response_json,
    is_correct:      Boolean(r.is_correct),
    response_error:  r.response_error,
    response_time_ms:r.response_time_ms,
    timeout_extended:Boolean(r.timeout_extended),
    skipped:         Boolean(r.skipped),
  }));
}

// POST /event — log a single game event (legacy, kept for backward compat)
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

// POST /trial — log a single trial (one round/question, ML-ready)
router.post('/trial', trialLimiter, async (req: Request, res: Response) => {
  try {
    const result = TrialSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    }

    const {
      sessionId, gameId, gameVariant, trialIndex, difficulty,
      stimulus, response, isCorrect, responseError, responseTimeMs,
      timeoutExtended, skipped,
    } = result.data;

    const now = Date.now();

    if (isPostgres()) {
      const pool = getPgPool();
      const countResult = await pool.query(
        'SELECT COUNT(*) AS count FROM trials WHERE session_id = $1',
        [sessionId]
      );
      if (parseInt(countResult.rows[0].count, 10) >= 200) {
        return res.status(429).json({ error: 'Session trial limit reached' });
      }
      await pool.query(
        `INSERT INTO trials
           (session_id, game_id, game_variant, trial_index, difficulty,
            stimulus_json, response_json, is_correct, response_error,
            response_time_ms, timeout_extended, skipped, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [sessionId, gameId, gameVariant ?? null, trialIndex, difficulty,
         JSON.stringify(stimulus), JSON.stringify(response),
         isCorrect ? 1 : 0, responseError, responseTimeMs,
         timeoutExtended ? 1 : 0, skipped ? 1 : 0, now]
      );
    } else {
      const db = getDb();
      const countRow = db
        .prepare('SELECT COUNT(*) as count FROM trials WHERE session_id = ?')
        .get(sessionId) as { count: number };
      if (countRow.count >= 200) {
        return res.status(429).json({ error: 'Session trial limit reached' });
      }
      db.prepare(
        `INSERT INTO trials
           (session_id, game_id, game_variant, trial_index, difficulty,
            stimulus_json, response_json, is_correct, response_error,
            response_time_ms, timeout_extended, skipped, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        sessionId, gameId, gameVariant ?? null, trialIndex, difficulty,
        JSON.stringify(stimulus), JSON.stringify(response),
        isCorrect ? 1 : 0, responseError, responseTimeMs,
        timeoutExtended ? 1 : 0, skipped ? 1 : 0, now
      );
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /trial error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /game-play — log one completed game play (strategy signals + timing)
router.post('/game-play', async (req: Request, res: Response) => {
  try {
    const result = GamePlaySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    }

    const { sessionId, gameId, gameVariant, difficultyAdapted, strategyJson, startedAt, endedAt } = result.data;
    const now = Date.now();

    if (isPostgres()) {
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO game_plays
           (session_id, game_id, game_variant, difficulty_adapted, strategy_json, started_at, ended_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [sessionId, gameId, gameVariant ?? null, difficultyAdapted ?? null,
         strategyJson ? JSON.stringify(strategyJson) : null,
         startedAt, endedAt ?? null, now]
      );
    } else {
      const db = getDb();
      db.prepare(
        `INSERT INTO game_plays
           (session_id, game_id, game_variant, difficulty_adapted, strategy_json, started_at, ended_at, created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      ).run(
        sessionId, gameId, gameVariant ?? null, difficultyAdapted ?? null,
        strategyJson ? JSON.stringify(strategyJson) : null,
        startedAt, endedAt ?? null, now
      );
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /game-play error:', err);
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

    const trialRecords = await getTrialsForSessionPg(sessionId);

    if (trialRecords.length === 0) {
      return res.status(404).json({ error: 'No trials found for session' });
    }

    const traits = calculateTraits(trialRecords);

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

    const trialRecords = getTrialsForSession(sessionId);

    if (trialRecords.length === 0) {
      return res.status(404).json({ error: 'No trials found for session' });
    }

    const traits = calculateTraits(trialRecords);

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
router.post('/select-games', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { userProfile, pool, userId: bodyUserId, sessionId } = req.body;
    if (!userProfile || !Array.isArray(userProfile.occupationTitles) || userProfile.occupationTitles.length === 0) {
      return res.status(400).json({ error: 'Missing userProfile' });
    }

    // Prefer token-authenticated userId, fall back to body userId for backward compat
    const userId = req.userId ?? (bodyUserId ? Number(bodyUserId) : undefined);

    // Load most recent trait scores for adaptive difficulty selection
    let previousTraits: TraitScores | undefined;
    if (userId) {
      try {
        const history = getUserTraitHistory(userId, 1);
        if (history.length > 0) {
          previousTraits = JSON.parse(history[0].traitsJson) as TraitScores;
        }
      } catch { /* non-fatal */ }
    }

    const result = await selectGamesForUser(userProfile, Array.isArray(pool) ? pool : undefined, previousTraits);

    // Register the session now that games have been selected
    if (sessionId && typeof sessionId === 'string') {
      try {
        startSession(sessionId, userId);
      } catch { /* non-fatal */ }
    }

    return res.json(result);
  } catch (err) {
    console.error('POST /select-games error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /career-report — generate occupation-aware report with user profile
router.post('/career-report', careerReportLimiter, authenticateJWT, async (req: Request, res: Response) => {
  try {
  const parseResult = CareerReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.issues });
  }

  const { sessionId, userId: bodyUserId, userProfile, gameResults, flowType: bodyFlowType } = parseResult.data;
  // Prefer token-authenticated userId, fall back to body userId for backward compat
  const userId = req.userId ?? bodyUserId;
  // Resolve flowType: body top-level > userProfile field > default
  const flowType: 'employed' | 'career_guidance' =
    bodyFlowType ?? userProfile.flowType ?? 'career_guidance';

  // ── Cache check ────────────────────────────────────────────────────────────
  if (isPostgres()) {
    const pool = getPgPool();
    const cached = await pool.query(
      'SELECT career_report FROM reports WHERE session_id = $1 AND career_report IS NOT NULL',
      [sessionId]
    );
    if (cached.rows.length > 0) {
      return res.json(cached.rows[0].career_report);
    }
  } else {
    const db = getDb();
    const cached = db
      .prepare('SELECT career_report FROM reports WHERE session_id = ? AND career_report IS NOT NULL')
      .get(sessionId) as { career_report: string } | undefined;
    if (cached) {
      return res.json(JSON.parse(cached.career_report));
    }
  }

  // ── Fetch trials ───────────────────────────────────────────────────────────
  let trialRecords: TrialRecord[];

  if (isPostgres()) {
    trialRecords = await getTrialsForSessionPg(sessionId);
  } else {
    trialRecords = getTrialsForSession(sessionId);
  }

  const traits = calculateTraits(trialRecords);
  const gameBehaviorData = extractStructuredBehaviorData(trialRecords, gameResults);

  // ── Fetch trait history for returning users ─────────────────────────────
  let traitHistory: TraitHistoryEntry[] | undefined;
  if (userId) {
    try {
      const historyRows = getUserTraitHistory(userId);
      if (historyRows.length > 0) {
        traitHistory = historyRows.map(r => ({
          traits: JSON.parse(r.traitsJson) as TraitScores,
          occupation: r.occupation,
          createdAt: r.createdAt,
        }));
      }
    } catch (err) {
      console.error('Failed to load trait history:', err);
    }
  }

  // ── Trait percentiles (compare against all other users) ──────────────────
  let traitPercentiles: Record<string, number | null> = {};
  if (userId) {
    try {
      const otherTraitsJson = getAllLatestTraitsExcluding(userId);
      traitPercentiles = computeTraitPercentiles(traits, otherTraitsJson);
    } catch (err) {
      console.error('Percentile computation failed:', err);
    }
  }

  try {
    const llmResult = await generateCareerReport(traits, userProfile, gameResults, gameBehaviorData, sessionId, traitHistory, flowType);
    const response = {
      traits,
      gameResults,
      traitPercentiles,
      thinkingStyle: llmResult.thinkingStyle,
      aiReport: llmResult.aiReport,
      progressSummary: llmResult.progressSummary,
      occupationFit: llmResult.occupationFit,
      aiRecommendedCareers: llmResult.aiRecommendedCareers,
      observations: llmResult.observations,
      skillDevelopment: llmResult.skillDevelopment,
    };

    // ── Store full report for caching ─────────────────────────────────────
    if (isPostgres()) {
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO reports (session_id, traits, ai_report, thinking_style, career_report, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id) DO UPDATE
           SET career_report = EXCLUDED.career_report, created_at = EXCLUDED.created_at`,
        [sessionId, traits, llmResult.aiReport, llmResult.thinkingStyle, response, Date.now()]
      );
    } else {
      const db = getDb();
      db.prepare(
        `INSERT OR REPLACE INTO reports (session_id, traits, ai_report, thinking_style, career_report, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(sessionId, JSON.stringify(traits), llmResult.aiReport, llmResult.thinkingStyle, JSON.stringify(response), Date.now());
    }

    // ── Persist trait history for returning user context ──────────────────
    if (userId) {
      try {
        saveUserTraitHistory(
          userId,
          sessionId,
          JSON.stringify(traits),
          JSON.stringify(gameResults),
          userProfile.occupationTitles.join(', '),
          flowType
        );
      } catch (err) {
        console.error('Failed to save trait history:', err);
      }
    }

    // ── Mark session as completed ─────────────────────────────────────────
    try {
      endSession(sessionId, 'completed');
    } catch { /* non-fatal */ }

    return res.json(response);
  } catch (err) {
    console.error('Career report failed:', err);
    return res.status(500).json({ error: 'Failed to generate career report' });
  }
  } catch (err) {
    console.error('POST /career-report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /user-history — return past sessions + current percentile rankings
router.get('/user-history', authenticateJWT, (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT session_id, traits_json, game_results_json, occupation, created_at
      FROM user_trait_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId) as Array<{
      session_id: string;
      traits_json: string;
      game_results_json: string;
      occupation: string;
      created_at: number;
    }>;

    const history = rows.map(r => ({
      sessionId:    r.session_id,
      traits:       JSON.parse(r.traits_json),
      gameResults:  JSON.parse(r.game_results_json),
      occupation:   r.occupation,
      createdAt:    r.created_at,
    }));

    // Compute current percentiles for the most recent session
    let currentPercentiles: Record<string, number | null> = {};
    if (history.length > 0) {
      try {
        const otherTraitsJson = getAllLatestTraitsExcluding(userId);
        currentPercentiles = computeTraitPercentiles(history[0].traits as TraitScores, otherTraitsJson);
      } catch { /* non-fatal */ }
    }

    return res.json({ history, currentPercentiles });
  } catch (err) {
    console.error('GET /user-history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
