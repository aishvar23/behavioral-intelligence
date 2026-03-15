import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@bi_session_id';

let currentSessionId: string | null = null;

export async function initSession(): Promise<string> {
  if (currentSessionId) return currentSessionId;

  try {
    const stored = await AsyncStorage.getItem(SESSION_KEY);
    if (stored) {
      currentSessionId = stored;
      return currentSessionId;
    }
  } catch {
    // Fall through to create a new session
  }

  currentSessionId = uuidv4();
  try {
    await AsyncStorage.setItem(SESSION_KEY, currentSessionId);
  } catch {
    // Non-fatal: session works in-memory even if storage fails
  }
  return currentSessionId;
}

export function startSession(): string {
  currentSessionId = uuidv4();
  AsyncStorage.setItem(SESSION_KEY, currentSessionId).catch(() => {});
  return currentSessionId;
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = uuidv4();
    AsyncStorage.setItem(SESSION_KEY, currentSessionId).catch(() => {});
  }
  return currentSessionId;
}

export async function resetSession(): Promise<void> {
  currentSessionId = null;
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Non-fatal
  }
}
