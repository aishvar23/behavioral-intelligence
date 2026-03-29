export type AgeRange = '< 18' | '18-24' | '25-34' | '35-44' | '45-54' | '55+';
export type Gender = 'male' | 'female' | 'non_binary';
export type EmploymentStatus = 'employed' | 'seeking_guidance' | 'student' | 'retired';
export type FlowType = 'employed' | 'career_guidance';

export interface OnboardingData {
  ageRange: AgeRange;
  gender: Gender;
  employmentStatus: EmploymentStatus;
  flowType: FlowType;
}
