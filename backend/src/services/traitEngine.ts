/**
 * Trait Engine
 * Derives personality/cognitive trait scores from raw game events.
 * Supports game types: memory, logic, reaction,
 * stroop, matrix, spatial, estimation, search, rule_discovery, planning.
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

const RULE_DISCOVERY_IDS = ['black_box', 'black_box_standard', 'black_box_hard'];
const PLANNING_IDS = ['task_planning', 'task_planning_standard', 'task_planning_hard'];
const MEMORY_IDS = [
  'memory_colors', 'memory_numbers', 'memory_positions',
  'memory_sequential', 'memory_faces', 'memory_code',
];
const LOGIC_IDS = ['logic_verbal', 'logic_situational', 'logic_deduction', 'logic_patterns', 'logic_boolean', 'logic_quantitative'];
const REACTION_IDS = ['reaction_basic', 'reaction_inhibition', 'reaction_speed'];
const STROOP_IDS = ['stroop', 'stroop_classic'];
const MATRIX_IDS = ['matrix_puzzle', 'matrix_standard', 'matrix_advanced'];
const SPATIAL_IDS = ['spatial_rotation', 'spatial'];
const ESTIMATION_IDS = ['dot_estimation'];
const SEARCH_IDS = ['visual_search', 'visual_search_standard', 'visual_search_hard'];

export function calculateTraits(events: GameEvent[]): TraitScores {
  const ruleDiscoveryEvents  = events.filter(e => RULE_DISCOVERY_IDS.includes(e.game_id));
  const planningEvents       = events.filter(e => PLANNING_IDS.includes(e.game_id));
  const memoryEvents         = events.filter(e => MEMORY_IDS.includes(e.game_id));
  const logicEvents          = events.filter(e => LOGIC_IDS.includes(e.game_id));
  const reactionEvents       = events.filter(e => REACTION_IDS.includes(e.game_id));
  const stroopEvents         = events.filter(e => STROOP_IDS.includes(e.game_id));
  const matrixEvents         = events.filter(e => MATRIX_IDS.includes(e.game_id));
  const spatialEvents        = events.filter(e => SPATIAL_IDS.includes(e.game_id));
  const estimationEvents     = events.filter(e => ESTIMATION_IDS.includes(e.game_id));
  const searchEvents         = events.filter(e => SEARCH_IDS.includes(e.game_id));

  // ── curiosity: how many inputs user tests in black box (high = intellectually curious) ─
  const curiosity = ruleDiscoveryEvents.length > 0 ? calcCuriosityFromRuleDiscovery(ruleDiscoveryEvents) : 0.5;

  // ── persistence: logic completion + reaction endurance + planning rounds ──────
  let persistence: number | null = null;
  if (logicEvents.length > 0) {
    const lp = calcPersistenceFromLogic(logicEvents);
    persistence = persistence !== null ? (persistence + lp) / 2 : lp;
  }
  if (reactionEvents.length > 0) {
    const rp = calcPersistenceFromReaction(reactionEvents);
    persistence = persistence !== null ? (persistence + rp) / 2 : rp;
  }
  if (planningEvents.length > 0) {
    const pp = calcPersistenceFromPlanning(planningEvents);
    persistence = persistence !== null ? (persistence + pp) / 2 : pp;
  }

  // ── risk_tolerance: reaction impulsivity (nogo false starts = willingness to take risk) ─
  let risk_tolerance: number | null = reactionEvents.length > 0 ? calcRiskFromReaction(reactionEvents) : null;

  // ── learning_speed: rule discovery + memory learning + matrix accuracy ─────
  let learning_speed: number | null = ruleDiscoveryEvents.length > 0 ? calcLearningFromRuleDiscovery(ruleDiscoveryEvents) : null;
  if (memoryEvents.length > 0) {
    const ml = calcLearningFromMemory(memoryEvents);
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }
  if (matrixEvents.length > 0) {
    const ml = calcAccuracyFromOptions(matrixEvents);
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }

  // ── working_memory: memory game recall accuracy ───────────────────────────
  const working_memory = memoryEvents.length > 0 ? calcWorkingMemory(memoryEvents) : 0.5;

  // ── processing_speed: reaction + stroop + estimation response times ────────
  let processing_speed: number | null = reactionEvents.length > 0 ? calcProcessingSpeed(reactionEvents) : null;
  if (stroopEvents.length > 0) {
    const sp = calcProcessingSpeedFromStroop(stroopEvents);
    processing_speed = processing_speed !== null ? (processing_speed + sp) / 2 : sp;
  }
  if (estimationEvents.length > 0) {
    const ep = calcProcessingSpeedFromEstimation(estimationEvents);
    processing_speed = processing_speed !== null ? (processing_speed + ep) / 2 : ep;
  }

  // ── impulse_control: nogo inhibition + stroop accuracy ────────────────────
  let impulse_control: number | null = reactionEvents.length > 0 ? calcImpulseControl(reactionEvents) : null;
  if (stroopEvents.length > 0) {
    const si = calcImpulseControlFromStroop(stroopEvents);
    impulse_control = impulse_control !== null ? (impulse_control + si) / 2 : si;
  }

  // ── analytical_thinking: logic + rule_discovery + matrix + estimation ───────
  let analytical_thinking: number | null = null;
  if (logicEvents.length > 0) {
    analytical_thinking = calcAccuracyFromLogic(logicEvents);
  }
  if (ruleDiscoveryEvents.length > 0) {
    const ra = calcAccuracyFromRuleDiscovery(ruleDiscoveryEvents);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ra) / 2 : ra;
  }
  if (matrixEvents.length > 0) {
    const ma = calcAccuracyFromOptions(matrixEvents);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ma) / 2 : ma;
  }
  if (estimationEvents.length > 0) {
    const ea = calcAccuracyFromOptions(estimationEvents);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ea) / 2 : ea;
  }

  // ── attention_to_detail: search accuracy ──────────────────────────────────
  let attention_to_detail: number | null = searchEvents.length > 0 ? calcAttentionFromSearch(searchEvents) : null;

  // ── systematic_thinking: spatial + planning ───────────────────────────────
  let systematic_thinking: number | null = null;
  if (spatialEvents.length > 0) {
    const sv = calcAccuracyFromOptions(spatialEvents);
    systematic_thinking = systematic_thinking !== null ? (systematic_thinking + sv) / 2 : sv;
  }
  if (planningEvents.length > 0) {
    const pv = calcSystematicFromPlanning(planningEvents);
    systematic_thinking = systematic_thinking !== null ? (systematic_thinking + pv) / 2 : pv;
  }

  // ── timeout_extended adjustment: many extensions indicate slower processing ──
  const timeoutExtensionCount = countTimeoutExtensions(events);
  let rawProcessingSpeed = processing_speed ?? 0.5;
  if (timeoutExtensionCount >= 6) {
    rawProcessingSpeed *= 0.75;
  } else if (timeoutExtensionCount >= 3) {
    rawProcessingSpeed *= 0.85;
  }

  return {
    curiosity:           clamp(curiosity),
    persistence:         clamp(persistence ?? 0.5),
    risk_tolerance:      clamp(risk_tolerance ?? 0.5),
    learning_speed:      clamp(learning_speed ?? 0.5),
    working_memory:      clamp(working_memory),
    processing_speed:    clamp(rawProcessingSpeed),
    impulse_control:     clamp(impulse_control ?? 0.5),
    analytical_thinking: clamp(analytical_thinking ?? 0.5),
    attention_to_detail: clamp(attention_to_detail ?? 0.5),
    systematic_thinking: clamp(systematic_thinking ?? 0.5),
  };
}

// ── Individual calculators ───────────────────────────────────────────────────

// Curiosity: more test inputs in BlackBox = more intellectually curious
function calcCuriosityFromRuleDiscovery(events: GameEvent[]): number {
  const tests = events.filter(e => e.event_type === 'input_tested');
  const rounds = new Set(events.filter(e => e.event_type === 'prediction_submitted').map(e => e.data.round as number)).size;
  if (rounds === 0) return 0.5;
  const avgTestsPerRound = tests.length / rounds;
  // 1 test = min curiosity (0.2), 5+ tests = max curiosity (1.0)
  return clamp(0.2 + (avgTestsPerRound - 1) / 4 * 0.8);
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

function calcRiskFromReaction(events: GameEvent[]): number {
  const nogoEvents = events.filter(e =>
    e.event_type === 'stimulus_response' && e.data.stimulusType === 'nogo'
  );
  if (nogoEvents.length === 0) return 0.4;
  const impulsivity = nogoEvents.filter(e => e.data.responded).length / nogoEvents.length;
  return clamp(0.3 + impulsivity * 0.7);
}

// Rule discovery: speed of deduction (fewer tests = faster learning)
function calcLearningFromRuleDiscovery(events: GameEvent[]): number {
  const predictions = events.filter(e => e.event_type === 'prediction_submitted' && !e.data.timedOut);
  if (predictions.length === 0) return 0.5;
  const correct = predictions.filter(e => e.data.correct);
  const accuracy = correct.length / predictions.length;
  // Lower testsUsed = faster learning signal
  const avgTests = predictions.reduce((sum, e) => sum + ((e.data.testsUsed as number) ?? 6), 0) / predictions.length;
  const efficiencyScore = clamp(1 - (avgTests - 1) / 5); // 1 test → 1.0, 6 tests → 0.0
  return clamp(accuracy * 0.6 + efficiencyScore * 0.4);
}

// Rule discovery accuracy for analytical_thinking
function calcAccuracyFromRuleDiscovery(events: GameEvent[]): number {
  const predictions = events.filter(e => e.event_type === 'prediction_submitted' && !e.data.timedOut);
  if (predictions.length === 0) return 0.5;
  return predictions.filter(e => e.data.correct).length / predictions.length;
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

// Planning: completion rate measures persistence
function calcPersistenceFromPlanning(events: GameEvent[]): number {
  const completions = events.filter(e => e.event_type === 'round_complete');
  if (completions.length === 0) return 0.5;
  return completions.filter(e => e.data.completed).length / completions.length;
}

// Planning: low-mistake completion rate measures systematic thinking
function calcSystematicFromPlanning(events: GameEvent[]): number {
  const completions = events.filter(e => e.event_type === 'round_complete');
  if (completions.length === 0) return 0.5;
  const completed = completions.filter(e => e.data.completed);
  const completionRate = completed.length / completions.length;
  const avgMistakes = completed.reduce((sum, e) => sum + ((e.data.mistakes as number) ?? 0), 0) /
    Math.max(completed.length, 1);
  // 0 mistakes → 1.0, 3+ mistakes → 0.2
  const mistakeScore = clamp(1 - avgMistakes / 3);
  return clamp(completionRate * 0.5 + mistakeScore * 0.5);
}

// ── Cognitive game calculators ───────────────────────────────────────────────

// Generic option-selection accuracy (matrix, spatial, estimation)
function calcAccuracyFromOptions(events: GameEvent[]): number {
  const selections = events.filter(e => e.event_type === 'option_selected' || e.event_type === 'group_selected');
  if (selections.length === 0) return 0.5;
  return selections.filter(e => e.data.correct).length / selections.length;
}

function calcProcessingSpeedFromStroop(events: GameEvent[]): number {
  const correct = events.filter(e => e.event_type === 'color_tapped' && e.data.correct);
  if (correct.length === 0) return 0.5;
  const avgTime = correct.reduce((sum, e) => sum + ((e.data.responseTime as number) ?? 2000), 0) / correct.length;
  // 500ms → 1.0, 3500ms → 0.0
  return clamp(1 - (avgTime - 500) / 3000);
}

function calcProcessingSpeedFromEstimation(events: GameEvent[]): number {
  const correct = events.filter(e => e.event_type === 'group_selected' && e.data.correct);
  if (correct.length === 0) return 0.5;
  const avgTime = correct.reduce((sum, e) => sum + ((e.data.responseTime as number) ?? 1500), 0) / correct.length;
  // 300ms → 1.0, 3000ms → 0.0
  return clamp(1 - (avgTime - 300) / 2700);
}

function calcImpulseControlFromStroop(events: GameEvent[]): number {
  const taps = events.filter(e => e.event_type === 'color_tapped');
  if (taps.length === 0) return 0.5;
  const accuracy = taps.filter(e => e.data.correct).length / taps.length;
  // Stroop requires overriding the automatic word-reading response — accuracy is the primary signal
  return clamp(accuracy);
}

function calcAttentionFromSearch(events: GameEvent[]): number {
  const taps = events.filter(e => e.event_type === 'target_tapped');
  if (taps.length === 0) return 0.5;
  const correct = taps.filter(e => e.data.correct).length;
  const wrong = taps.filter(e => !e.data.correct).length;
  // Reward correct finds, penalise wrong taps heavily
  return clamp((correct - wrong * 2) / Math.max(correct + wrong, 1));
}

// Count total timeout_extended events across all games
function countTimeoutExtensions(events: GameEvent[]): number {
  return events.filter(e => e.event_type === 'timeout_extended').length;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
