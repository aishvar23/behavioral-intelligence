export type OccupationCategory =
  | 'technology'
  | 'healthcare'
  | 'business'
  | 'education'
  | 'legal'
  | 'engineering'
  | 'science'
  | 'creative';

export interface Occupation {
  id: string;
  title: string;
  emoji: string;
  category: OccupationCategory;
  description: string;
}

export const OCCUPATION_CATEGORY_LABELS: Record<OccupationCategory, string> = {
  technology: 'Technology',
  healthcare: 'Healthcare',
  business: 'Business & Finance',
  education: 'Education & Social',
  legal: 'Legal & Policy',
  engineering: 'Engineering',
  science: 'Science & Research',
  creative: 'Creative & Media',
};

export const OCCUPATIONS: Occupation[] = [
  // Technology (8)
  { id: 'software_engineer', title: 'Software Engineer', emoji: '💻', category: 'technology', description: 'Design and build software systems' },
  { id: 'data_scientist', title: 'Data Scientist', emoji: '📊', category: 'technology', description: 'Extract insights from complex datasets' },
  { id: 'ux_designer', title: 'UX / UI Designer', emoji: '🎨', category: 'technology', description: 'Design intuitive digital experiences' },
  { id: 'product_manager', title: 'Product Manager', emoji: '🚀', category: 'technology', description: 'Lead product strategy and roadmap' },
  { id: 'cybersecurity_analyst', title: 'Cybersecurity Analyst', emoji: '🔒', category: 'technology', description: 'Protect systems from threats' },
  { id: 'devops_engineer', title: 'DevOps Engineer', emoji: '⚙️', category: 'technology', description: 'Streamline development pipelines' },
  { id: 'ai_ml_engineer', title: 'AI / ML Engineer', emoji: '🤖', category: 'technology', description: 'Build intelligent ML systems' },
  { id: 'game_developer', title: 'Game Developer', emoji: '🎮', category: 'technology', description: 'Create interactive games' },
  // Healthcare (7)
  { id: 'physician', title: 'Physician / Doctor', emoji: '🩺', category: 'healthcare', description: 'Diagnose and treat medical conditions' },
  { id: 'surgeon', title: 'Surgeon', emoji: '🔬', category: 'healthcare', description: 'Perform precise surgical procedures' },
  { id: 'nurse', title: 'Registered Nurse', emoji: '💊', category: 'healthcare', description: 'Provide patient care and support' },
  { id: 'psychiatrist', title: 'Psychiatrist', emoji: '🧠', category: 'healthcare', description: 'Diagnose and treat mental health' },
  { id: 'pharmacist', title: 'Pharmacist', emoji: '⚗️', category: 'healthcare', description: 'Manage medications and patient health' },
  { id: 'physiotherapist', title: 'Physiotherapist', emoji: '🏃', category: 'healthcare', description: 'Restore movement through therapy' },
  { id: 'radiologist', title: 'Radiologist', emoji: '🩻', category: 'healthcare', description: 'Interpret medical imaging' },
  // Business & Finance (8)
  { id: 'financial_analyst', title: 'Financial Analyst', emoji: '📈', category: 'business', description: 'Analyze financial data and trends' },
  { id: 'investment_banker', title: 'Investment Banker', emoji: '🏦', category: 'business', description: 'Manage high-stakes transactions' },
  { id: 'marketing_manager', title: 'Marketing Manager', emoji: '📣', category: 'business', description: 'Drive brand strategy and campaigns' },
  { id: 'sales_executive', title: 'Sales Executive', emoji: '🤝', category: 'business', description: 'Build relationships and close deals' },
  { id: 'entrepreneur', title: 'Entrepreneur', emoji: '💡', category: 'business', description: 'Build and scale new ventures' },
  { id: 'management_consultant', title: 'Management Consultant', emoji: '📋', category: 'business', description: 'Solve complex organizational problems' },
  { id: 'accountant', title: 'Accountant / CPA', emoji: '🧮', category: 'business', description: 'Manage financial records and compliance' },
  { id: 'supply_chain_manager', title: 'Supply Chain Manager', emoji: '📦', category: 'business', description: 'Optimize logistics and supply networks' },
  // Education & Social (6)
  { id: 'teacher', title: 'Teacher / Educator', emoji: '📚', category: 'education', description: 'Inspire and educate students' },
  { id: 'professor', title: 'University Professor', emoji: '🎓', category: 'education', description: 'Advance knowledge through research' },
  { id: 'psychologist', title: 'Psychologist', emoji: '🧩', category: 'education', description: 'Study and support human behavior' },
  { id: 'educational_technologist', title: 'Educational Technologist', emoji: '🖥️', category: 'education', description: 'Design tech-driven learning' },
  { id: 'curriculum_designer', title: 'Curriculum Designer', emoji: '✏️', category: 'education', description: 'Develop structured learning pathways' },
  { id: 'social_worker', title: 'Social Worker', emoji: '🫂', category: 'education', description: 'Support communities in need' },
  // Legal & Policy (4)
  { id: 'lawyer', title: 'Lawyer / Attorney', emoji: '⚖️', category: 'legal', description: 'Advocate and navigate legal frameworks' },
  { id: 'judge', title: 'Judge', emoji: '🔨', category: 'legal', description: 'Administer justice in proceedings' },
  { id: 'policy_analyst', title: 'Policy Analyst', emoji: '🏛️', category: 'legal', description: 'Research and evaluate government policy' },
  { id: 'hr_manager', title: 'HR Manager', emoji: '👥', category: 'legal', description: 'Manage people, culture and compliance' },
  // Engineering (6)
  { id: 'civil_engineer', title: 'Civil Engineer', emoji: '🌉', category: 'engineering', description: 'Design infrastructure and public works' },
  { id: 'mechanical_engineer', title: 'Mechanical Engineer', emoji: '🔧', category: 'engineering', description: 'Design mechanical systems' },
  { id: 'electrical_engineer', title: 'Electrical Engineer', emoji: '⚡', category: 'engineering', description: 'Design electrical systems and circuits' },
  { id: 'aerospace_engineer', title: 'Aerospace Engineer', emoji: '✈️', category: 'engineering', description: 'Design aircraft and spacecraft' },
  { id: 'biomedical_engineer', title: 'Biomedical Engineer', emoji: '🧬', category: 'engineering', description: 'Develop medical devices and health tech' },
  { id: 'environmental_engineer', title: 'Environmental Engineer', emoji: '🌿', category: 'engineering', description: 'Solve sustainability problems' },
  // Science & Research (5)
  { id: 'research_scientist', title: 'Research Scientist', emoji: '🔭', category: 'science', description: 'Advance knowledge through experiments' },
  { id: 'chemist', title: 'Chemist / Biochemist', emoji: '🧪', category: 'science', description: 'Study matter and chemical processes' },
  { id: 'neuroscientist', title: 'Neuroscientist', emoji: '🧠', category: 'science', description: 'Explore brain structure and function' },
  { id: 'environmental_scientist', title: 'Environmental Scientist', emoji: '🌍', category: 'science', description: 'Study and protect natural ecosystems' },
  { id: 'statistician', title: 'Statistician / Actuary', emoji: '📐', category: 'science', description: 'Model uncertainty and analyze data' },
  // Creative & Media (6)
  { id: 'architect', title: 'Architect', emoji: '🏗️', category: 'creative', description: 'Design functional and beautiful structures' },
  { id: 'graphic_designer', title: 'Graphic Designer', emoji: '🖌️', category: 'creative', description: 'Craft visual communication' },
  { id: 'journalist', title: 'Journalist / Writer', emoji: '📰', category: 'creative', description: 'Research and communicate stories' },
  { id: 'filmmaker', title: 'Filmmaker / Director', emoji: '🎬', category: 'creative', description: 'Direct visual storytelling' },
  { id: 'content_creator', title: 'Content Creator', emoji: '📱', category: 'creative', description: 'Build audiences through digital content' },
  { id: 'pr_manager', title: 'PR / Communications Manager', emoji: '📢', category: 'creative', description: 'Manage brand reputation and messaging' },
];

export function getOccupationById(id: string): Occupation | undefined {
  return OCCUPATIONS.find(o => o.id === id);
}

export function getOccupationsByCategory(): Record<OccupationCategory, Occupation[]> {
  const result = {} as Record<OccupationCategory, Occupation[]>;
  for (const occ of OCCUPATIONS) {
    if (!result[occ.category]) result[occ.category] = [];
    result[occ.category].push(occ);
  }
  return result;
}
