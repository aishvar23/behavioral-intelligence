import Anthropic from '@anthropic-ai/sdk';
import { TraitScores } from './traitEngine';

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
