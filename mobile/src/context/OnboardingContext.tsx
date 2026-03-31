import React, { createContext, useContext, useState, ReactNode } from 'react';
import { OnboardingData, AgeRange, Gender, EmploymentStatus, FlowType } from '../types/onboarding';

interface OnboardingContextValue {
  onboarding: Partial<OnboardingData>;
  // New profile fields
  name: string;
  age: string;
  country: string;
  setName: (v: string) => void;
  setAge: (v: string) => void;
  setCountry: (v: string) => void;
  // Existing setters
  setAgeRange: (v: AgeRange) => void;
  setGender: (v: Gender) => void;
  setEmploymentStatus: (v: EmploymentStatus) => void;
  setFlowType: (v: FlowType) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboarding, setOnboarding] = useState<Partial<OnboardingData>>({});
  const [name, setNameState] = useState('');
  const [age, setAgeState] = useState('');
  const [country, setCountryState] = useState('');

  function setName(v: string) { setNameState(v); }
  function setAge(v: string) { setAgeState(v); }
  function setCountry(v: string) { setCountryState(v); }

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

  function setFlowType(flowType: FlowType) {
    setOnboarding(prev => ({ ...prev, flowType }));
  }

  function reset() {
    setOnboarding({});
    setNameState('');
    setAgeState('');
    setCountryState('');
  }

  return (
    <OnboardingContext.Provider value={{
      onboarding,
      name,
      age,
      country,
      setName,
      setAge,
      setCountry,
      setAgeRange,
      setGender,
      setEmploymentStatus,
      setFlowType,
      reset,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
