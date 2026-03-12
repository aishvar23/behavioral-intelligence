import { logEvent, GameEvent } from '../services/api';
import { getSessionId } from '../services/session';

const queue: GameEvent[] = [];
let flushing = false;

export function trackEvent(
  gameId: string,
  eventType: string,
  data: Record<string, unknown> = {}
): void {
  const event: GameEvent = {
    sessionId: getSessionId(),
    gameId,
    eventType,
    timestamp: Date.now(),
    data,
  };
  queue.push(event);
  flushQueue();
}

async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  while (queue.length > 0) {
    const event = queue.shift()!;
    try {
      await logEvent(event);
    } catch {
      // Re-queue on failure and stop flushing
      queue.unshift(event);
      break;
    }
  }
  flushing = false;
}
