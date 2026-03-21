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
  software_engineer:       ['exploration_systematic','black_box_hard','task_planning_hard','puzzle_analytical','memory_code','matrix_standard','stroop_classic','dot_estimation','visual_search_standard','spatial_rotation'],
  data_scientist:          ['exploration_data','black_box_hard','black_box_standard','puzzle_analytical','memory_numbers','dot_estimation','stroop_classic','matrix_standard','visual_search_standard','task_planning_standard'],
  ux_designer:             ['exploration_open','exploration_standard','task_planning_standard','puzzle_collaborative','memory_positions','memory_faces','spatial_rotation','logic_situational','logic_verbal','reaction_basic'],
  product_manager:         ['exploration_standard','task_planning_hard','task_planning_standard','puzzle_collaborative','memory_sequential','logic_situational','matrix_standard','logic_verbal','dot_estimation','reaction_inhibition'],
  cybersecurity_analyst:   ['exploration_cautious','exploration_systematic','black_box_hard','task_planning_standard','puzzle_pressure','puzzle_analytical','memory_code','matrix_standard','visual_search_standard','stroop_classic'],
  devops_engineer:         ['exploration_systematic','exploration_resource','black_box_standard','task_planning_hard','puzzle_analytical','puzzle_precise','memory_code','stroop_classic','matrix_standard','visual_search_standard'],
  ai_ml_engineer:          ['exploration_data','exploration_systematic','black_box_hard','black_box_standard','task_planning_standard','puzzle_analytical','memory_numbers','dot_estimation','stroop_classic','matrix_standard'],
  game_developer:          ['exploration_standard','exploration_cautious','black_box_standard','task_planning_standard','puzzle_pressure','puzzle_precise','memory_positions','spatial_rotation','visual_search_standard','reaction_speed'],

  // Healthcare
  physician:               ['exploration_systematic','black_box_standard','puzzle_pressure','memory_sequential','memory_faces','matrix_standard','visual_search_standard','dot_estimation','logic_situational','reaction_inhibition'],
  surgeon:                 ['exploration_cautious','puzzle_precise','puzzle_pressure','memory_positions','memory_sequential','spatial_rotation','visual_search_standard','reaction_speed','reaction_inhibition','stroop_classic'],
  nurse:                   ['exploration_standard','task_planning_standard','memory_sequential','memory_faces','memory_colors','visual_search_standard','logic_situational','logic_verbal','reaction_inhibition','reaction_basic'],
  psychiatrist:            ['exploration_open','exploration_standard','black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition'],
  pharmacist:              ['exploration_systematic','black_box_standard','task_planning_standard','memory_sequential','memory_numbers','memory_code','visual_search_standard','dot_estimation','stroop_classic','reaction_inhibition'],
  physiotherapist:         ['exploration_open','exploration_standard','puzzle_collaborative','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic','reaction_inhibition'],
  radiologist:             ['exploration_systematic','exploration_data','black_box_standard','task_planning_standard','memory_positions','memory_sequential','spatial_rotation','visual_search_standard','matrix_standard','stroop_classic'],

  // Finance
  financial_analyst:       ['exploration_data','black_box_hard','black_box_standard','puzzle_analytical','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','task_planning_standard'],
  investment_banker:       ['exploration_resource','black_box_hard','task_planning_standard','puzzle_pressure','memory_numbers','dot_estimation','logic_situational','matrix_standard','visual_search_standard','reaction_speed'],
  accountant:              ['exploration_systematic','black_box_standard','task_planning_standard','memory_numbers','memory_sequential','dot_estimation','visual_search_standard','stroop_classic','matrix_standard','reaction_inhibition'],

  // Business
  marketing_manager:       ['exploration_open','exploration_standard','task_planning_standard','puzzle_collaborative','memory_faces','logic_verbal','logic_situational','dot_estimation','spatial_rotation','reaction_basic'],
  sales_executive:         ['exploration_open','exploration_standard','task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_speed','reaction_inhibition'],
  entrepreneur:            ['exploration_standard','exploration_cautious','exploration_resource','black_box_standard','task_planning_hard','puzzle_pressure','logic_situational','dot_estimation','matrix_standard','reaction_speed'],
  management_consultant:   ['exploration_systematic','exploration_data','black_box_standard','task_planning_hard','puzzle_analytical','memory_sequential','logic_situational','matrix_standard','dot_estimation','logic_verbal'],
  supply_chain_manager:    ['exploration_systematic','exploration_resource','task_planning_hard','task_planning_standard','puzzle_analytical','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard'],
  hr_manager:              ['exploration_open','exploration_standard','task_planning_standard','puzzle_collaborative','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','matrix_standard'],

  // Education
  teacher:                 ['exploration_open','exploration_standard','task_planning_standard','puzzle_collaborative','memory_sequential','memory_faces','logic_verbal','logic_situational','matrix_standard','reaction_inhibition'],
  professor:               ['exploration_data','exploration_systematic','black_box_hard','task_planning_hard','puzzle_analytical','memory_sequential','matrix_standard','dot_estimation','logic_verbal','visual_search_standard'],
  educational_technologist:['exploration_systematic','exploration_data','task_planning_hard','task_planning_standard','puzzle_collaborative','memory_sequential','stroop_classic','logic_situational','logic_verbal','reaction_basic'],
  curriculum_designer:     ['exploration_systematic','exploration_open','task_planning_hard','task_planning_standard','puzzle_collaborative','memory_sequential','logic_verbal','logic_situational','visual_search_standard','spatial_rotation'],

  // Social / Legal
  psychologist:            ['exploration_open','exploration_standard','black_box_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','matrix_standard','visual_search_standard','reaction_inhibition'],
  social_worker:           ['exploration_open','exploration_standard','task_planning_standard','puzzle_collaborative','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','reaction_inhibition'],
  lawyer:                  ['exploration_systematic','exploration_cautious','black_box_hard','puzzle_analytical','puzzle_pressure','memory_sequential','matrix_standard','logic_verbal','logic_situational','visual_search_standard'],
  judge:                   ['exploration_systematic','exploration_cautious','black_box_standard','puzzle_analytical','memory_sequential','memory_positions','matrix_standard','logic_verbal','logic_situational','visual_search_standard'],
  policy_analyst:          ['exploration_systematic','exploration_data','black_box_standard','task_planning_standard','puzzle_analytical','memory_sequential','matrix_standard','dot_estimation','logic_situational','logic_verbal'],

  // Engineering
  civil_engineer:          ['exploration_systematic','exploration_resource','task_planning_hard','puzzle_precise','memory_positions','memory_sequential','spatial_rotation','dot_estimation','visual_search_standard','matrix_standard'],
  mechanical_engineer:     ['exploration_systematic','exploration_cautious','black_box_standard','task_planning_standard','puzzle_precise','puzzle_analytical','memory_sequential','spatial_rotation','dot_estimation','stroop_classic'],
  electrical_engineer:     ['exploration_systematic','exploration_data','black_box_hard','task_planning_standard','puzzle_precise','puzzle_analytical','memory_code','stroop_classic','spatial_rotation','visual_search_standard'],
  aerospace_engineer:      ['exploration_systematic','exploration_cautious','black_box_hard','task_planning_hard','puzzle_precise','puzzle_pressure','memory_sequential','spatial_rotation','dot_estimation','stroop_classic'],
  biomedical_engineer:     ['exploration_systematic','exploration_data','black_box_standard','task_planning_standard','puzzle_analytical','memory_sequential','memory_positions','spatial_rotation','dot_estimation','matrix_standard'],
  environmental_engineer:  ['exploration_open','exploration_systematic','exploration_data','task_planning_standard','puzzle_analytical','memory_sequential','dot_estimation','matrix_standard','logic_situational','visual_search_standard'],

  // Science
  research_scientist:      ['exploration_data','exploration_systematic','exploration_open','black_box_hard','black_box_standard','task_planning_standard','puzzle_analytical','memory_sequential','matrix_standard','dot_estimation'],
  chemist:                 ['exploration_systematic','exploration_data','black_box_hard','task_planning_standard','puzzle_precise','puzzle_analytical','memory_sequential','memory_numbers','dot_estimation','stroop_classic'],
  neuroscientist:          ['exploration_data','exploration_systematic','black_box_hard','black_box_standard','puzzle_analytical','memory_sequential','memory_positions','dot_estimation','matrix_standard','visual_search_standard'],
  environmental_scientist: ['exploration_open','exploration_data','exploration_systematic','black_box_standard','puzzle_analytical','memory_sequential','dot_estimation','matrix_standard','visual_search_standard','logic_situational'],
  statistician:            ['exploration_data','black_box_hard','black_box_standard','puzzle_analytical','memory_numbers','dot_estimation','stroop_classic','visual_search_standard','matrix_standard','task_planning_standard'],

  // Creative / Media
  architect:               ['exploration_open','exploration_systematic','task_planning_hard','task_planning_standard','puzzle_precise','memory_positions','memory_sequential','spatial_rotation','logic_situational','dot_estimation'],
  graphic_designer:        ['exploration_open','exploration_standard','task_planning_standard','puzzle_standard','memory_positions','memory_colors','spatial_rotation','visual_search_standard','logic_situational','reaction_basic'],
  journalist:              ['exploration_open','exploration_standard','exploration_cautious','task_planning_standard','memory_sequential','memory_faces','logic_verbal','visual_search_standard','logic_situational','matrix_standard'],
  filmmaker:               ['exploration_open','exploration_standard','task_planning_hard','puzzle_collaborative','memory_sequential','memory_positions','spatial_rotation','logic_situational','logic_verbal','reaction_basic'],
  content_creator:         ['exploration_open','exploration_standard','task_planning_standard','memory_sequential','memory_faces','logic_verbal','logic_situational','visual_search_standard','spatial_rotation','reaction_basic'],
  pr_manager:              ['exploration_open','exploration_standard','task_planning_standard','memory_faces','memory_sequential','logic_verbal','logic_situational','visual_search_standard','dot_estimation','reaction_inhibition'],
};

// Used when no occupation is selected (explore freely path)
export const GENERAL_POOL: string[] = [
  'exploration_standard','exploration_open','exploration_data',
  'black_box_standard','task_planning_standard',
  'puzzle_standard','puzzle_collaborative',
  'memory_colors','memory_numbers','memory_positions',
  'matrix_standard','spatial_rotation','dot_estimation','visual_search_standard',
  'logic_verbal','logic_situational','stroop_classic',
  'reaction_basic','reaction_inhibition',
];
