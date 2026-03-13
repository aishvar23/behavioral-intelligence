import Anthropic from '@anthropic-ai/sdk';
import { TraitScores } from './traitEngine';

export interface CareerRecommendation {
  career: string;
  rating: 'highly_recommended' | 'recommended' | 'neutral' | 'not_recommended';
  reason: string;
}

export interface FullLLMResult {
  thinkingStyle: string;
  aiReport: string;
  careerRecommendations: CareerRecommendation[];
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface LLMResult {
  aiReport: string;
  thinkingStyle: string;
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

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const parsed = JSON.parse(text);
    return {
      aiReport: parsed.aiReport ?? 'Analysis unavailable.',
      thinkingStyle: parsed.thinkingStyle ?? 'Analytical and adaptive thinker.',
    };
  } catch {
    // Fallback if LLM returns non-JSON
    return {
      aiReport: text,
      thinkingStyle: 'Unique and nuanced thinker.',
    };
  }
}

export async function generateCareerReport(
  traits: TraitScores,
  gameScores: { exploration: number; pattern: number; puzzle: number },
  selectedCareers: string[]
): Promise<FullLLMResult> {
  const careersText = selectedCareers.join('\n');

  const prompt = `You are a behavioral psychologist and career counselor. Analyze the cognitive trait profile below, derived from gameplay behavior, and provide detailed career recommendations.

TRAIT SCORES (0 = low, 1 = high):
- Curiosity: ${traits.curiosity.toFixed(2)} — how exploratory and inquisitive
- Persistence: ${traits.persistence.toFixed(2)} — resilience and continued effort after setbacks
- Risk Tolerance: ${traits.risk_tolerance.toFixed(2)} — willingness to take uncertain risks
- Learning Speed: ${traits.learning_speed.toFixed(2)} — speed of internalizing new patterns and rules

GAME PERFORMANCE:
- Exploration Island score: ${gameScores.exploration} / 80 (strategic exploration)
- Hidden Pattern score: ${gameScores.pattern} / 90 (pattern recognition, analytical thinking)
- Impossible Puzzle score: ${gameScores.puzzle} / 1000 (problem-solving under pressure)

CAREERS TO EVALUATE:
${careersText}

Respond with valid JSON only (no markdown), with these keys:
- "thinkingStyle": one sentence ≤20 words describing their core cognitive style
- "aiReport": 4-5 sentences covering behavioral profile, key strengths, growth areas, and ideal work environments — be specific, cite trait numbers
- "careerRecommendations": array, one entry per career, each with:
    - "career": exact career name as given
    - "rating": one of "highly_recommended", "recommended", "neutral", "not_recommended"
    - "reason": 2-3 sentences explaining the fit or mismatch, citing specific traits and scores`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const parsed = JSON.parse(text);
      return {
        thinkingStyle: parsed.thinkingStyle ?? 'Analytical and adaptive thinker.',
        aiReport: parsed.aiReport ?? 'Analysis unavailable.',
        careerRecommendations: parsed.careerRecommendations ?? selectedCareers.map(career => ({
          career,
          rating: 'neutral' as const,
          reason: 'Analysis unavailable.',
        })),
      };
    } catch {
      return {
        thinkingStyle: 'Analytical and adaptive thinker.',
        aiReport: text,
        careerRecommendations: selectedCareers.map(career => ({
          career,
          rating: 'neutral' as const,
          reason: 'Analysis unavailable.',
        })),
      };
    }
  } catch (err) {
    console.error('Career report LLM generation failed:', err);
    return {
      thinkingStyle: 'Analytical and adaptive thinker.',
      aiReport: 'Behavioral analysis complete. Unable to generate detailed report at this time.',
      careerRecommendations: selectedCareers.map(career => ({
        career,
        rating: 'neutral' as const,
        reason: 'Career analysis unavailable at this time.',
      })),
    };
  }
}
