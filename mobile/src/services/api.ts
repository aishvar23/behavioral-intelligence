import axios from 'axios';
import { Platform } from 'react-native';
import { UserProfile, GameResult } from '../navigation/AppNavigator';

// Android emulator routes localhost to 10.0.2.2; iOS simulator uses localhost
const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000'
  : 'http://localhost:3000';

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

export interface BehavioralReport {
  traits: {
    curiosity: number;
    persistence: number;
    risk_tolerance: number;
    learning_speed: number;
  };
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
  traits: {
    curiosity: number;
    persistence: number;
    risk_tolerance: number;
    learning_speed: number;
  };
  gameResults: GameResult[];
  thinkingStyle: string;
  aiReport: string;
  occupationFit: OccupationFit;
  aiRecommendedCareers: CareerRecommendation[];
  observations?: GameObservation[];
  skillDevelopment?: SkillDevelopment[];
}

export interface GameSelectionResult {
  selectedIds: string[];
  reasoning: string;
}

export async function selectGames(userProfile: UserProfile): Promise<GameSelectionResult> {
  const response = await axios.post(`${BASE_URL}/select-games`, { userProfile });
  return response.data;
}

export async function getCareerReport(
  sessionId: string,
  userProfile: UserProfile,
  gameResults: GameResult[]
): Promise<FullReport> {
  const response = await axios.post(`${BASE_URL}/career-report`, {
    sessionId,
    userProfile,
    gameResults,
  });
  return response.data;
}
