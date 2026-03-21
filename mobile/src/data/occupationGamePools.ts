/**
 * Occupation Game Pools
 *
 * Each occupation maps to a curated pool of 10-14 game config IDs from the
 * catalog. Pools vary by COGNITIVE EMPHASIS (which game types appear), not
 * domain-specific content. The LLM selects 3 from the pool per session.
 * All game IDs used are abstract — no job knowledge required to play.
 */

export const OCCUPATION_GAME_POOLS: Record<string, string[]> = {
  // Tech / Engineering
  software_engineer:       ['black_box_hard','task_planning_hard','black_box_standard','memory_code','matrix_standard','stroop_classic','dot_estimation','visual_search_standard','spatial_rotation','reaction_inhibition'],
  data_scientist:          ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','matrix_standard','visual_search_standard','matrix_advanced','logic_situational'],
  ux_designer:             ['task_planning_standard','memory_positions','memory_faces','spatial_rotation','logic_situational','logic_verbal','reaction_basic','visual_search_standard','memory_colors','dot_estimation'],
  product_manager:         ['task_planning_hard','task_planning_standard','memory_sequential','logic_situational','matrix_standard','logic_verbal','dot_estimation','reaction_inhibition','stroop_classic','memory_faces'],
  cybersecurity_analyst:   ['black_box_hard','task_planning_standard','visual_search_hard','memory_code','matrix_standard','visual_search_standard','stroop_classic','reaction_speed','reaction_inhibition','dot_estimation'],
  devops_engineer:         ['black_box_standard','task_planning_hard','task_planning_standard','memory_code','stroop_classic','matrix_standard','visual_search_standard','reaction_speed','spatial_rotation','dot_estimation'],
  ai_ml_engineer:          ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','matrix_standard','matrix_advanced','visual_search_standard','logic_situational'],
  game_developer:          ['black_box_standard','task_planning_standard','memory_positions','spatial_rotation','visual_search_standard','reaction_speed','reaction_basic','stroop_classic','dot_estimation','logic_situational'],

  // Healthcare
  physician:               ['black_box_standard','task_planning_standard','memory_sequential','memory_faces','matrix_standard','visual_search_standard','dot_estimation','logic_situational','reaction_inhibition','stroop_classic'],
  surgeon:                 ['memory_positions','memory_sequential','spatial_rotation','visual_search_hard','visual_search_standard','reaction_speed','reaction_inhibition','stroop_classic','dot_estimation','task_planning_standard'],
  nurse:                   ['task_planning_standard','memory_sequential','memory_faces','memory_colors','visual_search_standard','logic_situational','logic_verbal','reaction_inhibition','reaction_basic','stroop_classic'],
  psychiatrist:            ['black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition','dot_estimation','memory_colors'],
  pharmacist:              ['black_box_standard','task_planning_standard','memory_sequential','memory_numbers','memory_code','visual_search_standard','dot_estimation','stroop_classic','reaction_inhibition','visual_search_hard'],
  physiotherapist:         ['task_planning_standard','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic','reaction_inhibition','dot_estimation','visual_search_standard'],
  radiologist:             ['black_box_standard','task_planning_standard','memory_positions','memory_sequential','spatial_rotation','visual_search_hard','visual_search_standard','matrix_standard','stroop_classic','dot_estimation'],

  // Finance
  financial_analyst:       ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','logic_situational','reaction_inhibition'],
  investment_banker:       ['black_box_hard','task_planning_standard','memory_numbers','dot_estimation','logic_situational','matrix_standard','visual_search_standard','reaction_speed','stroop_classic','reaction_inhibition'],
  accountant:              ['black_box_standard','task_planning_standard','memory_numbers','memory_sequential','dot_estimation','visual_search_standard','stroop_classic','matrix_standard','reaction_inhibition','visual_search_hard'],

  // Business
  marketing_manager:       ['task_planning_standard','memory_faces','logic_verbal','logic_situational','dot_estimation','spatial_rotation','reaction_basic','visual_search_standard','memory_sequential','stroop_classic'],
  sales_executive:         ['task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_speed','reaction_inhibition','dot_estimation','stroop_classic'],
  entrepreneur:            ['black_box_standard','task_planning_hard','task_planning_standard','logic_situational','dot_estimation','matrix_standard','reaction_speed','reaction_inhibition','memory_sequential','stroop_classic'],
  management_consultant:   ['black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','logic_situational','matrix_standard','dot_estimation','logic_verbal','stroop_classic','visual_search_standard'],
  supply_chain_manager:    ['task_planning_hard','task_planning_standard','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard','reaction_basic','stroop_classic','spatial_rotation'],
  hr_manager:              ['task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','matrix_standard','reaction_inhibition','dot_estimation','stroop_classic'],

  // Education
  teacher:                 ['task_planning_standard','memory_sequential','memory_faces','logic_verbal','logic_situational','matrix_standard','reaction_inhibition','dot_estimation','visual_search_standard','memory_colors'],
  professor:               ['black_box_hard','task_planning_hard','black_box_standard','memory_sequential','matrix_standard','dot_estimation','logic_verbal','visual_search_standard','stroop_classic','spatial_rotation'],
  educational_technologist:['task_planning_hard','task_planning_standard','memory_sequential','stroop_classic','logic_situational','logic_verbal','reaction_basic','visual_search_standard','matrix_standard','dot_estimation'],
  curriculum_designer:     ['task_planning_hard','task_planning_standard','memory_sequential','logic_verbal','logic_situational','visual_search_standard','spatial_rotation','matrix_standard','dot_estimation','stroop_classic'],

  // Social / Legal
  psychologist:            ['black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition','dot_estimation','stroop_classic'],
  social_worker:           ['task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_inhibition','dot_estimation','stroop_classic','matrix_standard'],
  lawyer:                  ['black_box_hard','task_planning_standard','memory_sequential','matrix_standard','logic_verbal','logic_situational','visual_search_standard','stroop_classic','dot_estimation','reaction_inhibition'],
  judge:                   ['black_box_standard','task_planning_hard','memory_sequential','memory_positions','matrix_standard','logic_verbal','logic_situational','visual_search_standard','stroop_classic','dot_estimation'],
  policy_analyst:          ['black_box_standard','task_planning_hard','task_planning_standard','memory_sequential','matrix_standard','dot_estimation','logic_situational','logic_verbal','stroop_classic','visual_search_standard'],

  // Engineering
  civil_engineer:          ['task_planning_hard','task_planning_standard','memory_positions','memory_sequential','spatial_rotation','dot_estimation','visual_search_standard','matrix_standard','stroop_classic','black_box_standard'],
  mechanical_engineer:     ['black_box_standard','task_planning_standard','memory_sequential','spatial_rotation','dot_estimation','visual_search_standard','stroop_classic','matrix_standard','black_box_hard','reaction_inhibition'],
  electrical_engineer:     ['black_box_hard','task_planning_standard','task_planning_hard','memory_code','stroop_classic','spatial_rotation','visual_search_standard','dot_estimation','matrix_standard','reaction_inhibition'],
  aerospace_engineer:      ['black_box_hard','task_planning_hard','task_planning_standard','memory_sequential','spatial_rotation','dot_estimation','stroop_classic','visual_search_hard','matrix_standard','reaction_speed'],
  biomedical_engineer:     ['black_box_standard','task_planning_standard','memory_sequential','memory_positions','spatial_rotation','dot_estimation','matrix_standard','visual_search_standard','stroop_classic','logic_situational'],
  environmental_engineer:  ['task_planning_standard','task_planning_hard','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard','stroop_classic','black_box_standard','spatial_rotation'],

  // Science
  research_scientist:      ['black_box_hard','black_box_standard','task_planning_standard','memory_sequential','matrix_standard','matrix_advanced','dot_estimation','stroop_classic','visual_search_standard','logic_situational'],
  chemist:                 ['black_box_hard','task_planning_standard','memory_sequential','memory_numbers','dot_estimation','visual_search_hard','stroop_classic','matrix_standard','spatial_rotation','reaction_inhibition'],
  neuroscientist:          ['black_box_hard','black_box_standard','memory_sequential','memory_positions','dot_estimation','matrix_standard','visual_search_standard','stroop_classic','spatial_rotation','logic_situational'],
  environmental_scientist: ['black_box_standard','task_planning_standard','memory_sequential','dot_estimation','matrix_standard','visual_search_standard','logic_situational','stroop_classic','spatial_rotation','matrix_advanced'],
  statistician:            ['black_box_hard','black_box_standard','task_planning_standard','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','matrix_advanced','logic_situational'],

  // Creative / Media
  architect:               ['task_planning_hard','task_planning_standard','memory_positions','memory_sequential','spatial_rotation','logic_situational','dot_estimation','black_box_standard','visual_search_standard','matrix_standard'],
  graphic_designer:        ['task_planning_standard','memory_positions','memory_colors','spatial_rotation','visual_search_standard','logic_situational','reaction_basic','dot_estimation','matrix_standard','visual_search_hard'],
  journalist:              ['task_planning_standard','memory_sequential','memory_faces','logic_verbal','visual_search_standard','logic_situational','matrix_standard','stroop_classic','dot_estimation','reaction_inhibition'],
  filmmaker:               ['task_planning_hard','task_planning_standard','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic','visual_search_standard','dot_estimation'],
  content_creator:         ['task_planning_standard','memory_sequential','memory_faces','logic_verbal','logic_situational','visual_search_standard','spatial_rotation','reaction_basic','dot_estimation','stroop_classic'],
  pr_manager:              ['task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','dot_estimation','reaction_inhibition','stroop_classic','matrix_standard'],
};

// Used when no occupation is selected (explore freely path)
export const GENERAL_POOL: string[] = [
  'black_box_standard','black_box_hard',
  'task_planning_standard','task_planning_hard',
  'memory_colors','memory_numbers','memory_positions','memory_sequential',
  'matrix_standard','spatial_rotation','dot_estimation',
  'visual_search_standard','visual_search_hard',
  'logic_verbal','logic_situational','stroop_classic',
  'reaction_basic','reaction_inhibition',
];
