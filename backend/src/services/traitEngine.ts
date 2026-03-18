/**
 * Trait Engine
 * Derives personality/cognitive trait scores from raw game events.
 * Supports all 6 game types: exploration, pattern, puzzle, memory, logic, reaction.
 */

export interface TraitScores {
  curiosity: number;           // 0–1  drive to explore the unknown
  persistence: number;         // 0–1  sustained effort despite difficulty
  risk_tolerance: number;      // 0–1  willingness to take uncertain actions
  learning_speed: number;      // 0–1  speed of adapting to new rules
  working_memory: number;      // 0–1  accurate short-term recall
  processing_speed: number;    // 0–1  rapid correct responses
  impulse_control: number;     // 0–1  ability to inhibit impulse responses
  analytical_thinking: number; // 0–1  logical reasoning correctness
  attention_to_detail: number; // 0–1  accuracy and error-detection
  systematic_thinking: number; // 0–1  methodical, coverage-oriented approach
}

interface GameEvent {
  game_id: string;
  event_type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const EXPLORATION_IDS = [
  'exploration', 'exploration_standard', 'exploration_cautious',
  'exploration_open', 'exploration_data', 'exploration_resource', 'exploration_systematic',
];
const PATTERN_IDS = [
  'pattern', 'pattern_standard', 'pattern_advanced', 'pattern_logic',
  'pattern_financial', 'pattern_adaptive', 'pattern_creative',
];
const PUZZLE_IDS = [
  'puzzle', 'puzzle_standard', 'puzzle_pressure', 'puzzle_strategic',
  'puzzle_collaborative', 'puzzle_precise', 'puzzle_analytical',
];
const MEMORY_IDS = [
  'memory_colors', 'memory_numbers', 'memory_positions',
  'memory_sequential', 'memory_faces', 'memory_code',
];
const LOGIC_IDS = [
  'logic_deduction', 'logic_patterns', 'logic_verbal', 'logic_boolean',
  'logic_quantitative', 'logic_spatial', 'logic_situational', 'logic_attention',
];
const REACTION_IDS = ['reaction_basic', 'reaction_inhibition', 'reaction_speed'];

export function calculateTraits(events: GameEvent[]): TraitScores {
  const explorationEvents = events.filter(e => EXPLORATION_IDS.includes(e.game_id));
  const patternEvents     = events.filter(e => PATTERN_IDS.includes(e.game_id));
  const puzzleEvents      = events.filter(e => PUZZLE_IDS.includes(e.game_id));
  const memoryEvents      = events.filter(e => MEMORY_IDS.includes(e.game_id));
  const logicEvents       = events.filter(e => LOGIC_IDS.includes(e.game_id));
  const reactionEvents    = events.filter(e => REACTION_IDS.includes(e.game_id));

  // ── curiosity: exploration coverage ───────────────────────────────────────
  const curiosity = explorationEvents.length > 0 ? calcCuriosity(explorationEvents) : 0.5;

  // ── persistence: puzzle effort + logic completion + reaction endurance ─────
  let persistence: number | null = puzzleEvents.length > 0 ? calcPersistenceFromPuzzle(puzzleEvents) : null;
  if (logicEvents.length > 0) {
    const lp = calcPersistenceFromLogic(logicEvents);
    persistence = persistence !== null ? (persistence + lp) / 2 : lp;
  }
  if (reactionEvents.length > 0) {
    const rp = calcPersistenceFromReaction(reactionEvents);
    persistence = persistence !== null ? (persistence + rp) / 2 : rp;
  }

  // ── risk_tolerance: exploration traps + reaction impulsivity ──────────────
  let risk_tolerance: number | null = explorationEvents.length > 0 ? calcRiskTolerance(explorationEvents) : null;
  if (reactionEvents.length > 0) {
    const rr = calcRiskFromReaction(reactionEvents);
    risk_tolerance = risk_tolerance !== null ? (risk_tolerance + rr) / 2 : rr;
  }

  // ── learning_speed: pattern adaptation + memory learning + logic accuracy ─
  let learning_speed: number | null = patternEvents.length > 0 ? calcLearningSpeed(patternEvents) : null;
  if (memoryEvents.length > 0) {
    const ml = calcLearningFromMemory(memoryEvents);
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }
  if (logicEvents.length > 0) {
    const ll = calcAccuracyFromLogic(logicEvents);
    learning_speed = learning_speed !== null ? (learning_speed + ll) / 2 : ll;
  }

  // ── working_memory: memory game recall accuracy ───────────────────────────
  const working_memory = memoryEvents.length > 0 ? calcWorkingMemory(memoryEvents) : 0.5;

  // ── processing_speed: reaction response times ─────────────────────────────
  const processing_speed = reactionEvents.length > 0 ? calcProcessingSpeed(reactionEvents) : 0.5;

  // ── impulse_control: nogo inhibition accuracy ─────────────────────────────
  const impulse_control = reactionEvents.length > 0 ? calcImpulseControl(reactionEvents) : 0.5;

  // ── analytical_thinking: logic correctness + pattern accuracy ─────────────
  let analytical_thinking: number | null = null;
  if (logicEvents.length > 0) {
    analytical_thinking = calcAccuracyFromLogic(logicEvents);
  }
  if (patternEvents.length > 0) {
    const pa = calcPatternAccuracy(patternEvents);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + pa) / 2 : pa;
  }

  // ── attention_to_detail: puzzle efficiency + logic accuracy ───────────────
  let attention_to_detail: number | null = null;
  if (puzzleEvents.length > 0) {
    attention_to_detail = calcAttentionFromPuzzle(puzzleEvents);
  }
  if (logicEvents.length > 0) {
    const la = calcAccuracyFromLogic(logicEvents);
    attention_to_detail = attention_to_detail !== null ? (attention_to_detail + la) / 2 : la;
  }

  // ── systematic_thinking: exploration coverage per move + puzzle efficiency ─
  let systematic_thinking: number | null = null;
  if (explorationEvents.length > 0) {
    systematic_thinking = calcSystematicFromExploration(explorationEvents);
  }
  if (puzzleEvents.length > 0) {
    const sp = calcSystematicFromPuzzle(puzzleEvents);
    systematic_thinking = systematic_thinking !== null ? (systematic_thinking + sp) / 2 : sp;
  }

  return {
    curiosity:           clamp(curiosity),
    persistence:         clamp(persistence ?? 0.5),
    risk_tolerance:      clamp(risk_tolerance ?? 0.5),
    learning_speed:      clamp(learning_speed ?? 0.5),
    working_memory:      clamp(working_memory),
    processing_speed:    clamp(processing_speed),
    impulse_control:     clamp(impulse_control),
    analytical_thinking: clamp(analytical_thinking ?? 0.5),
    attention_to_detail: clamp(attention_to_detail ?? 0.5),
    systematic_thinking: clamp(systematic_thinking ?? 0.5),
  };
}

// ── Individual calculators ───────────────────────────────────────────────────

function calcCuriosity(events: GameEvent[]): number {
  const moveEvents = events.filter(e => e.event_type === 'move');
  if (moveEvents.length === 0) return 0.5;
  const last = moveEvents[moveEvents.length - 1];
  const pct = (last.data.explorationPct as number) ?? 0;
  return clamp(pct / 0.6);
}

function calcPersistenceFromPuzzle(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move').length;
  const quit = events.some(e => e.event_type === 'quit');
  const solved = events.some(e => e.event_type === 'solved');
  if (quit && moves < 10) return 0.1;
  if (solved) return clamp(0.5 + moves / 200);
  return clamp(moves / 100);
}

function calcPersistenceFromLogic(events: GameEvent[]): number {
  const answers = events.filter(e => e.event_type === 'question_answer');
  const accuracy = answers.filter(e => e.data.correct).length / Math.max(answers.length, 1);
  return clamp(answers.length / 7 * 0.6 + accuracy * 0.4);
}

function calcPersistenceFromReaction(events: GameEvent[]): number {
  const responses = events.filter(e => e.event_type === 'stimulus_response');
  const accuracy = responses.filter(e => e.data.correct).length / Math.max(responses.length, 1);
  return clamp(responses.length / 10 * 0.6 + accuracy * 0.4);
}

function calcRiskTolerance(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move');
  if (moves.length === 0) return 0.5;
  const trapMoves = moves.filter(e => e.data.tileType === 'trap').length;
  return clamp(trapMoves / moves.length / 0.2);
}

function calcRiskFromReaction(events: GameEvent[]): number {
  const nogoEvents = events.filter(e =>
    e.event_type === 'stimulus_response' && e.data.stimulusType === 'nogo'
  );
  if (nogoEvents.length === 0) return 0.4;
  const impulsivity = nogoEvents.filter(e => e.data.responded).length / nogoEvents.length;
  return clamp(0.3 + impulsivity * 0.7);
}

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

function calcLearningFromMemory(events: GameEvent[]): number {
  const rounds = events.filter(e => e.event_type === 'round_complete');
  if (rounds.length === 0) return 0.5;
  const accuracy = rounds.filter(e => e.data.correct).length / rounds.length;
  const avgTime = rounds.reduce((sum, e) => sum + ((e.data.responseTime as number) ?? 5000), 0) / rounds.length;
  return clamp(accuracy * 0.7 + (1 - Math.min(avgTime / 10000, 1)) * 0.3);
}

function calcWorkingMemory(events: GameEvent[]): number {
  const rounds = events.filter(e => e.event_type === 'round_complete');
  if (rounds.length === 0) return 0.5;
  return rounds.filter(e => e.data.correct).length / rounds.length;
}

function calcProcessingSpeed(events: GameEvent[]): number {
  const correctResponses = events.filter(
    e => e.event_type === 'stimulus_response' && e.data.responded && e.data.correct
  );
  if (correctResponses.length === 0) return 0.5;
  const avgTime =
    correctResponses.reduce((sum, e) => sum + ((e.data.responseTime as number) ?? 600), 0) /
    correctResponses.length;
  // 200ms → 1.0, 1000ms → 0.0
  return clamp(1 - (avgTime - 200) / 800);
}

function calcImpulseControl(events: GameEvent[]): number {
  const nogoEvents = events.filter(
    e => e.event_type === 'stimulus_response' && e.data.stimulusType === 'nogo'
  );
  if (nogoEvents.length === 0) return 0.5;
  // Correct = did NOT respond to nogo stimulus
  const correct = nogoEvents.filter(e => !e.data.responded).length;
  return correct / nogoEvents.length;
}

function calcAccuracyFromLogic(events: GameEvent[]): number {
  const answers = events.filter(e => e.event_type === 'question_answer');
  if (answers.length === 0) return 0.5;
  return answers.filter(e => e.data.correct).length / answers.length;
}

function calcPatternAccuracy(events: GameEvent[]): number {
  const total = events.filter(e => ['correct_guess', 'wrong_guess'].includes(e.event_type)).length;
  const correct = events.filter(e => e.event_type === 'correct_guess').length;
  return total > 0 ? clamp(correct / total) : 0.5;
}

function calcAttentionFromPuzzle(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move').length;
  const solved = events.some(e => e.event_type === 'solved');
  if (!solved) return 0.3;
  // Optimal ~20 moves; score decays as moves increase toward 120
  return clamp(1 - Math.max(0, moves - 20) / 100);
}

function calcSystematicFromExploration(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move');
  if (moves.length === 0) return 0.5;
  const last = moves[moves.length - 1];
  const pct = (last.data.explorationPct as number) ?? 0;
  // Coverage per move fraction (1 = explored as much as possible per move)
  const coveragePerMove = pct / (moves.length / 30);
  return clamp(coveragePerMove / 0.8);
}

function calcSystematicFromPuzzle(events: GameEvent[]): number {
  const moves = events.filter(e => e.event_type === 'move').length;
  const solved = events.some(e => e.event_type === 'solved');
  if (!solved) return 0.2;
  // Optimal ~20 moves; methodical solvers ~30–50; random solvers ~100+
  return clamp(1 - Math.max(0, moves - 20) / 80);
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
