import axios from 'axios';

import { Platform } from 'react-native';

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

export async function getReport(sessionId: string): Promise<BehavioralReport> {
  const response = await axios.get(`${BASE_URL}/report/${sessionId}`);
  return response.data;
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
