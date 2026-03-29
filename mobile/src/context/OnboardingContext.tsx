import React, { createContext, useContext, useState, ReactNode } from 'react';
import { OnboardingData, AgeRange, Gender, EmploymentStatus, FlowType } from '../types/onboarding';

interface OnboardingContextValue {
  onboarding: Partial<OnboardingData>;
  setAgeRange: (v: AgeRange) => void;
  setGender: (v: Gender) => void;
  setEmploymentStatus: (v: EmploymentStatus) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboarding, setOnboarding] = useState<Partial<OnboardingData>>({});

  function setAgeRange(ageRange: AgeRange) {
    setOnboarding(prev => ({ ...prev, ageRange }));
  }

  function setGender(gender: Gender) {
    setOnboarding(prev => ({ ...prev, gender }));
  }

  function setEmploymentStatus(employmentStatus: EmploymentStatus) {
    const flowType: FlowType =
      employmentStatus === 'employed' || employmentStatus === 'retired'
        ? 'employed'
        : 'career_guidance';
    setOnboarding(prev => ({ ...prev, employmentStatus, flowType }));
  }

  function reset() {
    setOnboarding({});
  }

  return (
    <OnboardingContext.Provider value={{ onboarding, setAgeRange, setGender, setEmploymentStatus, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
