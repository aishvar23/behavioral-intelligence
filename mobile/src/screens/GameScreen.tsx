import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import ExplorationIsland from '../components/games/ExplorationIsland';
import HiddenPatternGame from '../components/games/HiddenPatternGame';
import ImpossiblePuzzle from '../components/games/ImpossiblePuzzle';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const GAME_ORDER: Array<'exploration' | 'pattern' | 'puzzle'> = [
  'exploration',
  'pattern',
  'puzzle',
];

export default function GameScreen({ navigation, route }: Props) {
  const { gameId, sessionId } = route.params;

  function handleGameComplete() {
    const currentIndex = GAME_ORDER.indexOf(gameId);
    const nextGame = GAME_ORDER[currentIndex + 1];
    if (nextGame) {
      navigation.replace('Game', { gameId: nextGame, sessionId });
    } else {
      navigation.replace('Report', { sessionId });
    }
  }

  return (
    <View style={styles.container}>
      {gameId === 'exploration' && (
        <ExplorationIsland sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {gameId === 'pattern' && (
        <HiddenPatternGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {gameId === 'puzzle' && (
        <ImpossiblePuzzle sessionId={sessionId} onComplete={handleGameComplete} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
});
