/**
 * Game Catalog
 *
 * Architecture: 36 uniquely configured game variants × 50 occupations, each with
 * a curated pool of 10-12 variants. Random selection of 3 per session creates
 * near-unlimited variety. Add more GameConfig entries to scale toward 50,000+ configs.
 */

export type GameType = 'memory' | 'logic' | 'reaction' | 'stroop' | 'matrix' | 'spatial' | 'estimation' | 'search' | 'rule_discovery' | 'planning' | 'reactor' | 'reactor_chaos' | 'speed_reactor' | 'archive' | 'circuit' | 'briefing' | 'empathy' | 'radar_sweep' | 'vector_flow' | 'signal_sift' | 'hold_short' | 'nav_link';

export interface GameConfig {
  id: string;
  type: GameType;
  title: string;
  emoji: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  config: Record<string, unknown>;
}

export const GAME_CONFIGS: Record<string, GameConfig> = {
  // ── Rule Discovery variants (2) — analytical reasoning + learning speed ─────
  black_box_standard: {
    id: 'black_box_standard', type: 'rule_discovery',
    title: 'Black Box', emoji: '⬛', difficulty: 'medium',
    description: 'Test inputs on a hidden function, deduce the rule, predict the output.',
    config: {},
  },
  black_box_hard: {
    id: 'black_box_hard', type: 'rule_discovery',
    title: 'Black Box: Hard', emoji: '🔲', difficulty: 'hard',
    description: 'More complex hidden functions — nonlinear rules requiring deeper analysis.',
    config: { hard: true },
  },

  // ── Task Planning variants (2) — systematic thinking + dependency reasoning ─
  task_planning_standard: {
    id: 'task_planning_standard', type: 'planning',
    title: 'Task Planner', emoji: '📋', difficulty: 'medium',
    description: 'Order tasks with dependency constraints in the correct sequence.',
    config: {},
  },
  task_planning_hard: {
    id: 'task_planning_hard', type: 'planning',
    title: 'Task Planner: Advanced', emoji: '🗂️', difficulty: 'hard',
    description: 'Complex dependency graphs — multiple parallel paths and merge points.',
    config: { hard: true },
  },

  // ── Memory variants (6) ───────────────────────────────────────────────────
  memory_colors: {
    id: 'memory_colors', type: 'memory',
    title: 'Color Memory', emoji: '🌈', difficulty: 'medium',
    description: 'Watch the color sequence, then recall it in order.',
    config: { variant: 'colors' },
  },
  memory_numbers: {
    id: 'memory_numbers', type: 'memory',
    title: 'Number Recall', emoji: '🔢', difficulty: 'medium',
    description: 'Memorize and repeat number sequences — tests working memory.',
    config: { variant: 'numbers' },
  },
  memory_positions: {
    id: 'memory_positions', type: 'memory',
    title: 'Spatial Memory', emoji: '🗂️', difficulty: 'hard',
    description: 'Remember which grid positions were highlighted.',
    config: { variant: 'positions' },
  },
  memory_sequential: {
    id: 'memory_sequential', type: 'memory',
    title: 'Procedure Recall', emoji: '📋', difficulty: 'medium',
    description: 'Memorise ordered sequences of steps — precision and order matter.',
    config: { variant: 'sequential' },
  },
  memory_faces: {
    id: 'memory_faces', type: 'memory',
    title: 'Name & Context', emoji: '🧑‍🤝‍🧑', difficulty: 'medium',
    description: 'Associate names with faces or labels — social and associative memory.',
    config: { variant: 'faces' },
  },
  memory_code: {
    id: 'memory_code', type: 'memory',
    title: 'Code Recall', emoji: '💾', difficulty: 'hard',
    description: 'Remember symbolic patterns and code-like structures under load.',
    config: { variant: 'code' },
  },

  // ── Logic variants (6) — text-based reasoning (MCQ) ─────────────────────
  logic_verbal: {
    id: 'logic_verbal', type: 'logic',
    title: 'Word Logic', emoji: '💬', difficulty: 'medium',
    description: 'Verbal analogies, odd-one-out, language-based reasoning.',
    config: { variant: 'verbal' },
  },
  logic_situational: {
    id: 'logic_situational', type: 'logic',
    title: 'Situational Judgment', emoji: '🎯', difficulty: 'medium',
    description: 'Abstract judgment calls under ambiguity — no domain knowledge needed.',
    config: { variant: 'situational' },
  },
  logic_deduction: {
    id: 'logic_deduction', type: 'logic',
    title: 'Logic Deduction', emoji: '🔍', difficulty: 'hard',
    description: 'Formal syllogisms and deductive inference chains — conclusion follows from premises.',
    config: { variant: 'deduction' },
  },
  logic_patterns: {
    id: 'logic_patterns', type: 'logic',
    title: 'Number Patterns', emoji: '🔢', difficulty: 'medium',
    description: 'Complete number and letter sequences by identifying the underlying rule.',
    config: { variant: 'patterns' },
  },
  logic_boolean: {
    id: 'logic_boolean', type: 'logic',
    title: 'Boolean Reasoning', emoji: '⚙️', difficulty: 'hard',
    description: 'Evaluate AND / OR / NOT / XOR expressions — systematic logical computation.',
    config: { variant: 'boolean' },
  },
  logic_quantitative: {
    id: 'logic_quantitative', type: 'logic',
    title: 'Quantitative Reasoning', emoji: '📊', difficulty: 'medium',
    description: 'Rates, ratios, percentages and algebraic word problems — numerical reasoning.',
    config: { variant: 'quantitative' },
  },

  // ── Stroop variants (1) — impulse control + processing speed ─────────────
  stroop_classic: {
    id: 'stroop_classic', type: 'stroop',
    title: 'Color Conflict', emoji: '🎨', difficulty: 'medium',
    description: 'A color word appears in a mismatching ink color. Tap the ink color — not what the word says.',
    config: {},
  },

  // ── Matrix variants (2) — analytical thinking + learning speed ───────────
  matrix_standard: {
    id: 'matrix_standard', type: 'matrix',
    title: 'Pattern Matrix', emoji: '🔲', difficulty: 'medium',
    description: 'A 3×3 grid of shapes with one cell missing. Find the rule and complete the pattern.',
    config: {},
  },
  matrix_advanced: {
    id: 'matrix_advanced', type: 'matrix',
    title: 'Advanced Matrix', emoji: '🧩', difficulty: 'hard',
    description: 'More complex Raven-style pattern matrices requiring deeper analytical reasoning.',
    config: { advanced: true },
  },

  // ── Spatial variants (1) — spatial reasoning + systematic thinking ────────
  spatial_rotation: {
    id: 'spatial_rotation', type: 'spatial',
    title: 'Mental Rotation', emoji: '🔷', difficulty: 'medium',
    description: 'A shape is shown. Pick the option that is the same shape, just rotated — not mirrored.',
    config: {},
  },

  // ── Estimation variants (1) — numerical intuition + processing speed ──────
  dot_estimation: {
    id: 'dot_estimation', type: 'estimation',
    title: 'Dot Sense', emoji: '⚫', difficulty: 'medium',
    description: 'Two groups of dots flash briefly. Tap the side with more dots — use instinct, not counting.',
    config: {},
  },

  // ── Visual search variants (2) — attention to detail + processing speed ───
  visual_search_standard: {
    id: 'visual_search_standard', type: 'search',
    title: 'Symbol Hunt', emoji: '🔍', difficulty: 'medium',
    description: 'A grid of symbols — most are identical, a few are different. Find and tap the odd ones out.',
    config: {},
  },
  visual_search_hard: {
    id: 'visual_search_hard', type: 'search',
    title: 'Symbol Hunt Pro', emoji: '🕵️', difficulty: 'hard',
    description: 'Harder symbol search with more visually similar pairs under tighter time pressure.',
    config: { hard: true },
  },

  // ── Reaction variants (3) — new game type ────────────────────────────────
  reaction_basic: {
    id: 'reaction_basic', type: 'reaction',
    title: 'Quick Tap', emoji: '⚡', difficulty: 'easy',
    description: 'Tap the circle the instant it appears — pure reaction time.',
    config: { variant: 'basic' },
  },
  reaction_inhibition: {
    id: 'reaction_inhibition', type: 'reaction',
    title: 'Stop & Go', emoji: '🛑', difficulty: 'medium',
    description: 'Tap green, resist red — impulse control under pressure.',
    config: { variant: 'inhibition' },
  },
  reaction_speed: {
    id: 'reaction_speed', type: 'reaction',
    title: 'Speed Challenge', emoji: '🏎️', difficulty: 'hard',
    description: 'Four targets, one highlighted — tap fast and accurately.',
    config: { variant: 'speed' },
  },

  // ── The Archive variants (T06 Working Memory) ───────────────────────────
  archive_standard: {
    id: 'archive_standard', type: 'archive',
    title: 'The Archive', emoji: '🗂️', difficulty: 'medium',
    description: 'Ancient glyphs flash on a grid. Memorise positions and sequence, then recall.',
    config: { gridSize: 3, seqLength: 3, blackoutMs: 0, flashMs: 1200, interference: false, nBack: 0, dualChannel: false, rounds: 4 },
  },
  archive_hard: {
    id: 'archive_hard', type: 'archive',
    title: 'The Archive: N-Back', emoji: '🧠', difficulty: 'hard',
    description: 'Dual 3-Back — track both color and symbol from 3 steps ago simultaneously.',
    config: { gridSize: 4, seqLength: 5, blackoutMs: 0, flashMs: 1200, interference: false, nBack: 3, dualChannel: true, rounds: 20 },
  },

  // ── Circuit Snap variants (T12 Systems Thinking) ─────────────────────────
  circuit_standard: {
    id: 'circuit_standard', type: 'circuit',
    title: 'Circuit Snap', emoji: '⚡', difficulty: 'medium',
    description: 'Flip switches to route power through logic gates to the goal node.',
    config: { levelIndex: 2, cascadeMode: false },
  },
  circuit_hard: {
    id: 'circuit_hard', type: 'circuit',
    title: 'Circuit Snap: Cascade', emoji: '🌪️', difficulty: 'hard',
    description: 'Cascade failure mode — the circuit degrades every few seconds. Keep all goals powered.',
    config: { levelIndex: 8, cascadeMode: true, cascadeIntervalMs: 5000 },
  },

  // ── Speed Reactor variants (T21 Processing Speed) ───────────────────────
  t21_speed_standard: {
    id: 't21_speed_standard', type: 'speed_reactor',
    title: 'Speed Reactor', emoji: '⚡', difficulty: 'medium',
    description: 'Tap each fuel rod the instant it appears — pure reaction time, no sorting required.',
    config: { numBins: 2, fallDurationMs: 3000, totalRods: 12, highContrast: true, randomInterval: false, peripheralBias: false, maxSimultaneous: 1, instantRefresh: false, spawnIntervalMs: 1800, level: 1 },
  },
  t21_speed_hard: {
    id: 't21_speed_hard', type: 'speed_reactor',
    title: 'Speed Reactor: Elite', emoji: '🏎️', difficulty: 'hard',
    description: 'Instant Refresh mode — rods spawn the moment you tap. Continuous Flow. Zero hesitation.',
    config: { numBins: 4, fallDurationMs: 1400, totalRods: 24, highContrast: false, randomInterval: true, peripheralBias: true, maxSimultaneous: 2, instantRefresh: true, spawnIntervalMs: 900, level: 9 },
  },

  // ── Reactor Chaos variants (T04 Panic Management) ────────────────────────
  reactor_chaos_standard: {
    id: 'reactor_chaos_standard', type: 'reactor_chaos',
    title: 'System Failure', emoji: '🧘', difficulty: 'medium',
    description: 'Fuel rods fall normally — until System Failure events strike. Maintain accuracy when the screen shakes, flickers and fades.',
    config: { numBins: 2, fallDurationMs: 3200, totalRods: 12, highRatio: 0.4, distractorRatio: 0.1, chaosIntervalMs: 8000, chaosDurationMs: 3000, effects: ['flicker'], inputLagMs: 0, steamOpacity: 0, dimOpacity: 0, shakeIntensityX: 0, shakeIntensityY: 0, invertColors: false },
  },
  reactor_chaos_hard: {
    id: 'reactor_chaos_hard', type: 'reactor_chaos',
    title: 'System Failure: Meltdown', emoji: '🌪️', difficulty: 'hard',
    description: 'Full meltdown — 6 bins, rapid rod spawns, all chaos effects active including color inversion and input lag.',
    config: { numBins: 6, fallDurationMs: 1600, totalRods: 24, highRatio: 0.35, distractorRatio: 0.25, chaosIntervalMs: 4000, chaosDurationMs: 5000, effects: ['shake', 'steam', 'dim', 'flicker', 'input_lag', 'inversion'], inputLagMs: 200, steamOpacity: 0.4, dimOpacity: 0.35, shakeIntensityX: 8, shakeIntensityY: 6, invertColors: true },
  },

  // ── The Reactor variants (T01 Triage) ────────────────────────────────────
  the_reactor_standard: {
    id: 'the_reactor_standard', type: 'reactor',
    title: 'The Reactor', emoji: '☢️', difficulty: 'medium',
    description: 'Fuel rods fall into the core. Tap glowing rods into their bins — ignore steam distractors.',
    config: { numBins: 2, fallDurationMs: 3500, distractors: false, highRatio: 0.4, distractorRatio: 0, totalRods: 12 },
  },
  the_reactor_hard: {
    id: 'the_reactor_hard', type: 'reactor',
    title: 'The Reactor: Meltdown', emoji: '⚡', difficulty: 'hard',
    description: 'Meltdown mode — 6 bins, screen shakes, rods flicker, and priority rules flip every 15 seconds.',
    config: { numBins: 6, fallDurationMs: 1800, distractors: true, highPriorityBoost: 0.25, oscillate: true, meltdown: true, highRatio: 0.35, distractorRatio: 0.2, totalRods: 24 },
  },
};

  // ── The Briefing variants (T15 Social Inference) ─────────────────────────
  briefing_standard: {
    id: 'briefing_standard', type: 'briefing',
    title: 'The Briefing', emoji: '🎭', difficulty: 'medium',
    description: 'Read crew transcripts and identify the hidden intent behind what is said.',
    config: { level: 3, scenarioCount: 4, timePerScenarioMs: 20000, visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0 },
  },
  briefing_hard: {
    id: 'briefing_hard', type: 'briefing',
    title: 'The Briefing: Signals', emoji: '📡', difficulty: 'hard',
    description: 'Conflicting cues and professional deference — read the intent behind formal language.',
    config: { level: 7, scenarioCount: 5, timePerScenarioMs: 16000, visibleCues: ['verbal', 'tonal'], noiseLevel: 1 },
  },

  // ── Empathy Response variants (T16 Affective Empathy) ─────────────────────
  empathy_standard: {
    id: 'empathy_standard', type: 'empathy',
    title: 'Response Protocol', emoji: '🧭', difficulty: 'medium',
    description: 'A crew member is in distress. Choose a response that balances mission and emotional support.',
    config: { level: 3, scenarioCount: 4, timePerScenarioMs: 25000, dualGame: false, baselineAccuracy: 0.75 },
  },
  empathy_hard: {
    id: 'empathy_hard', type: 'empathy',
    title: 'Response Protocol: Crisis', emoji: '🚨', difficulty: 'hard',
    description: 'High-intensity scenarios — irate passengers, panicked crew, post-incident. Stay steady.',
    config: { level: 7, scenarioCount: 5, timePerScenarioMs: 20000, dualGame: false, baselineAccuracy: 0.70 },
  },

  // ── Radar Sweep variants (G09 / T06 Working Memory) ──────────────────────
  radar_sweep_standard: {
    id: 'radar_sweep_standard', type: 'radar_sweep',
    title: 'Radar Sweep', emoji: '📡', difficulty: 'medium',
    description: 'Circular radar: watch contacts blink, then tap them in reverse order.',
    config: { contactCount: 4, fieldDegrees: 180, decoys: false, mentalRotation: false, displayMs: 900, rounds: 4 },
  },
  radar_sweep_hard: {
    id: 'radar_sweep_hard', type: 'radar_sweep',
    title: 'Radar Sweep: Rotated', emoji: '🛰️', difficulty: 'hard',
    description: '8 contacts, 360° field, decoy blinks, 90° mental rotation before input.',
    config: { contactCount: 7, fieldDegrees: 360, decoys: true, mentalRotation: true, displayMs: 700, rounds: 5 },
  },

  // ── Vector Flow variants (G10 / T21 Processing Speed) ────────────────────
  vector_flow_standard: {
    id: 'vector_flow_standard', type: 'vector_flow',
    title: 'Vector Flow', emoji: '🚀', difficulty: 'medium',
    description: 'Mach-speed tunnel — classify Mechanical vs Biological objects before they pass.',
    config: { speed: 3000, classCount: 2, tunnelRotation: false, ruleFlips: false, totalObjects: 12 },
  },
  vector_flow_hard: {
    id: 'vector_flow_hard', type: 'vector_flow',
    title: 'Vector Flow: Elite', emoji: '⚡', difficulty: 'hard',
    description: 'Sub-250ms window, 4 sub-classes, rotating tunnel, L/R rule swaps every 10s.',
    config: { speed: 1200, classCount: 4, tunnelRotation: true, ruleFlips: true, totalObjects: 24 },
  },

  // ── Signal Sift variants (G07 / T19 Anomaly Detection) ───────────────────
  signal_sift_standard: {
    id: 'signal_sift_standard', type: 'signal_sift',
    title: 'Signal Sift', emoji: '📊', difficulty: 'medium',
    description: '4-track scrolling waveform monitor. Tap spikes before they scroll off screen.',
    config: { trackCount: 4, visualSnow: false, phaseShifts: false, lowContrast: false, durationMs: 60000, anomalyRate: 0.2 },
  },
  signal_sift_hard: {
    id: 'signal_sift_hard', type: 'signal_sift',
    title: 'Signal Sift: Pro', emoji: '📡', difficulty: 'hard',
    description: '8-track monitor with visual noise, phase shifts, and subtle amplitude deviations.',
    config: { trackCount: 8, visualSnow: true, phaseShifts: true, lowContrast: true, durationMs: 60000, anomalyRate: 0.3 },
  },

  // ── Hold-Short variants (G08 / T04 Panic Management) ─────────────────────
  hold_short_standard: {
    id: 'hold_short_standard', type: 'hold_short',
    title: 'Hold-Short', emoji: '✈️', difficulty: 'medium',
    description: 'Runway intersection controller. Hold or Proceed each aircraft — zero collisions.',
    config: { aircraftCount: 4, maydayInterrupts: false, lowVisFog: false, approachSpeed: 4000, totalAircraft: 10 },
  },
  hold_short_hard: {
    id: 'hold_short_hard', type: 'hold_short',
    title: 'Hold-Short: Meltdown', emoji: '🚨', difficulty: 'hard',
    description: 'Low-vis fog, Mayday interrupts, 10+ simultaneous aircraft. Zero tolerance.',
    config: { aircraftCount: 10, maydayInterrupts: true, lowVisFog: true, approachSpeed: 2000, totalAircraft: 20 },
  },

  // ── Nav-Link variants (G06 / T12 Systems Thinking) ───────────────────────
  nav_link_standard: {
    id: 'nav_link_standard', type: 'nav_link',
    title: 'Nav-Link', emoji: '🛰️', difficulty: 'medium',
    description: 'Route satellite data to ground via relay nodes. Tap to connect.',
    config: { nodeCount: 5, signalDecay: false, bandwidthCaps: false, brownOuts: false, durationMs: 60000, orbitSpeed: 0 },
  },
  nav_link_hard: {
    id: 'nav_link_hard', type: 'nav_link',
    title: 'Nav-Link: Orbital', emoji: '🌐', difficulty: 'hard',
    description: 'Orbiting nodes, signal decay, bandwidth caps, and rapid brown-outs.',
    config: { nodeCount: 10, signalDecay: true, bandwidthCaps: true, brownOuts: true, durationMs: 90000, orbitSpeed: 20000 },
  },

// Game selection is handled dynamically by the backend LLM (/select-games endpoint).
// GAME_CONFIGS is the authoritative catalog used by the frontend to render games
// and by the backend to describe available games to the LLM.
