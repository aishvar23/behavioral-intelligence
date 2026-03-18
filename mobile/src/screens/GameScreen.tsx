import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, GameResult } from '../navigation/AppNavigator';
import ExplorationIsland from '../components/games/ExplorationIsland';
import HiddenPatternGame from '../components/games/HiddenPatternGame';
import ImpossiblePuzzle from '../components/games/ImpossiblePuzzle';
import MemorySequenceGame from '../components/games/MemorySequenceGame';
import LogicDeductionGame from '../components/games/LogicDeductionGame';
import ReactionTestGame from '../components/games/ReactionTestGame';
import StroopGame from '../components/games/StroopGame';
import MatrixPuzzleGame from '../components/games/MatrixPuzzleGame';
import MentalRotationGame from '../components/games/MentalRotationGame';
import DotEstimationGame from '../components/games/DotEstimationGame';
import VisualSearchGame from '../components/games/VisualSearchGame';
import { GAME_CONFIGS } from '../data/gameCatalog';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

// Rules shown in the tooltip modal, per game type
const GAME_RULES: Record<string, { summary: string; bullets: string[] }> = {
  exploration: {
    summary: 'Navigate a fog-covered grid to uncover tiles within a move limit.',
    bullets: [
      'You have 30 moves to explore the grid',
      'Green tiles give reward points — traps subtract points',
      'Unexplored tiles are hidden until you step on them',
      'Try to uncover as much of the grid as possible',
    ],
  },
  pattern: {
    summary: 'Decode the hidden rule behind a number sequence.',
    bullets: [
      'A number sequence is shown — guess the next number',
      'You get more points for correct answers on the first try',
      'The difficulty increases each round',
      'Use Pass if you\'re stuck — it reveals the answer',
    ],
  },
  puzzle: {
    summary: 'Slide tiles into the correct order using as few moves as possible.',
    bullets: [
      'Tap a tile adjacent to the empty space to slide it',
      'Goal: arrange tiles from 1 to 8 in order',
      'Fewer moves = higher score',
      'Use hints if you get stuck (limited supply)',
    ],
  },
  memory: {
    summary: 'Watch a sequence, then repeat it back in the same order.',
    bullets: [
      'A sequence is shown — memorise it carefully',
      'Tap the items in the exact order shown',
      'Sequences get longer each round',
      'All 5 rounds must be completed',
    ],
  },
  logic: {
    summary: 'Answer reasoning questions within a 30-second time limit each.',
    bullets: [
      'Each question has a 30-second timer',
      'Read carefully — questions test deduction and patterns',
      'Points are awarded for correct answers',
      '7 questions in total',
    ],
  },
  reaction: {
    summary: 'Test your reaction speed and impulse control.',
    bullets: [
      'Tap the target as quickly as possible when it appears',
      'For Stop & Go: tap green, do NOT tap red',
      'Faster correct responses score more points',
      '10 rounds in total',
    ],
  },
  stroop: {
    summary: 'A color word appears in a mismatching ink color — tap the ink color.',
    bullets: [
      'Ignore what the word says — focus on the color it\'s written in',
      'Tap the matching color button as fast as you can',
      'You lose points for wrong answers or timing out',
      '20 trials in total',
    ],
  },
  matrix: {
    summary: 'A 3×3 grid of shapes with one cell missing — find the pattern and complete it.',
    bullets: [
      'Each row and column follows a consistent rule',
      'Study both the shapes and background colors',
      'Pick the correct missing piece from 4 options',
      '6 rounds with 20 seconds each',
    ],
  },
  spatial: {
    summary: 'A shape is shown — pick the option that is the same shape, just rotated.',
    bullets: [
      'The target shape can be rotated in any direction',
      'Watch out for mirror images — they don\'t count!',
      'Different base shapes are also shown as distractors',
      '8 rounds with 12 seconds each',
    ],
  },
  estimation: {
    summary: 'Two groups of dots flash briefly — tap the side with more dots.',
    bullets: [
      'Dots flash for less than a second — use instinct, not counting',
      'Then tap LEFT or RIGHT to pick the larger group',
      'Harder rounds have closer ratios (e.g. 16 vs 20)',
      '14 trials in total',
    ],
  },
  search: {
    summary: 'A 5×5 grid of symbols appears — find and tap the odd ones out.',
    bullets: [
      'Most symbols are the same — a few are subtly different',
      'The target symbol is shown above the grid',
      'Wrong taps subtract 3 points — be precise',
      '8 rounds with 30 seconds each',
    ],
  },
};

export default function GameScreen({ navigation, route }: Props) {
  const { sessionId, userProfile, gameQueue, currentIndex, completedScores, userId } = route.params;
  const current = gameQueue[currentIndex];
  const completedRef = useRef(false); // guard against onComplete firing more than once
  const [showTooltip, setShowTooltip] = useState(false);

  // Intercept the Android hardware back button during the assessment
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Quit assessment?',
        'Your progress will be lost and you\'ll return to the home screen.',
        [
          { text: 'Keep playing', style: 'cancel' },
          {
            text: 'Quit',
            style: 'destructive',
            onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }),
          },
        ]
      );
      return true; // prevent default back behaviour
    });
    return () => sub.remove();
  }, [navigation]);

  function handleGameComplete(score: number) {
    if (completedRef.current) return; // already handled — ignore duplicate calls
    completedRef.current = true;

    const newScores = [...completedScores, score];
    if (currentIndex + 1 < gameQueue.length) {
      navigation.replace('Game', {
        sessionId,
        userProfile,
        gameQueue,
        currentIndex: currentIndex + 1,
        completedScores: newScores,
        userId,
      });
    } else {
      const gameResults: GameResult[] = gameQueue.map((item, i) => ({
        ...item,
        score: newScores[i],
      }));
      navigation.replace('Report', { sessionId, userProfile, gameResults, userId });
    }
  }

  function handleSkip() {
    Alert.alert(
      'Skip this game?',
      'You\'ll move to the next game and this one will score 0. Your report will still be generated.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: () => handleGameComplete(0) },
      ]
    );
  }

  const catalogEntry = GAME_CONFIGS[current.configId];
  const cfg = (catalogEntry?.config ?? {}) as Record<string, unknown>;
  const rules = GAME_RULES[current.gameType];

  return (
    <View style={styles.container}>
      {/* Header: progress + controls */}
      <View style={styles.header}>
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

        <View style={styles.headerRow}>
          <Text style={styles.progressText}>
            Game {currentIndex + 1} of {gameQueue.length}  ·  {current.emoji} {current.title}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTooltip(true)} activeOpacity={0.7}>
              <Text style={styles.iconBtnText}>ℹ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Game component */}
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
          config={{ variant: (cfg.variant as 'deduction' | 'patterns' | 'verbal' | 'boolean' | 'quantitative' | 'spatial' | 'situational' | 'attention') ?? 'deduction' }}
        />
      )}
      {current.gameType === 'reaction' && (
        <ReactionTestGame
          sessionId={sessionId}
          onComplete={handleGameComplete}
          config={{ variant: (cfg.variant as 'basic' | 'inhibition' | 'speed') ?? 'basic' }}
        />
      )}
      {current.gameType === 'stroop' && (
        <StroopGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'matrix' && (
        <MatrixPuzzleGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'spatial' && (
        <MentalRotationGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'estimation' && (
        <DotEstimationGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}
      {current.gameType === 'search' && (
        <VisualSearchGame sessionId={sessionId} onComplete={handleGameComplete} />
      )}

      {/* Rules tooltip modal */}
      <Modal visible={showTooltip} transparent animationType="fade" onRequestClose={() => setShowTooltip(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTooltip(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.tooltipCard}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipEmoji}>{current.emoji}</Text>
              <Text style={styles.tooltipTitle}>{current.title}</Text>
            </View>
            {rules && (
              <>
                <Text style={styles.tooltipSummary}>{rules.summary}</Text>
                <ScrollView style={styles.rulesList} showsVerticalScrollIndicator={false}>
                  {rules.bullets.map((rule, i) => (
                    <View key={i} style={styles.ruleRow}>
                      <Text style={styles.ruleBullet}>›</Text>
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            <TouchableOpacity style={styles.tooltipClose} onPress={() => setShowTooltip(false)}>
              <Text style={styles.tooltipCloseText}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Header
  header: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2a2a5e' },
  progressDone: { backgroundColor: '#3a6e3a' },
  progressActive: { backgroundColor: '#5c6bc0', transform: [{ scale: 1.3 }] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: { color: '#5555aa', fontSize: 12, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#2a2a5e',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { color: '#5c6bc0', fontSize: 15, fontWeight: 'bold' },
  skipBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#2a2a5e',
  },
  skipBtnText: { color: '#7777aa', fontSize: 12, fontWeight: '600' },

  // Tooltip modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltipCard: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    maxHeight: '80%',
  },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tooltipEmoji: { fontSize: 28 },
  tooltipTitle: { color: '#e0e0ff', fontSize: 18, fontWeight: '700', flex: 1 },
  tooltipSummary: { color: '#9999cc', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  rulesList: { maxHeight: 180 },
  ruleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ruleBullet: { color: '#5c6bc0', fontSize: 16, lineHeight: 20, width: 12 },
  ruleText: { color: '#c0c0ee', fontSize: 14, lineHeight: 20, flex: 1 },
  tooltipClose: {
    marginTop: 20,
    backgroundColor: '#5c6bc0',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tooltipCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
