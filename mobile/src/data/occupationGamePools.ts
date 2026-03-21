/**
 * Occupation Game Pools
 *
 * Each occupation maps to a curated pool of 16 game config IDs from the
 * catalog. Pools vary by COGNITIVE EMPHASIS (which game types appear), not
 * domain-specific content. The LLM selects 5 from the pool per session.
 * The pool is shuffled on the backend each time, ensuring variety across sessions.
 * All game IDs used are abstract — no job knowledge required to play.
 */

export const OCCUPATION_GAME_POOLS: Record<string, string[]> = {
  // Tech / Engineering
  software_engineer:       ['black_box_hard','task_planning_hard','black_box_standard','task_planning_standard','memory_code','matrix_standard','matrix_advanced','stroop_classic','dot_estimation','visual_search_standard','spatial_rotation','reaction_inhibition','logic_deduction','logic_boolean','logic_patterns','visual_search_hard'],
  data_scientist:          ['black_box_hard','black_box_standard','task_planning_standard','task_planning_hard','memory_numbers','dot_estimation','stroop_classic','matrix_standard','matrix_advanced','visual_search_standard','logic_situational','spatial_rotation','logic_patterns','logic_quantitative','logic_deduction','reaction_inhibition'],
  ux_designer:             ['task_planning_standard','task_planning_hard','memory_positions','memory_faces','memory_colors','spatial_rotation','logic_situational','logic_verbal','reaction_basic','visual_search_standard','dot_estimation','matrix_standard','memory_sequential','visual_search_hard','logic_patterns','stroop_classic'],
  product_manager:         ['task_planning_hard','task_planning_standard','memory_sequential','memory_faces','logic_situational','matrix_standard','logic_verbal','dot_estimation','reaction_inhibition','stroop_classic','black_box_standard','visual_search_standard','logic_quantitative','logic_deduction','memory_numbers','spatial_rotation'],
  cybersecurity_analyst:   ['black_box_hard','black_box_standard','task_planning_standard','visual_search_hard','memory_code','matrix_standard','visual_search_standard','stroop_classic','reaction_speed','reaction_inhibition','dot_estimation','spatial_rotation','logic_deduction','logic_boolean','logic_patterns','task_planning_hard'],
  devops_engineer:         ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_code','stroop_classic','matrix_standard','visual_search_standard','reaction_speed','spatial_rotation','dot_estimation','reaction_inhibition','logic_boolean','logic_deduction','logic_patterns','visual_search_hard'],
  ai_ml_engineer:          ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','matrix_standard','matrix_advanced','visual_search_standard','logic_situational','spatial_rotation','logic_patterns','logic_quantitative','logic_deduction','logic_boolean'],
  game_developer:          ['black_box_standard','black_box_hard','task_planning_standard','memory_positions','spatial_rotation','visual_search_standard','reaction_speed','reaction_basic','stroop_classic','dot_estimation','logic_situational','matrix_standard','logic_patterns','reaction_inhibition','visual_search_hard','memory_sequential'],

  // Healthcare
  physician:               ['black_box_standard','task_planning_standard','task_planning_hard','memory_sequential','memory_faces','matrix_standard','visual_search_standard','dot_estimation','logic_situational','reaction_inhibition','stroop_classic','memory_numbers','logic_deduction','logic_verbal','visual_search_hard','logic_quantitative'],
  surgeon:                 ['memory_positions','memory_sequential','spatial_rotation','visual_search_hard','visual_search_standard','reaction_speed','reaction_inhibition','stroop_classic','dot_estimation','task_planning_standard','task_planning_hard','matrix_standard','reaction_basic','logic_situational','memory_colors','black_box_standard'],
  nurse:                   ['task_planning_standard','task_planning_hard','memory_sequential','memory_faces','memory_colors','visual_search_standard','logic_situational','logic_verbal','reaction_inhibition','reaction_basic','stroop_classic','dot_estimation','memory_numbers','matrix_standard','logic_quantitative','visual_search_hard'],
  psychiatrist:            ['black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition','dot_estimation','memory_colors','task_planning_standard','stroop_classic','logic_deduction','logic_patterns','memory_positions','spatial_rotation'],
  pharmacist:              ['black_box_standard','black_box_hard','task_planning_standard','memory_sequential','memory_numbers','memory_code','visual_search_standard','dot_estimation','stroop_classic','reaction_inhibition','visual_search_hard','matrix_standard','logic_deduction','logic_quantitative','logic_boolean','task_planning_hard'],
  physiotherapist:         ['task_planning_standard','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic','reaction_inhibition','dot_estimation','visual_search_standard','stroop_classic','memory_colors','matrix_standard','logic_patterns','memory_faces','reaction_speed'],
  radiologist:             ['black_box_standard','black_box_hard','task_planning_standard','memory_positions','memory_sequential','spatial_rotation','visual_search_hard','visual_search_standard','matrix_standard','stroop_classic','dot_estimation','reaction_inhibition','matrix_advanced','logic_deduction','memory_colors','reaction_speed'],

  // Finance
  financial_analyst:       ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','matrix_advanced','logic_situational','reaction_inhibition','logic_quantitative','logic_patterns','logic_deduction','memory_sequential'],
  investment_banker:       ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','dot_estimation','logic_situational','matrix_standard','visual_search_standard','reaction_speed','stroop_classic','reaction_inhibition','task_planning_hard','logic_quantitative','logic_deduction','matrix_advanced','logic_patterns'],
  accountant:              ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','memory_sequential','dot_estimation','visual_search_standard','stroop_classic','matrix_standard','reaction_inhibition','visual_search_hard','logic_situational','logic_quantitative','logic_boolean','logic_patterns','task_planning_hard'],

  // Business
  marketing_manager:       ['task_planning_hard','task_planning_standard','memory_faces','logic_verbal','logic_situational','dot_estimation','spatial_rotation','reaction_basic','visual_search_standard','memory_sequential','stroop_classic','matrix_standard','logic_patterns','logic_quantitative','memory_colors','black_box_standard'],
  sales_executive:         ['task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_speed','reaction_inhibition','dot_estimation','stroop_classic','matrix_standard','spatial_rotation','logic_patterns','memory_colors','logic_quantitative','reaction_basic'],
  entrepreneur:            ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','logic_situational','dot_estimation','matrix_standard','reaction_speed','reaction_inhibition','memory_sequential','stroop_classic','spatial_rotation','logic_deduction','logic_quantitative','matrix_advanced','visual_search_standard'],
  management_consultant:   ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','logic_situational','matrix_standard','dot_estimation','logic_verbal','stroop_classic','visual_search_standard','matrix_advanced','logic_deduction','logic_quantitative','logic_patterns','spatial_rotation'],
  supply_chain_manager:    ['task_planning_hard','task_planning_standard','black_box_standard','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard','reaction_basic','stroop_classic','spatial_rotation','reaction_inhibition','logic_quantitative','logic_patterns','black_box_hard','task_planning_hard'],
  hr_manager:              ['task_planning_hard','task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','matrix_standard','reaction_inhibition','dot_estimation','stroop_classic','black_box_standard','logic_patterns','memory_colors','logic_quantitative','spatial_rotation'],

  // Education
  teacher:                 ['task_planning_hard','task_planning_standard','memory_sequential','memory_faces','logic_verbal','logic_situational','matrix_standard','reaction_inhibition','dot_estimation','visual_search_standard','memory_colors','stroop_classic','logic_patterns','logic_deduction','memory_numbers','spatial_rotation'],
  professor:               ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','matrix_standard','matrix_advanced','dot_estimation','logic_verbal','visual_search_standard','stroop_classic','spatial_rotation','logic_deduction','logic_patterns','logic_boolean','logic_quantitative'],
  educational_technologist:['task_planning_hard','task_planning_standard','black_box_standard','memory_sequential','stroop_classic','logic_situational','logic_verbal','reaction_basic','visual_search_standard','matrix_standard','dot_estimation','memory_colors','logic_patterns','spatial_rotation','logic_boolean','memory_numbers'],
  curriculum_designer:     ['task_planning_hard','task_planning_standard','black_box_standard','memory_sequential','logic_verbal','logic_situational','visual_search_standard','spatial_rotation','matrix_standard','dot_estimation','stroop_classic','memory_faces','logic_patterns','logic_deduction','memory_numbers','matrix_advanced'],

  // Social / Legal
  psychologist:            ['black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition','dot_estimation','stroop_classic','task_planning_standard','memory_colors','logic_deduction','logic_patterns','spatial_rotation','memory_positions'],
  social_worker:           ['task_planning_hard','task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_inhibition','dot_estimation','stroop_classic','matrix_standard','black_box_standard','logic_patterns','memory_colors','spatial_rotation','logic_quantitative'],
  lawyer:                  ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','matrix_standard','logic_verbal','logic_situational','visual_search_standard','stroop_classic','dot_estimation','reaction_inhibition','logic_deduction','logic_boolean','logic_patterns','matrix_advanced'],
  judge:                   ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','memory_positions','matrix_standard','logic_verbal','logic_situational','visual_search_standard','stroop_classic','dot_estimation','logic_deduction','logic_boolean','logic_patterns','matrix_advanced'],
  policy_analyst:          ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','matrix_standard','matrix_advanced','dot_estimation','logic_situational','logic_verbal','stroop_classic','visual_search_standard','logic_deduction','logic_quantitative','logic_patterns','spatial_rotation'],

  // Engineering
  civil_engineer:          ['task_planning_hard','task_planning_standard','black_box_standard','memory_positions','memory_sequential','spatial_rotation','dot_estimation','visual_search_standard','matrix_standard','stroop_classic','black_box_hard','reaction_inhibition','logic_quantitative','logic_deduction','logic_patterns','matrix_advanced'],
  mechanical_engineer:     ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','spatial_rotation','dot_estimation','visual_search_standard','stroop_classic','matrix_standard','visual_search_hard','reaction_inhibition','logic_quantitative','logic_deduction','matrix_advanced','memory_positions'],
  electrical_engineer:     ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_code','stroop_classic','spatial_rotation','visual_search_standard','dot_estimation','matrix_standard','reaction_inhibition','visual_search_hard','logic_boolean','logic_deduction','logic_patterns','matrix_advanced'],
  aerospace_engineer:      ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','spatial_rotation','dot_estimation','stroop_classic','visual_search_hard','matrix_standard','reaction_speed','matrix_advanced','logic_quantitative','logic_deduction','logic_patterns','memory_positions'],
  biomedical_engineer:     ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','memory_positions','spatial_rotation','dot_estimation','matrix_standard','visual_search_standard','stroop_classic','logic_situational','logic_quantitative','logic_deduction','matrix_advanced','visual_search_hard'],
  environmental_engineer:  ['task_planning_hard','task_planning_standard','black_box_standard','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard','stroop_classic','spatial_rotation','black_box_hard','reaction_inhibition','logic_quantitative','logic_patterns','matrix_advanced','memory_numbers'],

  // Science
  research_scientist:      ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','matrix_standard','matrix_advanced','dot_estimation','stroop_classic','visual_search_standard','logic_situational','spatial_rotation','logic_deduction','logic_patterns','logic_quantitative','logic_boolean'],
  chemist:                 ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','memory_numbers','dot_estimation','visual_search_hard','stroop_classic','matrix_standard','spatial_rotation','reaction_inhibition','logic_quantitative','logic_deduction','logic_patterns','memory_positions'],
  neuroscientist:          ['black_box_hard','black_box_standard','task_planning_standard','memory_sequential','memory_positions','dot_estimation','matrix_standard','matrix_advanced','visual_search_standard','stroop_classic','spatial_rotation','logic_situational','logic_deduction','logic_patterns','logic_boolean','task_planning_hard'],
  environmental_scientist: ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','dot_estimation','matrix_standard','visual_search_standard','logic_situational','stroop_classic','spatial_rotation','matrix_advanced','logic_quantitative','logic_patterns','logic_deduction','memory_numbers'],
  statistician:            ['black_box_hard','black_box_standard','task_planning_hard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','matrix_advanced','logic_situational','spatial_rotation','logic_quantitative','logic_patterns','logic_deduction','logic_boolean'],

  // Creative / Media
  architect:               ['task_planning_hard','task_planning_standard','black_box_standard','black_box_hard','memory_positions','memory_sequential','spatial_rotation','logic_situational','dot_estimation','visual_search_standard','matrix_standard','stroop_classic','logic_patterns','logic_deduction','visual_search_hard','matrix_advanced'],
  graphic_designer:        ['task_planning_hard','task_planning_standard','memory_positions','memory_colors','spatial_rotation','visual_search_standard','visual_search_hard','logic_situational','reaction_basic','dot_estimation','matrix_standard','stroop_classic','logic_patterns','memory_sequential','memory_faces','logic_verbal'],
  journalist:              ['task_planning_standard','black_box_standard','memory_sequential','memory_faces','logic_verbal','visual_search_standard','logic_situational','matrix_standard','stroop_classic','dot_estimation','reaction_inhibition','spatial_rotation','logic_deduction','logic_patterns','memory_numbers','logic_quantitative'],
  filmmaker:               ['task_planning_hard','task_planning_standard','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic','visual_search_standard','dot_estimation','matrix_standard','stroop_classic','logic_patterns','memory_colors','memory_faces','visual_search_hard'],
  content_creator:         ['task_planning_hard','task_planning_standard','memory_sequential','memory_faces','logic_verbal','logic_situational','visual_search_standard','spatial_rotation','reaction_basic','dot_estimation','stroop_classic','matrix_standard','logic_patterns','memory_colors','logic_quantitative','memory_numbers'],
  pr_manager:              ['task_planning_hard','task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','dot_estimation','reaction_inhibition','stroop_classic','matrix_standard','black_box_standard','logic_patterns','memory_colors','logic_quantitative','spatial_rotation'],
};

// Used when no occupation is selected (explore freely path)
export const GENERAL_POOL: string[] = [
  'black_box_standard','black_box_hard',
  'task_planning_standard','task_planning_hard',
  'memory_colors','memory_numbers','memory_positions','memory_sequential',
  'matrix_standard','matrix_advanced','spatial_rotation','dot_estimation',
  'visual_search_standard','visual_search_hard',
  'logic_verbal','logic_situational','logic_deduction','logic_patterns','logic_boolean','logic_quantitative',
  'stroop_classic',
  'reaction_basic','reaction_inhibition','reaction_speed',
];
