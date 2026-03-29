import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import OnboardingAgeScreen from '../screens/OnboardingAgeScreen';
import OnboardingGenderScreen from '../screens/OnboardingGenderScreen';
import OnboardingEmploymentScreen from '../screens/OnboardingEmploymentScreen';
import ProfessionSelectionScreen from '../screens/ProfessionSelectionScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import GameScreen from '../screens/GameScreen';
import ReportScreen from '../screens/ReportScreen';
import AuthScreen from '../screens/AuthScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import GuestSetupScreen from '../screens/GuestSetupScreen';
import { GameType } from '../data/gameCatalog';
import { initSession } from '../services/session';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { OnboardingData } from '../types/onboarding';

// ---------------------------------------------------------------------------
// Shared type exports (consumed by screens)
// ---------------------------------------------------------------------------

export interface UserProfile {
  userName: string;
  age: string;              // holds ageRange string (e.g. '18-24') or legacy numeric string
  country: string;
  lifeStage: string;
  occupations: string[];      // occupation IDs
  occupationTitles: string[]; // human-readable titles
  occupationEmojis: string[]; // per-occupation emojis
  interests: string;
  // Onboarding fields (present for new flows)
  ageRange?: string;
  gender?: string;
  employmentStatus?: string;
  flowType?: 'employed' | 'career_guidance';
}

export interface GameQueueItem {
  configId: string;
  gameType: GameType;
  title: string;
  emoji: string;
  description: string;
}

export interface GameResult extends GameQueueItem {
  score: number;
}

// ---------------------------------------------------------------------------
// Route param lists
// ---------------------------------------------------------------------------

export type AuthStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  GuestSetup: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  OnboardingAge: undefined;
  OnboardingGender: undefined;
  OnboardingEmployment: undefined;
  ProfessionSelection: { onboardingData: OnboardingData };
  UserProfile: { onboardingData: OnboardingData };
  Game: {
    sessionId: string;
    userProfile: UserProfile;
    gameQueue: GameQueueItem[];
    currentIndex: number;
    completedScores: number[];
    userId?: number;
  };
  Report: {
    sessionId: string;
    userProfile: UserProfile;
    gameResults: GameResult[];
    userId?: number;
  };
};

// ---------------------------------------------------------------------------
// Navigators
// ---------------------------------------------------------------------------

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<RootStackParamList>();

const HEADER_OPTS = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#e0e0ff',
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={HEADER_OPTS}>
      <AuthStack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In' }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <AuthStack.Screen
        name="GuestSetup"
        component={GuestSetupScreen}
        options={{ title: 'Quick Setup' }}
      />
    </AuthStack.Navigator>
  );
}

function AppNavigatorInner() {
  return (
    <OnboardingProvider>
      <AppStack.Navigator
        initialRouteName="Home"
        screenOptions={HEADER_OPTS}
      >
        <AppStack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Behavioral Intelligence', headerShown: false }}
        />
        <AppStack.Screen
          name="OnboardingAge"
          component={OnboardingAgeScreen}
          options={{ title: 'About You', headerShown: false }}
        />
        <AppStack.Screen
          name="OnboardingGender"
          component={OnboardingGenderScreen}
          options={{ title: 'About You', headerShown: false }}
        />
        <AppStack.Screen
          name="OnboardingEmployment"
          component={OnboardingEmploymentScreen}
          options={{ title: 'About You', headerShown: false }}
        />
        <AppStack.Screen
          name="ProfessionSelection"
          component={ProfessionSelectionScreen}
          options={{ title: 'Your Profession' }}
        />
        <AppStack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ title: 'Your Profile' }}
        />
        <AppStack.Screen
          name="Game"
          component={GameScreen}
          options={{ title: 'Assessment', headerBackVisible: false }}
        />
        <AppStack.Screen
          name="Report"
          component={ReportScreen}
          options={{ title: 'Your Report', headerBackVisible: false }}
        />
      </AppStack.Navigator>
    </OnboardingProvider>
  );
}

// Root navigator — reads auth state and picks the correct stack.
// Must be a child of AuthProvider so hooks work.
function RootNavigator() {
  const { auth } = useAuth();

  useEffect(() => { initSession(); }, []);

  if (auth.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#5c6bc0" />
      </View>
    );
  }

  if (!auth.userId && !auth.isGuest) {
    return <AuthNavigator />;
  }

  return <AppNavigatorInner />;
}

// ---------------------------------------------------------------------------
// Default export — wraps everything in AuthProvider + NavigationContainer
// ---------------------------------------------------------------------------

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
