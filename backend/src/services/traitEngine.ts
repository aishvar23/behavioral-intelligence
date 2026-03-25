/**
 * Trait Engine
 * Derives cognitive trait scores from structured trial records.
 * Each trial is one round/question with full stimulus + response context.
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

export interface TrialRecord {
  game_id: string;
  game_variant: string | null;
  trial_index: number;
  difficulty: string;
  stimulus: Record<string, unknown>;
  response: Record<string, unknown>;
  is_correct: boolean;
  response_error: number;
  response_time_ms: number;
  timeout_extended: boolean;
  skipped: boolean;
}

const RULE_DISCOVERY_IDS = ['black_box', 'black_box_standard', 'black_box_hard'];
const PLANNING_IDS       = ['task_planning', 'task_planning_standard', 'task_planning_hard'];
const MEMORY_IDS         = ['memory_colors', 'memory_numbers', 'memory_positions', 'memory_sequential', 'memory_faces', 'memory_code'];
const LOGIC_IDS          = ['logic_verbal', 'logic_situational', 'logic_deduction', 'logic_patterns', 'logic_boolean', 'logic_quantitative'];
const REACTION_IDS       = ['reaction_basic', 'reaction_inhibition', 'reaction_speed'];
const STROOP_IDS         = ['stroop', 'stroop_classic'];
const MATRIX_IDS         = ['matrix_puzzle', 'matrix_standard', 'matrix_advanced'];
const SPATIAL_IDS        = ['spatial_rotation', 'spatial'];
const ESTIMATION_IDS     = ['dot_estimation'];
const SEARCH_IDS         = ['visual_search', 'visual_search_standard', 'visual_search_hard'];

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function accuracy(trials: TrialRecord[]): number {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return 0.5;
  return active.filter(t => t.is_correct).length / active.length;
}

export function calculateTraits(trials: TrialRecord[]): TraitScores {
  const rdTrials        = trials.filter(t => RULE_DISCOVERY_IDS.includes(t.game_id));
  const planningTrials  = trials.filter(t => PLANNING_IDS.includes(t.game_id));
  const memoryTrials    = trials.filter(t => MEMORY_IDS.includes(t.game_id));
  const logicTrials     = trials.filter(t => LOGIC_IDS.includes(t.game_id));
  const reactionTrials  = trials.filter(t => REACTION_IDS.includes(t.game_id));
  const stroopTrials    = trials.filter(t => STROOP_IDS.includes(t.game_id));
  const matrixTrials    = trials.filter(t => MATRIX_IDS.includes(t.game_id));
  const spatialTrials   = trials.filter(t => SPATIAL_IDS.includes(t.game_id));
  const estimationTrials= trials.filter(t => ESTIMATION_IDS.includes(t.game_id));
  const searchTrials    = trials.filter(t => SEARCH_IDS.includes(t.game_id));

  // ── curiosity: more inputs tested in BlackBox = more intellectually curious ──
  const curiosity = rdTrials.length > 0 ? (() => {
    const nonSkipped = rdTrials.filter(t => !t.skipped);
    if (nonSkipped.length === 0) return 0.5;
    const avgTests = avg(nonSkipped.map(t => ((t.response.inputs_tested as unknown[]) ?? []).length));
    return clamp(0.2 + (avgTests - 1) / 4 * 0.8);
  })() : 0.5;

  // ── persistence: sustained effort across logic, reaction, planning ───────────
  let persistence: number | null = null;
  if (logicTrials.length > 0) {
    const active = logicTrials.filter(t => !t.skipped);
    const p = clamp(active.length / 7 * 0.6 + accuracy(logicTrials) * 0.4);
    persistence = persistence !== null ? (persistence + p) / 2 : p;
  }
  if (reactionTrials.length > 0) {
    const active = reactionTrials.filter(t => !t.skipped);
    const p = clamp(active.length / 10 * 0.6 + accuracy(reactionTrials) * 0.4);
    persistence = persistence !== null ? (persistence + p) / 2 : p;
  }
  if (planningTrials.length > 0) {
    const completionRate = planningTrials.filter(t => t.response.completed === true).length / planningTrials.length;
    persistence = persistence !== null ? (persistence + completionRate) / 2 : completionRate;
  }

  // ── risk_tolerance: nogo false starts = impulsive action under uncertainty ───
  const nogoTrials = reactionTrials.filter(t => (t.stimulus.stimulus_type as string) === 'nogo');
  const risk_tolerance = nogoTrials.length > 0
    ? clamp(0.3 + (nogoTrials.filter(t => !t.is_correct).length / nogoTrials.length) * 0.7)
    : null;

  // ── learning_speed: rule discovery efficiency + memory accuracy ────────────
  let learning_speed: number | null = null;
  if (rdTrials.length > 0) {
    const nonSkipped = rdTrials.filter(t => !t.skipped);
    if (nonSkipped.length > 0) {
      const acc = nonSkipped.filter(t => t.is_correct).length / nonSkipped.length;
      const avgTests = avg(nonSkipped.map(t => ((t.response.inputs_tested as unknown[]) ?? []).length));
      const efficiency = clamp(1 - (avgTests - 1) / 5); // 1 test→1.0, 6 tests→0.0
      learning_speed = clamp(acc * 0.6 + efficiency * 0.4);
    }
  }
  if (memoryTrials.length > 0) {
    const acc = accuracy(memoryTrials);
    const active = memoryTrials.filter(t => !t.skipped);
    const avgRt = active.length > 0 ? avg(active.map(t => t.response_time_ms)) : 5000;
    const ml = clamp(acc * 0.7 + (1 - Math.min(avgRt / 10000, 1)) * 0.3);
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }
  if (matrixTrials.length > 0) {
    const ml = accuracy(matrixTrials);
    learning_speed = learning_speed !== null ? (learning_speed + ml) / 2 : ml;
  }

  // ── working_memory: memory recall accuracy ────────────────────────────────
  const working_memory = memoryTrials.length > 0 ? accuracy(memoryTrials) : 0.5;

  // ── processing_speed: reaction RT + stroop RT + estimation RT ─────────────
  let processing_speed: number | null = null;
  if (reactionTrials.length > 0) {
    const goCorrect = reactionTrials.filter(t => (t.stimulus.stimulus_type as string) === 'go' && t.is_correct);
    if (goCorrect.length > 0) {
      const avgRt = avg(goCorrect.map(t => t.response_time_ms));
      processing_speed = clamp(1 - (avgRt - 200) / 800); // 200ms→1.0, 1000ms→0.0
    }
  }
  if (stroopTrials.length > 0) {
    const correct = stroopTrials.filter(t => t.is_correct);
    if (correct.length > 0) {
      const avgRt = avg(correct.map(t => t.response_time_ms));
      const sp = clamp(1 - (avgRt - 500) / 3000); // 500ms→1.0, 3500ms→0.0
      processing_speed = processing_speed !== null ? (processing_speed + sp) / 2 : sp;
    }
  }
  if (estimationTrials.length > 0) {
    const correct = estimationTrials.filter(t => t.is_correct);
    if (correct.length > 0) {
      const avgRt = avg(correct.map(t => t.response_time_ms));
      const ep = clamp(1 - (avgRt - 300) / 2700); // 300ms→1.0, 3000ms→0.0
      processing_speed = processing_speed !== null ? (processing_speed + ep) / 2 : ep;
    }
  }

  // ── impulse_control: nogo inhibition + stroop interference accuracy ────────
  let impulse_control: number | null = null;
  if (nogoTrials.length > 0) {
    const ic = nogoTrials.filter(t => t.is_correct).length / nogoTrials.length;
    impulse_control = ic;
  }
  if (stroopTrials.length > 0) {
    const si = accuracy(stroopTrials);
    impulse_control = impulse_control !== null ? (impulse_control + si) / 2 : si;
  }

  // ── analytical_thinking: logic + rule discovery + matrix + estimation ──────
  let analytical_thinking: number | null = null;
  if (logicTrials.length > 0) {
    analytical_thinking = accuracy(logicTrials);
  }
  if (rdTrials.length > 0) {
    const ra = accuracy(rdTrials);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ra) / 2 : ra;
  }
  if (matrixTrials.length > 0) {
    const ma = accuracy(matrixTrials);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ma) / 2 : ma;
  }
  if (estimationTrials.length > 0) {
    const ea = accuracy(estimationTrials);
    analytical_thinking = analytical_thinking !== null ? (analytical_thinking + ea) / 2 : ea;
  }

  // ── attention_to_detail: visual search — finds targets, avoids false taps ──
  let attention_to_detail: number | null = null;
  if (searchTrials.length > 0) {
    const totalTargets = searchTrials.reduce((s, t) => s + ((t.stimulus.total_targets as number) ?? 0), 0);
    const found        = searchTrials.reduce((s, t) => s + ((t.response.targets_found as number) ?? 0), 0);
    const falseTaps    = searchTrials.reduce((s, t) => s + ((t.response.false_taps as number) ?? 0), 0);
    attention_to_detail = clamp((found - falseTaps * 2) / Math.max(totalTargets, 1));
  }

  // ── systematic_thinking: spatial accuracy + planning with low mistakes ─────
  let systematic_thinking: number | null = null;
  if (spatialTrials.length > 0) {
    systematic_thinking = accuracy(spatialTrials);
  }
  if (planningTrials.length > 0) {
    const completed = planningTrials.filter(t => t.response.completed === true);
    const completionRate = completed.length / planningTrials.length;
    const avgMistakes = completed.length > 0
      ? avg(completed.map(t => (t.response.mistakes as number) ?? 0))
      : 0;
    const mistakeScore = clamp(1 - avgMistakes / 3); // 0 mistakes→1.0, 3+→0.0
    const pv = clamp(completionRate * 0.5 + mistakeScore * 0.5);
    systematic_thinking = systematic_thinking !== null ? (systematic_thinking + pv) / 2 : pv;
  }

  // ── processing_speed penalty for many timeout extensions ─────────────────
  const timeoutCount = trials.filter(t => t.timeout_extended).length;
  let rawProcessingSpeed = processing_speed ?? 0.5;
  if (timeoutCount >= 6) rawProcessingSpeed *= 0.75;
  else if (timeoutCount >= 3) rawProcessingSpeed *= 0.85;

  return {
    curiosity:            clamp(curiosity),
    persistence:          clamp(persistence ?? 0.5),
    risk_tolerance:       clamp(risk_tolerance ?? 0.5),
    learning_speed:       clamp(learning_speed ?? 0.5),
    working_memory:       clamp(working_memory),
    processing_speed:     clamp(rawProcessingSpeed),
    impulse_control:      clamp(impulse_control ?? 0.5),
    analytical_thinking:  clamp(analytical_thinking ?? 0.5),
    attention_to_detail:  clamp(attention_to_detail ?? 0.5),
    systematic_thinking:  clamp(systematic_thinking ?? 0.5),
  };
}
