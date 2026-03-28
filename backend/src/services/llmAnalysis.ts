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

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as any)?.status as number | undefined;
      // Only retry on overload (529), server errors (≥500), or network errors (no status)
      const isRetryable = status === undefined || status === 529 || status >= 500;
      if (!isRetryable || attempt >= maxAttempts) break;
      // Exponential backoff: 3s → 8s → 15s
      const delayMs = [3000, 8000, 15000][attempt - 1] ?? 15000;
      console.warn(`[withRetry] attempt ${attempt} failed (status=${status ?? 'network'}), retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const LLM_TIMEOUT_MS = 15_000;

export interface UserProfile {
  age: string;
  occupations: string[];
  occupationTitles: string[];
  occupationEmojis: string[];
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

Available assessment games:

RULE DISCOVERY — measures analytical thinking, learning speed, hypothesis testing:
  black_box_standard    | "Black Box"              | Test inputs on a hidden function, deduce the rule, predict output.
  black_box_hard        | "Black Box: Hard"        | Nonlinear hidden functions — deeper analytical reasoning required.

TASK PLANNING — measures systematic thinking, dependency reasoning, logical planning:
  task_planning_standard| "Task Planner"           | Order tasks with dependency constraints in correct topological sequence.
  task_planning_hard    | "Task Planner: Advanced" | Complex dependency graphs — parallel paths, merge points, 6-node DAGs.

MEMORY — measures working memory, spatial recall, numerical retention:
  memory_colors         | "Color Memory"           | Recall colour sequences. Visual/spatial memory.
  memory_numbers        | "Number Recall"          | Recall number sequences. Numerical working memory.
  memory_positions      | "Spatial Memory"         | Recall grid positions. Spatial/positional memory.
  memory_sequential     | "Procedure Recall"       | Ordered step sequences. Procedural memory under load.
  memory_faces          | "Name & Context"         | Associate names with faces. Social/associative memory.
  memory_code           | "Code Recall"            | Symbolic/code-like patterns. Abstract working memory.

VERBAL / LOGICAL REASONING — measures judgment, verbal and formal reasoning (text-based MCQ):
  logic_verbal        | "Word Logic"              | Verbal analogies, odd-one-out. Verbal reasoning.
  logic_situational   | "Situational Judgment"    | Abstract judgment calls under ambiguity and constraint.
  logic_deduction     | "Logic Deduction"         | Formal syllogisms and deductive chains. Precise logical inference.
  logic_patterns      | "Number Patterns"         | Number/letter sequence completion. Inductive pattern recognition.
  logic_boolean       | "Boolean Reasoning"       | AND/OR/NOT/XOR operators. Systematic logical computation.
  logic_quantitative  | "Quantitative Reasoning"  | Rates, ratios, percentages, algebra. Numerical reasoning.

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
  black_box_standard:     'RULE_DISC   | "Black Box"               | Test inputs on hidden function, predict output. Analytical thinking + learning speed.',
  black_box_hard:         'RULE_DISC   | "Black Box: Hard"         | Nonlinear hidden functions. Deep analytical reasoning + hypothesis testing.',
  task_planning_standard: 'PLANNING    | "Task Planner"            | Topological ordering of tasks with dependencies. Systematic thinking.',
  task_planning_hard:     'PLANNING    | "Task Planner: Advanced"  | Complex DAG dependency graphs with parallel branches. Advanced systematic thinking.',
  memory_colors:          'MEMORY      | "Color Memory"            | Colour sequences. Visual/spatial working memory.',
  memory_numbers:         'MEMORY      | "Number Recall"           | Number sequences. Numerical working memory.',
  memory_positions:       'MEMORY      | "Spatial Memory"          | Grid positions. Spatial/positional memory.',
  memory_sequential:      'MEMORY      | "Procedure Recall"        | Ordered steps. Procedural memory under load.',
  memory_faces:           'MEMORY      | "Name & Context"          | Name-face association. Social/associative memory.',
  memory_code:            'MEMORY      | "Code Recall"             | Symbolic patterns. Abstract working memory.',
  logic_verbal:            'LOGIC    | "Word Logic"              | Verbal analogies and odd-one-out. Verbal reasoning.',
  logic_situational:       'LOGIC    | "Situational Judgment"    | Abstract judgment under ambiguity and constraint.',
  logic_deduction:         'LOGIC    | "Logic Deduction"         | Syllogisms and formal deduction. Precise logical inference.',
  logic_patterns:          'LOGIC    | "Number Patterns"         | Number/letter sequence completion. Inductive pattern recognition.',
  logic_boolean:           'LOGIC    | "Boolean Reasoning"       | AND/OR/NOT logic operators. Systematic logical computation.',
  logic_quantitative:      'LOGIC    | "Quantitative Reasoning"  | Rates, ratios, percentages. Numerical and algebraic reasoning.',
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

const FALLBACK_GAMES = ['black_box_standard', 'task_planning_standard', 'matrix_standard', 'stroop_classic', 'visual_search_standard'];

export async function selectGamesForUser(
  userProfile: UserProfile,
  pool?: string[],
  previousTraits?: TraitScores
): Promise<GameSelectionResult> {
  const occupationLabel = userProfile.occupationTitles.join(' / ');

  // Use the provided occupation pool, falling back to the full catalog
  const validIds = pool && pool.length >= 5
    ? pool.filter(id => ALL_VALID_GAME_IDS.includes(id))
    : ALL_VALID_GAME_IDS;

  // Shuffle so the LLM sees a different ordering each session — prevents deterministic picks
  const shuffledIds = [...validIds].sort(() => Math.random() - 0.5);
  const poolCatalog = shuffledIds
    .map(id => `  ${id} | ${GAME_DESCRIPTIONS[id]}`)
    .join('\n');

  // Build adaptive difficulty context from previous session performance
  let adaptiveContext = '';
  if (previousTraits) {
    const avgTrait = Object.values(previousTraits).reduce((a, b) => a + b, 0) / Object.values(previousTraits).length;
    if (avgTrait >= 0.65) {
      adaptiveContext = `\nPREVIOUS PERFORMANCE: User scored high (avg trait: ${avgTrait.toFixed(2)}). They are performing well — INCREASE difficulty. Prefer 'hard' variants and cognitively demanding games.`;
    } else if (avgTrait <= 0.40) {
      adaptiveContext = `\nPREVIOUS PERFORMANCE: User scored low (avg trait: ${avgTrait.toFixed(2)}). They are struggling — DECREASE difficulty. Prefer 'medium' or 'easy' variants and accessible games.`;
    } else {
      adaptiveContext = `\nPREVIOUS PERFORMANCE: User scored average (avg trait: ${avgTrait.toFixed(2)}). Maintain current difficulty mix.`;
    }
  }

  const ageNum = parseInt(userProfile.age, 10);
  const ageDifficulty = (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 40) ? 'hard'
    : (!isNaN(ageNum) && ((ageNum >= 41 && ageNum <= 55) || (ageNum >= 15 && ageNum < 18))) ? 'medium'
    : 'easy';

  const prompt = `You are an expert behavioral assessment designer for a cognitive intelligence platform.

A user wants to be assessed for the following occupation:

USER PROFILE:
- Age: ${userProfile.age}
- Target / Current Occupation: ${occupationLabel}
- Areas of Interest: ${userProfile.interests}${adaptiveContext}

Available games for this occupation (${validIds.length} options):
Format: ID | TYPE | TITLE | DESCRIPTION
${poolCatalog}

Your task: Select exactly 5 games from the list above that will best reveal the cognitive and behavioral traits most critical for success as a ${occupationLabel}.

MANDATORY RULES — all must be satisfied:
1. Cognitive variety — you MUST include at least two games from the interactive cognitive category:
   STROOP, MATRIX, SPATIAL, ESTIMATION, SEARCH, RULE_DISC, or PLANNING types.
2. Type diversity — no type may appear more than twice. Use at least 4 different types across the 5 games.
3. Relevance — prioritise traits most critical for ${occupationLabel}
4. Complexity by age — base difficulty on age:
   • Age 18–40 → STRONGLY PREFER 'hard' difficulty games
   • Age 41–55 or 15–17 → prefer 'medium' difficulty games
   • Age < 15 or > 55 → prefer 'easy' difficulty games
   Age ${userProfile.age} → default to '${ageDifficulty}'.
5. Adaptive complexity — if PREVIOUS PERFORMANCE data is provided above, it overrides age-based difficulty.
6. Use ONLY the exact ID strings from the leftmost column above

Respond with valid JSON only (no markdown):
{"selectedIds": ["id_1","id_2","id_3","id_4","id_5"], "reasoning": "One or two sentences explaining why these 5 games best assess a ${occupationLabel}"}`;

  try {
    const message = await withRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 450,
      system: 'You are a JSON API. Respond only with valid JSON. No prose, no markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    }));

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const text = jsonMatch ? jsonMatch[0] : raw.trim();
    const parsed = JSON.parse(text);

    const returned: string[] = parsed.selectedIds ?? [];
    const ids: string[] = returned.filter((id: string) => validIds.includes(id)).slice(0, 5);
    console.log('[selectGames] LLM returned:', returned, '| valid pool size:', validIds.length, '| accepted:', ids);
    if (ids.length < 5) {
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
  rule_discovery: 240,  // 8 rounds × 30 pts max
  planning:       240,  // 6 rounds × 40 pts max
  memory:         150,  // 5 rounds × 30 pts max
  logic:          105,  // 7 questions × 15 pts max (with time bonus)
  reaction:       150,  // 10 rounds × 15 pts max
  stroop:         360,  // 24 trials × 15 pts max
  matrix:         200,  // 8 rounds × 25 pts max
  spatial:        160,  // 8 rounds × 20 pts max
  estimation:     200,  // 20 trials × 20 pts max
  search:         200,  // 8 rounds × 25 pts max
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
  const occupationLabel = userProfile.occupationTitles.join(' / ');

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

The user is ${userProfile.age} years old and wants to become a ${occupationLabel}.
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
The user wants to become a ${occupationLabel}.
First, infer the core cognitive traits needed for this occupation from the 10 measured traits above (curiosity, persistence, risk tolerance, learning speed, working memory, processing speed, impulse control, analytical thinking, attention to detail, systematic thinking).
Then compare the observed game behaviors to those inferred traits.

═══ YOUR TASK ═══
1. OBSERVE — Describe what the user actually did in each game using factual, second-person language.
   Example: "In the pattern game, you identified the rule within 8 seconds and made 2 incorrect guesses. This suggests strong analytical reasoning, which is useful for debugging code."
2. COMPARE — Match each observed behavior to a trait needed for ${occupationLabel}.
3. ALIGN — Highlight 2–3 behaviors that align with the occupation.
4. DEVELOP — Identify 1–2 areas that may need development based on observed data.
5. SUGGEST — Give age-appropriate skill-building activities for this user.
   Age group: ${ageGroup}.
6. PROGRESS — Only if historical data is present above: note 1–2 traits that improved since previous sessions and 1 that still needs work. If no history, omit this field entirely.

Respond with valid JSON only (no markdown, no code fences):
{
  "thinkingStyle": "≤12 words describing their cognitive approach based on observed behavior",
  "report": "2–3 sentences: key observed behaviors → relation to ${occupationLabel} → one strength and one area to develop",
  "progressSummary": "Only include if historical data was provided: 1–2 sentences on trait improvement trends vs previous sessions. Omit this key entirely if no history.",
  "observations": [
    {
      "game": "game title",
      "observation": "1 sentence: what the user did (factual, second-person)",
      "relevance": "1 sentence: how it relates to ${occupationLabel}"
    }
  ],
  "occupationFit": {
    "occupation": "${occupationLabel}",
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
          occupation: occupationLabel,
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
        occupationFit: { occupation: occupationLabel, rating: 'low', summary: 'Analysis unavailable.' },
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
      occupationFit: { occupation: occupationLabel, rating: 'low', summary: 'Unable to generate fit analysis.' },
      aiRecommendedCareers: [],
      observations: [],
      skillDevelopment: [],
    };
  }
}

// ── Cognitive Mirror: Trait Discovery ────────────────────────────────────────

export interface DiscoveredTrait {
  id: string;       // e.g. T01
  name: string;     // e.g. "Triage"
  isPrimary: boolean;
  relevance: string; // 1-sentence reason why this trait matters for the profession
}

// All 12 supported trait IDs and names for the LLM to choose from
const SUPPORTED_TRAITS = `
T01  Triage              — Prioritising high-importance signals under time pressure
T04  Panic Management    — Maintaining accuracy despite escalating stress and interference
T06  Working Memory      — Holding and manipulating information across long sequences
T11  Deductive Logic     — Multi-step reasoning: syllogisms, boolean chains, inference
T12  Systems Thinking    — Mapping dependencies and sequencing complex task networks
T13  Risk Management     — Gathering evidence before committing; exploration vs. efficiency
T15  Social Inference    — Reading subtext, intent, and optimal responses in social scenarios
T16  Affective Empathy   — Encoding and recalling emotional context; empathic foundation
T19  Anomaly Detection   — Identifying rare signals within dense, noisy fields
T20  Sustained Attention — Consistent accuracy on long tasks without performance decay
T21  Processing Speed    — Rapid, accurate response to stimuli; raw cognitive throughput
T23  Ideational Fluency  — Generating high-volume quality hypotheses; creative exploration
`;

export async function discoverTraitsForProfession(
  profession: string,
  sessionId: string,
): Promise<DiscoveredTrait[]> {
  const start = Date.now();

  const prompt = `You are a cognitive scientist matching professions to cognitive traits measured by assessment games.

The user's target profession: "${profession}"

Available cognitive traits (choose exactly 5):
${SUPPORTED_TRAITS}

Rules:
- Select exactly 3 PRIMARY traits (most critical for this profession)
- Select exactly 2 SECONDARY traits (supporting but important)
- Base your choice ONLY on cognitive demands — not job knowledge or domain expertise
- For each trait, write one concise sentence explaining why it matters for this profession

Respond ONLY with valid JSON in this exact format:
{
  "traits": [
    { "id": "T01", "name": "Triage", "isPrimary": true, "relevance": "..." },
    { "id": "T11", "name": "Deductive Logic", "isPrimary": true, "relevance": "..." },
    { "id": "T12", "name": "Systems Thinking", "isPrimary": true, "relevance": "..." },
    { "id": "T21", "name": "Processing Speed", "isPrimary": false, "relevance": "..." },
    { "id": "T06", "name": "Working Memory", "isPrimary": false, "relevance": "..." }
  ]
}`;

  const message = await withRetry(() =>
    Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS)
      ),
    ])
  );

  const latencyMs = Date.now() - start;
  const content   = message.content[0];
  const text      = content.type === 'text' ? content.text : '';

  await logLlmCall({
    sessionId,
    latencyMs,
    inputTokens:  message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    costUsd: calcCost(message.usage.input_tokens, message.usage.output_tokens),
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);
    const traits: DiscoveredTrait[] = (parsed.traits ?? []).slice(0, 5);
    return traits;
  } catch {
    // Fallback: generic analytical set
    return [
      { id: 'T11', name: 'Deductive Logic',     isPrimary: true,  relevance: 'Core reasoning required across most professional roles.' },
      { id: 'T06', name: 'Working Memory',       isPrimary: true,  relevance: 'Retaining and manipulating information under task load.' },
      { id: 'T12', name: 'Systems Thinking',     isPrimary: true,  relevance: 'Managing complex dependencies and workflow sequences.' },
      { id: 'T21', name: 'Processing Speed',     isPrimary: false, relevance: 'Rapid decision-making under time pressure.' },
      { id: 'T01', name: 'Triage',               isPrimary: false, relevance: 'Prioritising high-impact tasks in demanding environments.' },
    ];
  }
}

// ── Cognitive Mirror: Archetype Report ───────────────────────────────────────

export interface TraitResult {
  traitId: string;
  traitName: string;
  isPrimary: boolean;
  peakLevel: number;       // highest level reached
  peakScore: number;       // score at peak level (0-100)
  avgScore: number;        // average across all levels played
  outcome: string;         // 'complete' | 'ceiling' | 'skip_completed'
  scores: number[];        // level-by-level scores
}

export interface TraitTalkSummary {
  flags: Array<{ flag: string; description: string; severity: string }>;
  archetypeModifiers: string[];
  validationPassed: boolean;
}

export interface ArchetypeCard {
  archetypeName: string;         // e.g. "The Precision Analyst"
  archetypeTagline: string;      // 1 line, punchy
  professionalAlignment: string; // "Your X and Y match the Nth percentile of [profession]"
  strengthSummary: string;       // 2–3 sentences on cognitive strengths
  developmentArea: string;       // 1–2 sentences on the gap
  traitNarratives: Array<{
    traitId: string;
    traitName: string;
    level: string;              // "Elite" | "Strong" | "Developing" | "Foundational"
    narrative: string;          // 1–2 sentence insight
  }>;
  traitTalkInsights: string[];   // 1 insight per conflict flag found
  recommendations: Array<{ action: string; rationale: string }>;
}

export async function generateArchetypeReport(
  profession: string,
  traitResults: TraitResult[],
  traitTalk: TraitTalkSummary,
  sessionId: string,
  baselineRtMs: number | null,
): Promise<ArchetypeCard> {
  const start = Date.now();

  const traitSummary = traitResults.map(t => {
    const levelLabel = t.peakScore >= 85 ? 'Elite' : t.peakScore >= 70 ? 'Strong' : t.peakScore >= 50 ? 'Developing' : 'Foundational';
    return `${t.traitId} ${t.traitName} (${t.isPrimary ? 'PRIMARY' : 'secondary'}): peak level ${t.peakLevel}/10, peak score ${Math.round(t.peakScore)}/100 [${levelLabel}], outcome: ${t.outcome}`;
  }).join('\n');

  const traitTalkSection = traitTalk.flags.length > 0
    ? `Trait Talk Flags:\n${traitTalk.flags.map(f => `• ${f.flag} (${f.severity}): ${f.description}`).join('\n')}`
    : 'Trait Talk: No conflicts detected — scores are internally consistent.';

  const baselineContext = baselineRtMs
    ? `Baseline reaction time: ${Math.round(baselineRtMs)}ms (calibrated)`
    : 'Baseline: not calibrated';

  const prompt = `You are a cognitive profiling expert generating a personalised Archetype Card for a user who completed the Cognitive Mirror Assessment.

Target Profession: "${profession}"
${baselineContext}

Trait Performance:
${traitSummary}

${traitTalkSection}

Generate a rich, insightful Archetype Card. Be specific to the data — do NOT use generic phrases like "well-rounded" or "room for improvement". Draw direct connections between the scores and what that means professionally.

Respond ONLY with valid JSON in this format:
{
  "archetypeName": "The [Archetype Name]",
  "archetypeTagline": "One punchy line that captures this cognitive profile",
  "professionalAlignment": "Specific statement about how their primary traits align with ${profession} demands",
  "strengthSummary": "2-3 sentences describing their cognitive strengths based on the data",
  "developmentArea": "1-2 sentences on the specific gap or risk area revealed by the data",
  "traitNarratives": [
    { "traitId": "T01", "traitName": "Triage", "level": "Elite|Strong|Developing|Foundational", "narrative": "1-2 sentence insight tied directly to their performance data" }
  ],
  "traitTalkInsights": ["One insight per flag, explaining what the conflict means for their professional profile"],
  "recommendations": [
    { "action": "Specific development action", "rationale": "Why this addresses the data-revealed gap" }
  ]
}`;

  const message = await withRetry(() =>
    Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 25_000)
      ),
    ])
  );

  const latencyMs = Date.now() - start;
  const content   = message.content[0];
  const text      = content.type === 'text' ? content.text : '';

  await logLlmCall({
    sessionId,
    latencyMs,
    inputTokens:  message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    costUsd: calcCost(message.usage.input_tokens, message.usage.output_tokens),
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed: ArchetypeCard = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch {
    return {
      archetypeName: 'The Cognitive Explorer',
      archetypeTagline: 'Measured, methodical, and always learning.',
      professionalAlignment: `Your assessment reveals a distinctive cognitive profile relevant to ${profession}.`,
      strengthSummary: 'The assessment captured a range of cognitive signals across your chosen trait domains.',
      developmentArea: 'Further assessment sessions will provide a more detailed developmental picture.',
      traitNarratives: traitResults.map(t => ({
        traitId: t.traitId, traitName: t.traitName,
        level: t.peakScore >= 85 ? 'Elite' : t.peakScore >= 70 ? 'Strong' : t.peakScore >= 50 ? 'Developing' : 'Foundational',
        narrative: `Reached level ${t.peakLevel} with a peak score of ${Math.round(t.peakScore)}.`,
      })),
      traitTalkInsights: traitTalk.flags.map(f => f.description),
      recommendations: [{ action: 'Retake the assessment with full focus', rationale: 'More data points improve archetype accuracy.' }],
    };
  }
}
