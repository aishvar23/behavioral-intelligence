/**
 * Game Catalog
 *
 * Architecture: 36 uniquely configured game variants × 50 occupations, each with
 * a curated pool of 10-12 variants. Random selection of 3 per session creates
 * near-unlimited variety. Add more GameConfig entries to scale toward 50,000+ configs.
 */

export type GameType = 'exploration' | 'pattern' | 'puzzle' | 'memory' | 'logic' | 'reaction';

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

  // ── Logic variants (3) — new game type ───────────────────────────────────
  logic_deduction: {
    id: 'logic_deduction', type: 'logic',
    title: 'Logic Deduction', emoji: '🔎', difficulty: 'hard',
    description: 'Solve deductive reasoning puzzles — tests analytical thinking.',
    config: { variant: 'deduction' },
  },
  logic_patterns: {
    id: 'logic_patterns', type: 'logic',
    title: 'Abstract Patterns', emoji: '🔲', difficulty: 'medium',
    description: 'Identify the rule in number and abstract sequences.',
    config: { variant: 'patterns' },
  },
  logic_verbal: {
    id: 'logic_verbal', type: 'logic',
    title: 'Word Logic', emoji: '💬', difficulty: 'medium',
    description: 'Verbal analogies, odd-one-out, language-based reasoning.',
    config: { variant: 'verbal' },
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
