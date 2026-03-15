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
