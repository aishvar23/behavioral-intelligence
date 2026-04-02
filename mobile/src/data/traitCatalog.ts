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

export interface ProfessionalBenchmark {
  profession: string;
  minLevel: number;
  minAccuracy: number;       // 0–1
  maxLatencyMs?: number;
  notes?: string;
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
  // Professional benchmarks for the Archetype Card verdict
  benchmarks?: ProfessionalBenchmark[];
  // Trait Talk: which other trait validates this one
  validatedBy?: string;     // trait ID
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

  // ── T01 · Triage — The Reactor ───────────────────────────────────────────
  // Nuclear Core Maintenance: fuel rods fall into bins. Tap glowing (high-
  // priority) rods, ignore steam/static distractors.
  //
  // Professional benchmarks:
  //   Commercial Pilot : Level 9+ · ≥98% high-priority accuracy
  //   ER Surgeon       : Level 8+ · decision latency < 300ms
  //   Project Manager  : Level 7+ · 5+ bins, high sort efficiency
  //
  // Validated by: T04 Panic Management (Trait Talk — Stress-Fragile rule)
  T01: {
    id: 'T01', name: 'Triage', icon: '🚨',
    description: 'Rapidly categorising incoming signals by importance — catching critical items while ignoring noise under escalating time pressure.',
    gameEngine: 'reactor',
    primaryGameId: 'the_reactor_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T04',
    benchmarks: [
      { profession: 'Commercial Pilot',  minLevel: 9, minAccuracy: 0.98, notes: '≥98% high-priority accuracy in Meltdown phase' },
      { profession: 'ER Surgeon',        minLevel: 8, minAccuracy: 0.95, maxLatencyMs: 300, notes: 'Ultra-low decision latency (<300ms) required' },
      { profession: 'Project Manager',   minLevel: 7, minAccuracy: 0.85, notes: 'High efficiency across 5+ bin configurations' },
    ],
    levels: levels([
      // L1–2 · Baseline: 2 bins, slow fall, no distractors
      {
        level: 1, label: 'Cold Start',
        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 2, fallDurationMs: 4000, distractors: false, highPriorityBoost: 0, oscillate: false, meltdown: false, totalRods: 10, highRatio: 0.40, distractorRatio: 0 },
        targetAccuracy: 0.75, eliteLatencyMs: 350,
      },
      {
        level: 2, label: 'Warm-Up',
        speedMultiplier: 1.1, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 2, fallDurationMs: 3600, distractors: false, highPriorityBoost: 0, oscillate: false, meltdown: false, totalRods: 12, highRatio: 0.40, distractorRatio: 0 },
        targetAccuracy: 0.77, eliteLatencyMs: 340,
      },
      // L3–4 · Introduction of Noise: 3 bins, steam distractors begin
      {
        level: 3, label: 'Static Introduced',
        speedMultiplier: 1.2, distractorDensity: 0.15, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 3, fallDurationMs: 3200, distractors: true, highPriorityBoost: 0, oscillate: false, meltdown: false, totalRods: 14, highRatio: 0.38, distractorRatio: 0.15 },
        targetAccuracy: 0.78, eliteLatencyMs: 330,
      },
      {
        level: 4, label: 'Noise Rising',
        speedMultiplier: 1.3, distractorDensity: 0.20, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 3, fallDurationMs: 3000, distractors: true, highPriorityBoost: 0.05, oscillate: false, meltdown: false, totalRods: 15, highRatio: 0.38, distractorRatio: 0.20 },
        targetAccuracy: 0.78, eliteLatencyMs: 320,
      },
      // L5–6 · Priority Shift: 4 bins, high-priority rods fall 20% faster
      {
        level: 5, label: 'Priority Surge',
        speedMultiplier: 1.4, distractorDensity: 0.25, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 4, fallDurationMs: 2800, distractors: true, highPriorityBoost: 0.20, oscillate: false, meltdown: false, totalRods: 16, highRatio: 0.38, distractorRatio: 0.20 },
        targetAccuracy: 0.79, eliteLatencyMs: 310,
      },
      {
        level: 6, label: 'Speed Split',
        speedMultiplier: 1.5, distractorDensity: 0.30, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 4, fallDurationMs: 2600, distractors: true, highPriorityBoost: 0.20, oscillate: false, meltdown: false, totalRods: 18, highRatio: 0.37, distractorRatio: 0.22 },
        targetAccuracy: 0.80, eliteLatencyMs: 305,
      },
      // L7–8 · Environmental Stress: 5 bins, bins oscillate
      {
        level: 7, label: 'Unstable Core',
        speedMultiplier: 1.6, distractorDensity: 0.40, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 5, fallDurationMs: 2300, distractors: true, highPriorityBoost: 0.20, oscillate: true, meltdown: false, totalRods: 20, highRatio: 0.37, distractorRatio: 0.22 },
        targetAccuracy: 0.80, eliteLatencyMs: 300,
      },
      {
        level: 8, label: 'Critical Instability',
        speedMultiplier: 1.7, distractorDensity: 0.50, ruleShifting: false, uiInterference: false,
        gameParams: { numBins: 5, fallDurationMs: 2100, distractors: true, highPriorityBoost: 0.22, oscillate: true, meltdown: false, totalRods: 22, highRatio: 0.36, distractorRatio: 0.24 },
        targetAccuracy: 0.80, eliteLatencyMs: 295,
      },
      // L9–10 · Elite / Pilot Grade: 6 bins, full meltdown mode
      {
        level: 9, label: 'Meltdown',
        speedMultiplier: 1.9, distractorDensity: 0.70, ruleShifting: true, uiInterference: true,
        gameParams: { numBins: 6, fallDurationMs: 1900, distractors: true, highPriorityBoost: 0.25, oscillate: true, meltdown: true, totalRods: 24, highRatio: 0.35, distractorRatio: 0.25 },
        targetAccuracy: 0.80, eliteLatencyMs: 290,
      },
      {
        level: 10, label: 'Core Breach',
        speedMultiplier: 2.0, distractorDensity: 0.90, ruleShifting: true, uiInterference: true,
        gameParams: { numBins: 6, fallDurationMs: 1700, distractors: true, highPriorityBoost: 0.25, oscillate: true, meltdown: true, totalRods: 26, highRatio: 0.35, distractorRatio: 0.25 },
        targetAccuracy: 0.80, eliteLatencyMs: 280,
      },
    ]),
  },

  // ── T04 · Panic Management — Reactor Chaos ──────────────────────────────
  // Same nuclear core as T01 but periodic "System Failure" events inject chaos:
  // screen shake, dim overlay, flicker, steam, color inversion, input lag.
  //
  // Key T04 metrics (returned inside game score payload):
  //   precisionDelta  = calmAccuracy − chaosAccuracy (lower = better)
  //   recoveryMs      = latency from chaos end → first correct tap (lower = better)
  //   panicClicks     = rapid-fire taps ≤250ms apart during chaos (0 = elite)
  //   chaosRtSd       = std-dev of reaction times during chaos (lower = consistent)
  //
  // Professional benchmarks:
  //   Commercial Pilot : Level 10 · precisionDelta < 3%, recoveryMs < 150ms
  //   Air Traffic Ctrl : Level 9+ · zero panic clicks, delta < 5%
  //   Stock Trader     : Level 8+ · recoveryMs < 200ms, delta < 8%
  //
  // Validated by: T01 Triage (Trait Talk — Fair-Weather Triage / Stress-Fragile)
  T04: {
    id: 'T04', name: 'Panic Management', icon: '🧘',
    description: 'Maintaining accuracy under sudden system failures — runway intersection control with emergencies, fog, and rapid multi-aircraft convergence.',
    gameEngine: 'hold_short',
    primaryGameId: 'hold_short_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T01',
    benchmarks: [
      { profession: 'Commercial Pilot',       minLevel: 9, minAccuracy: 0.95, notes: 'Zero collisions at Level 9+ fog + mayday conditions' },
      { profession: 'Air Traffic Controller', minLevel: 9, minAccuracy: 0.95, notes: 'Zero violations; ≥95% triage accuracy under low-vis fog' },
      { profession: 'Stock Trader',           minLevel: 8, minAccuracy: 0.90, notes: '≥90% triage accuracy; recovers in <1s post-mayday' },
    ],
    levels: levels([
      // L1–2: Calm — slow approach, 2-3 aircraft, no fog or emergencies
      { level: 1,  label: 'Calm',          speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { aircraftCount: 2, maydayInterrupts: false, lowVisFog: false, approachSpeed: 5000, totalAircraft: 8  }, targetAccuracy: 0.80, eliteLatencyMs: 2500 },
      { level: 2,  label: 'Steady',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { aircraftCount: 3, maydayInterrupts: false, lowVisFog: false, approachSpeed: 4500, totalAircraft: 10 }, targetAccuracy: 0.80, eliteLatencyMs: 2400 },
      // L3–4: Faster approach, 4-5 aircraft
      { level: 3,  label: 'Busy',          speedMultiplier: 1.1, distractorDensity: 0.05, ruleShifting: false, uiInterference: false, gameParams: { aircraftCount: 4, maydayInterrupts: false, lowVisFog: false, approachSpeed: 4000, totalAircraft: 12 }, targetAccuracy: 0.78, eliteLatencyMs: 2200 },
      { level: 4,  label: 'Rush Hour',     speedMultiplier: 1.2, distractorDensity: 0.05, ruleShifting: false, uiInterference: false, gameParams: { aircraftCount: 5, maydayInterrupts: false, lowVisFog: false, approachSpeed: 3500, totalAircraft: 14 }, targetAccuracy: 0.76, eliteLatencyMs: 2000 },
      // L5–6: Mayday interrupts begin
      { level: 5,  label: 'Emergency',     speedMultiplier: 1.2, distractorDensity: 0.10, ruleShifting: true,  uiInterference: false, gameParams: { aircraftCount: 5, maydayInterrupts: true,  lowVisFog: false, approachSpeed: 3500, totalAircraft: 14 }, targetAccuracy: 0.74, eliteLatencyMs: 1900 },
      { level: 6,  label: 'Crisis',        speedMultiplier: 1.3, distractorDensity: 0.15, ruleShifting: true,  uiInterference: false, gameParams: { aircraftCount: 6, maydayInterrupts: true,  lowVisFog: false, approachSpeed: 3000, totalAircraft: 16 }, targetAccuracy: 0.72, eliteLatencyMs: 1800 },
      // L7–8: Low-vis fog + mayday
      { level: 7,  label: 'Low Vis',       speedMultiplier: 1.4, distractorDensity: 0.20, ruleShifting: true,  uiInterference: true,  gameParams: { aircraftCount: 7, maydayInterrupts: true,  lowVisFog: true,  approachSpeed: 2800, totalAircraft: 16 }, targetAccuracy: 0.70, eliteLatencyMs: 1700 },
      { level: 8,  label: 'Fog + Chaos',   speedMultiplier: 1.5, distractorDensity: 0.25, ruleShifting: true,  uiInterference: true,  gameParams: { aircraftCount: 8, maydayInterrupts: true,  lowVisFog: true,  approachSpeed: 2500, totalAircraft: 18 }, targetAccuracy: 0.68, eliteLatencyMs: 1600 },
      // L9–10: Max saturation — 10-12 aircraft, all stress conditions
      { level: 9,  label: 'Saturation',    speedMultiplier: 1.7, distractorDensity: 0.30, ruleShifting: true,  uiInterference: true,  gameParams: { aircraftCount: 10, maydayInterrupts: true, lowVisFog: true,  approachSpeed: 2200, totalAircraft: 18 }, targetAccuracy: 0.65, eliteLatencyMs: 1500 },
      { level: 10, label: 'Total Control', speedMultiplier: 2.0, distractorDensity: 0.35, ruleShifting: true,  uiInterference: true,  gameParams: { aircraftCount: 12, maydayInterrupts: true, lowVisFog: true,  approachSpeed: 2000, totalAircraft: 20 }, targetAccuracy: 0.62, eliteLatencyMs: 1400 },
    ]),
  },

  // ── T06 · Working Memory — Radar Sweep ──────────────────────────────────
  // Circular radar display. Contacts blink sequentially as the sweep passes.
  // User taps them in REVERSE order. Decoys and 90° mental rotation added at
  // higher levels to stress spatial working memory vs rote sequence recall.
  //
  // L1-2: 3-4 contacts, 180° field, no decoys, no rotation
  // L3-4: 4-5 contacts, 180°→360°, no decoys
  // L5-6: 5-6 contacts, 360°, decoys introduced
  // L7-8: 6-7 contacts, 360°, decoys + mental rotation
  // L9-10: 7-8 contacts, 360°, decoys + rotation + fast display
  //
  // Key metrics: maxReverseSpan, spatialErrorDeg, interferenceResistance
  // Pilot Floor: 6+ reverse span; <15° rotation error at L10
  // Validated by: T12 Systems Thinking (Spatial Rotation failure vs Rote success)
  T06: {
    id: 'T06', name: 'Working Memory', icon: '🧠',
    description: 'Circular radar sweep — memorise blinking contact positions, then tap them in reverse order. Decoys and mental rotation at elite levels.',
    gameEngine: 'radar_sweep',
    primaryGameId: 'radar_sweep_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T12',
    benchmarks: [
      { profession: 'Commercial Pilot',       minLevel: 8, minAccuracy: 0.82, notes: '6+ reverse span in 360° field; <20° spatial error' },
      { profession: 'Air Traffic Controller', minLevel: 9, minAccuracy: 0.80, notes: '≥6 span with decoys + mental rotation; error <15°' },
      { profession: 'Software Engineer',      minLevel: 7, minAccuracy: 0.78, notes: 'Span 5+; decoy resistance >75%; <25° spatial error' },
    ],
    levels: levels([
      // L1-2: 3-4 contacts, 180°, clean — establish raw reverse-span baseline
      { level: 1,  label: 'Sweep',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 3, fieldDegrees: 180, decoys: false, mentalRotation: false, displayMs: 1000, rounds: 3 }, targetAccuracy: 0.85, eliteLatencyMs: 6000 },
      { level: 2,  label: 'Track',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 4, fieldDegrees: 180, decoys: false, mentalRotation: false, displayMs: 950,  rounds: 3 }, targetAccuracy: 0.82, eliteLatencyMs: 6000 },
      // L3-4: 360° field
      { level: 3,  label: 'Full Arc',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 4, fieldDegrees: 360, decoys: false, mentalRotation: false, displayMs: 950,  rounds: 4 }, targetAccuracy: 0.78, eliteLatencyMs: 6500 },
      { level: 4,  label: 'Span 5',        speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 5, fieldDegrees: 360, decoys: false, mentalRotation: false, displayMs: 900,  rounds: 4 }, targetAccuracy: 0.76, eliteLatencyMs: 7000 },
      // L5-6: Decoys introduced
      { level: 5,  label: 'Decoy Field',   speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 5, fieldDegrees: 360, decoys: true,  mentalRotation: false, displayMs: 900,  rounds: 4 }, targetAccuracy: 0.74, eliteLatencyMs: 7000 },
      { level: 6,  label: 'Span 6',        speedMultiplier: 1.2, distractorDensity: 0.25, ruleShifting: false, uiInterference: false, gameParams: { contactCount: 6, fieldDegrees: 360, decoys: true,  mentalRotation: false, displayMs: 850,  rounds: 4 }, targetAccuracy: 0.72, eliteLatencyMs: 7500 },
      // L7-8: Mental rotation (90° before recall phase)
      { level: 7,  label: 'Rotated',       speedMultiplier: 1.2, distractorDensity: 0.25, ruleShifting: true,  uiInterference: false, gameParams: { contactCount: 6, fieldDegrees: 360, decoys: true,  mentalRotation: true,  displayMs: 850,  rounds: 4 }, targetAccuracy: 0.70, eliteLatencyMs: 8000 },
      { level: 8,  label: 'Span 7',        speedMultiplier: 1.3, distractorDensity: 0.30, ruleShifting: true,  uiInterference: false, gameParams: { contactCount: 7, fieldDegrees: 360, decoys: true,  mentalRotation: true,  displayMs: 800,  rounds: 5 }, targetAccuracy: 0.68, eliteLatencyMs: 8500 },
      // L9-10: Fast display + all stressors
      { level: 9,  label: 'Elite Scan',    speedMultiplier: 1.4, distractorDensity: 0.35, ruleShifting: true,  uiInterference: true,  gameParams: { contactCount: 7, fieldDegrees: 360, decoys: true,  mentalRotation: true,  displayMs: 750,  rounds: 5 }, targetAccuracy: 0.65, eliteLatencyMs: 9000 },
      { level: 10, label: 'Pilot Grade',   speedMultiplier: 1.5, distractorDensity: 0.40, ruleShifting: true,  uiInterference: true,  gameParams: { contactCount: 8, fieldDegrees: 360, decoys: true,  mentalRotation: true,  displayMs: 700,  rounds: 5 }, targetAccuracy: 0.62, eliteLatencyMs: 10000 },
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

  // ── T12 · Systems Thinking — Nav-Link ───────────────────────────────────
  // Satellite-to-Ground data routing. Tap pairs of nodes to establish links;
  // maintain an optimal path as nodes orbit, degrade, and brown out.
  // L1-2: 3-5 static nodes, no signal decay
  // L3-4: 6-7 nodes, signal decay active
  // L5-6: 7-8 nodes, bandwidth caps
  // L7-8: 9-10 nodes, brown-out cycling
  // L9-10: 10-12 nodes, orbit + all features
  //
  // Key metrics: uptimePct, pathEfficiency, mttrMs
  // Validated by: T06 Working Memory (Slow Architect: high T12, low T06)
  T12: {
    id: 'T12', name: 'Systems Thinking', icon: '🗺️',
    description: 'Route satellite data to the ground via relay nodes — maintain optimal path as nodes orbit, degrade, and brown out.',
    gameEngine: 'nav_link',
    primaryGameId: 'nav_link_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T06',
    benchmarks: [
      { profession: 'Systems Engineer',   minLevel: 9,  minAccuracy: 0.92, notes: '>92% uptime with orbital flux and brown-outs' },
      { profession: 'Commercial Pilot',   minLevel: 8,  minAccuracy: 0.88, notes: '>88% uptime; MTTR <3s at 10-node network' },
      { profession: 'Project Manager',    minLevel: 7,  minAccuracy: 0.85, notes: 'Bandwidth-cap network with >85% path efficiency' },
    ],
    levels: levels([
      // L1-2: 3-5 static nodes, no decay, no caps, no brownout
      { level: 1,  label: 'Link',          speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { nodeCount: 3,  signalDecay: false, bandwidthCaps: false, brownOuts: false, durationMs: 50000, orbitSpeed: 0     }, targetAccuracy: 0.90, eliteLatencyMs: 15000 },
      { level: 2,  label: 'Route',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { nodeCount: 5,  signalDecay: false, bandwidthCaps: false, brownOuts: false, durationMs: 55000, orbitSpeed: 0     }, targetAccuracy: 0.88, eliteLatencyMs: 18000 },
      // L3-4: Signal decay (prefer shorter links)
      { level: 3,  label: 'Decay',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { nodeCount: 6,  signalDecay: true,  bandwidthCaps: false, brownOuts: false, durationMs: 60000, orbitSpeed: 0     }, targetAccuracy: 0.85, eliteLatencyMs: 20000 },
      { level: 4,  label: 'Attenuation',   speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { nodeCount: 7,  signalDecay: true,  bandwidthCaps: false, brownOuts: false, durationMs: 60000, orbitSpeed: 0     }, targetAccuracy: 0.83, eliteLatencyMs: 22000 },
      // L5-6: Bandwidth caps
      { level: 5,  label: 'Capacity',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: false, gameParams: { nodeCount: 7,  signalDecay: true,  bandwidthCaps: true,  brownOuts: false, durationMs: 65000, orbitSpeed: 0     }, targetAccuracy: 0.80, eliteLatencyMs: 25000 },
      { level: 6,  label: 'Constrained',   speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: false, gameParams: { nodeCount: 8,  signalDecay: true,  bandwidthCaps: true,  brownOuts: false, durationMs: 65000, orbitSpeed: 0     }, targetAccuracy: 0.78, eliteLatencyMs: 28000 },
      // L7-8: Brown-out cycling
      { level: 7,  label: 'Brownout',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { nodeCount: 9,  signalDecay: true,  bandwidthCaps: true,  brownOuts: true,  durationMs: 70000, orbitSpeed: 0     }, targetAccuracy: 0.75, eliteLatencyMs: 30000 },
      { level: 8,  label: 'Flux',          speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { nodeCount: 10, signalDecay: true,  bandwidthCaps: true,  brownOuts: true,  durationMs: 75000, orbitSpeed: 0     }, targetAccuracy: 0.72, eliteLatencyMs: 35000 },
      // L9-10: Orbiting nodes + all features
      { level: 9,  label: 'Orbital',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { nodeCount: 10, signalDecay: true,  bandwidthCaps: true,  brownOuts: true,  durationMs: 80000, orbitSpeed: 25000 }, targetAccuracy: 0.68, eliteLatencyMs: 40000 },
      { level: 10, label: 'Deep Space',    speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { nodeCount: 12, signalDecay: true,  bandwidthCaps: true,  brownOuts: true,  durationMs: 90000, orbitSpeed: 18000 }, targetAccuracy: 0.65, eliteLatencyMs: 50000 },
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

  // ── T15 · Social Inference — The Briefing ───────────────────────────────
  // Text-based Theory of Mind game. User reads crew transcripts and identifies
  // the hidden intent behind words + cues.
  //
  // Metrics:
  //   inferenceAccuracy  — % correct intent identifications (60pts)
  //   cueWeighting       — relying on non-verbal over verbal cues (25pts)
  //   biasScore          — avoiding projection bias choices (15pts)
  //
  // Professional benchmarks:
  //   Commercial Pilot   : Level 8+ · ≥80% non-verbal cue weighting
  //   Air Traffic Control: Level 7+ · zero projection bias flags
  //   Military Commander : Level 9+ · ≥85% accuracy under noise conditions
  //
  // Validated by: T16 Affective Empathy (Trait Talk — Social Analyst rule)
  T15: {
    id: 'T15', name: 'Social Inference', icon: '👥',
    description: 'Reading between the lines — inferring hidden intent from tone, body language, and subtext across high-stakes crew interactions.',
    gameEngine: 'briefing',
    primaryGameId: 'briefing_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T16',
    benchmarks: [
      { profession: 'Commercial Pilot',      minLevel: 8, minAccuracy: 0.80, notes: '≥80% non-verbal cue weighting; hidden alarm detection at L7+' },
      { profession: 'Air Traffic Controller', minLevel: 7, minAccuracy: 0.78, notes: 'Zero projection bias flags across formal radio exchanges' },
      { profession: 'Military Commander',     minLevel: 9, minAccuracy: 0.85, notes: '≥85% accuracy under noise/static (L10 garbled conditions)' },
    ],
    levels: levels([
      // L1–2: Clear emotions, all cues visible, generous timer
      { level: 1,  label: 'Direct Read',      speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { level: 1, scenarioCount: 4, timePerScenarioMs: 22000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.72, eliteLatencyMs: 8000 },
      { level: 2,  label: 'Clear Signal',     speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { level: 2, scenarioCount: 4, timePerScenarioMs: 20000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.73, eliteLatencyMs: 8000 },
      // L3–4: Sarcasm/doubt, tonal cue is key signal
      { level: 3,  label: 'Between the Lines', speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false,
        gameParams: { level: 3, scenarioCount: 4, timePerScenarioMs: 20000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.72, eliteLatencyMs: 9000 },
      { level: 4,  label: 'Sarcasm Layer',    speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false,
        gameParams: { level: 4, scenarioCount: 5, timePerScenarioMs: 18000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.71, eliteLatencyMs: 9000 },
      // L5–6: Conflicting verbal vs body — weigh which cue is reliable
      { level: 5,  label: 'Mixed Signal',     speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false,
        gameParams: { level: 5, scenarioCount: 5, timePerScenarioMs: 18000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.70, eliteLatencyMs: 9500 },
      { level: 6,  label: 'Conflict Channel', speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false,
        gameParams: { level: 6, scenarioCount: 5, timePerScenarioMs: 16000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
        targetAccuracy: 0.70, eliteLatencyMs: 9500 },
      // L7–8: Professional deference, cockpit formality, hidden alarm
      { level: 7,  label: 'Professional Mask', speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: true, uiInterference: false,
        gameParams: { level: 7, scenarioCount: 5, timePerScenarioMs: 16000, visibleCues: ['verbal', 'tonal'], noiseLevel: 0 },
        targetAccuracy: 0.68, eliteLatencyMs: 10000 },
      { level: 8,  label: 'Hidden Alarm',     speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: true, uiInterference: false,
        gameParams: { level: 8, scenarioCount: 5, timePerScenarioMs: 14000, visibleCues: ['verbal', 'tonal'], noiseLevel: 0 },
        targetAccuracy: 0.67, eliteLatencyMs: 10000 },
      // L9: Multi-step exchanges, rapid inference
      { level: 9,  label: 'Multi-Channel',    speedMultiplier: 1.4, distractorDensity: 0.50, ruleShifting: true, uiInterference: false,
        gameParams: { level: 9, scenarioCount: 5, timePerScenarioMs: 14000, visibleCues: ['verbal', 'tonal'], noiseLevel: 0 },
        targetAccuracy: 0.65, eliteLatencyMs: 10500 },
      // L10: Garbled / [STATIC] partial — Fog of War
      { level: 10, label: 'Fog of War',       speedMultiplier: 1.5, distractorDensity: 0.60, ruleShifting: true, uiInterference: true,
        gameParams: { level: 10, scenarioCount: 5, timePerScenarioMs: 12000, visibleCues: ['verbal'], noiseLevel: 2 },
        targetAccuracy: 0.62, eliteLatencyMs: 11000 },
    ]),
  },

  // ── T16 · Affective Empathy — Empathy Response ──────────────────────────
  // Emergency Response Coordinator metaphor. User chooses responses to crew
  // in distress — must balance mission success with emotional support.
  //
  // Metrics:
  //   supportAccuracy   — % de-escalating responses (50pts)
  //   contagionPenalty  — RT slowdown on high-distress vs neutral (30pts)
  //   boundariesScore   — avoids over-apologetic/mission-abandoning choices (20pts)
  //
  // Level 10 dual-game: The Reactor runs as a HUD strip simultaneously.
  //   Gatekeeper: if reactor miss rate > 50% during any answer → score capped at 40.
  //   Degradation: score drop vs L9 baseline → up to 20pt penalty.
  //
  // Professional benchmarks:
  //   Commercial Pilot   : Level 9+ · contagionPenalty < 0.10, boundaries ≥85%
  //   ER Surgeon         : Level 8+ · supportAccuracy ≥80% under extreme distress
  //   Crisis Negotiator  : Level 10 · full dual-game score ≥70
  //
  // Validated by: T15 Social Inference (Trait Talk — Emotional Sponge / Social Analyst)
  T16: {
    id: 'T16', name: 'Affective Empathy', icon: '❤️',
    description: 'Choosing responses that de-escalate distress without losing mission focus — measured under escalating emotional load.',
    gameEngine: 'empathy',
    primaryGameId: 'empathy_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T15',
    benchmarks: [
      { profession: 'Commercial Pilot',  minLevel: 9, minAccuracy: 0.80, notes: 'contagionPenalty <10%; boundaries ≥85% in high-distress scenarios' },
      { profession: 'ER Surgeon',        minLevel: 8, minAccuracy: 0.80, notes: 'supportAccuracy ≥80% in extreme-distress events' },
      { profession: 'Crisis Negotiator', minLevel: 10, minAccuracy: 0.70, notes: 'Full dual-game (Mayday+Reactor) score ≥70' },
    ],
    levels: levels([
      // L1–2: Mild disappointment, warm supportive responses needed
      { level: 1,  label: 'Soft Landing',   speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { level: 1, scenarioCount: 4, timePerScenarioMs: 28000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.75, eliteLatencyMs: 10000 },
      { level: 2,  label: 'First Response', speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false,
        gameParams: { level: 2, scenarioCount: 4, timePerScenarioMs: 26000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.74, eliteLatencyMs: 10000 },
      // L3–4: User-caused stress — avoid becoming over-apologetic
      { level: 3,  label: 'Own It',         speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false,
        gameParams: { level: 3, scenarioCount: 4, timePerScenarioMs: 25000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.72, eliteLatencyMs: 10500 },
      { level: 4,  label: 'Fault Line',     speedMultiplier: 1.0, distractorDensity: 0.10, ruleShifting: false, uiInterference: false,
        gameParams: { level: 4, scenarioCount: 4, timePerScenarioMs: 23000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.72, eliteLatencyMs: 10500 },
      // L5–6: Mission vs face-saving trade-off
      { level: 5,  label: 'The Trade-off',  speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false,
        gameParams: { level: 5, scenarioCount: 5, timePerScenarioMs: 22000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.70, eliteLatencyMs: 11000 },
      { level: 6,  label: 'Truth or Shield', speedMultiplier: 1.1, distractorDensity: 0.20, ruleShifting: false, uiInterference: false,
        gameParams: { level: 6, scenarioCount: 5, timePerScenarioMs: 20000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.70, eliteLatencyMs: 11000 },
      // L7–8: High intensity (irate/panicked characters + RT measurement)
      { level: 7,  label: 'Pressure Point', speedMultiplier: 1.2, distractorDensity: 0.30, ruleShifting: false, uiInterference: false,
        gameParams: { level: 7, scenarioCount: 5, timePerScenarioMs: 20000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.68, eliteLatencyMs: 11500 },
      { level: 8,  label: 'Panic Protocol', speedMultiplier: 1.3, distractorDensity: 0.40, ruleShifting: false, uiInterference: false,
        gameParams: { level: 8, scenarioCount: 5, timePerScenarioMs: 18000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.67, eliteLatencyMs: 12000 },
      // L9: Extreme crisis, multiple escalation layers
      { level: 9,  label: 'Critical Mass',  speedMultiplier: 1.4, distractorDensity: 0.50, ruleShifting: false, uiInterference: true,
        gameParams: { level: 9, scenarioCount: 4, timePerScenarioMs: 18000, dualGame: false, baselineAccuracy: 0 },
        targetAccuracy: 0.65, eliteLatencyMs: 12000 },
      // L10: Dual game — Mayday scenario + Reactor HUD concurrently
      { level: 10, label: 'Mayday Protocol', speedMultiplier: 1.5, distractorDensity: 0.60, ruleShifting: true, uiInterference: true,
        gameParams: {
          level: 10, scenarioCount: 3, timePerScenarioMs: 30000, dualGame: true, baselineAccuracy: 0.70,
          reactorConfig: {
            numBins: 3, fallDurationMs: 2000, distractors: false,
            highPriorityBoost: 0, oscillate: false, meltdown: false,
            totalRods: 20, highRatio: 0.5, distractorRatio: 0,
          },
        },
        targetAccuracy: 0.60, eliteLatencyMs: 13000 },
    ]),
  },

  // ── T19 · Anomaly Detection ──────────────────────────────────────────────
  T19: {
    id: 'T19', name: 'Anomaly Detection', icon: '🔎',
    description: 'Scrolling 8-track waveform monitor — tap spikes and phase-shifts before they scroll off screen. Precision vs false-positive balance.',
    gameEngine: 'signal_sift',
    primaryGameId: 'signal_sift_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    levels: levels([
      // L1-2: 1-2 tracks, clean signal, high-contrast spikes
      { level: 1,  label: 'Scan',           speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { trackCount: 1, visualSnow: false, phaseShifts: false, lowContrast: false, durationMs: 45000, anomalyRate: 0.15 }, targetAccuracy: 0.82, eliteLatencyMs: 800 },
      { level: 2,  label: 'Dual Track',     speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { trackCount: 2, visualSnow: false, phaseShifts: false, lowContrast: false, durationMs: 50000, anomalyRate: 0.18 }, targetAccuracy: 0.80, eliteLatencyMs: 800 },
      // L3-4: 3-4 tracks
      { level: 3,  label: 'Monitor',        speedMultiplier: 1.1, distractorDensity: 0.10, ruleShifting: false, uiInterference: false, gameParams: { trackCount: 3, visualSnow: false, phaseShifts: false, lowContrast: false, durationMs: 55000, anomalyRate: 0.20 }, targetAccuracy: 0.78, eliteLatencyMs: 800 },
      { level: 4,  label: 'Array',          speedMultiplier: 1.1, distractorDensity: 0.15, ruleShifting: false, uiInterference: false, gameParams: { trackCount: 4, visualSnow: false, phaseShifts: false, lowContrast: false, durationMs: 55000, anomalyRate: 0.22 }, targetAccuracy: 0.77, eliteLatencyMs: 800 },
      // L5-6: Visual snow + higher anomaly rate
      { level: 5,  label: 'Snow',           speedMultiplier: 1.2, distractorDensity: 0.25, ruleShifting: false, uiInterference: true,  gameParams: { trackCount: 5, visualSnow: true,  phaseShifts: false, lowContrast: false, durationMs: 60000, anomalyRate: 0.22 }, targetAccuracy: 0.75, eliteLatencyMs: 800 },
      { level: 6,  label: 'Noise Field',    speedMultiplier: 1.3, distractorDensity: 0.35, ruleShifting: false, uiInterference: true,  gameParams: { trackCount: 6, visualSnow: true,  phaseShifts: false, lowContrast: false, durationMs: 60000, anomalyRate: 0.25 }, targetAccuracy: 0.74, eliteLatencyMs: 800 },
      // L7-8: Phase shifts added
      { level: 7,  label: 'Phase Shift',    speedMultiplier: 1.4, distractorDensity: 0.45, ruleShifting: true,  uiInterference: true,  gameParams: { trackCount: 6, visualSnow: true,  phaseShifts: true,  lowContrast: false, durationMs: 60000, anomalyRate: 0.27 }, targetAccuracy: 0.72, eliteLatencyMs: 800 },
      { level: 8,  label: 'Inversion',      speedMultiplier: 1.5, distractorDensity: 0.55, ruleShifting: true,  uiInterference: true,  gameParams: { trackCount: 7, visualSnow: true,  phaseShifts: true,  lowContrast: false, durationMs: 60000, anomalyRate: 0.28 }, targetAccuracy: 0.71, eliteLatencyMs: 800 },
      // L9-10: Low-contrast + all 8 tracks
      { level: 9,  label: 'Near-Identical', speedMultiplier: 1.6, distractorDensity: 0.65, ruleShifting: true,  uiInterference: true,  gameParams: { trackCount: 8, visualSnow: true,  phaseShifts: true,  lowContrast: true,  durationMs: 60000, anomalyRate: 0.30 }, targetAccuracy: 0.70, eliteLatencyMs: 800 },
      { level: 10, label: 'Expert Eye',     speedMultiplier: 1.8, distractorDensity: 0.75, ruleShifting: true,  uiInterference: true,  gameParams: { trackCount: 8, visualSnow: true,  phaseShifts: true,  lowContrast: true,  durationMs: 60000, anomalyRate: 0.33 }, targetAccuracy: 0.68, eliteLatencyMs: 800 },
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

  // ── T21 · Processing Speed — Vector Flow ───────────────────────────────
  // Mach-speed classification tunnel. Objects rush toward you — classify
  // Mechanical vs Biological (later 4 sub-classes) before they pass.
  // Rule-flips swap L/R sides every 10s at higher levels.
  //
  // Level axes:
  //   speed (ms)     L1-2: slow (3000ms); L9-10: Mach (<1300ms)
  //   classCount     L1-6: 2 classes; L7-10: 4 sub-classes
  //   tunnelRotation L7-8: barrel slowly rotates
  //   ruleFlips      L9-10: L/R swap every 10s
  //
  // Key metrics: mrt, accuracy, switchingCost
  // Validated by: T01 Triage (Overclocked: MRT <250ms but accuracy <80%)
  T21: {
    id: 'T21', name: 'Processing Speed', icon: '⚡',
    description: 'Mach-speed classification tunnel — classify objects rushing toward you before they pass. Rule flips and rotating barrel at elite levels.',
    gameEngine: 'vector_flow',
    primaryGameId: 'vector_flow_standard',
    ceilingDropPct: 0.40, ceilingLevels: 3,
    skipScore: 95, skipToLevel: 4,
    validatedBy: 'T01',
    benchmarks: [
      { profession: 'Commercial Pilot',    minLevel: 9, minAccuracy: 0.90, maxLatencyMs: 250, notes: 'MRT <250ms; >90% accuracy at Mach Speed' },
      { profession: 'Pro Esports Athlete', minLevel: 10, minAccuracy: 0.85, maxLatencyMs: 200, notes: 'MRT <200ms with <50ms switching cost' },
      { profession: 'Stock Trader',        minLevel: 8, minAccuracy: 0.88, maxLatencyMs: 280, notes: 'MRT <280ms; rule-flip recovery <80ms' },
    ],
    levels: levels([
      // L1-2: 2 classes, slow approach, no rotation, no flips
      { level: 1,  label: 'Baseline',       speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 3000, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 12 }, targetAccuracy: 0.85, eliteLatencyMs: 500 },
      { level: 2,  label: 'Steady',         speedMultiplier: 1.0, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 2700, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 14 }, targetAccuracy: 0.83, eliteLatencyMs: 460 },
      // L3-4: Faster approach
      { level: 3,  label: 'Approach',       speedMultiplier: 1.1, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 2400, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 14 }, targetAccuracy: 0.82, eliteLatencyMs: 420 },
      { level: 4,  label: 'Mach',           speedMultiplier: 1.2, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 2100, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 16 }, targetAccuracy: 0.80, eliteLatencyMs: 380 },
      // L5-6: Higher speed
      { level: 5,  label: 'Sprint',         speedMultiplier: 1.3, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 1900, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 18 }, targetAccuracy: 0.80, eliteLatencyMs: 350 },
      { level: 6,  label: 'Velocity',       speedMultiplier: 1.4, distractorDensity: 0.00, ruleShifting: false, uiInterference: false, gameParams: { speed: 1700, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 20 }, targetAccuracy: 0.78, eliteLatencyMs: 320 },
      // L7-8: 4 sub-classes + tunnel rotation
      { level: 7,  label: 'Quad Class',     speedMultiplier: 1.5, distractorDensity: 0.00, ruleShifting: false, uiInterference: true,  gameParams: { speed: 1600, classCount: 4, tunnelRotation: true,  ruleFlips: false, totalObjects: 20 }, targetAccuracy: 0.76, eliteLatencyMs: 295 },
      { level: 8,  label: 'Barrel Roll',    speedMultiplier: 1.6, distractorDensity: 0.00, ruleShifting: false, uiInterference: true,  gameParams: { speed: 1450, classCount: 4, tunnelRotation: true,  ruleFlips: false, totalObjects: 22 }, targetAccuracy: 0.74, eliteLatencyMs: 270 },
      // L9-10: Rule flips every 10s — switching cost measured
      { level: 9,  label: 'Rule Flip',      speedMultiplier: 1.8, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { speed: 1350, classCount: 4, tunnelRotation: true,  ruleFlips: true,  totalObjects: 24 }, targetAccuracy: 0.72, eliteLatencyMs: 250 },
      { level: 10, label: 'Pilot Grade',    speedMultiplier: 2.0, distractorDensity: 0.00, ruleShifting: true,  uiInterference: true,  gameParams: { speed: 1200, classCount: 4, tunnelRotation: true,  ruleFlips: true,  totalObjects: 24 }, targetAccuracy: 0.70, eliteLatencyMs: 220 },
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
