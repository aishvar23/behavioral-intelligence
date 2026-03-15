import Anthropic from '@anthropic-ai/sdk';
import { TraitScores } from './traitEngine';
import { GameBehaviorData } from './behavioralSignals';

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

export interface FullLLMResult {
  thinkingStyle: string;
  aiReport: string;
  occupationFit: OccupationFit;
  aiRecommendedCareers: CareerRecommendation[];
}

export interface LLMResult {
  aiReport: string;
  thinkingStyle: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Game Catalog (kept in sync with mobile/src/data/gameCatalog.ts) ───────────
const GAME_CATALOG_FOR_LLM = `
Available assessment games (18 total, across 6 types):

EXPLORATION — measures curiosity, risk tolerance, strategic navigation:
  exploration_standard  | "Exploration Island"     | 8×8 fog grid, 30 moves. Rewards + traps.
  exploration_cautious  | "Risk Zone"              | Dense trap field. High-stakes risk decisions.
  exploration_open      | "Discovery Expedition"   | Reward-rich terrain. Curiosity and persistence.

PATTERN RECOGNITION — measures analytical thinking, learning speed, adaptability:
  pattern_standard      | "Pattern Detective"      | Decode number sequences, 9 rounds (easy→hard).
  pattern_advanced      | "Advanced Patterns"      | Starts at medium difficulty. Harder analytics.
  pattern_logic         | "Logic Sequences"        | Complex multi-step sequences. Deep analysis.

PUZZLE SOLVING — measures problem-solving, persistence, strategic planning:
  puzzle_standard       | "Impossible Puzzle"      | Sliding tile puzzle, 3 hints available.
  puzzle_pressure       | "Pressure Puzzle"        | Only 1 hint. High persistence requirement.
  puzzle_strategic      | "Strategic Puzzle"       | Move-efficiency scoring. Strategic planning.

MEMORY — measures working memory, spatial recall, numerical retention:
  memory_colors         | "Color Memory"           | Recall colour sequences. Visual/spatial memory.
  memory_numbers        | "Number Recall"          | Recall number sequences. Numerical working memory.
  memory_positions      | "Spatial Memory"         | Recall grid positions. Spatial/positional memory.

LOGICAL REASONING — measures deductive reasoning, verbal reasoning, abstraction:
  logic_deduction       | "Logic Deduction"        | Classical if-then deduction. Logical analysis.
  logic_patterns        | "Abstract Patterns"      | Number/abstract sequence rules. Abstraction.
  logic_verbal          | "Word Logic"             | Verbal analogies, odd-one-out. Verbal reasoning.

REACTION & INHIBITION — measures processing speed, impulse control, focus:
  reaction_basic        | "Quick Tap"              | Tap on stimulus appearance. Pure reaction speed.
  reaction_inhibition   | "Stop & Go"              | Tap green, resist red. Impulse control + focus.
  reaction_speed        | "Speed Challenge"        | Multi-target rapid tap. Speed + accuracy.
`;

export interface GameSelectionResult {
  selectedIds: string[];
  reasoning: string;
}

const VALID_GAME_IDS = [
  'exploration_standard', 'exploration_cautious', 'exploration_open',
  'pattern_standard', 'pattern_advanced', 'pattern_logic',
  'puzzle_standard', 'puzzle_pressure', 'puzzle_strategic',
  'memory_colors', 'memory_numbers', 'memory_positions',
  'logic_deduction', 'logic_patterns', 'logic_verbal',
  'reaction_basic', 'reaction_inhibition', 'reaction_speed',
];

const FALLBACK_GAMES = ['pattern_standard', 'puzzle_standard', 'logic_deduction'];

export async function selectGamesForUser(userProfile: UserProfile): Promise<GameSelectionResult> {
  const prompt = `You are an expert behavioral assessment designer for a cognitive intelligence platform.

A user wants to be assessed for the following occupation:

USER PROFILE:
- Age: ${userProfile.age}
- Target / Current Occupation: ${userProfile.occupationTitle}
- Areas of Interest: ${userProfile.interests}
${GAME_CATALOG_FOR_LLM}
Your task: Select exactly 3 games that will best reveal the cognitive and behavioral traits most critical for success as a ${userProfile.occupationTitle}.

Rules:
1. Diversity — pick games from DIFFERENT types (no two from the same category)
2. Relevance — prioritise games measuring skills most important for ${userProfile.occupationTitle}
3. Context — consider the user's age and stated interests in your reasoning
4. Think carefully: what does a ${userProfile.occupationTitle} most need cognitively?

Respond with valid JSON only (no markdown):
{"selectedIds": ["id_1", "id_2", "id_3"], "reasoning": "One or two sentences explaining why these games best assess a ${userProfile.occupationTitle}"}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const text = jsonMatch ? jsonMatch[0] : raw.trim();
    const parsed = JSON.parse(text);

    const ids: string[] = (parsed.selectedIds ?? []).filter((id: string) => VALID_GAME_IDS.includes(id)).slice(0, 3);
    if (ids.length < 3) {
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
    {
      curiosity: traits.curiosity.toFixed(2),
      persistence: traits.persistence.toFixed(2),
      risk_tolerance: traits.risk_tolerance.toFixed(2),
      learning_speed: traits.learning_speed.toFixed(2),
    },
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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

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

export async function generateCareerReport(
  traits: TraitScores,
  userProfile: UserProfile,
  gameResults: GameResult[],
  gameBehaviorData?: GameBehaviorData
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

  const prompt = `You are an AI career exploration assistant.

The user played three short cognitive games lasting 2–3 minutes.
These games provide weak behavioral signals about curiosity,
persistence, analytical thinking, and risk tolerance.

Do NOT make definitive career judgments.

Instead, structure your analysis around these five points:
1. Describe the user's behavior observed in the games.
2. Explain how these behaviors relate to the chosen occupation.
3. Highlight strengths.
4. Suggest areas for improvement.
5. Provide learning activities suitable for the user's age.

User information:
- Age: ${userProfile.age}
- Target occupation: ${userProfile.occupationTitle}

Game behavior data:
${behaviorJson}

Supporting context (trait scores derived from the same session):
- Curiosity: ${traits.curiosity.toFixed(2)} | Persistence: ${traits.persistence.toFixed(2)} | Risk Tolerance: ${traits.risk_tolerance.toFixed(2)} | Learning Speed: ${traits.learning_speed.toFixed(2)}

Game scores (for reference):
${gamePerformance}
Overall engagement: ${avgPct}% — ${overallEngagement}

Respond with valid JSON only (no markdown, no code fences):
- "thinkingStyle": one sentence ≤20 words describing their cognitive style based on actual observed behavior
- "report": 4–5 sentences following the five-point structure above — behavior observed, relation to occupation, strengths, improvement areas, and age-appropriate learning activities
- "occupationFit": object with:
    - "occupation": "${userProfile.occupationTitle}"
    - "rating": one of "excellent", "good", "moderate", "low" — based on behavioral evidence, not stated goals
    - "summary": 2–3 sentences on fit or mismatch with specific references to observed in-game behaviors
- "recommendedCareers": array of 3 careers matching demonstrated behaviors, each with:
    - "career": career title
    - "rating": one of "strong_match", "possible_match", "explore_further"
    - "reason": 2 sentences grounded in observed game behavior and age-appropriate development`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const text = jsonMatch ? jsonMatch[0] : raw.trim();

    try {
      const parsed = JSON.parse(text);
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
        aiReport: parsed.report ?? parsed.aiReport ?? 'Analysis unavailable.',
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
      };
    } catch {
      return {
        thinkingStyle: 'Adaptive thinker with room to demonstrate full potential.',
        aiReport: text,
        occupationFit: { occupation: userProfile.occupationTitle, rating: 'low', summary: 'Analysis unavailable.' },
        aiRecommendedCareers: [],
      };
    }
  } catch (err) {
    console.error('Career report LLM generation failed:', err);
    return {
      thinkingStyle: 'Adaptive thinker with room to demonstrate full potential.',
      aiReport: 'Unable to generate a detailed report at this time.',
      occupationFit: { occupation: userProfile.occupationTitle, rating: 'low', summary: 'Unable to generate fit analysis.' },
      aiRecommendedCareers: [],
    };
  }
}
