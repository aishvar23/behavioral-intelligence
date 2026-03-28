/**
 * Cognitive Mirror — Trait Catalog
 *
 * 12 cognitive traits, each mapped to a game engine with 10 progressive levels.
 * Levels scale along 4 complexity axes: speed, distractor density, rule-shifting, UI interference.
 *
 * Adaptive rules (applied by LevelGameScreen):
 *   Skip rule  — Level 1 score ≥ 95 → jump to Level 4
 *   Ceiling    — Score drops ≥ 40% across any 3 consecutive levels → end trait
 */

import { GameType } from './gameCatalog';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LevelConfig {
  level: number;
  label: string;
  // Complexity axes
  speedMultiplier: number;        // 1.0 = normal; higher = faster stimuli / shorter timers
  distractorDensity: number;      // 0.0–1.0
  ruleShifting: boolean;          // rules change mid-game
  uiInterference: boolean;        // screen shake, visual noise
  // Game-engine params forwarded to the game component
  gameParams: Record<string, unknown>;
  // Per-level targets (used in verdict display — not gatekeeping)
  targetAccuracy: number;         // 0.0–1.0 "passing" threshold
  eliteLatencyMs: number;         // latency below this = elite
}

export interface TraitDefinition {
  id: string;               // T01, T04 …
  name: string;             // "Triage"
  description: string;      // short bio shown on TraitDiscovery card
  icon: string;             // emoji
  gameEngine: GameType;     // which game component to run
  primaryGameId: string;    // config ID from GAME_CONFIGS
  levels: LevelConfig[];
  // Ceiling rule: if perf drops ≥ ceilingDropPct over ceilingLevels consecutive levels → stop
  ceilingDropPct: number;   // 0.40 = 40%
  ceilingLevels: number;    // 3
  // Skip rule threshold (only applied to Level 1)
  skipScore: number;        // e.g. 95 → jump to level 4 if score ≥ this
  skipToLevel: number;      // 4
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function levels(
  configs: Array<{
    level: number;
    label: string;
    speedMultiplier: number;
    distractorDensity: number;
    ruleShifting: boolean;
    uiInterference: boolean;
    gameParams: Record<string, unknown>;
    targetAccuracy: number;
    eliteLatencyMs: number;
  }>
): LevelConfig[] {
  return configs;
}

// ── Trait Catalog ─────────────────────────────────────────────────────────────

export const TRAIT_CATALOG: Record<string, TraitDefinition> = {

  // ── T01 · Triage ─────────────────────────────────────────────────────────
  T01: {
    id: 'T01', name: 'Triage', icon: '🚨',
    description: 'Correctly prioritising high-importance signals under time pressure while ignoring distractors.',
    gameEngine: 'reaction',
    primaryGameId: 'reaction_inhibition',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Orientation',    speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'inhibition', trials: 10, goInterval: 1800 }, targetAccuracy: 0.70, eliteLatencyMs: 350 },
      { level: 2,  label: 'Warm-up',        speedMultiplier: 1.1, distractorDensity: 0.15, ruleShifting: false, uiInterference: false, gameParams: { variant: 'inhibition', trials: 12, goInterval: 1600 }, targetAccuracy: 0.72, eliteLatencyMs: 340 },
      { level: 3,  label: 'Active',         speedMultiplier: 1.2, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'inhibition', trials: 14, goInterval: 1400 }, targetAccuracy: 0.75, eliteLatencyMs: 320 },
      { level: 4,  label: 'Pressure',       speedMultiplier: 1.3, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { variant: 'inhibition', trials: 16, goInterval: 1200 }, targetAccuracy: 0.77, eliteLatencyMs: 310 },
      { level: 5,  label: 'Surge',          speedMultiplier: 1.4, distractorDensity: 0.40, ruleShifting: false, uiInterference: false, gameParams: { variant: 'inhibition', trials: 18, goInterval: 1100 }, targetAccuracy: 0.78, eliteLatencyMs: 300 },
      { level: 6,  label: 'Escalation',     speedMultiplier: 1.5, distractorDensity: 0.50, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'inhibition', trials: 20, goInterval: 1000 }, targetAccuracy: 0.80, eliteLatencyMs: 290 },
      { level: 7,  label: 'High Tempo',     speedMultiplier: 1.6, distractorDensity: 0.60, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'speed',      trials: 20, goInterval: 900  }, targetAccuracy: 0.80, eliteLatencyMs: 280 },
      { level: 8,  label: 'Chaos',          speedMultiplier: 1.7, distractorDensity: 0.70, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'speed',      trials: 22, goInterval: 800  }, targetAccuracy: 0.80, eliteLatencyMs: 270 },
      { level: 9,  label: 'Crisis Mode',    speedMultiplier: 1.9, distractorDensity: 0.80, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'speed',      trials: 24, goInterval: 700  }, targetAccuracy: 0.80, eliteLatencyMs: 260 },
      { level: 10, label: 'Extreme Triage', speedMultiplier: 2.0, distractorDensity: 0.90, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'speed',      trials: 26, goInterval: 600  }, targetAccuracy: 0.80, eliteLatencyMs: 250 },
    ]),
  },

  // ── T04 · Panic Management ───────────────────────────────────────────────
  T04: {
    id: 'T04', name: 'Panic Management', icon: '🧘',
    description: 'Maintaining accuracy and speed on cognitive tasks despite escalating pressure and interference.',
    gameEngine: 'stroop',
    primaryGameId: 'stroop_classic',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Calm',           speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { trials: 8,  timerMs: 4000 }, targetAccuracy: 0.70, eliteLatencyMs: 700  },
      { level: 2,  label: 'Aware',          speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { trials: 10, timerMs: 3500 }, targetAccuracy: 0.72, eliteLatencyMs: 680  },
      { level: 3,  label: 'Alert',          speedMultiplier: 1.2, distractorDensity: 0.15, ruleShifting: false, uiInterference: false, gameParams: { trials: 12, timerMs: 3200 }, targetAccuracy: 0.74, eliteLatencyMs: 650  },
      { level: 4,  label: 'Stressed',       speedMultiplier: 1.3, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { trials: 14, timerMs: 3000 }, targetAccuracy: 0.75, eliteLatencyMs: 620  },
      { level: 5,  label: 'Under Fire',     speedMultiplier: 1.4, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { trials: 16, timerMs: 2800 }, targetAccuracy: 0.76, eliteLatencyMs: 600  },
      { level: 6,  label: 'Distracted',     speedMultiplier: 1.5, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { trials: 18, timerMs: 2600 }, targetAccuracy: 0.76, eliteLatencyMs: 580  },
      { level: 7,  label: 'Overwhelmed',    speedMultiplier: 1.6, distractorDensity: 0.50, ruleShifting: true,  uiInterference: false, gameParams: { trials: 20, timerMs: 2400 }, targetAccuracy: 0.76, eliteLatencyMs: 560  },
      { level: 8,  label: 'Chaos',          speedMultiplier: 1.7, distractorDensity: 0.60, ruleShifting: true,  uiInterference: true,  gameParams: { trials: 22, timerMs: 2200 }, targetAccuracy: 0.75, eliteLatencyMs: 540  },
      { level: 9,  label: 'Crisis',         speedMultiplier: 1.9, distractorDensity: 0.75, ruleShifting: true,  uiInterference: true,  gameParams: { trials: 24, timerMs: 2000 }, targetAccuracy: 0.74, eliteLatencyMs: 520  },
      { level: 10, label: 'Meltdown',       speedMultiplier: 2.0, distractorDensity: 0.90, ruleShifting: true,  uiInterference: true,  gameParams: { trials: 26, timerMs: 1800 }, targetAccuracy: 0.72, eliteLatencyMs: 500  },
    ]),
  },

  // ── T06 · Working Memory ─────────────────────────────────────────────────
  T06: {
    id: 'T06', name: 'Working Memory', icon: '🧠',
    description: 'Accurately holding and manipulating information across increasingly long sequences.',
    gameEngine: 'memory',
    primaryGameId: 'memory_sequential',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Imprint',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 3, seqLength: 3 }, targetAccuracy: 0.80, eliteLatencyMs: 3000 },
      { level: 2,  label: 'Register',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 3, seqLength: 4 }, targetAccuracy: 0.78, eliteLatencyMs: 3500 },
      { level: 3,  label: 'Encode',         speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 4, seqLength: 4 }, targetAccuracy: 0.76, eliteLatencyMs: 4000 },
      { level: 4,  label: 'Hold',           speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 4, seqLength: 5 }, targetAccuracy: 0.75, eliteLatencyMs: 4500 },
      { level: 5,  label: 'Retain',         speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 4, seqLength: 5 }, targetAccuracy: 0.74, eliteLatencyMs: 5000 },
      { level: 6,  label: 'Extend',         speedMultiplier: 1.2, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 5, seqLength: 6 }, targetAccuracy: 0.72, eliteLatencyMs: 5000 },
      { level: 7,  label: 'Overload',       speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 5, seqLength: 6 }, targetAccuracy: 0.70, eliteLatencyMs: 5500 },
      { level: 8,  label: 'Interference',   speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: false, uiInterference: false, gameParams: { variant: 'sequential', rounds: 5, seqLength: 7 }, targetAccuracy: 0.68, eliteLatencyMs: 6000 },
      { level: 9,  label: 'Deep Store',     speedMultiplier: 1.3, distractorDensity: 0.50, ruleShifting: false, uiInterference: true,  gameParams: { variant: 'sequential', rounds: 5, seqLength: 8 }, targetAccuracy: 0.65, eliteLatencyMs: 6500 },
      { level: 10, label: 'Peak Capacity',  speedMultiplier: 1.4, distractorDensity: 0.60, ruleShifting: false, uiInterference: true,  gameParams: { variant: 'sequential', rounds: 5, seqLength: 9 }, targetAccuracy: 0.60, eliteLatencyMs: 7000 },
    ]),
  },

  // ── T11 · Deductive Logic ────────────────────────────────────────────────
  T11: {
    id: 'T11', name: 'Deductive Logic', icon: '🔍',
    description: 'Drawing valid conclusions from premises through systematic multi-step reasoning chains.',
    gameEngine: 'logic',
    primaryGameId: 'logic_deduction',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Premise',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'deduction', questions: 5, timeLimitMs: 35000 }, targetAccuracy: 0.70, eliteLatencyMs: 15000 },
      { level: 2,  label: 'Inference',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'deduction', questions: 5, timeLimitMs: 32000 }, targetAccuracy: 0.72, eliteLatencyMs: 14000 },
      { level: 3,  label: 'Chain',          speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'deduction', questions: 6, timeLimitMs: 30000 }, targetAccuracy: 0.73, eliteLatencyMs: 13000 },
      { level: 4,  label: 'Branch',         speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'deduction', questions: 6, timeLimitMs: 28000 }, targetAccuracy: 0.74, eliteLatencyMs: 13000 },
      { level: 5,  label: 'Contrapositive', speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'deduction', questions: 6, timeLimitMs: 26000 }, targetAccuracy: 0.74, eliteLatencyMs: 12000 },
      { level: 6,  label: 'Contradiction',  speedMultiplier: 1.2, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'boolean',   questions: 6, timeLimitMs: 25000 }, targetAccuracy: 0.75, eliteLatencyMs: 12000 },
      { level: 7,  label: 'Dilemma',        speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'boolean',   questions: 7, timeLimitMs: 22000 }, targetAccuracy: 0.75, eliteLatencyMs: 11000 },
      { level: 8,  label: 'Paradox',        speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'boolean',   questions: 7, timeLimitMs: 20000 }, targetAccuracy: 0.74, eliteLatencyMs: 11000 },
      { level: 9,  label: 'System',         speedMultiplier: 1.4, distractorDensity: 0.50, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'boolean',   questions: 7, timeLimitMs: 18000 }, targetAccuracy: 0.73, eliteLatencyMs: 10000 },
      { level: 10, label: 'Axiom',          speedMultiplier: 1.5, distractorDensity: 0.60, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'boolean',   questions: 7, timeLimitMs: 15000 }, targetAccuracy: 0.70, eliteLatencyMs: 9000  },
    ]),
  },

  // ── T12 · Systems Thinking ───────────────────────────────────────────────
  T12: {
    id: 'T12', name: 'Systems Thinking', icon: '🗺️',
    description: 'Mapping dependencies and sequencing tasks within complex networks without making mistakes.',
    gameEngine: 'planning',
    primaryGameId: 'task_planning_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Linear',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { tasks: 3,  hard: false }, targetAccuracy: 0.85, eliteLatencyMs: 20000 },
      { level: 2,  label: 'Fork',           speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { tasks: 4,  hard: false }, targetAccuracy: 0.83, eliteLatencyMs: 22000 },
      { level: 3,  label: 'Branch',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { tasks: 5,  hard: false }, targetAccuracy: 0.81, eliteLatencyMs: 25000 },
      { level: 4,  label: 'Merge',          speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { tasks: 5,  hard: false }, targetAccuracy: 0.80, eliteLatencyMs: 28000 },
      { level: 5,  label: 'Pipeline',       speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { tasks: 6,  hard: false }, targetAccuracy: 0.78, eliteLatencyMs: 30000 },
      { level: 6,  label: 'Network',        speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { tasks: 7,  hard: true  }, targetAccuracy: 0.76, eliteLatencyMs: 35000 },
      { level: 7,  label: 'Critical Path',  speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { tasks: 8,  hard: true  }, targetAccuracy: 0.75, eliteLatencyMs: 38000 },
      { level: 8,  label: 'Cascade',        speedMultiplier: 1.0, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { tasks: 9,  hard: true  }, targetAccuracy: 0.73, eliteLatencyMs: 42000 },
      { level: 9,  label: 'System Failure', speedMultiplier: 1.0, distractorDensity: 0.40, ruleShifting: true,  uiInterference: true,  gameParams: { tasks: 10, hard: true  }, targetAccuracy: 0.70, eliteLatencyMs: 45000 },
      { level: 10, label: 'Architect',      speedMultiplier: 1.0, distractorDensity: 0.50, ruleShifting: true,  uiInterference: true,  gameParams: { tasks: 12, hard: true  }, targetAccuracy: 0.68, eliteLatencyMs: 50000 },
    ]),
  },

  // ── T13 · Risk Management ────────────────────────────────────────────────
  T13: {
    id: 'T13', name: 'Risk Management', icon: '⚖️',
    description: 'Gathering sufficient evidence before committing — balancing exploration efficiency with prediction accuracy.',
    gameEngine: 'rule_discovery',
    primaryGameId: 'black_box_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Pattern',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 4 }, targetAccuracy: 0.75, eliteLatencyMs: 30000 },
      { level: 2,  label: 'Variable',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 5 }, targetAccuracy: 0.73, eliteLatencyMs: 32000 },
      { level: 3,  label: 'Threshold',      speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 6 }, targetAccuracy: 0.72, eliteLatencyMs: 34000 },
      { level: 4,  label: 'Correlation',    speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 6 }, targetAccuracy: 0.72, eliteLatencyMs: 35000 },
      { level: 5,  label: 'Multivariate',   speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  rounds: 6 }, targetAccuracy: 0.70, eliteLatencyMs: 38000 },
      { level: 6,  label: 'Noise',          speedMultiplier: 1.0, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  rounds: 7 }, targetAccuracy: 0.70, eliteLatencyMs: 40000 },
      { level: 7,  label: 'Confound',       speedMultiplier: 1.0, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  rounds: 7 }, targetAccuracy: 0.68, eliteLatencyMs: 42000 },
      { level: 8,  label: 'Nonlinear',      speedMultiplier: 1.0, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  rounds: 8 }, targetAccuracy: 0.67, eliteLatencyMs: 45000 },
      { level: 9,  label: 'Black Swan',     speedMultiplier: 1.0, distractorDensity: 0.50, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  rounds: 8 }, targetAccuracy: 0.65, eliteLatencyMs: 48000 },
      { level: 10, label: 'Uncertainty',    speedMultiplier: 1.0, distractorDensity: 0.60, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  rounds: 8 }, targetAccuracy: 0.62, eliteLatencyMs: 50000 },
    ]),
  },

  // ── T15 · Social Inference ───────────────────────────────────────────────
  T15: {
    id: 'T15', name: 'Social Inference', icon: '👥',
    description: 'Reading between the lines in social situations — inferring intent, subtext, and optimal responses.',
    gameEngine: 'logic',
    primaryGameId: 'logic_situational',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Greeting',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 5, timeLimitMs: 35000 }, targetAccuracy: 0.70, eliteLatencyMs: 14000 },
      { level: 2,  label: 'Context',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 5, timeLimitMs: 32000 }, targetAccuracy: 0.71, eliteLatencyMs: 13500 },
      { level: 3,  label: 'Subtext',        speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 5, timeLimitMs: 30000 }, targetAccuracy: 0.72, eliteLatencyMs: 13000 },
      { level: 4,  label: 'Motive',         speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 6, timeLimitMs: 28000 }, targetAccuracy: 0.73, eliteLatencyMs: 12500 },
      { level: 5,  label: 'Ambiguity',      speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 6, timeLimitMs: 26000 }, targetAccuracy: 0.73, eliteLatencyMs: 12000 },
      { level: 6,  label: 'Conflict',       speedMultiplier: 1.2, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'situational', questions: 6, timeLimitMs: 24000 }, targetAccuracy: 0.73, eliteLatencyMs: 11500 },
      { level: 7,  label: 'Power Play',     speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'situational', questions: 7, timeLimitMs: 22000 }, targetAccuracy: 0.72, eliteLatencyMs: 11000 },
      { level: 8,  label: 'Deception',      speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'situational', questions: 7, timeLimitMs: 20000 }, targetAccuracy: 0.72, eliteLatencyMs: 10500 },
      { level: 9,  label: 'High Stakes',    speedMultiplier: 1.4, distractorDensity: 0.50, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'situational', questions: 7, timeLimitMs: 18000 }, targetAccuracy: 0.71, eliteLatencyMs: 10000 },
      { level: 10, label: 'Crisis Diplomacy', speedMultiplier: 1.5, distractorDensity: 0.60, ruleShifting: true, uiInterference: true, gameParams: { variant: 'situational', questions: 7, timeLimitMs: 15000 }, targetAccuracy: 0.70, eliteLatencyMs: 9000  },
    ]),
  },

  // ── T16 · Affective Empathy ──────────────────────────────────────────────
  T16: {
    id: 'T16', name: 'Affective Empathy', icon: '❤️',
    description: 'Accurately encoding and recalling emotional contexts — the foundation of empathic response.',
    gameEngine: 'memory',
    primaryGameId: 'memory_faces',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Recognition',    speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 3, seqLength: 3 }, targetAccuracy: 0.80, eliteLatencyMs: 4000 },
      { level: 2,  label: 'Association',    speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 3, seqLength: 4 }, targetAccuracy: 0.77, eliteLatencyMs: 4500 },
      { level: 3,  label: 'Context',        speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 4, seqLength: 4 }, targetAccuracy: 0.75, eliteLatencyMs: 5000 },
      { level: 4,  label: 'Nuance',         speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 4, seqLength: 5 }, targetAccuracy: 0.73, eliteLatencyMs: 5000 },
      { level: 5,  label: 'Mixed Signals',  speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 4, seqLength: 5 }, targetAccuracy: 0.72, eliteLatencyMs: 5500 },
      { level: 6,  label: 'Masked',         speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 5, seqLength: 6 }, targetAccuracy: 0.70, eliteLatencyMs: 5500 },
      { level: 7,  label: 'Complexity',     speedMultiplier: 1.2, distractorDensity: 0.40, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 5, seqLength: 6 }, targetAccuracy: 0.68, eliteLatencyMs: 6000 },
      { level: 8,  label: 'Contradiction',  speedMultiplier: 1.3, distractorDensity: 0.50, ruleShifting: false, uiInterference: false, gameParams: { variant: 'faces', rounds: 5, seqLength: 7 }, targetAccuracy: 0.66, eliteLatencyMs: 6000 },
      { level: 9,  label: 'Overload',       speedMultiplier: 1.3, distractorDensity: 0.60, ruleShifting: false, uiInterference: true,  gameParams: { variant: 'faces', rounds: 5, seqLength: 8 }, targetAccuracy: 0.63, eliteLatencyMs: 6500 },
      { level: 10, label: 'Full Room',      speedMultiplier: 1.4, distractorDensity: 0.70, ruleShifting: false, uiInterference: true,  gameParams: { variant: 'faces', rounds: 5, seqLength: 9 }, targetAccuracy: 0.60, eliteLatencyMs: 7000 },
    ]),
  },

  // ── T19 · Anomaly Detection ──────────────────────────────────────────────
  T19: {
    id: 'T19', name: 'Anomaly Detection', icon: '🔎',
    description: 'Identifying rare signals within dense, uniform fields — precision vs false-positive balance.',
    gameEngine: 'search',
    primaryGameId: 'visual_search_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Scan',           speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { hard: false, gridSize: 4, timeLimitMs: 30000 }, targetAccuracy: 0.80, eliteLatencyMs: 12000 },
      { level: 2,  label: 'Survey',         speedMultiplier: 1.1, distractorDensity: 0.25, ruleShifting: false, uiInterference: false, gameParams: { hard: false, gridSize: 4, timeLimitMs: 27000 }, targetAccuracy: 0.79, eliteLatencyMs: 11500 },
      { level: 3,  label: 'Screen',         speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { hard: false, gridSize: 5, timeLimitMs: 25000 }, targetAccuracy: 0.78, eliteLatencyMs: 11000 },
      { level: 4,  label: 'Filter',         speedMultiplier: 1.2, distractorDensity: 0.35, ruleShifting: false, uiInterference: false, gameParams: { hard: false, gridSize: 5, timeLimitMs: 23000 }, targetAccuracy: 0.77, eliteLatencyMs: 10500 },
      { level: 5,  label: 'Vigilance',      speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  gridSize: 5, timeLimitMs: 22000 }, targetAccuracy: 0.76, eliteLatencyMs: 10000 },
      { level: 6,  label: 'Dense Field',    speedMultiplier: 1.4, distractorDensity: 0.50, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  gridSize: 6, timeLimitMs: 20000 }, targetAccuracy: 0.75, eliteLatencyMs: 9500  },
      { level: 7,  label: 'Camouflage',     speedMultiplier: 1.5, distractorDensity: 0.60, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  gridSize: 6, timeLimitMs: 18000 }, targetAccuracy: 0.73, eliteLatencyMs: 9000  },
      { level: 8,  label: 'Noise',          speedMultiplier: 1.6, distractorDensity: 0.70, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  gridSize: 7, timeLimitMs: 16000 }, targetAccuracy: 0.72, eliteLatencyMs: 8500  },
      { level: 9,  label: 'Near-Identical', speedMultiplier: 1.7, distractorDensity: 0.80, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  gridSize: 7, timeLimitMs: 14000 }, targetAccuracy: 0.70, eliteLatencyMs: 8000  },
      { level: 10, label: 'Expert Eye',     speedMultiplier: 1.8, distractorDensity: 0.90, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  gridSize: 8, timeLimitMs: 12000 }, targetAccuracy: 0.68, eliteLatencyMs: 7500  },
    ]),
  },

  // ── T20 · Sustained Attention ────────────────────────────────────────────
  T20: {
    id: 'T20', name: 'Sustained Attention', icon: '🎯',
    description: 'Maintaining consistent accuracy across long cognitive tasks without performance decay.',
    gameEngine: 'stroop',
    primaryGameId: 'stroop_classic',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Baseline',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { trials: 8,  timerMs: 4000 }, targetAccuracy: 0.75, eliteLatencyMs: 900  },
      { level: 2,  label: 'Sustained',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { trials: 10, timerMs: 4000 }, targetAccuracy: 0.75, eliteLatencyMs: 900  },
      { level: 3,  label: 'Extended',       speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { trials: 12, timerMs: 3800 }, targetAccuracy: 0.74, eliteLatencyMs: 880  },
      { level: 4,  label: 'Endurance',      speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { trials: 14, timerMs: 3600 }, targetAccuracy: 0.74, eliteLatencyMs: 860  },
      { level: 5,  label: 'Marathon',       speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { trials: 16, timerMs: 3400 }, targetAccuracy: 0.73, eliteLatencyMs: 850  },
      { level: 6,  label: 'Fatigue Test',   speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { trials: 18, timerMs: 3200 }, targetAccuracy: 0.72, eliteLatencyMs: 840  },
      { level: 7,  label: 'Vigilance',      speedMultiplier: 1.0, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { trials: 20, timerMs: 3000 }, targetAccuracy: 0.72, eliteLatencyMs: 830  },
      { level: 8,  label: 'Monotony',       speedMultiplier: 1.0, distractorDensity: 0.40, ruleShifting: false, uiInterference: false, gameParams: { trials: 22, timerMs: 2800 }, targetAccuracy: 0.71, eliteLatencyMs: 820  },
      { level: 9,  label: 'Deep Focus',     speedMultiplier: 1.0, distractorDensity: 0.50, ruleShifting: false, uiInterference: false, gameParams: { trials: 24, timerMs: 2600 }, targetAccuracy: 0.70, eliteLatencyMs: 810  },
      { level: 10, label: 'Iron Focus',     speedMultiplier: 1.0, distractorDensity: 0.60, ruleShifting: false, uiInterference: true,  gameParams: { trials: 26, timerMs: 2400 }, targetAccuracy: 0.70, eliteLatencyMs: 800  },
    ]),
  },

  // ── T21 · Processing Speed ───────────────────────────────────────────────
  T21: {
    id: 'T21', name: 'Processing Speed', icon: '⚡',
    description: 'Responding accurately to stimuli in minimal time — the raw tempo of cognitive throughput.',
    gameEngine: 'reaction',
    primaryGameId: 'reaction_basic',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Ready',          speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 8,  delayMs: 1000 }, targetAccuracy: 0.85, eliteLatencyMs: 280 },
      { level: 2,  label: 'Alert',          speedMultiplier: 1.1, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 9,  delayMs: 900  }, targetAccuracy: 0.85, eliteLatencyMs: 270 },
      { level: 3,  label: 'Quick',          speedMultiplier: 1.2, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 10, delayMs: 800  }, targetAccuracy: 0.85, eliteLatencyMs: 260 },
      { level: 4,  label: 'Fast',           speedMultiplier: 1.3, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 10, delayMs: 700  }, targetAccuracy: 0.84, eliteLatencyMs: 255 },
      { level: 5,  label: 'Rapid',          speedMultiplier: 1.4, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 11, delayMs: 650  }, targetAccuracy: 0.83, eliteLatencyMs: 250 },
      { level: 6,  label: 'Sprint',         speedMultiplier: 1.5, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { variant: 'basic', rounds: 12, delayMs: 600  }, targetAccuracy: 0.82, eliteLatencyMs: 245 },
      { level: 7,  label: 'Flash',          speedMultiplier: 1.6, distractorDensity: 0.30, ruleShifting: false, uiInterference: false, gameParams: { variant: 'speed', rounds: 12, delayMs: 550  }, targetAccuracy: 0.82, eliteLatencyMs: 240 },
      { level: 8,  label: 'Instant',        speedMultiplier: 1.7, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'speed', rounds: 13, delayMs: 500  }, targetAccuracy: 0.81, eliteLatencyMs: 235 },
      { level: 9,  label: 'Reflex',         speedMultiplier: 1.8, distractorDensity: 0.50, ruleShifting: true,  uiInterference: false, gameParams: { variant: 'speed', rounds: 14, delayMs: 400  }, targetAccuracy: 0.80, eliteLatencyMs: 230 },
      { level: 10, label: 'Apex',           speedMultiplier: 2.0, distractorDensity: 0.60, ruleShifting: true,  uiInterference: true,  gameParams: { variant: 'speed', rounds: 15, delayMs: 300  }, targetAccuracy: 0.78, eliteLatencyMs: 220 },
    ]),
  },

  // ── T23 · Ideational Fluency ─────────────────────────────────────────────
  T23: {
    id: 'T23', name: 'Ideational Fluency', icon: '💡',
    description: 'Generating a high volume of quality hypotheses — creative exploration without abandoning rigour.',
    gameEngine: 'rule_discovery',
    primaryGameId: 'black_box_hard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      { level: 1,  label: 'Spark',          speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 4 }, targetAccuracy: 0.70, eliteLatencyMs: 35000 },
      { level: 2,  label: 'Explore',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { hard: false, rounds: 5 }, targetAccuracy: 0.70, eliteLatencyMs: 35000 },
      { level: 3,  label: 'Diverge',        speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  rounds: 5 }, targetAccuracy: 0.68, eliteLatencyMs: 36000 },
      { level: 4,  label: 'Branch',         speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  rounds: 5 }, targetAccuracy: 0.68, eliteLatencyMs: 37000 },
      { level: 5,  label: 'Generate',       speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { hard: true,  rounds: 6 }, targetAccuracy: 0.67, eliteLatencyMs: 38000 },
      { level: 6,  label: 'Proliferate',    speedMultiplier: 1.0, distractorDensity: 0.20, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  rounds: 6 }, targetAccuracy: 0.66, eliteLatencyMs: 39000 },
      { level: 7,  label: 'Expand',         speedMultiplier: 1.0, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  rounds: 7 }, targetAccuracy: 0.65, eliteLatencyMs: 40000 },
      { level: 8,  label: 'Synthesise',     speedMultiplier: 1.0, distractorDensity: 0.40, ruleShifting: true,  uiInterference: false, gameParams: { hard: true,  rounds: 7 }, targetAccuracy: 0.64, eliteLatencyMs: 42000 },
      { level: 9,  label: 'Recombine',      speedMultiplier: 1.0, distractorDensity: 0.50, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  rounds: 8 }, targetAccuracy: 0.62, eliteLatencyMs: 44000 },
      { level: 10, label: 'Breakthrough',   speedMultiplier: 1.0, distractorDensity: 0.60, ruleShifting: true,  uiInterference: true,  gameParams: { hard: true,  rounds: 8 }, targetAccuracy: 0.60, eliteLatencyMs: 46000 },
    ]),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTraitById(id: string): TraitDefinition | undefined {
  return TRAIT_CATALOG[id];
}

export function getTraitLevel(traitId: string, level: number): LevelConfig | undefined {
  return TRAIT_CATALOG[traitId]?.levels[level - 1];
}

/**
 * Adaptive decision after a level completes.
 * Returns: 'skip' (jump to level 4), 'continue', 'ceiling' (end trait), 'complete' (level 10 done)
 */
export function adaptiveDecision(
  traitId: string,
  completedLevel: number,
  score: number,               // 0–100
  recentScores: number[],      // last N scores including current, oldest first
): 'skip' | 'continue' | 'ceiling' | 'complete' {
  const trait = TRAIT_CATALOG[traitId];
  if (!trait) return 'complete';

  // Skip rule: only on level 1
  if (completedLevel === 1 && score >= trait.skipScore) return 'skip';

  // Ceiling rule: if any 3-consecutive-level window shows ≥40% drop
  if (recentScores.length >= trait.ceilingLevels) {
    const window = recentScores.slice(-trait.ceilingLevels);
    const peak   = Math.max(...window);
    const trough = Math.min(...window);
    if (peak > 0 && (peak - trough) / peak >= trait.ceilingDropPct) return 'ceiling';
  }

  if (completedLevel >= 10) return 'complete';
  return 'continue';
}
