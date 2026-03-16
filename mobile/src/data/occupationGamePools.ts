/**
 * Occupation Game Pools
 *
 * Each occupation maps to a curated pool of 10-12 game config IDs from the
 * 36-game catalog. The LLM selects 3 from the pool — ensuring every game
 * shown is actually relevant to the user's occupation and age.
 */

export const OCCUPATION_GAME_POOLS: Record<string, string[]> = {
  // ── Technology ──────────────────────────────────────────────────────────────
  software_engineer: [
    'exploration_systematic', 'pattern_standard', 'pattern_logic', 'pattern_advanced',
    'puzzle_standard', 'puzzle_strategic', 'puzzle_analytical', 'memory_code',
    'logic_deduction', 'logic_systems', 'reaction_basic', 'reaction_inhibition',
  ],
  data_scientist: [
    'exploration_data', 'exploration_systematic', 'pattern_standard', 'pattern_financial',
    'pattern_logic', 'puzzle_analytical', 'memory_numbers', 'memory_code',
    'logic_deduction', 'logic_diagnostic', 'logic_patterns', 'logic_systems',
  ],
  ux_designer: [
    'exploration_open', 'exploration_standard', 'pattern_creative', 'puzzle_standard',
    'puzzle_collaborative', 'memory_colors', 'memory_positions', 'memory_faces',
    'logic_patterns', 'logic_verbal', 'reaction_inhibition', 'reaction_speed',
  ],
  product_manager: [
    'exploration_standard', 'exploration_resource', 'pattern_standard', 'pattern_adaptive',
    'puzzle_standard', 'puzzle_analytical', 'memory_sequential', 'memory_faces',
    'logic_deduction', 'logic_systems', 'logic_verbal', 'reaction_inhibition',
  ],
  cybersecurity_analyst: [
    'exploration_cautious', 'exploration_systematic', 'pattern_standard', 'pattern_adaptive',
    'pattern_logic', 'puzzle_pressure', 'puzzle_standard', 'logic_deduction',
    'logic_diagnostic', 'logic_systems', 'reaction_basic', 'reaction_inhibition',
  ],
  devops_engineer: [
    'exploration_systematic', 'exploration_resource', 'pattern_standard', 'pattern_logic',
    'puzzle_strategic', 'puzzle_analytical', 'memory_sequential', 'memory_code',
    'logic_deduction', 'logic_systems', 'reaction_basic', 'reaction_speed',
  ],
  ai_ml_engineer: [
    'exploration_data', 'exploration_systematic', 'pattern_standard', 'pattern_advanced',
    'pattern_logic', 'pattern_financial', 'puzzle_strategic', 'puzzle_analytical',
    'logic_deduction', 'logic_patterns', 'logic_systems', 'memory_numbers',
  ],
  game_developer: [
    'exploration_open', 'exploration_standard', 'pattern_standard', 'pattern_creative',
    'puzzle_standard', 'puzzle_strategic', 'memory_colors', 'memory_positions',
    'reaction_basic', 'reaction_speed', 'reaction_multitask', 'logic_patterns',
  ],

  // ── Healthcare ───────────────────────────────────────────────────────────────
  physician: [
    'pattern_standard', 'pattern_adaptive', 'puzzle_standard', 'puzzle_analytical',
    'memory_sequential', 'memory_numbers', 'logic_deduction', 'logic_diagnostic',
    'logic_ethical', 'reaction_inhibition', 'reaction_basic', 'logic_patterns',
  ],
  surgeon: [
    'exploration_cautious', 'puzzle_pressure', 'puzzle_precise', 'puzzle_strategic',
    'memory_sequential', 'memory_positions', 'logic_deduction', 'logic_diagnostic',
    'reaction_basic', 'reaction_surgical', 'reaction_inhibition', 'memory_numbers',
  ],
  nurse: [
    'puzzle_collaborative', 'puzzle_standard', 'memory_sequential', 'memory_numbers',
    'memory_faces', 'logic_deduction', 'logic_diagnostic', 'logic_ethical',
    'reaction_basic', 'reaction_inhibition', 'exploration_systematic', 'pattern_standard',
  ],
  psychiatrist: [
    'pattern_standard', 'pattern_adaptive', 'pattern_creative', 'puzzle_analytical',
    'memory_faces', 'memory_sequential', 'logic_deduction', 'logic_diagnostic',
    'logic_ethical', 'logic_verbal', 'reaction_inhibition', 'exploration_open',
  ],
  pharmacist: [
    'pattern_standard', 'pattern_financial', 'pattern_logic', 'memory_numbers',
    'memory_sequential', 'logic_deduction', 'logic_diagnostic', 'logic_financial',
    'reaction_basic', 'puzzle_precise', 'exploration_systematic',
  ],
  physiotherapist: [
    'exploration_open', 'puzzle_collaborative', 'puzzle_standard', 'memory_sequential',
    'memory_positions', 'logic_deduction', 'logic_ethical', 'reaction_basic',
    'reaction_inhibition', 'logic_diagnostic', 'pattern_standard',
  ],
  radiologist: [
    'exploration_systematic', 'exploration_data', 'memory_positions', 'memory_colors',
    'logic_deduction', 'logic_diagnostic', 'puzzle_precise', 'puzzle_analytical',
    'reaction_basic', 'pattern_standard', 'memory_sequential',
  ],

  // ── Business & Finance ────────────────────────────────────────────────────────
  financial_analyst: [
    'pattern_financial', 'pattern_standard', 'pattern_logic', 'puzzle_analytical',
    'memory_numbers', 'logic_deduction', 'logic_financial', 'logic_patterns',
    'logic_diagnostic', 'reaction_basic', 'exploration_data',
  ],
  investment_banker: [
    'pattern_financial', 'pattern_adaptive', 'pattern_logic', 'puzzle_pressure',
    'puzzle_strategic', 'logic_financial', 'logic_deduction', 'logic_systems',
    'reaction_basic', 'reaction_inhibition', 'exploration_resource',
  ],
  marketing_manager: [
    'exploration_open', 'exploration_resource', 'pattern_creative', 'pattern_adaptive',
    'puzzle_collaborative', 'memory_faces', 'memory_colors', 'logic_verbal',
    'logic_ethical', 'logic_systems', 'reaction_inhibition', 'reaction_speed',
  ],
  sales_executive: [
    'exploration_open', 'exploration_resource', 'pattern_adaptive', 'puzzle_collaborative',
    'memory_faces', 'logic_verbal', 'logic_ethical', 'reaction_inhibition',
    'reaction_speed', 'logic_deduction', 'memory_sequential',
  ],
  entrepreneur: [
    'exploration_open', 'exploration_resource', 'pattern_standard', 'pattern_adaptive',
    'puzzle_standard', 'puzzle_pressure', 'logic_systems', 'logic_financial',
    'logic_ethical', 'reaction_inhibition', 'reaction_speed', 'memory_faces',
  ],
  management_consultant: [
    'exploration_standard', 'exploration_resource', 'pattern_adaptive', 'pattern_logic',
    'puzzle_analytical', 'logic_deduction', 'logic_systems', 'logic_verbal',
    'logic_ethical', 'reaction_inhibition', 'memory_sequential', 'logic_diagnostic',
  ],
  accountant: [
    'pattern_standard', 'pattern_financial', 'pattern_logic', 'memory_numbers',
    'memory_sequential', 'logic_deduction', 'logic_financial', 'puzzle_analytical',
    'puzzle_precise', 'reaction_basic', 'exploration_systematic',
  ],
  supply_chain_manager: [
    'exploration_systematic', 'exploration_resource', 'pattern_standard', 'pattern_logic',
    'puzzle_strategic', 'puzzle_analytical', 'logic_systems', 'logic_deduction',
    'memory_sequential', 'reaction_inhibition', 'logic_financial',
  ],

  // ── Education & Social ────────────────────────────────────────────────────────
  teacher: [
    'exploration_open', 'pattern_creative', 'pattern_standard', 'puzzle_collaborative',
    'memory_faces', 'memory_sequential', 'logic_verbal', 'logic_ethical',
    'reaction_inhibition', 'logic_deduction', 'exploration_standard',
  ],
  professor: [
    'exploration_systematic', 'exploration_data', 'pattern_logic', 'pattern_advanced',
    'puzzle_analytical', 'logic_deduction', 'logic_diagnostic', 'logic_patterns',
    'memory_numbers', 'reaction_basic', 'logic_systems',
  ],
  psychologist: [
    'pattern_standard', 'pattern_adaptive', 'pattern_creative', 'puzzle_analytical',
    'memory_faces', 'memory_sequential', 'logic_deduction', 'logic_diagnostic',
    'logic_ethical', 'logic_verbal', 'reaction_inhibition', 'exploration_open',
  ],
  educational_technologist: [
    'exploration_standard', 'exploration_data', 'pattern_standard', 'pattern_creative',
    'puzzle_standard', 'puzzle_collaborative', 'logic_systems', 'logic_verbal',
    'memory_colors', 'reaction_basic', 'logic_patterns',
  ],
  curriculum_designer: [
    'exploration_systematic', 'pattern_creative', 'pattern_standard', 'puzzle_analytical',
    'logic_verbal', 'logic_systems', 'logic_deduction', 'memory_sequential',
    'reaction_basic', 'logic_patterns', 'exploration_standard',
  ],
  social_worker: [
    'exploration_open', 'puzzle_collaborative', 'memory_faces', 'memory_sequential',
    'logic_verbal', 'logic_ethical', 'reaction_inhibition', 'logic_deduction',
    'logic_diagnostic', 'exploration_standard', 'pattern_standard',
  ],

  // ── Legal & Policy ────────────────────────────────────────────────────────────
  lawyer: [
    'pattern_adaptive', 'pattern_logic', 'pattern_standard', 'puzzle_analytical',
    'logic_deduction', 'logic_verbal', 'logic_ethical', 'logic_diagnostic',
    'logic_systems', 'memory_sequential', 'reaction_inhibition', 'exploration_systematic',
  ],
  judge: [
    'pattern_standard', 'pattern_adaptive', 'logic_deduction', 'logic_verbal',
    'logic_ethical', 'logic_diagnostic', 'puzzle_analytical', 'memory_sequential',
    'reaction_inhibition', 'logic_patterns', 'logic_systems',
  ],
  policy_analyst: [
    'exploration_systematic', 'exploration_data', 'pattern_adaptive', 'pattern_logic',
    'logic_deduction', 'logic_systems', 'logic_ethical', 'logic_verbal',
    'puzzle_analytical', 'memory_numbers', 'reaction_basic', 'logic_diagnostic',
  ],
  hr_manager: [
    'exploration_standard', 'exploration_open', 'pattern_adaptive', 'puzzle_collaborative',
    'memory_faces', 'memory_sequential', 'logic_verbal', 'logic_ethical',
    'logic_deduction', 'reaction_inhibition', 'logic_systems',
  ],

  // ── Engineering ───────────────────────────────────────────────────────────────
  civil_engineer: [
    'exploration_systematic', 'exploration_resource', 'puzzle_standard', 'puzzle_strategic',
    'puzzle_precise', 'logic_systems', 'logic_deduction', 'memory_sequential',
    'reaction_basic', 'pattern_standard', 'pattern_logic',
  ],
  mechanical_engineer: [
    'exploration_systematic', 'puzzle_strategic', 'puzzle_precise', 'puzzle_pressure',
    'logic_systems', 'logic_deduction', 'memory_sequential', 'pattern_standard',
    'pattern_logic', 'reaction_basic', 'puzzle_analytical',
  ],
  electrical_engineer: [
    'pattern_standard', 'pattern_logic', 'pattern_advanced', 'puzzle_precise',
    'puzzle_strategic', 'logic_systems', 'logic_deduction', 'memory_sequential',
    'memory_numbers', 'reaction_basic', 'exploration_systematic',
  ],
  aerospace_engineer: [
    'exploration_cautious', 'exploration_systematic', 'pattern_logic', 'pattern_advanced',
    'puzzle_pressure', 'puzzle_precise', 'logic_systems', 'logic_deduction',
    'memory_sequential', 'reaction_surgical', 'reaction_multitask',
  ],
  biomedical_engineer: [
    'exploration_data', 'exploration_systematic', 'pattern_standard', 'puzzle_precise',
    'logic_deduction', 'logic_diagnostic', 'logic_systems', 'memory_sequential',
    'memory_numbers', 'reaction_basic', 'logic_patterns',
  ],
  environmental_engineer: [
    'exploration_open', 'exploration_systematic', 'exploration_resource', 'pattern_standard',
    'puzzle_analytical', 'logic_systems', 'logic_ethical', 'logic_deduction',
    'memory_numbers', 'reaction_basic',
  ],

  // ── Science & Research ────────────────────────────────────────────────────────
  research_scientist: [
    'exploration_systematic', 'exploration_data', 'pattern_logic', 'pattern_advanced',
    'puzzle_analytical', 'logic_deduction', 'logic_diagnostic', 'logic_patterns',
    'memory_numbers', 'reaction_basic', 'logic_systems',
  ],
  chemist: [
    'exploration_systematic', 'exploration_data', 'pattern_standard', 'pattern_logic',
    'puzzle_precise', 'logic_deduction', 'logic_diagnostic', 'memory_numbers',
    'memory_sequential', 'reaction_basic', 'logic_patterns',
  ],
  neuroscientist: [
    'exploration_data', 'exploration_systematic', 'pattern_standard', 'pattern_logic',
    'puzzle_analytical', 'logic_deduction', 'logic_diagnostic', 'logic_patterns',
    'memory_numbers', 'memory_sequential', 'reaction_inhibition',
  ],
  environmental_scientist: [
    'exploration_open', 'exploration_systematic', 'exploration_data', 'pattern_standard',
    'logic_deduction', 'logic_diagnostic', 'logic_systems', 'logic_ethical',
    'memory_numbers', 'puzzle_analytical', 'logic_patterns',
  ],
  statistician: [
    'pattern_financial', 'pattern_logic', 'pattern_standard', 'pattern_advanced',
    'logic_deduction', 'logic_patterns', 'logic_financial', 'logic_diagnostic',
    'memory_numbers', 'puzzle_analytical', 'exploration_data',
  ],

  // ── Creative & Media ──────────────────────────────────────────────────────────
  architect: [
    'exploration_open', 'exploration_systematic', 'puzzle_strategic', 'puzzle_standard',
    'memory_positions', 'memory_colors', 'logic_systems', 'logic_deduction',
    'reaction_basic', 'pattern_standard', 'pattern_creative',
  ],
  graphic_designer: [
    'exploration_open', 'exploration_standard', 'pattern_creative', 'pattern_standard',
    'memory_colors', 'memory_positions', 'puzzle_standard', 'logic_patterns',
    'logic_verbal', 'reaction_speed', 'reaction_inhibition',
  ],
  journalist: [
    'exploration_open', 'exploration_standard', 'pattern_adaptive', 'pattern_creative',
    'logic_verbal', 'logic_diagnostic', 'logic_ethical', 'memory_faces',
    'logic_deduction', 'reaction_speed', 'puzzle_analytical',
  ],
  filmmaker: [
    'exploration_open', 'exploration_standard', 'pattern_creative', 'pattern_adaptive',
    'memory_positions', 'memory_colors', 'memory_sequential', 'logic_verbal',
    'logic_systems', 'reaction_speed', 'puzzle_standard',
  ],
  content_creator: [
    'exploration_open', 'exploration_standard', 'pattern_creative', 'pattern_adaptive',
    'memory_colors', 'memory_faces', 'logic_verbal', 'reaction_speed',
    'reaction_inhibition', 'puzzle_collaborative',
  ],
  pr_manager: [
    'exploration_open', 'exploration_resource', 'pattern_adaptive', 'pattern_creative',
    'puzzle_collaborative', 'memory_faces', 'memory_sequential', 'logic_verbal',
    'logic_ethical', 'reaction_inhibition', 'reaction_speed',
  ],
};

// Used when no occupation is selected (explore freely path)
export const GENERAL_POOL: string[] = [
  'exploration_standard', 'pattern_standard', 'puzzle_standard',
  'memory_colors', 'logic_deduction', 'reaction_inhibition',
  'exploration_data', 'pattern_adaptive', 'puzzle_analytical',
  'memory_sequential', 'logic_systems', 'reaction_basic',
];
