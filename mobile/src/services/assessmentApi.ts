/**
 * Cognitive Mirror — Assessment API
 * All calls to the /assessment/* endpoints.
 */

import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredTrait {
  id: string;
  name: string;
  isPrimary: boolean;
  relevance: string;
}

export interface TraitResult {
  traitId: string;
  traitName: string;
  isPrimary: boolean;
  peakLevel: number;
  peakScore: number;
  avgScore: number;
  outcome: 'continue' | 'skip' | 'ceiling' | 'complete';
  scores: number[];
}

export interface TraitTalkFlag {
  flag: string;
  description: string;
  severity: 'info' | 'warning' | 'caution';
}

export interface TraitTalkResult {
  flags: TraitTalkFlag[];
  archetypeModifiers: string[];
  validationPassed: boolean;
}

export interface TraitNarrative {
  traitId: string;
  traitName: string;
  level: 'Elite' | 'Strong' | 'Developing' | 'Foundational';
  narrative: string;
}

export interface ArchetypeCard {
  archetypeName: string;
  archetypeTagline: string;
  professionalAlignment: string;
  strengthSummary: string;
  developmentArea: string;
  traitNarratives: TraitNarrative[];
  traitTalkInsights: string[];
  recommendations: Array<{ action: string; rationale: string }>;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function discoverTraits(
  profession: string,
  sessionId: string,
): Promise<DiscoveredTrait[]> {
  const res = await api.post<{ traits: DiscoveredTrait[] }>('/assessment/discover-traits', {
    profession,
    sessionId,
  });
  return res.data.traits;
}

export async function startAssessmentSession(
  sessionId: string,
  profession: string,
  traits: DiscoveredTrait[],
  userId?: number,
): Promise<void> {
  await api.post('/assessment/start', {
    sessionId,
    profession,
    traitsJson: JSON.stringify(traits),
    userId,
  });
}

export async function submitBaseline(
  sessionId: string,
  baselineRtMs: number,
  baselineDeviceMs: number,
): Promise<void> {
  await api.post('/assessment/baseline', { sessionId, baselineRtMs, baselineDeviceMs });
}

export async function submitLevelResult(payload: {
  sessionId: string;
  traitId: string;
  level: number;
  score: number;
  accuracy: number;
  avgLatencyMs: number;
  outcome: 'continue' | 'skip' | 'ceiling' | 'complete';
  levelConfigJson: string;
}): Promise<void> {
  await api.post('/assessment/level-result', payload);
}

export async function runTraitTalk(
  sessionId: string,
  scores: Record<string, number>,
): Promise<TraitTalkResult> {
  const res = await api.post<TraitTalkResult>('/assessment/trait-talk', { sessionId, scores });
  return res.data;
}

export async function generateArchetype(
  sessionId: string,
  profession: string,
  traitResults: TraitResult[],
  traitTalk: TraitTalkResult,
): Promise<ArchetypeCard> {
  const res = await api.post<ArchetypeCard>('/assessment/archetype', {
    sessionId,
    profession,
    traitResults,
    traitTalk,
  });
  return res.data;
}
