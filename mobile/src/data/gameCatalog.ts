/**
 * Game Catalog
 *
 * Architecture: 18 uniquely configured game variants × 50 occupations, each with
 * a curated pool of 6-8 variants. Random selection of 3 per session creates
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

// ── Occupation → game pool mapping (50 occupations) ──────────────────────────
const OCCUPATION_GAME_POOLS: Record<string, string[]> = {
  // Technology
  software_engineer:        ['logic_deduction', 'logic_patterns', 'puzzle_standard', 'puzzle_pressure', 'pattern_advanced', 'memory_numbers', 'reaction_inhibition'],
  data_scientist:           ['pattern_standard', 'pattern_advanced', 'logic_deduction', 'logic_patterns', 'memory_numbers', 'puzzle_strategic', 'exploration_standard'],
  ux_designer:              ['exploration_standard', 'exploration_open', 'memory_colors', 'memory_positions', 'reaction_basic', 'logic_verbal', 'puzzle_standard'],
  product_manager:          ['logic_deduction', 'logic_verbal', 'exploration_standard', 'pattern_standard', 'memory_numbers', 'puzzle_strategic', 'reaction_inhibition'],
  cybersecurity_analyst:    ['reaction_inhibition', 'reaction_speed', 'logic_deduction', 'logic_patterns', 'puzzle_pressure', 'pattern_advanced', 'memory_numbers'],
  devops_engineer:          ['reaction_speed', 'reaction_inhibition', 'logic_patterns', 'puzzle_standard', 'puzzle_strategic', 'memory_numbers', 'pattern_standard'],
  ai_ml_engineer:           ['pattern_advanced', 'pattern_logic', 'logic_deduction', 'logic_patterns', 'memory_numbers', 'puzzle_pressure', 'reaction_inhibition'],
  game_developer:           ['exploration_standard', 'exploration_open', 'logic_patterns', 'puzzle_standard', 'memory_colors', 'reaction_basic', 'reaction_speed'],
  // Healthcare
  physician:                ['memory_colors', 'memory_numbers', 'logic_deduction', 'reaction_inhibition', 'reaction_speed', 'puzzle_pressure', 'pattern_standard'],
  surgeon:                  ['reaction_inhibition', 'reaction_speed', 'reaction_basic', 'memory_numbers', 'memory_positions', 'puzzle_pressure', 'logic_deduction'],
  nurse:                    ['memory_colors', 'memory_numbers', 'reaction_inhibition', 'logic_deduction', 'logic_verbal', 'pattern_standard', 'exploration_cautious'],
  psychiatrist:             ['logic_verbal', 'logic_deduction', 'memory_colors', 'memory_positions', 'pattern_standard', 'exploration_standard', 'puzzle_standard'],
  pharmacist:               ['memory_numbers', 'memory_colors', 'logic_deduction', 'pattern_standard', 'pattern_advanced', 'reaction_inhibition', 'puzzle_standard'],
  physiotherapist:          ['reaction_basic', 'reaction_speed', 'memory_positions', 'exploration_open', 'logic_verbal', 'puzzle_standard', 'pattern_standard'],
  radiologist:              ['memory_positions', 'memory_colors', 'logic_patterns', 'logic_deduction', 'reaction_inhibition', 'puzzle_strategic', 'pattern_advanced'],
  // Business & Finance
  financial_analyst:        ['pattern_advanced', 'pattern_standard', 'logic_deduction', 'logic_patterns', 'memory_numbers', 'puzzle_strategic', 'puzzle_standard'],
  investment_banker:        ['reaction_inhibition', 'reaction_speed', 'logic_deduction', 'pattern_advanced', 'memory_numbers', 'puzzle_pressure', 'exploration_cautious'],
  marketing_manager:        ['exploration_standard', 'exploration_open', 'logic_verbal', 'memory_colors', 'pattern_standard', 'reaction_basic', 'puzzle_standard'],
  sales_executive:          ['exploration_standard', 'logic_verbal', 'reaction_basic', 'reaction_speed', 'memory_colors', 'pattern_standard', 'puzzle_standard'],
  entrepreneur:             ['exploration_standard', 'exploration_open', 'exploration_cautious', 'logic_deduction', 'logic_verbal', 'puzzle_standard', 'reaction_inhibition'],
  management_consultant:    ['logic_deduction', 'logic_verbal', 'logic_patterns', 'puzzle_strategic', 'pattern_advanced', 'memory_numbers', 'exploration_standard'],
  accountant:               ['memory_numbers', 'logic_deduction', 'logic_patterns', 'pattern_advanced', 'pattern_standard', 'puzzle_strategic', 'reaction_inhibition'],
  supply_chain_manager:     ['logic_deduction', 'logic_patterns', 'exploration_standard', 'memory_numbers', 'puzzle_strategic', 'pattern_standard', 'reaction_inhibition'],
  // Education & Social
  teacher:                  ['logic_verbal', 'logic_deduction', 'memory_colors', 'memory_numbers', 'pattern_standard', 'exploration_open', 'puzzle_standard'],
  professor:                ['logic_deduction', 'logic_patterns', 'logic_verbal', 'pattern_advanced', 'memory_numbers', 'puzzle_strategic', 'exploration_standard'],
  psychologist:             ['logic_verbal', 'logic_deduction', 'memory_colors', 'memory_positions', 'exploration_standard', 'pattern_standard', 'puzzle_standard'],
  educational_technologist: ['logic_verbal', 'logic_patterns', 'memory_positions', 'memory_colors', 'exploration_open', 'puzzle_standard', 'pattern_standard'],
  curriculum_designer:      ['logic_verbal', 'logic_deduction', 'memory_colors', 'pattern_standard', 'exploration_open', 'puzzle_standard', 'reaction_basic'],
  social_worker:            ['logic_verbal', 'memory_colors', 'memory_numbers', 'exploration_standard', 'exploration_open', 'pattern_standard', 'puzzle_standard'],
  // Legal & Policy
  lawyer:                   ['logic_deduction', 'logic_verbal', 'logic_patterns', 'pattern_advanced', 'memory_numbers', 'puzzle_standard', 'puzzle_pressure'],
  judge:                    ['logic_deduction', 'logic_verbal', 'pattern_advanced', 'memory_numbers', 'memory_positions', 'puzzle_pressure', 'reaction_inhibition'],
  policy_analyst:           ['logic_deduction', 'logic_verbal', 'logic_patterns', 'exploration_standard', 'pattern_advanced', 'memory_numbers', 'puzzle_strategic'],
  hr_manager:               ['logic_verbal', 'logic_deduction', 'memory_colors', 'memory_numbers', 'exploration_standard', 'pattern_standard', 'reaction_inhibition'],
  // Engineering
  civil_engineer:           ['logic_deduction', 'logic_patterns', 'puzzle_standard', 'puzzle_strategic', 'memory_numbers', 'memory_positions', 'exploration_cautious'],
  mechanical_engineer:      ['puzzle_standard', 'puzzle_strategic', 'puzzle_pressure', 'logic_patterns', 'logic_deduction', 'memory_numbers', 'reaction_speed'],
  electrical_engineer:      ['logic_deduction', 'logic_patterns', 'puzzle_standard', 'puzzle_pressure', 'memory_numbers', 'reaction_inhibition', 'reaction_speed'],
  aerospace_engineer:       ['logic_deduction', 'logic_patterns', 'puzzle_pressure', 'puzzle_strategic', 'memory_numbers', 'memory_positions', 'reaction_inhibition'],
  biomedical_engineer:      ['memory_numbers', 'memory_positions', 'logic_deduction', 'logic_patterns', 'puzzle_strategic', 'reaction_inhibition', 'pattern_advanced'],
  environmental_engineer:   ['exploration_standard', 'exploration_open', 'exploration_cautious', 'logic_deduction', 'logic_patterns', 'memory_numbers', 'puzzle_strategic'],
  // Science & Research
  research_scientist:       ['logic_deduction', 'logic_patterns', 'pattern_advanced', 'pattern_standard', 'exploration_standard', 'memory_numbers', 'puzzle_strategic'],
  chemist:                  ['memory_numbers', 'memory_positions', 'logic_deduction', 'logic_patterns', 'puzzle_standard', 'puzzle_strategic', 'pattern_advanced'],
  neuroscientist:           ['memory_colors', 'memory_numbers', 'memory_positions', 'logic_deduction', 'logic_patterns', 'reaction_inhibition', 'pattern_advanced'],
  environmental_scientist:  ['exploration_standard', 'exploration_open', 'logic_patterns', 'logic_deduction', 'memory_numbers', 'pattern_standard', 'puzzle_standard'],
  statistician:             ['pattern_advanced', 'pattern_standard', 'pattern_logic', 'logic_deduction', 'logic_patterns', 'memory_numbers', 'puzzle_strategic'],
  // Creative & Media
  architect:                ['exploration_standard', 'exploration_open', 'memory_positions', 'memory_colors', 'logic_patterns', 'puzzle_standard', 'puzzle_strategic'],
  graphic_designer:         ['memory_colors', 'memory_positions', 'exploration_open', 'reaction_basic', 'logic_verbal', 'logic_patterns', 'puzzle_standard'],
  journalist:               ['logic_verbal', 'logic_deduction', 'exploration_standard', 'exploration_open', 'memory_numbers', 'memory_colors', 'pattern_standard'],
  filmmaker:                ['exploration_open', 'exploration_standard', 'memory_positions', 'memory_colors', 'logic_verbal', 'reaction_basic', 'puzzle_standard'],
  content_creator:          ['exploration_open', 'logic_verbal', 'memory_colors', 'reaction_basic', 'reaction_speed', 'pattern_standard', 'puzzle_standard'],
  pr_manager:               ['logic_verbal', 'memory_colors', 'memory_numbers', 'exploration_standard', 'reaction_basic', 'pattern_standard', 'puzzle_standard'],
};

const DEFAULT_POOL = ['pattern_standard', 'puzzle_standard', 'logic_deduction', 'memory_colors', 'reaction_basic', 'exploration_standard'];

/**
 * Randomly selects `count` games from an occupation's pool, favouring type diversity.
 */
export function selectGamesForOccupation(occupationId: string, count = 3): GameConfig[] {
  const pool = OCCUPATION_GAME_POOLS[occupationId] ?? DEFAULT_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  const selected: GameConfig[] = [];
  const usedTypes = new Set<GameType>();

  // First pass: unique types
  for (const id of shuffled) {
    if (selected.length >= count) break;
    const cfg = GAME_CONFIGS[id];
    if (cfg && !usedTypes.has(cfg.type)) {
      selected.push(cfg);
      usedTypes.add(cfg.type);
    }
  }

  // Second pass: fill remaining if pool has fewer unique types than count
  for (const id of shuffled) {
    if (selected.length >= count) break;
    const cfg = GAME_CONFIGS[id];
    if (cfg && !selected.includes(cfg)) {
      selected.push(cfg);
    }
  }

  return selected;
}
