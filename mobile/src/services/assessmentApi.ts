/**
 * Cognitive Mirror — Assessment API
 * All calls to the /assessment/* endpoints.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuid } from 'uuid';
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
  professionFit?: {
    rating: string;
    summary: string;
  };
  observations?: Array<{
    trait: string;
    observation: string;
    relevance: string;
  }>;
  traitNarratives: TraitNarrative[];
  traitTalkInsights: string[];
  skillDevelopment?: Array<{
    skill: string;
    activities: string[];
  }>;
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

// ── Trait Progress ────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = '@bi_device_id';
const LOCAL_PROGRESS_KEY = '@bi_trait_progress';

export interface TraitProgressItem {
  traitId: string;
  nextLevel: number;    // level to play next time (1–10)
  bestScore: number;
  bestLevel: number;
  status: 'in_progress' | 'ceiling' | 'complete';
}

/** Returns a stable device ID, generating one on first call. */
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Load trait progress for this device.
 * Tries the backend first; falls back to AsyncStorage on network failure.
 * Returns a map of traitId → TraitProgressItem.
 */
export async function getTraitProgress(deviceId: string): Promise<Record<string, TraitProgressItem>> {
  try {
    const res = await api.get<{ progress: TraitProgressItem[] }>('/assessment/progress', {
      params: { deviceId },
    });
    const map: Record<string, TraitProgressItem> = {};
    for (const item of res.data.progress) {
      map[item.traitId] = { ...item, bestScore: Math.min(100, item.bestScore) };
    }
    // Keep local copy in sync
    await AsyncStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(map));
    return map;
  } catch (err) {
    console.warn('[assessmentApi:getTraitProgress] API failed, using local cache', {
      deviceId,
      error: err instanceof Error ? err.message : err,
    });
    const cached = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!cached) return {};
    const raw: Record<string, TraitProgressItem> = JSON.parse(cached);
    // Clamp bestScore in case cache contains pre-normalization raw point values
    for (const key of Object.keys(raw)) {
      raw[key] = { ...raw[key], bestScore: Math.min(100, raw[key].bestScore) };
    }
    return raw;
  }
}

/**
 * Save trait progress after a completed round.
 * Always writes to AsyncStorage immediately; also sends to backend (non-blocking on failure).
 */
export async function saveTraitProgress(
  deviceId: string,
  userId: number | undefined,
  items: TraitProgressItem[],
): Promise<void> {
  // Update local cache immediately
  const cached = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY);
  const map: Record<string, TraitProgressItem> = cached ? JSON.parse(cached) : {};
  for (const item of items) map[item.traitId] = item;
  await AsyncStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(map));

  // Best-effort backend sync
  try {
    await api.post('/assessment/progress', { deviceId, userId, items });
  } catch (err) {
    console.warn('[assessmentApi:saveTraitProgress] Backend sync failed — local cache updated', {
      deviceId,
      error: err instanceof Error ? err.message : err,
    });
  }
}
