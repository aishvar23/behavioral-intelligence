import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import OccupationIntentScreen from '../screens/OccupationIntentScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import GameScreen from '../screens/GameScreen';
import ReportScreen from '../screens/ReportScreen';
import { GameType } from '../data/gameCatalog';

export interface UserProfile {
  age: string;
  occupation: string;       // occupation ID
  occupationTitle: string;
  occupationEmoji: string;
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

export type RootStackParamList = {
  Home: undefined;
  OccupationIntent: undefined;
  UserProfile: undefined;
  Game: {
    sessionId: string;
    userProfile: UserProfile;
    gameQueue: GameQueueItem[];
    currentIndex: number;
    completedScores: number[];
  };
  Report: {
    sessionId: string;
    userProfile: UserProfile;
    gameResults: GameResult[];
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#e0e0ff' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Behavioral Intelligence', headerShown: false }} />
        <Stack.Screen name="OccupationIntent" component={OccupationIntentScreen} options={{ title: 'Assessment Setup', headerShown: false }} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Your Profile' }} />
        <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Assessment', headerBackVisible: false }} />
        <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Your Report', headerBackVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
