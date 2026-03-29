/**
 * Cognitive Mirror — Assessment Routes
 *
 * POST /assessment/discover-traits   — profession → LLM → top 5 traits
 * POST /assessment/start             — create assessment session in DB
 * POST /assessment/baseline          — store calibration data
 * POST /assessment/level-result      — store one level's result
 * POST /assessment/trait-talk        — run conflict validation
 * POST /assessment/archetype         — generate final Archetype Card
 * GET  /assessment/history           — authenticated user's past assessments
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  createAssessmentSession,
  getAssessmentSession,
  updateAssessmentBaseline,
  completeAssessmentSession,
  saveLevelResult,
  getLevelResults,
  getAssessmentHistory,
} from '../db/database';
import { discoverTraitsForProfession, generateArchetypeReport, TraitResult } from '../services/llmAnalysis';
import { runTraitTalk } from '../services/traitTalk';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

const discoverLimiter  = rateLimit({ windowMs: 60_000, max: 10 });
const archetypeLimiter = rateLimit({ windowMs: 60_000, max: 5  });

// ── Schemas ───────────────────────────────────────────────────────────────────

const DiscoverTraitsSchema = z.object({
  profession: z.string().min(2).max(100),
  sessionId:  z.string().uuid(),
});

const StartSessionSchema = z.object({
  sessionId:  z.string().uuid(),
  profession: z.string().min(2).max(100),
  traitsJson: z.string(),
  userId:     z.number().int().positive().optional(),
});

const BaselineSchema = z.object({
  sessionId:     z.string().uuid(),
  baselineRtMs:  z.number().positive(),
  baselineDeviceMs: z.number().positive(),
});

const LevelResultSchema = z.object({
  sessionId:      z.string().uuid(),
  traitId:        z.string(),
  level:          z.number().int().min(1).max(10),
  score:          z.number().min(0).max(100),
  accuracy:       z.number().min(0).max(1),
  avgLatencyMs:   z.number().min(0),
  outcome:        z.enum(['continue', 'skip', 'ceiling', 'complete']),
  levelConfigJson: z.string(),
});

const TraitTalkSchema = z.object({
  sessionId: z.string().uuid(),
  scores:    z.record(z.string(), z.number()),
});

const ArchetypeSchema = z.object({
  sessionId:    z.string().uuid(),
  profession:   z.string(),
  traitResults: z.array(z.object({
    traitId:   z.string(),
    traitName: z.string(),
    isPrimary: z.boolean(),
    peakLevel: z.number(),
    peakScore: z.number(),
    avgScore:  z.number(),
    outcome:   z.string(),
    scores:    z.array(z.number()),
  })),
  traitTalk: z.object({
    flags:              z.array(z.object({ flag: z.string(), description: z.string(), severity: z.string() })),
    archetypeModifiers: z.array(z.string()),
    validationPassed:   z.boolean(),
  }),
});

// ── POST /assessment/discover-traits ─────────────────────────────────────────

router.post('/assessment/discover-traits', discoverLimiter, async (req, res) => {
  const parse = DiscoverTraitsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const { profession, sessionId } = parse.data;
  try {
    const traits = await discoverTraitsForProfession(profession, sessionId);
    return res.json({ traits });
  } catch (err) {
    console.error('[discover-traits]', err);
    return res.status(500).json({ error: 'Trait discovery failed' });
  }
});

// ── POST /assessment/start ────────────────────────────────────────────────────

router.post('/assessment/start', (req, res) => {
  const parse = StartSessionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const { sessionId, profession, traitsJson, userId } = parse.data;
  try {
    const session = createAssessmentSession(sessionId, userId ?? null, profession, traitsJson);
    return res.json({ sessionId: session.sessionId, status: session.status });
  } catch (err: any) {
    // Idempotency: if session already exists return it rather than erroring
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const existing = getAssessmentSession(sessionId);
      if (existing) return res.json({ sessionId: existing.sessionId, status: existing.status });
    }
    console.error('[assessment/start]', err);
    return res.status(500).json({ error: 'Failed to start assessment session' });
  }
});

// ── POST /assessment/baseline ─────────────────────────────────────────────────

router.post('/assessment/baseline', (req, res) => {
  const parse = BaselineSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const { sessionId, baselineRtMs, baselineDeviceMs } = parse.data;
  try {
    updateAssessmentBaseline(sessionId, baselineRtMs, baselineDeviceMs);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[assessment/baseline]', err);
    return res.status(500).json({ error: 'Failed to save baseline' });
  }
});

// ── POST /assessment/level-result ─────────────────────────────────────────────

router.post('/assessment/level-result', (req, res) => {
  const parse = LevelResultSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  try {
    saveLevelResult(parse.data);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[assessment/level-result]', err);
    return res.status(500).json({ error: 'Failed to save level result' });
  }
});

// ── POST /assessment/trait-talk ───────────────────────────────────────────────

router.post('/assessment/trait-talk', (req, res) => {
  const parse = TraitTalkSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  try {
    const result = runTraitTalk(parse.data.scores);
    return res.json(result);
  } catch (err) {
    console.error('[assessment/trait-talk]', err);
    return res.status(500).json({ error: 'Trait talk failed' });
  }
});

// ── POST /assessment/archetype ────────────────────────────────────────────────

router.post('/assessment/archetype', archetypeLimiter, async (req, res) => {
  const parse = ArchetypeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

  const { sessionId, profession, traitResults, traitTalk } = parse.data;

  try {
    const session = getAssessmentSession(sessionId);
    const baselineRtMs = session?.baselineRtMs ?? null;

    const archetype = await generateArchetypeReport(
      profession,
      traitResults as TraitResult[],
      traitTalk,
      sessionId,
      baselineRtMs,
    );

    completeAssessmentSession(sessionId, JSON.stringify(archetype));
    return res.json(archetype);
  } catch (err) {
    console.error('[assessment/archetype]', err);
    return res.status(500).json({ error: 'Archetype generation failed' });
  }
});

// ── GET /assessment/history ───────────────────────────────────────────────────

router.get('/assessment/history', authenticateJWT, (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const history = getAssessmentHistory(userId, 10);
    return res.json({ history });
  } catch (err) {
    console.error('[assessment/history]', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
