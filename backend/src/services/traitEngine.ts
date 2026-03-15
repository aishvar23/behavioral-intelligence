/**
 * Trait Engine
 * Derives personality/cognitive trait scores from raw game events.
 * Supports original 3 games (exploration, pattern, puzzle) plus new game types
 * (memory, logic, reaction) introduced with occupation-specific assessment.
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

const EXPLORATION_IDS = ['exploration', 'exploration_standard', 'exploration_cautious', 'exploration_open'];
const PATTERN_IDS = ['pattern', 'pattern_standard', 'pattern_advanced', 'pattern_logic'];
const PUZZLE_IDS = ['puzzle', 'puzzle_standard', 'puzzle_pressure', 'puzzle_strategic'];
const MEMORY_IDS = ['memory_colors', 'memory_numbers', 'memory_positions'];
const LOGIC_IDS = ['logic_deduction', 'logic_patterns', 'logic_verbal'];
const REACTION_IDS = ['reaction_basic', 'reaction_inhibition', 'reaction_speed'];

export function calculateTraits(events: GameEvent[]): TraitScores {
  const explorationEvents = events.filter(e => EXPLORATION_IDS.includes(e.game_id));
  const patternEvents = events.filter(e => PATTERN_IDS.includes(e.game_id));
  const puzzleEvents = events.filter(e => PUZZLE_IDS.includes(e.game_id));
  const memoryEvents = events.filter(e => MEMORY_IDS.includes(e.game_id));
  const logicEvents = events.filter(e => LOGIC_IDS.includes(e.game_id));
  const reactionEvents = events.filter(e => REACTION_IDS.includes(e.game_id));

  let curiosity: number | null = explorationEvents.length > 0 ? calcCuriosity(explorationEvents) : null;
  let persistence: number | null = puzzleEvents.length > 0 ? calcPersistence(puzzleEvents) : null;
  let risk_tolerance: number | null = explorationEvents.length > 0 ? calcRiskTolerance(explorationEvents) : null;
  let learning_speed: number | null = patternEvents.length > 0 ? calcLearningSpeed(patternEvents) : null;

  // Memory events → curiosity (engagement with recall tasks) + learning_speed (accuracy/speed)
  if (memoryEvents.length > 0) {
    const { curiosity: mc, learning_speed: ml } = calcFromMemory(memoryEvents);
    curiosity = curiosity !== null ? (curiosity + mc) / 2 : mc;
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }

  // Logic events → persistence (attempting hard problems) + learning_speed (correctness)
  if (logicEvents.length > 0) {
    const { persistence: lp, learning_speed: ll } = calcFromLogic(logicEvents);
    persistence = persistence !== null ? (persistence + lp) / 2 : lp;
    learning_speed = learning_speed !== null ? (learning_speed + ll) / 2 : ll;
  }

  // Reaction events → risk_tolerance (impulsivity) + persistence (accuracy under pressure)
  if (reactionEvents.length > 0) {
    const { risk_tolerance: rr, persistence: rp } = calcFromReaction(reactionEvents);
    risk_tolerance = risk_tolerance !== null ? (risk_tolerance + rr) / 2 : rr;
    persistence = persistence !== null ? (persistence + rp) / 2 : rp;
  }

  return {
    curiosity: curiosity ?? 0.5,
    persistence: persistence ?? 0.5,
    risk_tolerance: risk_tolerance ?? 0.5,
    learning_speed: learning_speed ?? 0.5,
  };
}

// curiosity_score = explored_tiles / total_tiles (from last move event)
function calcCuriosity(events: GameEvent[]): number {
  const moveEvents = events.filter(e => e.event_type === 'move');
  if (moveEvents.length === 0) return 0.5;
  const last = moveEvents[moveEvents.length - 1];
  const pct = (last.data.explorationPct as number) ?? 0;
  return clamp(pct / 0.6);
}

// persistence_score = total puzzle moves after each wrong attempt
function calcPersistence(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move').length;
  const quit = events.some(e => e.event_type === 'quit');
  const solved = events.some(e => e.event_type === 'solved');
  if (quit && moves < 10) return 0.1;
  if (solved) return clamp(0.5 + moves / 200);
  return clamp(moves / 100);
}

// risk_score = traps entered / total moves
function calcRiskTolerance(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move');
  if (moves.length === 0) return 0.5;
  const trapMoves = moves.filter(e => e.data.tileType === 'trap').length;
  return clamp(trapMoves / moves.length / 0.2);
}

// learning_speed = how quickly player adapts after a rule change in the pattern game
function calcLearningSpeed(events: GameEvent[]): number {
  const correctAfterChange = events.filter(
    e => e.event_type === 'correct_guess' && (e.data.adaptationRound as number | null) !== null
  );
  if (correctAfterChange.length === 0) {
    const total = events.filter(e => ['correct_guess', 'wrong_guess'].includes(e.event_type)).length;
    const correct = events.filter(e => e.event_type === 'correct_guess').length;
    return total > 0 ? clamp(correct / total) : 0.5;
  }
  const avgAdaptRound =
    correctAfterChange.reduce((sum, e) => sum + (e.data.adaptationRound as number), 0) /
    correctAfterChange.length;
  return clamp(1 - (avgAdaptRound - 1) / 4);
}

function calcFromMemory(events: GameEvent[]): { curiosity: number; learning_speed: number } {
  const rounds = events.filter(e => e.event_type === 'round_complete');
  if (rounds.length === 0) return { curiosity: 0.5, learning_speed: 0.5 };
  const accuracy = rounds.filter(e => e.data.correct).length / rounds.length;
  const avgTime = rounds.reduce((sum, e) => sum + ((e.data.responseTime as number) ?? 5000), 0) / rounds.length;
  return {
    curiosity: clamp(accuracy),
    learning_speed: clamp(accuracy * 0.7 + (1 - Math.min(avgTime / 10000, 1)) * 0.3),
  };
}

function calcFromLogic(events: GameEvent[]): { persistence: number; learning_speed: number } {
  const answers = events.filter(e => e.event_type === 'question_answer');
  if (answers.length === 0) return { persistence: 0.5, learning_speed: 0.5 };
  const accuracy = answers.filter(e => e.data.correct).length / answers.length;
  return {
    persistence: clamp(answers.length / 7 * 0.6 + accuracy * 0.4),
    learning_speed: clamp(accuracy),
  };
}

function calcFromReaction(events: GameEvent[]): { risk_tolerance: number; persistence: number } {
  const responses = events.filter(e => e.event_type === 'stimulus_response');
  if (responses.length === 0) return { risk_tolerance: 0.5, persistence: 0.5 };
  const nogoResponses = responses.filter(e => e.data.stimulusType === 'nogo');
  const impulsivity = nogoResponses.length > 0
    ? nogoResponses.filter(e => e.data.responded).length / nogoResponses.length
    : 0.4; // neutral-ish if no nogo trials
  const accuracy = responses.filter(e => e.data.correct).length / responses.length;
  return {
    risk_tolerance: clamp(0.3 + impulsivity * 0.7),
    persistence: clamp(accuracy),
  };
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
