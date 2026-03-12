import axios from 'axios';

const BASE_URL = 'http://localhost:3000'; // Update for production

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
