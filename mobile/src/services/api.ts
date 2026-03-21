import axios from 'axios';
import { UserProfile, GameResult } from '../navigation/AppNavigator';
import { API_BASE_URL } from '../config';

const BASE_URL = API_BASE_URL;

export interface GameEvent {
  sessionId: string;
  gameId: string;
  eventType: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export async function logEvent(event: GameEvent): Promise<void> {
  await axios.post(`${BASE_URL}/event`, event);
}

export interface TraitScores {
  curiosity: number;
  persistence: number;
  risk_tolerance: number;
  learning_speed: number;
  working_memory: number;
  processing_speed: number;
  impulse_control: number;
  analytical_thinking: number;
  attention_to_detail: number;
  systematic_thinking: number;
}

export interface BehavioralReport {
  traits: TraitScores;
  aiReport: string;
  thinkingStyle: string;
}

export async function getReport(sessionId: string): Promise<BehavioralReport> {
  const response = await axios.get(`${BASE_URL}/report/${sessionId}`);
  return response.data;
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

export interface FullReport {
  traits: TraitScores;
  gameResults: GameResult[];
  thinkingStyle: string;
  aiReport: string;
  progressSummary?: string;
  occupationFit: OccupationFit;
  aiRecommendedCareers: CareerRecommendation[];
  observations?: GameObservation[];
  skillDevelopment?: SkillDevelopment[];
}

export interface GameSelectionResult {
  selectedIds: string[];
  reasoning: string;
}

export async function registerUser(
  username: string,
  age: string,
  country: string,
  lifeStage: string
): Promise<{ userId: number }> {
  const response = await axios.post(`${BASE_URL}/user`, { username, age, country, lifeStage });
  return response.data;
}

export async function selectGames(userProfile: UserProfile, pool: string[], userId?: number): Promise<GameSelectionResult> {
  const response = await axios.post(`${BASE_URL}/select-games`, { userProfile, pool, userId });
  return response.data;
}

export async function getCareerReport(
  sessionId: string,
  userProfile: UserProfile,
  gameResults: GameResult[],
  userId?: number
): Promise<FullReport> {
  const response = await axios.post(`${BASE_URL}/career-report`, {
    sessionId,
    userId,
    userProfile,
    gameResults,
  });
  return response.data;
}
