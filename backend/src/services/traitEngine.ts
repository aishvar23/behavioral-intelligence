/**
 * Trait Engine
 * Derives personality/cognitive trait scores from raw game events.
 */

export interface TraitScores {
  curiosity: number;       // 0–1
  persistence: number;     // 0–1
  risk_tolerance: number;  // 0–1
  learning_speed: number;  // 0–1
}

interface GameEvent {
  game_id: string;
  event_type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export function calculateTraits(events: GameEvent[]): TraitScores {
  const explorationEvents = events.filter(e => e.game_id === 'exploration');
  const patternEvents = events.filter(e => e.game_id === 'pattern');
  const puzzleEvents = events.filter(e => e.game_id === 'puzzle');

  return {
    curiosity: calcCuriosity(explorationEvents),
    persistence: calcPersistence(puzzleEvents),
    risk_tolerance: calcRiskTolerance(explorationEvents),
    learning_speed: calcLearningSpeed(patternEvents),
  };
}

// curiosity_score = explored_tiles / total_tiles (from last move event)
function calcCuriosity(events: GameEvent[]): number {
  const moveEvents = events.filter(e => e.event_type === 'move');
  if (moveEvents.length === 0) return 0.5;

  const last = moveEvents[moveEvents.length - 1];
  const pct = (last.data.explorationPct as number) ?? 0;
  // Normalise: >60% explored = high curiosity
  return clamp(pct / 0.6);
}

// persistence_score = total puzzle moves after each wrong attempt
function calcPersistence(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move').length;
  const quit = events.some(e => e.event_type === 'quit');
  const solved = events.some(e => e.event_type === 'solved');

  if (quit && moves < 10) return 0.1;
  if (solved) return clamp(0.5 + moves / 200); // more moves to solve = slightly lower persistence
  return clamp(moves / 100);
}

// risk_score = traps entered / total moves
function calcRiskTolerance(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move');
  if (moves.length === 0) return 0.5;
  const trapMoves = moves.filter(e => e.data.tileType === 'trap').length;
  return clamp(trapMoves / moves.length / 0.2); // 20% trap rate = score of 1
}

// learning_speed = how quickly player adapts after a rule change in the pattern game
// Lower adaptation rounds = higher score
function calcLearningSpeed(events: GameEvent[]): number {
  const correctAfterChange = events.filter(
    e => e.event_type === 'correct_guess' && (e.data.adaptationRound as number | null) !== null
  );
  if (correctAfterChange.length === 0) {
    // fallback: ratio of correct vs total guesses
    const total = events.filter(e => ['correct_guess', 'wrong_guess'].includes(e.event_type)).length;
    const correct = events.filter(e => e.event_type === 'correct_guess').length;
    return total > 0 ? clamp(correct / total) : 0.5;
  }
  const avgAdaptRound =
    correctAfterChange.reduce((sum, e) => sum + (e.data.adaptationRound as number), 0) /
    correctAfterChange.length;
  // Adapt in 1 round = 1.0; 5+ rounds = ~0
  return clamp(1 - (avgAdaptRound - 1) / 4);
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
