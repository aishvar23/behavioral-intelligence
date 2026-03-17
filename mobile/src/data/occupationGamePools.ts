/**
 * Occupation Game Pools
 *
 * Each occupation maps to a curated pool of 10-12 game config IDs from the
 * 36-game catalog. The LLM selects 3 from the pool — ensuring every game
 * shown is actually relevant to the user's occupation and age.
 */

export const OCCUPATION_GAME_POOLS: Record<string, string[]> = {
  // ── Technology ──────────────────────────────────────────────────────────────
  software_engineer: ['exploration_systematic','exploration_data','pattern_standard','pattern_logic','pattern_adaptive','puzzle_analytical','puzzle_precise','memory_code','memory_sequential','logic_debugging','logic_systems','logic_boolean','logic_priority','reaction_basic'],
  data_scientist: ['exploration_data','exploration_systematic','pattern_standard','pattern_financial','pattern_adaptive','puzzle_analytical','memory_code','memory_positions','logic_scientific_method','logic_boolean','logic_systems','logic_patterns','reaction_basic'],
  ux_designer: ['exploration_standard','exploration_open','pattern_creative','puzzle_collaborative','memory_positions','memory_faces','logic_creative_judgment','logic_behavioral','logic_pedagogy','reaction_basic','reaction_inhibition'],
  product_manager: ['exploration_standard','exploration_systematic','pattern_standard','puzzle_collaborative','memory_sequential','logic_priority','logic_systems','logic_behavioral','logic_creative_judgment','reaction_inhibition'],
  cybersecurity_analyst: ['exploration_cautious','exploration_systematic','pattern_logic','pattern_adaptive','puzzle_pressure','puzzle_analytical','memory_code','logic_debugging','logic_systems','logic_boolean','logic_risk_assessment','reaction_speed'],
  devops_engineer: ['exploration_systematic','exploration_resource','pattern_logic','pattern_adaptive','puzzle_analytical','puzzle_precise','memory_code','logic_debugging','logic_systems','logic_priority','reaction_speed','reaction_basic'],
  ai_ml_engineer: ['exploration_data','exploration_systematic','pattern_standard','pattern_logic','pattern_adaptive','pattern_financial','puzzle_analytical','memory_code','logic_scientific_method','logic_boolean','logic_systems','logic_debugging'],
  game_developer: ['exploration_standard','exploration_cautious','pattern_standard','pattern_creative','puzzle_standard','puzzle_pressure','puzzle_precise','memory_positions','logic_debugging','logic_boolean','logic_creative_judgment','reaction_speed','reaction_basic'],

  // ── Healthcare ───────────────────────────────────────────────────────────────
  physician: ['exploration_cautious','exploration_systematic','pattern_standard','puzzle_pressure','memory_sequential','memory_faces','logic_clinical','logic_medical_ethics','logic_scientific_method','logic_risk_assessment','reaction_inhibition'],
  surgeon: ['exploration_cautious','puzzle_pressure','puzzle_precise','memory_sequential','memory_positions','logic_clinical','logic_medical_ethics','logic_risk_assessment','reaction_speed','reaction_inhibition','reaction_basic'],
  nurse: ['exploration_standard','exploration_systematic','pattern_standard','memory_sequential','memory_faces','memory_colors','logic_clinical','logic_medical_ethics','logic_behavioral','logic_pedagogy','reaction_inhibition','reaction_basic'],
  psychiatrist: ['exploration_standard','exploration_open','pattern_standard','memory_faces','memory_sequential','logic_clinical','logic_medical_ethics','logic_behavioral','logic_scientific_method','logic_creative_judgment','reaction_inhibition'],
  pharmacist: ['exploration_systematic','pattern_standard','pattern_financial','memory_sequential','memory_code','memory_numbers','logic_clinical','logic_medical_ethics','logic_risk_assessment','logic_scientific_method','reaction_inhibition'],
  physiotherapist: ['exploration_standard','exploration_open','puzzle_collaborative','memory_sequential','memory_positions','logic_clinical','logic_behavioral','logic_pedagogy','logic_medical_ethics','reaction_basic','reaction_inhibition'],
  radiologist: ['exploration_systematic','exploration_data','pattern_standard','pattern_logic','memory_positions','memory_sequential','logic_clinical','logic_scientific_method','logic_risk_assessment','reaction_basic','reaction_inhibition'],

  // ── Business & Finance ────────────────────────────────────────────────────────
  financial_analyst: ['exploration_data','exploration_systematic','pattern_standard','pattern_financial','pattern_adaptive','puzzle_analytical','memory_numbers','logic_financial_analysis','logic_risk_assessment','logic_systems','logic_scientific_method'],
  investment_banker: ['exploration_resource','exploration_data','pattern_financial','pattern_adaptive','puzzle_pressure','memory_numbers','logic_financial_analysis','logic_risk_assessment','logic_priority','logic_systems','reaction_speed'],
  marketing_manager: ['exploration_open','exploration_standard','pattern_standard','pattern_creative','puzzle_collaborative','memory_faces','logic_creative_judgment','logic_behavioral','logic_risk_assessment','logic_priority','reaction_basic'],
  sales_executive: ['exploration_open','exploration_standard','pattern_standard','memory_faces','memory_sequential','logic_behavioral','logic_creative_judgment','logic_priority','logic_risk_assessment','reaction_speed','reaction_inhibition'],
  entrepreneur: ['exploration_standard','exploration_cautious','exploration_resource','pattern_adaptive','puzzle_standard','puzzle_pressure','logic_priority','logic_risk_assessment','logic_systems','logic_financial_analysis','logic_behavioral','reaction_speed'],
  management_consultant: ['exploration_systematic','exploration_data','pattern_standard','pattern_adaptive','puzzle_analytical','memory_sequential','logic_priority','logic_systems','logic_financial_analysis','logic_risk_assessment','logic_behavioral'],
  accountant: ['exploration_systematic','exploration_data','pattern_standard','pattern_financial','memory_numbers','memory_sequential','logic_financial_analysis','logic_risk_assessment','logic_legal_reasoning','logic_scientific_method','reaction_inhibition'],
  supply_chain_manager: ['exploration_systematic','exploration_resource','pattern_standard','pattern_adaptive','puzzle_analytical','memory_sequential','logic_systems','logic_risk_assessment','logic_priority','logic_financial_analysis','reaction_basic'],

  // ── Education & Social ────────────────────────────────────────────────────────
  teacher: ['exploration_open','exploration_standard','pattern_standard','pattern_creative','puzzle_collaborative','memory_sequential','memory_faces','logic_pedagogy','logic_behavioral','logic_creative_judgment','reaction_inhibition'],
  professor: ['exploration_data','exploration_systematic','pattern_logic','pattern_adaptive','puzzle_analytical','memory_sequential','logic_scientific_method','logic_pedagogy','logic_behavioral','logic_deduction','logic_patterns'],
  psychologist: ['exploration_standard','exploration_open','pattern_standard','memory_faces','memory_sequential','logic_behavioral','logic_medical_ethics','logic_scientific_method','logic_pedagogy','logic_creative_judgment','reaction_inhibition'],
  educational_technologist: ['exploration_systematic','exploration_data','pattern_standard','pattern_adaptive','puzzle_collaborative','memory_sequential','logic_pedagogy','logic_systems','logic_creative_judgment','logic_boolean','reaction_basic'],
  curriculum_designer: ['exploration_systematic','exploration_open','pattern_creative','puzzle_collaborative','memory_sequential','logic_pedagogy','logic_creative_judgment','logic_scientific_method','logic_behavioral','logic_priority'],
  social_worker: ['exploration_standard','exploration_open','puzzle_collaborative','memory_faces','memory_sequential','logic_behavioral','logic_medical_ethics','logic_legal_reasoning','logic_pedagogy','logic_creative_judgment','reaction_inhibition'],

  // ── Legal & Policy ────────────────────────────────────────────────────────────
  lawyer: ['exploration_systematic','exploration_cautious','pattern_logic','puzzle_analytical','puzzle_pressure','memory_sequential','logic_legal_reasoning','logic_deduction','logic_risk_assessment','logic_behavioral','logic_priority'],
  judge: ['exploration_systematic','exploration_cautious','pattern_logic','puzzle_analytical','memory_sequential','memory_positions','logic_legal_reasoning','logic_deduction','logic_medical_ethics','logic_risk_assessment','logic_behavioral'],
  policy_analyst: ['exploration_systematic','exploration_data','pattern_standard','pattern_adaptive','puzzle_analytical','memory_sequential','logic_legal_reasoning','logic_risk_assessment','logic_systems','logic_scientific_method','logic_behavioral'],
  hr_manager: ['exploration_standard','exploration_open','pattern_standard','puzzle_collaborative','memory_faces','memory_sequential','logic_behavioral','logic_legal_reasoning','logic_pedagogy','logic_priority','logic_medical_ethics','reaction_inhibition'],

  // ── Engineering ───────────────────────────────────────────────────────────────
  civil_engineer: ['exploration_systematic','exploration_resource','pattern_standard','puzzle_standard','puzzle_precise','memory_positions','memory_sequential','logic_engineering_analysis','logic_risk_assessment','logic_systems','logic_scientific_method'],
  mechanical_engineer: ['exploration_systematic','exploration_cautious','pattern_standard','pattern_logic','puzzle_precise','puzzle_analytical','memory_sequential','logic_engineering_analysis','logic_risk_assessment','logic_scientific_method','logic_systems'],
  electrical_engineer: ['exploration_systematic','exploration_data','pattern_logic','pattern_adaptive','puzzle_analytical','puzzle_precise','memory_code','logic_engineering_analysis','logic_boolean','logic_systems','logic_scientific_method'],
  aerospace_engineer: ['exploration_systematic','exploration_cautious','exploration_resource','pattern_logic','puzzle_precise','puzzle_pressure','memory_sequential','logic_engineering_analysis','logic_risk_assessment','logic_scientific_method','logic_systems'],
  biomedical_engineer: ['exploration_systematic','exploration_data','pattern_standard','puzzle_analytical','memory_sequential','memory_code','logic_engineering_analysis','logic_clinical','logic_scientific_method','logic_risk_assessment','logic_systems'],
  environmental_engineer: ['exploration_systematic','exploration_open','exploration_data','pattern_standard','puzzle_analytical','memory_sequential','logic_engineering_analysis','logic_risk_assessment','logic_scientific_method','logic_systems','logic_medical_ethics'],

  // ── Science & Research ────────────────────────────────────────────────────────
  research_scientist: ['exploration_data','exploration_systematic','exploration_open','pattern_logic','pattern_adaptive','puzzle_analytical','memory_sequential','logic_scientific_method','logic_deduction','logic_risk_assessment','logic_patterns'],
  chemist: ['exploration_systematic','exploration_data','pattern_standard','pattern_logic','puzzle_analytical','memory_sequential','memory_code','logic_scientific_method','logic_engineering_analysis','logic_risk_assessment','logic_deduction'],
  neuroscientist: ['exploration_data','exploration_systematic','pattern_logic','pattern_adaptive','puzzle_analytical','memory_sequential','memory_positions','logic_scientific_method','logic_clinical','logic_behavioral','logic_deduction'],
  environmental_scientist: ['exploration_open','exploration_data','exploration_systematic','pattern_standard','pattern_adaptive','puzzle_analytical','memory_sequential','logic_scientific_method','logic_risk_assessment','logic_systems','logic_medical_ethics'],
  statistician: ['exploration_data','exploration_systematic','pattern_standard','pattern_financial','pattern_logic','puzzle_analytical','memory_numbers','logic_scientific_method','logic_risk_assessment','logic_financial_analysis','logic_boolean'],

  // ── Creative & Media ──────────────────────────────────────────────────────────
  architect: ['exploration_standard','exploration_systematic','exploration_open','pattern_creative','puzzle_standard','puzzle_precise','memory_positions','logic_creative_judgment','logic_engineering_analysis','logic_systems','logic_risk_assessment'],
  graphic_designer: ['exploration_open','exploration_standard','pattern_creative','puzzle_standard','memory_positions','memory_colors','logic_creative_judgment','logic_behavioral','logic_pedagogy','reaction_basic','reaction_inhibition'],
  journalist: ['exploration_open','exploration_standard','exploration_cautious','pattern_standard','memory_sequential','memory_faces','logic_creative_judgment','logic_legal_reasoning','logic_behavioral','logic_medical_ethics','logic_risk_assessment'],
  filmmaker: ['exploration_open','exploration_standard','pattern_creative','puzzle_collaborative','memory_sequential','memory_positions','logic_creative_judgment','logic_behavioral','logic_risk_assessment','logic_priority','reaction_basic'],
  content_creator: ['exploration_open','exploration_standard','pattern_creative','pattern_adaptive','memory_sequential','memory_faces','logic_creative_judgment','logic_behavioral','logic_risk_assessment','logic_priority','reaction_basic'],
  pr_manager: ['exploration_open','exploration_standard','pattern_standard','pattern_adaptive','memory_faces','memory_sequential','logic_creative_judgment','logic_behavioral','logic_risk_assessment','logic_priority','logic_medical_ethics','reaction_inhibition'],
};

// Used when no occupation is selected (explore freely path)
export const GENERAL_POOL: string[] = [
  'exploration_standard','exploration_open','exploration_data',
  'pattern_standard','pattern_adaptive','pattern_creative',
  'puzzle_standard','puzzle_collaborative',
  'memory_colors','memory_numbers','memory_positions',
  'logic_deduction','logic_patterns','logic_verbal','logic_behavioral','logic_risk_assessment',
  'reaction_basic','reaction_inhibition',
];
