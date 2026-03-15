import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { logEvent } from '../../services/api';

type Variant = 'colors' | 'numbers' | 'positions';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: { variant: Variant };
}

const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da'];
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Orange', 'Purple', 'Cyan'];
const TOTAL_ROUNDS = 5;
const BASE_SEQUENCE_LENGTH = 4; // grows by 1 per round

type Phase = 'intro' | 'showing' | 'recall' | 'feedback' | 'done';

function buildSequence(length: number, variant: Variant): number[] {
  const max = variant === 'positions' ? 9 : variant === 'numbers' ? 9 : 6;
  return Array.from({ length }, () => Math.floor(Math.random() * max));
}

export default function MemorySequenceGame({ sessionId, onComplete, config }: Props) {
  const variant = config.variant ?? 'colors';
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [showIndex, setShowIndex] = useState(-1); // which item is currently flashing
  const [userInput, setUserInput] = useState<number[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [roundStart, setRoundStart] = useState(0);
  const flashAnim = useRef(new Animated.Value(1)).current;

  const startRound = useCallback((r: number) => {
    const len = BASE_SEQUENCE_LENGTH + (r - 1);
    const seq = buildSequence(len, variant);
    setSequence(seq);
    setUserInput([]);
    setShowIndex(-1);
    setPhase('showing');
    setRoundStart(Date.now());

    let i = 0;
    const show = () => {
      if (i >= seq.length) {
        setTimeout(() => { setShowIndex(-1); setPhase('recall'); }, 400);
        return;
      }
      setShowIndex(i);
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      i++;
      setTimeout(show, 800);
    };
    setTimeout(show, 600);
  }, [variant, flashAnim]);

  function handleTap(index: number) {
    if (phase !== 'recall') return;
    const next = [...userInput, index];
    setUserInput(next);

    if (next.length === sequence.length) {
      const correct = next.every((v, i) => v === sequence[i]);
      const elapsed = (Date.now() - roundStart) / 1000;
      const roundScore = correct ? Math.round(20 * round * Math.max(0.5, 1 - elapsed / 30)) : 0;
      const newTotal = totalScore + roundScore;
      setTotalScore(newTotal);
      setLastCorrect(correct);
      setPhase('feedback');

      logEvent({
        sessionId,
        gameId: `memory_${variant}`,
        eventType: 'round_complete',
        timestamp: Date.now(),
        data: { round, correct, sequenceLength: sequence.length, responseTime: elapsed * 1000 },
      }).catch(() => {});

      setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          logEvent({
            sessionId,
            gameId: `memory_${variant}`,
            eventType: 'game_complete',
            timestamp: Date.now(),
            data: { score: newTotal },
          }).catch(() => {});
          setPhase('done');
          onComplete(newTotal);
        } else {
          setRound(r => r + 1);
          startRound(round + 1);
        }
      }, 1200);
    }
  }

  const itemCount = variant === 'colors' ? 6 : variant === 'numbers' ? 9 : 9;
  const isActive = (i: number) => showIndex === i || (phase === 'recall' && userInput.includes(i));
  const tapCount = userInput.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {variant === 'colors' ? '🌈 Color Memory' : variant === 'numbers' ? '🔢 Number Recall' : '🗂️ Spatial Memory'}
        </Text>
        <Text style={styles.sub}>Round {round} / {TOTAL_ROUNDS}  ·  Score: {totalScore}</Text>
      </View>

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>
            {variant === 'colors'
              ? 'Watch the colors light up in sequence.\nThen tap them back in the same order.'
              : variant === 'numbers'
              ? 'Watch which numbers highlight in sequence.\nThen tap them back in order.'
              : 'Watch which cells highlight.\nThen tap them back in order.'}
          </Text>
          <Text style={styles.infoSub}>Sequence grows each round.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => startRound(1)}>
            <Text style={styles.btnText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {(phase === 'showing' || phase === 'recall') && (
        <>
          <Text style={styles.phaseLabel}>
            {phase === 'showing'
              ? `Memorize ${sequence.length} items...`
              : `Recall — ${tapCount}/${sequence.length} tapped`}
          </Text>

          {/* Grid */}
          <View style={[styles.grid, variant === 'positions' || variant === 'numbers' ? styles.grid3 : styles.grid3]}>
            {Array.from({ length: itemCount }, (_, i) => {
              const lit = showIndex === i;
              const tapped = userInput.includes(i);
              const bgColor = variant === 'colors'
                ? (lit || tapped ? COLORS[i] : '#16213e')
                : '#16213e';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.cell,
                    variant === 'colors' && { backgroundColor: bgColor, borderColor: COLORS[i] },
                    variant !== 'colors' && lit && styles.cellLit,
                    variant !== 'colors' && tapped && styles.cellTapped,
                  ]}
                  onPress={() => phase === 'recall' && handleTap(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cellText, (lit || tapped) && styles.cellTextLit]}>
                    {variant === 'numbers' ? String(i + 1) : variant === 'colors' ? '' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {phase === 'feedback' && (
        <View style={styles.center}>
          <Text style={[styles.feedbackText, lastCorrect ? styles.correct : styles.wrong]}>
            {lastCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </Text>
          <Text style={styles.feedbackSub}>
            {lastCorrect ? `+${Math.round(20 * round)} pts` : 'Sequence was: ' + sequence.map(v => variant === 'numbers' ? v + 1 : v).join(' → ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  header: { marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  sub: { color: '#9999cc', fontSize: 13, textAlign: 'center', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  infoText: { color: '#c0c0ee', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  infoSub: { color: '#6666aa', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: '#5c6bc0', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  phaseLabel: { color: '#9999cc', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  grid3: { maxWidth: 280, alignSelf: 'center' },
  cell: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: '#16213e', borderWidth: 2, borderColor: '#2a2a5e',
    alignItems: 'center', justifyContent: 'center',
  },
  cellLit: { backgroundColor: '#5c6bc0', borderColor: '#9999ff' },
  cellTapped: { backgroundColor: '#2e5c2e', borderColor: '#66bb6a' },
  cellText: { color: '#5555aa', fontSize: 20, fontWeight: 'bold' },
  cellTextLit: { color: '#fff' },
  feedbackText: { fontSize: 36, fontWeight: 'bold' },
  feedbackSub: { color: '#aaaacc', fontSize: 14, textAlign: 'center' },
  correct: { color: '#66bb6a' },
  wrong: { color: '#ef5350' },
});
