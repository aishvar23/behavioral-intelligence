// Mock heavy dependencies before imports
jest.mock('../db/database');
jest.mock('../services/llmAnalysis');

import request from 'supertest';
import express from 'express';
import router from './events';
import { getDb } from '../db/database';
import { generateBehaviorReport, generateCareerReport } from '../services/llmAnalysis';

// ─── DB mock helpers ──────────────────────────────────────────────────────────
// db.prepare(sql) returns a statement object with run/get/all.
// We need separate prepared-statement mocks so we can configure return values
// per query in individual tests.

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn().mockReturnValue(undefined);
const mockAll = jest.fn().mockReturnValue([]);

const mockStatement = {
  run: mockRun,
  get: mockGet,
  all: mockAll,
};

const mockDb = {
  prepare: jest.fn().mockReturnValue(mockStatement),
};

(getDb as jest.Mock).mockReturnValue(mockDb);

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', router);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDbRow(gameId: string, eventType: string, data: Record<string, unknown> = {}) {
  return {
    game_id: gameId,
    event_type: eventType,
    timestamp: Date.now(),
    data: JSON.stringify(data),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply default returns after clearing
  mockDb.prepare.mockReturnValue(mockStatement);
  mockRun.mockReturnValue({ changes: 1 });
  mockGet.mockReturnValue(undefined);
  mockAll.mockReturnValue([]);
  (getDb as jest.Mock).mockReturnValue(mockDb);
});

// ─── POST /event ──────────────────────────────────────────────────────────────

describe('POST /event', () => {
  it('returns 201 on happy path', async () => {
    const res = await request(app)
      .post('/event')
      .send({
        sessionId: 'sess-1',
        gameId: 'exploration',
        eventType: 'move',
        timestamp: Date.now(),
        data: { tileType: 'grass' },
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events')
    );
    expect(mockRun).toHaveBeenCalledWith(
      'sess-1',
      'exploration',
      'move',
      expect.any(Number),
      JSON.stringify({ tileType: 'grass' })
    );
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/event')
      .send({ gameId: 'exploration', eventType: 'move', timestamp: Date.now() });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when gameId is missing', async () => {
    const res = await request(app)
      .post('/event')
      .send({ sessionId: 'sess-1', eventType: 'move', timestamp: Date.now() });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when eventType is missing', async () => {
    const res = await request(app)
      .post('/event')
      .send({ sessionId: 'sess-1', gameId: 'exploration', timestamp: Date.now() });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when timestamp is missing', async () => {
    const res = await request(app)
      .post('/event')
      .send({ sessionId: 'sess-1', gameId: 'exploration', eventType: 'move' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('stores empty object when data is not provided', async () => {
    const res = await request(app)
      .post('/event')
      .send({ sessionId: 'sess-2', gameId: 'puzzle', eventType: 'quit', timestamp: 12345 });

    expect(res.status).toBe(201);
    expect(mockRun).toHaveBeenCalledWith('sess-2', 'puzzle', 'quit', 12345, '{}');
  });
});

// ─── GET /report/:sessionId ───────────────────────────────────────────────────

describe('GET /report/:sessionId', () => {
  it('returns 404 when no events found for session', async () => {
    // get() → no cached report; all() → no events
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);

    const res = await request(app).get('/report/unknown-session');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'No events found for session');
  });

  it('returns cached report when one exists in db', async () => {
    const cachedReport = {
      traits: JSON.stringify({ curiosity: 0.8, persistence: 0.6, risk_tolerance: 0.4, learning_speed: 0.7 }),
      ai_report: 'Cached behavioral analysis.',
      thinking_style: 'Strategic and deliberate thinker.',
    };

    // First prepare().get() call returns the cached report
    mockGet.mockReturnValue(cachedReport);

    const res = await request(app).get('/report/cached-session');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      traits: { curiosity: 0.8, persistence: 0.6, risk_tolerance: 0.4, learning_speed: 0.7 },
      aiReport: 'Cached behavioral analysis.',
      thinkingStyle: 'Strategic and deliberate thinker.',
    });
    // Should not call generateBehaviorReport when using cache
    expect(generateBehaviorReport).not.toHaveBeenCalled();
  });

  it('returns traits and report when events are present', async () => {
    mockGet.mockReturnValue(undefined); // no cache

    const events = [
      makeDbRow('exploration', 'move', { explorationPct: 0.6 }),
      makeDbRow('puzzle', 'solved', {}),
      makeDbRow('exploration', 'move', { tileType: 'trap' }),
    ];
    mockAll.mockReturnValue(events);

    (generateBehaviorReport as jest.Mock).mockResolvedValue({
      aiReport: 'You are highly curious.',
      thinkingStyle: 'Exploratory thinker.',
    });

    const res = await request(app).get('/report/active-session');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('traits');
    expect(res.body).toHaveProperty('aiReport', 'You are highly curious.');
    expect(res.body).toHaveProperty('thinkingStyle', 'Exploratory thinker.');
    expect(res.body.traits).toHaveProperty('curiosity');
    expect(res.body.traits).toHaveProperty('persistence');
    expect(res.body.traits).toHaveProperty('risk_tolerance');
    expect(res.body.traits).toHaveProperty('learning_speed');
    expect(generateBehaviorReport).toHaveBeenCalledTimes(1);
  });

  it('returns fallback text when LLM throws an error', async () => {
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([
      makeDbRow('exploration', 'move', { explorationPct: 0.3 }),
    ]);

    (generateBehaviorReport as jest.Mock).mockRejectedValue(new Error('LLM unavailable'));

    const res = await request(app).get('/report/llm-fail-session');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('traits');
    // Falls back to hardcoded strings
    expect(res.body).toHaveProperty('aiReport', 'Behavioral analysis complete.');
    expect(res.body).toHaveProperty('thinkingStyle', 'Analytical and adaptive thinker.');
  });

  it('caches the generated report after computing it', async () => {
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([makeDbRow('exploration', 'move', { explorationPct: 0.5 })]);

    (generateBehaviorReport as jest.Mock).mockResolvedValue({
      aiReport: 'New report.',
      thinkingStyle: 'Curious thinker.',
    });

    await request(app).get('/report/new-session');

    // Should have called prepare with the INSERT OR REPLACE for caching
    const prepareCalls: string[] = mockDb.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(prepareCalls.some(sql => sql.includes('INSERT OR REPLACE INTO reports'))).toBe(true);
  });
});

// ─── POST /career-report ─────────────────────────────────────────────────────

const mockUserProfile = {
  age: '25',
  occupation: 'software_engineer',
  occupationTitle: 'Software Engineer',
  occupationEmoji: '💻',
  interests: 'Machine learning',
};

const mockGameResults = [
  { configId: 'logic_deduction', gameType: 'logic', title: 'Logic Deduction', emoji: '🔎', score: 85 },
  { configId: 'pattern_advanced', gameType: 'pattern', title: 'Advanced Patterns', emoji: '🔮', score: 70 },
  { configId: 'memory_numbers', gameType: 'memory', title: 'Number Recall', emoji: '🔢', score: 60 },
];

describe('POST /career-report', () => {
  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/career-report')
      .send({ userProfile: mockUserProfile, gameResults: mockGameResults });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when userProfile is missing', async () => {
    const res = await request(app)
      .post('/career-report')
      .send({ sessionId: 'sess-1', gameResults: mockGameResults });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when gameResults is missing', async () => {
    const res = await request(app)
      .post('/career-report')
      .send({ sessionId: 'sess-1', userProfile: mockUserProfile });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns full career report on valid request', async () => {
    mockAll.mockReturnValue([
      makeDbRow('logic_deduction', 'question_answer', { correct: true, timeSpent: 10 }),
      makeDbRow('pattern_advanced', 'correct_guess', { adaptationRound: 2 }),
    ]);

    const cannedResult = {
      thinkingStyle: 'Methodical and exploratory thinker.',
      aiReport: 'Detailed behavioral profile here.',
      occupationFit: { occupation: 'Software Engineer', rating: 'excellent', summary: 'Great fit.' },
      aiRecommendedCareers: [
        { career: 'AI/ML Engineer', rating: 'highly_recommended', reason: 'Strong analytical skills.' },
      ],
    };
    (generateCareerReport as jest.Mock).mockResolvedValue(cannedResult);

    const res = await request(app)
      .post('/career-report')
      .send({ sessionId: 'sess-career', userProfile: mockUserProfile, gameResults: mockGameResults });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('traits');
    expect(res.body).toHaveProperty('gameResults');
    expect(res.body).toHaveProperty('thinkingStyle', 'Methodical and exploratory thinker.');
    expect(res.body).toHaveProperty('aiReport', 'Detailed behavioral profile here.');
    expect(res.body).toHaveProperty('occupationFit');
    expect(res.body.occupationFit).toHaveProperty('rating', 'excellent');
    expect(res.body).toHaveProperty('aiRecommendedCareers');
    expect(res.body.aiRecommendedCareers).toHaveLength(1);
  });

  it('returns 500 when generateCareerReport throws', async () => {
    mockAll.mockReturnValue([makeDbRow('exploration', 'move', { explorationPct: 0.5 })]);

    (generateCareerReport as jest.Mock).mockRejectedValue(new Error('LLM down'));

    const res = await request(app)
      .post('/career-report')
      .send({ sessionId: 'sess-fail', userProfile: mockUserProfile, gameResults: mockGameResults });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Failed to generate career report');
  });

  it('passes traits and userProfile to generateCareerReport', async () => {
    mockAll.mockReturnValue([
      makeDbRow('exploration', 'move', { explorationPct: 0.6 }),
    ]);

    (generateCareerReport as jest.Mock).mockResolvedValue({
      thinkingStyle: 'Test style.',
      aiReport: 'Test report.',
      occupationFit: { occupation: 'Software Engineer', rating: 'good', summary: 'Good fit.' },
      aiRecommendedCareers: [],
    });

    await request(app)
      .post('/career-report')
      .send({ sessionId: 'sess-traits', userProfile: mockUserProfile, gameResults: mockGameResults });

    expect(generateCareerReport).toHaveBeenCalledWith(
      expect.objectContaining({ curiosity: 1.0 }),  // 0.6/0.6 = 1.0
      mockUserProfile,
      mockGameResults
    );
  });
});
