import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { startSession } from '../services/session';

type GameId = 'exploration' | 'pattern' | 'puzzle';
type Scores = { exploration?: number; pattern?: number; puzzle?: number };
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const GAMES: Array<{
  id: GameId;
  emoji: string;
  label: string;
  description: string;
  tooltip: string;
}> = [
  {
    id: 'exploration',
    emoji: '🏝️',
    label: 'Exploration Island',
    description: 'Navigate a fog-covered 8×8 grid in 30 moves.',
    tooltip:
      'You start at the top-left corner of a mystery island covered in fog. Move one tile at a time to reveal what\'s hidden — collect 💎 rewards (+10 pts) and dodge 💀 traps (−5 pts). You have 30 moves. How much can you uncover?',
  },
  {
    id: 'pattern',
    emoji: '🔍',
    label: 'Hidden Pattern Game',
    description: 'Decode number sequences across 9 rounds of increasing difficulty.',
    tooltip:
      'A number sequence appears with a ? at the end. Figure out the rule and type what comes next. Difficulty rises every 3 rounds — from simple alternating gaps (Easy) to interleaved tracks and Fibonacci-style rules (Hard). Score more by guessing correctly first try.',
  },
  {
    id: 'puzzle',
    emoji: '🧩',
    label: 'Impossible Puzzle',
    description: 'Slide tiles into order — deceptively hard.',
    tooltip:
      'A 3×3 sliding tile puzzle. Tap any tile next to the blank space to slide it in. Goal: arrange tiles 1–8 in order. You have 3 hints available. Solve it in as few moves as possible — or press Skip Game if you\'re well and truly stuck.',
  },
];

export default function HomeScreen({ navigation, route }: Props) {
  const sessionIdRef = useRef<string>(startSession());
  const [scores, setScores] = useState<Scores>({});
  const [tooltipGame, setTooltipGame] = useState<GameId | null>(null);

  // Absorb score passed back from a completed game
  useEffect(() => {
    const params = route.params;
    if (params?.completedGame !== undefined && params?.score !== undefined) {
      setScores(prev => ({ ...prev, [params.completedGame!]: params.score }));
    }
  }, [route.params]);

  function launchGame(id: GameId) {
    navigation.navigate('Game', { gameId: id, sessionId: sessionIdRef.current });
  }

  function goToCareerSelection() {
    navigation.navigate('CareerSelection', {
      sessionId: sessionIdRef.current,
      scores: {
        exploration: scores.exploration ?? 0,
        pattern: scores.pattern ?? 0,
        puzzle: scores.puzzle ?? 0,
      },
    });
  }

  const completedCount = Object.values(scores).filter(v => v !== undefined).length;
  const tooltipInfo = GAMES.find(g => g.id === tooltipGame);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Behavioral Intelligence</Text>
      <Text style={styles.subtitle}>Pick a game to discover your cognitive profile.</Text>

      <View style={styles.games}>
        {GAMES.map(game => {
          const isDone = scores[game.id] !== undefined;
          return (
            <TouchableOpacity
              key={game.id}
              style={[styles.card, isDone && styles.cardDone]}
              onPress={() => launchGame(game.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{game.label}</Text>
                <Text style={styles.cardDesc}>{game.description}</Text>
              </View>
              <View style={styles.cardRight}>
                {isDone && (
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreChipText}>{scores[game.id]}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => setTooltipGame(game.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.infoBtnText}>ℹ</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {completedCount > 0 && (
        <TouchableOpacity style={styles.reportBtn} onPress={goToCareerSelection}>
          <Text style={styles.reportBtnText}>
            {completedCount === 3
              ? 'View My Report →'
              : `Continue to Report  (${completedCount}/3 games done) →`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tooltip modal */}
      <Modal
        visible={tooltipGame !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltipGame(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTooltipGame(null)}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {tooltipInfo?.emoji}  {tooltipInfo?.label}
            </Text>
            <Text style={styles.modalText}>{tooltipInfo?.tooltip}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setTooltipGame(null)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0e0ff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#9999cc',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  games: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  cardDone: {
    borderColor: '#3a6e3a',
    backgroundColor: '#162416',
  },
  cardEmoji: { fontSize: 26 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 16, color: '#e0e0ff', fontWeight: '700', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#7777aa', lineHeight: 17 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  scoreChip: {
    backgroundColor: '#2e5c2e',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreChipText: { color: '#90ee90', fontSize: 13, fontWeight: '700' },
  infoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#5c6bc0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: { color: '#9999cc', fontSize: 13 },
  reportBtn: {
    backgroundColor: '#5c6bc0',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  reportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3a3a6e',
    width: '100%',
  },
  modalTitle: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold', marginBottom: 14 },
  modalText: { color: '#aaaacc', fontSize: 14, lineHeight: 22 },
  modalClose: {
    marginTop: 20,
    backgroundColor: '#5c6bc0',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
