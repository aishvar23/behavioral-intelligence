import Anthropic from '@anthropic-ai/sdk';
import { TraitScores } from './traitEngine';
import { GameBehaviorData } from './behavioralSignals';
import { logLlmCall } from '../db/database';

// Claude Sonnet 4.6 pricing (per million tokens)
const INPUT_COST_PER_M  = 3.0;
const OUTPUT_COST_PER_M = 15.0;

function calcCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  throw lastErr;
}

const LLM_TIMEOUT_MS = 15_000;

export interface UserProfile {
  age: string;
  occupation: string;
  occupationTitle: string;
  occupationEmoji: string;
  interests: string;
}

export interface GameResult {
  configId: string;
  gameType: string;
  title: string;
  emoji: string;
  score: number;
}

export interface CareerRecommendation {
  career: string;
  rating: 'highly_recommended' | 'recommended' | 'neutral' | 'not_recommended';
  reason: string;
}

export interface OccupationFit {
  occupation: string;
  rating: 'excellent' | 'good' | 'moderate' | 'low';
  summary: string;
}

export interface GameObservation {
  game: string;
  observation: string;
  relevance: string;
}

export interface SkillDevelopment {
  skill: string;
  activities: string[];
}

export interface TraitHistoryEntry {
  traits: TraitScores;
  occupation: string;
  createdAt: number;
}

export interface FullLLMResult {
  thinkingStyle: string;
  aiReport: string;
  progressSummary?: string;
  occupationFit: OccupationFit;
  aiRecommendedCareers: CareerRecommendation[];
  observations: GameObservation[];
  skillDevelopment: SkillDevelopment[];
}

export interface LLMResult {
  aiReport: string;
  thinkingStyle: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Game Catalog (kept in sync with mobile/src/data/gameCatalog.ts) ───────────
// Full 36-game catalog used as context in the report prompt.
// For game selection, a focused per-occupation subset is passed instead.
const GAME_CATALOG_FOR_LLM = `
NOTE: Select games based on the COGNITIVE TRAITS required for the occupation (curiosity, precision, memory, analytical thinking, spatial reasoning, speed) — not on job-specific knowledge. All games use abstract content anyone can attempt.

Available assessment games (across 6 types):

EXPLORATION — measures curiosity, risk tolerance, strategic navigation:
  exploration_standard  | "Exploration Island"     | 8×8 fog grid, 30 moves. Rewards + traps.
  exploration_cautious  | "Risk Zone"              | Dense trap field. High-stakes risk decisions.
  exploration_open      | "Discovery Expedition"   | Reward-rich terrain. Curiosity and persistence.
  exploration_data      | "Data Landscape"         | Clustered reward patterns. Data-driven exploration.
  exploration_resource  | "Resource Optimizer"     | Tight move budget. Maximise resource collection.
  exploration_systematic| "Systematic Survey"      | Coverage bonus. Rewards methodical grid exploration.

PATTERN RECOGNITION — measures analytical thinking, learning speed, adaptability:
  pattern_standard      | "Pattern Detective"      | Decode number sequences, 9 rounds (easy→hard).
  pattern_advanced      | "Advanced Patterns"      | Starts at medium difficulty. Harder analytics.
  pattern_logic         | "Logic Sequences"        | Complex multi-step sequences. Deep analysis.
  pattern_financial     | "Market Signals"         | Financial-style numerical trends. Quantitative reasoning.
  pattern_adaptive      | "Adaptive Decode"        | Frequent rule shifts. Rapid re-calibration under change.
  pattern_creative      | "Open Sequences"         | Open-ended patterns. Lateral and creative thinking.

PUZZLE SOLVING — measures problem-solving, persistence, strategic planning:
  puzzle_standard       | "Impossible Puzzle"      | Sliding tile puzzle, 3 hints available.
  puzzle_pressure       | "Pressure Puzzle"        | Only 1 hint. High persistence requirement.
  puzzle_strategic      | "Strategic Puzzle"       | Move-efficiency scoring. Strategic planning.
  puzzle_collaborative  | "Team Solve"             | Hints freely available. Collaboration mindset.
  puzzle_precise        | "Precision Assembly"     | Exact moves required. Zero tolerance for error.
  puzzle_analytical     | "Analytical Deconstruct" | Move history shown. Deliberate, methodical solving.

MEMORY — measures working memory, spatial recall, numerical retention:
  memory_colors         | "Color Memory"           | Recall colour sequences. Visual/spatial memory.
  memory_numbers        | "Number Recall"          | Recall number sequences. Numerical working memory.
  memory_positions      | "Spatial Memory"         | Recall grid positions. Spatial/positional memory.
  memory_sequential     | "Procedure Recall"       | Ordered step sequences. Procedural memory under load.
  memory_faces          | "Name & Context"         | Associate names with faces. Social/associative memory.
  memory_code           | "Code Recall"            | Symbolic/code-like patterns. Abstract working memory.

VERBAL / SITUATIONAL REASONING — measures judgment, verbal reasoning (text-based MCQ):
  logic_verbal       | "Word Logic"           | Verbal analogies, odd-one-out. Verbal reasoning.
  logic_situational  | "Situational Judgment" | Abstract judgment calls under ambiguity and constraint.

COGNITIVE INTERACTIVE GAMES — measures analytical thinking, impulse control, attention, spatial reasoning:
  stroop_classic       | "Color Conflict"     | Color word shown in mismatching ink — tap ink color. Impulse control + processing speed.
  matrix_standard      | "Pattern Matrix"     | 3×3 Raven-style grid, find the missing piece. Analytical thinking + learning speed.
  matrix_advanced      | "Advanced Matrix"    | Harder Raven-style matrices. Deep analytical reasoning.
  spatial_rotation     | "Mental Rotation"    | Pick the correctly rotated shape from 4 options. Spatial reasoning + systematic thinking.
  dot_estimation       | "Dot Sense"          | Flash two dot groups — tap the larger side. Numerical intuition + processing speed.
  visual_search_standard | "Symbol Hunt"      | 5×5 grid, find the odd-one-out symbols. Attention to detail + processing speed.
  visual_search_hard   | "Symbol Hunt Pro"    | Harder visual search with more similar pairs. High attention to detail.

REACTION & INHIBITION — measures processing speed, impulse control, focus:
  reaction_basic        | "Quick Tap"              | Tap on stimulus appearance. Pure reaction speed.
  reaction_inhibition   | "Stop & Go"              | Tap green, resist red. Impulse control + focus.
  reaction_speed        | "Speed Challenge"        | Multi-target rapid tap. Speed + accuracy.
  reaction_surgical     | "Precision Tap"          | Tiny targets. Accuracy weighted over speed.
  reaction_multitask    | "Dual Focus"             | Two simultaneous stimuli. Divided attention under load.
`;

// Per-game descriptions used to build focused pool catalogs for the LLM
const GAME_DESCRIPTIONS: Record<string, string> = {
  exploration_standard:   'EXPLORATION | "Exploration Island"      | 8×8 fog grid, 30 moves. Rewards + traps. Curiosity & risk.',
  exploration_cautious:   'EXPLORATION | "Risk Zone"               | Dense trap field. High-stakes risk decisions.',
  exploration_open:       'EXPLORATION | "Discovery Expedition"    | Reward-rich terrain. Curiosity and persistence.',
  exploration_data:       'EXPLORATION | "Data Landscape"          | Clustered rewards. Data-driven, pattern-seeking exploration.',
  exploration_resource:   'EXPLORATION | "Resource Optimizer"      | Tight move budget. Resource efficiency under constraint.',
  exploration_systematic: 'EXPLORATION | "Systematic Survey"       | Coverage bonus. Rewards methodical, thorough exploration.',
  pattern_standard:       'PATTERN     | "Pattern Detective"       | Number sequences, 9 rounds easy→hard. Analytical thinking.',
  pattern_advanced:       'PATTERN     | "Advanced Patterns"       | Medium-start difficulty. Deeper analytical reasoning.',
  pattern_logic:          'PATTERN     | "Logic Sequences"         | Complex multi-step sequences. Deep analysis.',
  pattern_financial:      'PATTERN     | "Market Signals"          | Financial-style trends. Quantitative pattern recognition.',
  pattern_adaptive:       'PATTERN     | "Adaptive Decode"         | Frequent rule shifts. Rapid re-calibration under change.',
  pattern_creative:       'PATTERN     | "Open Sequences"          | Open-ended patterns. Lateral and creative thinking.',
  puzzle_standard:        'PUZZLE      | "Impossible Puzzle"       | Sliding tile, 3 hints. Problem-solving & persistence.',
  puzzle_pressure:        'PUZZLE      | "Pressure Puzzle"         | Only 1 hint. High persistence requirement.',
  puzzle_strategic:       'PUZZLE      | "Strategic Puzzle"        | Move-efficiency scoring. Strategic planning.',
  puzzle_collaborative:   'PUZZLE      | "Team Solve"              | Hints freely available. Collaboration over brute-force.',
  puzzle_precise:         'PUZZLE      | "Precision Assembly"      | Exact moves required. Zero tolerance for error.',
  puzzle_analytical:      'PUZZLE      | "Analytical Deconstruct"  | Move history shown. Deliberate, methodical solving.',
  memory_colors:          'MEMORY      | "Color Memory"            | Colour sequences. Visual/spatial working memory.',
  memory_numbers:         'MEMORY      | "Number Recall"           | Number sequences. Numerical working memory.',
  memory_positions:       'MEMORY      | "Spatial Memory"          | Grid positions. Spatial/positional memory.',
  memory_sequential:      'MEMORY      | "Procedure Recall"        | Ordered steps. Procedural memory under load.',
  memory_faces:           'MEMORY      | "Name & Context"          | Name-face association. Social/associative memory.',
  memory_code:            'MEMORY      | "Code Recall"             | Symbolic patterns. Abstract working memory.',
  logic_verbal:            'LOGIC    | "Word Logic"              | Verbal analogies and odd-one-out. Verbal reasoning.',
  logic_situational:       'LOGIC    | "Situational Judgment"    | Abstract judgment under ambiguity and constraint.',
  stroop_classic:          'STROOP   | "Color Conflict"          | Tap ink color, ignore word. Impulse control + processing speed.',
  matrix_standard:         'MATRIX   | "Pattern Matrix"          | 3×3 Raven-style grid, missing piece. Analytical thinking + learning speed.',
  matrix_advanced:         'MATRIX   | "Advanced Matrix"         | Harder Raven matrices. Deep analytical reasoning.',
  spatial_rotation:        'SPATIAL  | "Mental Rotation"         | Pick the rotated shape. Spatial reasoning + systematic thinking.',
  dot_estimation:          'ESTIM    | "Dot Sense"               | Flash two dot groups, tap larger. Numerical intuition + processing speed.',
  visual_search_standard:  'SEARCH   | "Symbol Hunt"             | 5×5 grid, find odd-one-out. Attention to detail + processing speed.',
  visual_search_hard:      'SEARCH   | "Symbol Hunt Pro"         | Harder visual search. High attention to detail.',
  reaction_basic:         'REACTION    | "Quick Tap"               | Pure reaction speed. Processing speed.',
  reaction_inhibition:    'REACTION    | "Stop & Go"               | Tap green, resist red. Impulse control + focus.',
  reaction_speed:         'REACTION    | "Speed Challenge"         | Multi-target rapid tap. Speed + accuracy.',
  reaction_surgical:      'REACTION    | "Precision Tap"           | Tiny targets. Accuracy weighted over speed.',
  reaction_multitask:     'REACTION    | "Dual Focus"              | Two simultaneous stimuli. Divided attention.',
};

export interface GameSelectionResult {
  selectedIds: string[];
  reasoning: string;
}

const ALL_VALID_GAME_IDS = Object.keys(GAME_DESCRIPTIONS);

const FALLBACK_GAMES = ['pattern_standard', 'puzzle_standard', 'matrix_standard'];

export async function selectGamesForUser(
  userProfile: UserProfile,
  pool?: string[]
): Promise<GameSelectionResult> {
  // Use the provided occupation pool, falling back to the full catalog
  const validIds = pool && pool.length >= 3
    ? pool.filter(id => ALL_VALID_GAME_IDS.includes(id))
    : ALL_VALID_GAME_IDS;

  const poolCatalog = validIds
    .map(id => `  ${id} | ${GAME_DESCRIPTIONS[id]}`)
    .join('\n');

  const prompt = `You are an expert behavioral assessment designer for a cognitive intelligence platform.

A user wants to be assessed for the following occupation:

USER PROFILE:
- Age: ${userProfile.age}
- Target / Current Occupation: ${userProfile.occupationTitle}
- Areas of Interest: ${userProfile.interests}

Available games for this occupation (${validIds.length} options):
Format: ID | TYPE | TITLE | DESCRIPTION
${poolCatalog}

Your task: Select exactly 3 games from the list above that will best reveal the cognitive and behavioral traits most critical for success as a ${userProfile.occupationTitle}.

Rules:
1. Diversity — pick games from DIFFERENT types (EXPLORATION / PATTERN / PUZZLE / MEMORY / LOGIC / REACTION)
2. Relevance — prioritise games measuring skills most important for ${userProfile.occupationTitle}
3. Age context — consider the user's age (${userProfile.age}) and stated interests in your reasoning
4. Use ONLY the exact ID strings from the leftmost column above

Respond with valid JSON only (no markdown):
{"selectedIds": ["exact_id_1", "exact_id_2", "exact_id_3"], "reasoning": "One or two sentences explaining why these 3 games best assess a ${userProfile.occupationTitle}"}`;

  try {
    const message = await withRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'You are a JSON API. Respond only with valid JSON. No prose, no markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    }));

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const text = jsonMatch ? jsonMatch[0] : raw.trim();
    const parsed = JSON.parse(text);

    const returned: string[] = parsed.selectedIds ?? [];
    const ids: string[] = returned.filter((id: string) => validIds.includes(id)).slice(0, 3);
    console.log('[selectGames] LLM returned:', returned, '| valid pool size:', validIds.length, '| accepted:', ids);
    if (ids.length < 3) {
      console.warn('[selectGames] Falling back — only', ids.length, 'valid IDs from LLM response');
      return { selectedIds: FALLBACK_GAMES, reasoning: 'Standard assessment selected.' };
    }
    return { selectedIds: ids, reasoning: parsed.reasoning ?? '' };
  } catch (err) {
    console.error('Game selection LLM call failed:', err);
    return { selectedIds: FALLBACK_GAMES, reasoning: 'Standard assessment selected.' };
  }
}

export async function generateBehaviorReport(traits: TraitScores): Promise<LLMResult> {
  const traitJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(traits).map(([k, v]) => [k, (v as number).toFixed(2)])
    ),
    null,
    2
  );

  const prompt = `Analyze the behavioral profile of a user based on these cognitive signals and produce a short report describing thinking style, strengths, and possible skill domains.

Trait scores (0 = low, 1 = high):
${traitJson}

Respond with a JSON object with exactly two keys:
- "thinkingStyle": a single sentence (≤15 words) describing their core cognitive style
- "aiReport": 3–4 sentences describing their behavioral profile, strengths, and suggested skill domains

Return only valid JSON, no markdown.`;

  const message = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  }));

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const text = jsonMatch ? jsonMatch[0] : raw.trim();

  try {
    const parsed = JSON.parse(text);
    return {
      aiReport: parsed.aiReport ?? 'Analysis unavailable.',
      thinkingStyle: parsed.thinkingStyle ?? 'Analytical and adaptive thinker.',
    };
  } catch {
    return { aiReport: text, thinkingStyle: 'Unique and nuanced thinker.' };
  }
}

// Approximate practical maximum scores per game type
const GAME_MAX_SCORES: Record<string, number> = {
  exploration: 80,   // 8 reward tiles × 10 pts
  pattern:     90,   // 9 rounds × 10 pts first-try
  puzzle:      700,  // practical max (theoretical 1000 minus minimum moves)
  memory:      150,  // 5 rounds × 30 pts max
  logic:       105,  // 7 questions × 15 pts max (with time bonus)
  reaction:    150,  // 10 rounds × 15 pts max
};

function performanceLabel(pct: number): string {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 40) return 'Moderate';
  if (pct >= 20) return 'Below average';
  return 'Poor';
}

function overallEngagementLabel(avgPct: number): string {
  if (avgPct >= 60) return 'Strong — meaningful behavioral data captured';
  if (avgPct >= 35) return 'Moderate — partial behavioral signals captured';
  return 'Poor — insufficient data to confirm cognitive fit for demanding roles';
}

function buildHistoricalContext(history: TraitHistoryEntry[]): string {
  if (history.length === 0) return '';

  // Average all past traits
  const keys = Object.keys(history[0].traits) as (keyof TraitScores)[];
  const avg: Record<string, number> = {};
  for (const k of keys) {
    avg[k] = history.reduce((sum, h) => sum + h.traits[k], 0) / history.length;
  }

  const avgLine = keys.map(k => `${k.replace(/_/g, ' ')}: ${avg[k].toFixed(2)}`).join(' | ');
  const occupations = [...new Set(history.map(h => h.occupation))].join(', ');

  let trendNote = '';
  if (history.length >= 2) {
    // history is DESC (most recent first), so [0] = latest previous, [length-1] = oldest
    const latest = history[0].traits;
    const oldest = history[history.length - 1].traits;
    const delta = keys
      .map(k => {
        const d = latest[k] - oldest[k];
        if (Math.abs(d) >= 0.05) {
          return `${k.replace(/_/g, ' ')} ${d > 0 ? '+' : ''}${d.toFixed(2)}`;
        }
        return null;
      })
      .filter(Boolean);
    if (delta.length > 0) {
      trendNote = `\nTrend (oldest → most recent previous session): ${delta.join(', ')}`;
    }
  }

  return `\n═══ HISTORICAL CONTEXT (${history.length} previous session${history.length > 1 ? 's' : ''}) ═══
Average traits from prior assessments: ${avgLine}
Previous occupations assessed: ${occupations}${trendNote}
NOTE: Compare current session scores to this baseline when assessing growth or consistency.\n`;
}

export async function generateCareerReport(
  traits: TraitScores,
  userProfile: UserProfile,
  gameResults: GameResult[],
  gameBehaviorData?: GameBehaviorData,
  sessionId?: string,
  traitHistory?: TraitHistoryEntry[]
): Promise<FullLLMResult> {
  // Build per-game performance lines with score context
  const scoredGames = gameResults.map(g => {
    const max = GAME_MAX_SCORES[g.gameType] ?? 100;
    const pct = Math.min(100, Math.round((g.score / max) * 100));
    return { ...g, max, pct, label: performanceLabel(pct) };
  });

  const avgPct = scoredGames.length > 0
    ? Math.round(scoredGames.reduce((sum, g) => sum + g.pct, 0) / scoredGames.length)
    : 0;

  const overallEngagement = overallEngagementLabel(avgPct);

  const gamePerformance = scoredGames
    .map(g => `- ${g.emoji} ${g.title}: ${g.score} / ${g.max} pts (${g.pct}%) — ${g.label}`)
    .join('\n');

  const behaviorJson = gameBehaviorData && Object.keys(gameBehaviorData).length > 0
    ? JSON.stringify(gameBehaviorData, null, 2)
    : JSON.stringify({ note: 'No structured behavioral data was recorded for this session.' }, null, 2);

  const ageNum = parseInt(userProfile.age, 10);
  const ageGroup = !isNaN(ageNum)
    ? ageNum <= 13 ? 'child (age ≤13): suggest Scratch, simple game-building projects, kid-friendly puzzles and storytelling games'
      : ageNum <= 16 ? 'early teen (age 14–16): suggest beginner coding projects, school clubs, online courses like Khan Academy or Codecademy'
      : ageNum <= 19 ? 'late teen (age 17–19): suggest competitive programming (Codeforces/LeetCode), GitHub projects, hackathons, and internship prep'
      : 'adult (age 20+): suggest professional certifications, open-source contributions, portfolio projects, and specialised courses'
    : 'age unknown: give generally applicable suggestions';

  const historicalContext = buildHistoricalContext(traitHistory ?? []);

  const traitLine = [
    `Curiosity: ${traits.curiosity.toFixed(2)}`,
    `Persistence: ${traits.persistence.toFixed(2)}`,
    `Risk Tolerance: ${traits.risk_tolerance.toFixed(2)}`,
    `Learning Speed: ${traits.learning_speed.toFixed(2)}`,
    `Working Memory: ${traits.working_memory.toFixed(2)}`,
    `Processing Speed: ${traits.processing_speed.toFixed(2)}`,
    `Impulse Control: ${traits.impulse_control.toFixed(2)}`,
    `Analytical Thinking: ${traits.analytical_thinking.toFixed(2)}`,
    `Attention to Detail: ${traits.attention_to_detail.toFixed(2)}`,
    `Systematic Thinking: ${traits.systematic_thinking.toFixed(2)}`,
  ].join(' | ');

  const prompt = `You are a behavioral assessment assistant for a career exploration platform.

The user is ${userProfile.age} years old and wants to become a ${userProfile.occupationTitle}.
They played ${gameResults.length} short cognitive games (2–3 minutes total). These provide WEAK behavioral signals — not definitive proof — about cognitive traits.
Do NOT make strong personality judgments. Use language like "this suggests…" or "this may indicate…" — never "you are…".
${historicalContext}
═══ BEHAVIORAL DATA (raw signals from game events) ═══
${behaviorJson}

═══ TRAIT SCORES (0 = low, 1 = high) ═══
${traitLine}

═══ GAME PERFORMANCE ═══
${gamePerformance}
Overall engagement: ${avgPct}% — ${overallEngagement}

═══ OCCUPATION CONTEXT ═══
The user wants to become a ${userProfile.occupationTitle}.
First, infer the core cognitive traits needed for this occupation from the 10 measured traits above (curiosity, persistence, risk tolerance, learning speed, working memory, processing speed, impulse control, analytical thinking, attention to detail, systematic thinking).
Then compare the observed game behaviors to those inferred traits.

═══ YOUR TASK ═══
1. OBSERVE — Describe what the user actually did in each game using factual, second-person language.
   Example: "In the pattern game, you identified the rule within 8 seconds and made 2 incorrect guesses. This suggests strong analytical reasoning, which is useful for debugging code."
2. COMPARE — Match each observed behavior to a trait needed for ${userProfile.occupationTitle}.
3. ALIGN — Highlight 2–3 behaviors that align with the occupation.
4. DEVELOP — Identify 1–2 areas that may need development based on observed data.
5. SUGGEST — Give age-appropriate skill-building activities for this user.
   Age group: ${ageGroup}.
6. PROGRESS — Only if historical data is present above: note 1–2 traits that improved since previous sessions and 1 that still needs work. If no history, omit this field entirely.

Respond with valid JSON only (no markdown, no code fences):
{
  "thinkingStyle": "≤12 words describing their cognitive approach based on observed behavior",
  "report": "2–3 sentences: key observed behaviors → relation to ${userProfile.occupationTitle} → one strength and one area to develop",
  "progressSummary": "Only include if historical data was provided: 1–2 sentences on trait improvement trends vs previous sessions. Omit this key entirely if no history.",
  "observations": [
    {
      "game": "game title",
      "observation": "1 sentence: what the user did (factual, second-person)",
      "relevance": "1 sentence: how it relates to ${userProfile.occupationTitle}"
    }
  ],
  "occupationFit": {
    "occupation": "${userProfile.occupationTitle}",
    "rating": "excellent | good | moderate | low",
    "summary": "1–2 sentences grounded in observed in-game behavior"
  },
  "skillDevelopment": [
    {
      "skill": "skill name",
      "activities": ["activity 1", "activity 2"]
    }
  ],
  "recommendedCareers": [
    {
      "career": "career title",
      "rating": "strong_match | possible_match | explore_further",
      "reason": "1 sentence linking observed behavior to this career"
    }
  ]
}`;

  try {
    const t0 = Date.now();
    const message = await withRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'You are a JSON API. Respond only with valid JSON. No prose, no markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    }));
    const latencyMs = Date.now() - t0;

    if (sessionId) {
      void logLlmCall({
        sessionId,
        latencyMs,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        costUsd: calcCost(message.usage.input_tokens, message.usage.output_tokens),
      });
    }

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const text = jsonMatch ? jsonMatch[0] : raw.trim();

    try {
      const parsed = JSON.parse(text);
      console.log('[careerReport] JSON parsed OK — stop_reason:', message.stop_reason, 'output_tokens:', message.usage.output_tokens);
      // Normalise recommendedCareers rating values to what the frontend expects
      const normaliseRating = (r: string): CareerRecommendation['rating'] => {
        if (r === 'strong_match') return 'highly_recommended';
        if (r === 'possible_match') return 'recommended';
        if (r === 'explore_further') return 'neutral';
        // Pass through any legacy values the LLM might still use
        if (['highly_recommended', 'recommended', 'neutral', 'not_recommended'].includes(r)) {
          return r as CareerRecommendation['rating'];
        }
        return 'neutral';
      };

      const rawCareers: Array<{ career: string; rating: string; reason: string }> =
        parsed.recommendedCareers ?? parsed.aiRecommendedCareers ?? [];

      return {
        thinkingStyle: parsed.thinkingStyle ?? 'Adaptive thinker with room to demonstrate full potential.',
        aiReport: parsed.report ?? parsed.aiReport ?? parsed.analysis ?? parsed.summary ?? parsed.behavioralAnalysis ?? 'Analysis unavailable.',
        progressSummary: parsed.progressSummary ?? undefined,
        occupationFit: parsed.occupationFit ?? {
          occupation: userProfile.occupationTitle,
          rating: 'low',
          summary: 'Assessment data was insufficient to confirm fit for this role. Consider retaking with full engagement.',
        },
        aiRecommendedCareers: rawCareers.map(c => ({
          career: c.career,
          rating: normaliseRating(c.rating),
          reason: c.reason,
        })),
        observations: parsed.observations ?? [],
        skillDevelopment: parsed.skillDevelopment ?? [],
      };
    } catch {
      console.error('[careerReport] JSON.parse failed — stop_reason:', message.stop_reason, 'output_tokens:', message.usage.output_tokens, 'raw snippet:', text.slice(0, 200));
      return {
        thinkingStyle: 'Adaptive thinker with room to demonstrate full potential.',
        aiReport: text,
        occupationFit: { occupation: userProfile.occupationTitle, rating: 'low', summary: 'Analysis unavailable.' },
        aiRecommendedCareers: [],
        observations: [],
        skillDevelopment: [],
      };
    }
  } catch (err) {
    console.error('Career report LLM generation failed:', err);
    return {
      thinkingStyle: 'Adaptive thinker with room to demonstrate full potential.',
      aiReport: 'Unable to generate a detailed report at this time.',
      occupationFit: { occupation: userProfile.occupationTitle, rating: 'low', summary: 'Unable to generate fit analysis.' },
      aiRecommendedCareers: [],
      observations: [],
      skillDevelopment: [],
    };
  }
}
