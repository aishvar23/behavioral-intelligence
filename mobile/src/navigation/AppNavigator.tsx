import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import ReportScreen from '../screens/ReportScreen';
import CareerSelectionScreen from '../screens/CareerSelectionScreen';

export type RootStackParamList = {
  Home: { completedGame?: 'exploration' | 'pattern' | 'puzzle'; score?: number } | undefined;
  Game: { gameId: 'exploration' | 'pattern' | 'puzzle'; sessionId: string };
  CareerSelection: { sessionId: string; scores: { exploration: number; pattern: number; puzzle: number } };
  Report: { sessionId: string; scores: { exploration: number; pattern: number; puzzle: number }; selectedCareers: string[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#e0e0ff' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Behavioral Intelligence' }} />
        <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Game' }} />
        <Stack.Screen name="CareerSelection" component={CareerSelectionScreen} options={{ title: 'Choose Careers' }} />
        <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Your Report' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
