import Anthropic from '@anthropic-ai/sdk';
import { TraitScores } from './traitEngine';

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

export async function generateCareerReport(
  traits: TraitScores,
  userProfile: UserProfile,
  gameResults: GameResult[]
): Promise<FullLLMResult> {
  const gamePerformance = gameResults
    .map(g => `- ${g.emoji} ${g.title}: ${g.score} pts`)
    .join('\n');

  const prompt = `You are a behavioral psychologist and career counselor. Analyze the cognitive-behavioral profile below — derived from gameplay — and provide personalised career guidance tailored to this individual.

USER PROFILE:
- Age: ${userProfile.age}
- Target / Current Occupation: ${userProfile.occupationTitle}
- Areas of Interest: ${userProfile.interests}

BEHAVIORAL TRAIT SCORES (0 = low, 1 = high):
- Curiosity: ${traits.curiosity.toFixed(2)} — explorative, inquisitive behaviour
- Persistence: ${traits.persistence.toFixed(2)} — resilience and continued effort after setbacks
- Risk Tolerance: ${traits.risk_tolerance.toFixed(2)} — willingness to take uncertain risks
- Learning Speed: ${traits.learning_speed.toFixed(2)} — speed of internalising new patterns

GAME PERFORMANCE (occupation-specific assessment games):
${gamePerformance}

Using the user's profile, traits, AND their stated occupation/interests, respond with valid JSON only (no markdown, no code fences) containing:
- "thinkingStyle": one sentence ≤20 words describing their core cognitive style, personalised to their background
- "aiReport": 4-5 sentences covering behavioral profile, key strengths, growth areas, and ideal work environments — reference their age/interests where relevant; cite trait scores
- "occupationFit": object assessing fit for "${userProfile.occupationTitle}" with:
    - "occupation": "${userProfile.occupationTitle}"
    - "rating": one of "excellent", "good", "moderate", "low"
    - "summary": 3-4 sentences explaining the fit, citing specific traits and game performance
- "aiRecommendedCareers": array of 3-5 careers strongly matching this behavioral profile (may overlap with stated occupation if fit is high), each with:
    - "career": career title
    - "rating": "highly_recommended" or "recommended"
    - "reason": 2-3 sentences explaining the fit for this specific person, referencing their interests and trait scores`;

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
      return {
        thinkingStyle: parsed.thinkingStyle ?? 'Analytical and adaptive thinker.',
        aiReport: parsed.aiReport ?? 'Analysis unavailable.',
        occupationFit: parsed.occupationFit ?? {
          occupation: userProfile.occupationTitle,
          rating: 'moderate',
          summary: 'Assessment data was insufficient for a detailed fit analysis.',
        },
        aiRecommendedCareers: parsed.aiRecommendedCareers ?? [],
      };
    } catch {
      return {
        thinkingStyle: 'Analytical and adaptive thinker.',
        aiReport: text,
        occupationFit: { occupation: userProfile.occupationTitle, rating: 'moderate', summary: 'Analysis unavailable.' },
        aiRecommendedCareers: [],
      };
    }
  } catch (err) {
    console.error('Career report LLM generation failed:', err);
    return {
      thinkingStyle: 'Analytical and adaptive thinker.',
      aiReport: 'Behavioral analysis complete. Unable to generate detailed report at this time.',
      occupationFit: { occupation: userProfile.occupationTitle, rating: 'moderate', summary: 'Unable to generate fit analysis.' },
      aiRecommendedCareers: [],
    };
  }
}
