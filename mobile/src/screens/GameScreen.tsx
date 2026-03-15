import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, GameResult } from '../navigation/AppNavigator';
import ExplorationIsland from '../components/games/ExplorationIsland';
import HiddenPatternGame from '../components/games/HiddenPatternGame';
import ImpossiblePuzzle from '../components/games/ImpossiblePuzzle';
import MemorySequenceGame from '../components/games/MemorySequenceGame';
import LogicDeductionGame from '../components/games/LogicDeductionGame';
import ReactionTestGame from '../components/games/ReactionTestGame';
import { GAME_CONFIGS } from '../data/gameCatalog';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ navigation, route }: Props) {
  const { sessionId, userProfile, gameQueue, currentIndex, completedScores } = route.params;
  const current = gameQueue[currentIndex];

  function handleGameComplete(score: number) {
    const newScores = [...completedScores, score];
    if (currentIndex + 1 < gameQueue.length) {
      navigation.replace('Game', {
        sessionId,
        userProfile,
        gameQueue,
        currentIndex: currentIndex + 1,
        completedScores: newScores,
      });
    } else {
      const gameResults: GameResult[] = gameQueue.map((item, i) => ({
        ...item,
        score: newScores[i],
      }));
      navigation.replace('Report', { sessionId, userProfile, gameResults });
    }
  }

  const catalogEntry = GAME_CONFIGS[current.configId];
  const cfg = (catalogEntry?.config ?? {}) as Record<string, unknown>;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {gameQueue.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i < currentIndex && styles.progressDone,
              i === currentIndex && styles.progressActive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progressText}>
        Game {currentIndex + 1} of {gameQueue.length}  ·  {current.emoji} {current.title}
      </Text>

      {current.gameType === 'exploration' && (
        <ExplorationIsland sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'pattern' && (
        <HiddenPatternGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'puzzle' && (
        <ImpossiblePuzzle sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'memory' && (
        <MemorySequenceGame
          sessionId={sessionId}
          onComplete={handleGameComplete}
          config={{ variant: (cfg.variant as 'colors' | 'numbers' | 'positions') ?? 'colors' }}
        />
      )}
      {current.gameType === 'logic' && (
        <LogicDeductionGame
          sessionId={sessionId}
          onComplete={handleGameComplete}
          config={{ variant: (cfg.variant as 'deduction' | 'patterns' | 'verbal') ?? 'deduction' }}
        />
      )}
      {current.gameType === 'reaction' && (
        <ReactionTestGame
          sessionId={sessionId}
          onComplete={handleGameComplete}
          config={{ variant: (cfg.variant as 'basic' | 'inhibition' | 'speed') ?? 'basic' }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#2a2a5e',
  },
  progressDone: { backgroundColor: '#3a6e3a' },
  progressActive: { backgroundColor: '#5c6bc0', transform: [{ scale: 1.3 }] },
  progressText: {
    color: '#5555aa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },
});
