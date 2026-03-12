import { v4 as uuidv4 } from 'uuid';

let currentSessionId: string | null = null;

export function startSession(): string {
  currentSessionId = uuidv4();
  return currentSessionId;
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = uuidv4();
  }
  return currentSessionId;
}

export function resetSession(): void {
  currentSessionId = null;
}
