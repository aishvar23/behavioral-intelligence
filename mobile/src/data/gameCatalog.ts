/**
 * Game Catalog
 *
 * Architecture: 36 uniquely configured game variants × 50 occupations, each with
 * a curated pool of 10-12 variants. Random selection of 3 per session creates
 * near-unlimited variety. Add more GameConfig entries to scale toward 50,000+ configs.
 */

export type GameType = 'exploration' | 'pattern' | 'puzzle' | 'memory' | 'logic' | 'reaction' | 'stroop' | 'matrix' | 'spatial' | 'estimation' | 'search';

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
  // ── Exploration variants (3) ──────────────────────────────────────────────
  exploration_standard: {
    id: 'exploration_standard', type: 'exploration',
    title: 'Exploration Island', emoji: '🏝️', difficulty: 'medium',
    description: 'Navigate a fog-covered 8×8 grid. Collect rewards, dodge traps.',
    config: {},
  },
  exploration_cautious: {
    id: 'exploration_cautious', type: 'exploration',
    title: 'Risk Zone', emoji: '⚠️', difficulty: 'hard',
    description: 'Dense trap field — every step is a calculated risk.',
    config: { trapDensity: 'high' },
  },
  exploration_open: {
    id: 'exploration_open', type: 'exploration',
    title: 'Discovery Expedition', emoji: '🗺️', difficulty: 'easy',
    description: 'Wide terrain rich with rewards for the truly curious.',
    config: { rewardDensity: 'high' },
  },
  exploration_data: {
    id: 'exploration_data', type: 'exploration',
    title: 'Data Landscape', emoji: '🗃️', difficulty: 'medium',
    description: 'Uncover patterns in a data-rich terrain — clusters reveal insights.',
    config: { rewardPattern: 'clustered' },
  },
  exploration_resource: {
    id: 'exploration_resource', type: 'exploration',
    title: 'Resource Optimizer', emoji: '💎', difficulty: 'hard',
    description: 'Maximise resources collected with a tight move budget.',
    config: { movePenalty: true },
  },
  exploration_systematic: {
    id: 'exploration_systematic', type: 'exploration',
    title: 'Systematic Survey', emoji: '📡', difficulty: 'easy',
    description: 'Cover every zone methodically — bonus points for full grid coverage.',
    config: { coverageBonus: true },
  },

  // ── Pattern variants (3) ──────────────────────────────────────────────────
  pattern_standard: {
    id: 'pattern_standard', type: 'pattern',
    title: 'Pattern Detective', emoji: '🔍', difficulty: 'medium',
    description: 'Decode number sequences across 9 rounds of increasing difficulty.',
    config: {},
  },
  pattern_advanced: {
    id: 'pattern_advanced', type: 'pattern',
    title: 'Advanced Patterns', emoji: '🔮', difficulty: 'hard',
    description: 'Challenging sequences starting at medium difficulty.',
    config: { startTier: 1 },
  },
  pattern_logic: {
    id: 'pattern_logic', type: 'pattern',
    title: 'Logic Sequences', emoji: '🧮', difficulty: 'hard',
    description: 'Complex chains demanding deep analytical thinking.',
    config: { startTier: 2 },
  },
  pattern_financial: {
    id: 'pattern_financial', type: 'pattern',
    title: 'Market Signals', emoji: '📉', difficulty: 'hard',
    description: 'Detect trends in numerical sequences that mimic financial data.',
    config: { variant: 'financial' },
  },
  pattern_adaptive: {
    id: 'pattern_adaptive', type: 'pattern',
    title: 'Adaptive Decode', emoji: '🔄', difficulty: 'hard',
    description: 'Rules shift faster than usual — test how quickly you re-calibrate.',
    config: { ruleChanges: 'frequent', startTier: 1 },
  },
  pattern_creative: {
    id: 'pattern_creative', type: 'pattern',
    title: 'Open Sequences', emoji: '🎨', difficulty: 'easy',
    description: 'Flexible, open-ended patterns that reward lateral thinking.',
    config: { variant: 'creative' },
  },

  // ── Puzzle variants (3) ───────────────────────────────────────────────────
  puzzle_standard: {
    id: 'puzzle_standard', type: 'puzzle',
    title: 'Impossible Puzzle', emoji: '🧩', difficulty: 'medium',
    description: 'Slide tiles into order — deceptively hard.',
    config: {},
  },
  puzzle_pressure: {
    id: 'puzzle_pressure', type: 'puzzle',
    title: 'Pressure Puzzle', emoji: '🔥', difficulty: 'hard',
    description: 'One hint. No safety net. Solve it cold.',
    config: { maxHints: 1 },
  },
  puzzle_strategic: {
    id: 'puzzle_strategic', type: 'puzzle',
    title: 'Strategic Puzzle', emoji: '♟️', difficulty: 'medium',
    description: 'Efficiency scores — solve in fewest moves for max reward.',
    config: { scoreEfficiencyBonus: true },
  },
  puzzle_collaborative: {
    id: 'puzzle_collaborative', type: 'puzzle',
    title: 'Team Solve', emoji: '🤝', difficulty: 'easy',
    description: 'Hints are freely available — collaboration over brute-force.',
    config: { maxHints: 5, hintPenalty: 5 },
  },
  puzzle_precise: {
    id: 'puzzle_precise', type: 'puzzle',
    title: 'Precision Assembly', emoji: '🔩', difficulty: 'hard',
    description: 'Requires exact, efficient moves — no room for trial and error.',
    config: { shuffleDepth: 'low', efficiencyRequired: true },
  },
  puzzle_analytical: {
    id: 'puzzle_analytical', type: 'puzzle',
    title: 'Analytical Deconstruct', emoji: '🧐', difficulty: 'medium',
    description: 'Move history visible throughout — reward deliberate, methodical solvers.',
    config: { showMoveHistory: true },
  },

  // ── Memory variants (3) — new game type ───────────────────────────────────
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

  // ── Logic variants (2) — text-based reasoning (MCQ) ─────────────────────
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
};

// Game selection is handled dynamically by the backend LLM (/select-games endpoint).
// GAME_CONFIGS is the authoritative catalog used by the frontend to render games
// and by the backend to describe available games to the LLM.
