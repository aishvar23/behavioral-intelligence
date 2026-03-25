import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import OccupationIntentScreen from '../screens/OccupationIntentScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import GameScreen from '../screens/GameScreen';
import ReportScreen from '../screens/ReportScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AuthScreen from '../screens/AuthScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { GameType } from '../data/gameCatalog';
import { initSession } from '../services/session';
import { AuthProvider, useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Shared type exports (consumed by screens)
// ---------------------------------------------------------------------------

export interface UserProfile {
  userName: string;
  age: string;
  country: string;
  lifeStage: string;
  occupations: string[];      // occupation IDs
  occupationTitles: string[]; // human-readable titles
  occupationEmojis: string[]; // per-occupation emojis
  interests: string;
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
};

export type RootStackParamList = {
  Home: undefined;
  History: undefined;
  OccupationIntent: undefined;
  UserProfile: undefined;
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
    </AuthStack.Navigator>
  );
}

function AppNavigatorInner() {
  return (
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
        name="History"
        component={HistoryScreen}
        options={{ title: 'My Progress', ...HEADER_OPTS }}
      />
      <AppStack.Screen
        name="OccupationIntent"
        component={OccupationIntentScreen}
        options={{ title: 'Assessment Setup', headerShown: false }}
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
