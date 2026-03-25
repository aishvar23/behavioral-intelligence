import axios from 'axios';
import { UserProfile, GameResult } from '../navigation/AppNavigator';
import { API_BASE_URL } from '../config';
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken } from './tokenStore';
import { refreshAccessToken } from './authApi';
import { saveTokens, loadTokens } from './authStorage';

const BASE_URL = API_BASE_URL;

const api = axios.create({ baseURL: BASE_URL });

export interface GameEvent {
  sessionId: string;
  gameId: string;
  eventType: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export async function logEvent(event: GameEvent): Promise<void> {
  await api.post('/event', event);
}

export interface TrialPayload {
  sessionId:       string;
  gameId:          string;
  gameVariant?:    string | null;
  trialIndex:      number;
  difficulty?:     string;
  stimulus:        Record<string, unknown>;
  response:        Record<string, unknown>;
  isCorrect:       boolean;
  responseError?:  number;
  responseTimeMs:  number;
  timeoutExtended?:boolean;
  skipped?:        boolean;
}

export interface GamePlayPayload {
  sessionId:         string;
  gameId:            string;
  gameVariant?:      string | null;
  difficultyAdapted?:string | null;
  strategyJson?:     Record<string, unknown> | null;
  startedAt:         number;
  endedAt?:          number | null;
}

export async function logTrial(trial: TrialPayload): Promise<void> {
  await api.post('/trial', trial);
}

export async function logGamePlay(play: GamePlayPayload): Promise<void> {
  await api.post('/game-play', play);
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
  const response = await api.get<BehavioralReport>(`/report/${sessionId}`);
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

export type TraitPercentiles = Record<keyof TraitScores, number | null>;

export interface FullReport {
  traits: TraitScores;
  gameResults: GameResult[];
  traitPercentiles?: TraitPercentiles;
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
  lifeStage: string,
): Promise<{ userId: number }> {
  const response = await api.post<{ userId: number }>('/user', {
    username,
    age,
    country,
    lifeStage,
  });
  return response.data;
}

export async function selectGames(
  userProfile: UserProfile,
  pool: string[],
  userId?: number,
): Promise<GameSelectionResult> {
  const response = await api.post<GameSelectionResult>('/select-games', {
    userProfile,
    pool,
    userId,
  });
  return response.data;
}

// ── History ───────────────────────────────────────────────────────────────────

export interface SessionHistory {
  sessionId:   string;
  traits:      TraitScores;
  gameResults: Array<{ configId: string; gameType: string; title: string; emoji: string; score: number }>;
  occupation:  string;
  createdAt:   number;
}

export interface UserHistoryResponse {
  history:            SessionHistory[];
  currentPercentiles: TraitPercentiles;
}

export async function getUserHistory(): Promise<UserHistoryResponse> {
  const response = await api.get<UserHistoryResponse>('/user-history');
  return response.data;
}

export async function getCareerReport(
  sessionId: string,
  userProfile: UserProfile,
  gameResults: GameResult[],
  userId?: number,
): Promise<FullReport> {
  const response = await api.post<FullReport>('/career-report', {
    sessionId,
    userId,
    userProfile,
    gameResults,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Axios interceptors
// ---------------------------------------------------------------------------

// Request: attach Bearer token if one is available in memory
api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: on 401, attempt a single token refresh then retry the request
api.interceptors.response.use(
  res => res,
  async err => {
    // Avoid retry loops
    if (err.response?.status === 401 && !(err.config as { _retry?: boolean })._retry) {
      (err.config as { _retry?: boolean })._retry = true;

      const storedRefreshToken = getRefreshToken();
      if (storedRefreshToken) {
        try {
          const { accessToken: newAccessToken } = await refreshAccessToken(storedRefreshToken);

          // Update in-memory token
          setAccessToken(newAccessToken);

          // Persist the updated access token alongside the existing refresh token and user
          const stored = await loadTokens();
          if (stored) {
            await saveTokens(newAccessToken, stored.refreshToken, stored.user);
          }

          // Retry original request with new token
          err.config.headers = err.config.headers ?? {};
          err.config.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(err.config);
        } catch {
          // Refresh failed — clear in-memory tokens and surface the original error
          setAccessToken(null);
          setRefreshToken(null);
        }
      }
    }
    return Promise.reject(err);
  },
);

export default api;
