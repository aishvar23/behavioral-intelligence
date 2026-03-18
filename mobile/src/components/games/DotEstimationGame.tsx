/**
 * Dot Estimation Game
 * Two groups of dots flash briefly. Tap the side with more dots.
 * Measures: analytical_thinking (numerical intuition), processing_speed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const TOTAL_TRIALS = 14;
const FLASH_MS = 800;
const RESPOND_MS = 3000;

// Ratios: [smaller, larger] — harder = closer ratio
const TRIAL_CONFIGS = [
  { a: 6,  b: 12 }, // easy 1:2
  { a: 8,  b: 16 }, // easy 1:2
  { a: 9,  b: 15 }, // medium 3:5
  { a: 10, b: 16 }, // medium 5:8
  { a: 11, b: 17 }, // medium
  { a: 12, b: 18 }, // medium
  { a: 10, b: 14 }, // hard 5:7
  { a: 11, b: 15 }, // hard
  { a: 12, b: 16 }, // hard 3:4
  { a: 13, b: 17 }, // hard
  { a: 14, b: 18 }, // hard
  { a: 15, b: 20 }, // hard 3:4
  { a: 16, b: 20 }, // very hard 4:5
  { a: 17, b: 21 }, // very hard
];

// Generate random dot positions inside a W×H container (returns percentage offsets)
function genDots(count: number, seed: number): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = 8 + (s % 84);
    s = (s * 9301 + 49297) % 233280;
    const y = 8 + (s % 80);
    dots.push({ x, y });
  }
  return dots;
}

type Phase = 'intro' | 'flash' | 'respond' | 'feedback' | 'done';

export default function DotEstimationGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialNum, setTrialNum] = useState(0);
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [leftDots, setLeftDots] = useState<{ x: number; y: number }[]>([]);
  const [rightDots, setRightDots] = useState<{ x: number; y: number }[]>([]);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const scoreRef = useRef(0);
  const respondStart = useRef(0);
  const answered = useRef(false);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();

  const setupTrial = useCallback((index: number) => {
    const cfg = TRIAL_CONFIGS[index];
    const leftBigger = Math.random() < 0.5;
    const lCount = leftBigger ? cfg.b : cfg.a;
    const rCount = leftBigger ? cfg.a : cfg.b;
    const seed = Date.now();
    setLeftCount(lCount);
    setRightCount(rCount);
    setLeftDots(genDots(lCount, seed));
    setRightDots(genDots(rCount, seed + 1000));
    setCorrect(null);
    setTimerPct(1);
    answered.current = false;
    setPhase('flash');
  }, []);

  useEffect(() => {
    if (phase !== 'flash') return;
    const t = setTimeout(() => {
      respondStart.current = Date.now();
      setPhase('respond');
    }, FLASH_MS);
    return () => clearTimeout(t);
  }, [phase, trialNum]);

  useEffect(() => {
    if (phase !== 'respond') return;
    timerInterval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - respondStart.current) / RESPOND_MS);
      setTimerPct(pct);
      if (pct === 0 && !answered.current) {
        clearInterval(timerInterval.current);
        answered.current = true;
        void logEvent({ sessionId, gameId: 'dot_estimation', eventType: 'group_selected', timestamp: Date.now(), data: { correct: false, responseTime: RESPOND_MS, side: null, timedOut: true, ratio: TRIAL_CONFIGS[trialNum].a / TRIAL_CONFIGS[trialNum].b } });
        setCorrect(false);
        setPhase('feedback');
        setTimeout(() => advance(0, trialNum + 1), 800);
      }
    }, 50);
    return () => clearInterval(timerInterval.current);
  }, [phase, trialNum]);

  function handleSide(side: 'left' | 'right') {
    if (answered.current || phase !== 'respond') return;
    clearInterval(timerInterval.current);
    answered.current = true;
    const rt = Date.now() - respondStart.current;
    const pickedCount = side === 'left' ? leftCount : rightCount;
    const otherCount = side === 'left' ? rightCount : leftCount;
    const isCorrect = pickedCount > otherCount;
    const cfg = TRIAL_CONFIGS[trialNum];
    const ratio = cfg.a / cfg.b;
    const difficultyBonus = ratio > 0.7 ? 5 : ratio > 0.6 ? 3 : 0;
    const pts = isCorrect ? 10 + difficultyBonus : 0;
    void logEvent({ sessionId, gameId: 'dot_estimation', eventType: 'group_selected', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, side, ratio } });
    scoreRef.current += pts;
    setCorrect(isCorrect);
    setPhase('feedback');
    setTimeout(() => advance(0, trialNum + 1), 800);
  }

  function advance(pts: number, next: number) {
    void pts;
    if (next >= TOTAL_TRIALS) {
      setPhase('done');
      onComplete(scoreRef.current);
    } else {
      setTrialNum(next);
      setupTrial(next);
    }
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>⚫</Text>
      <Text style={s.title}>Dot Sense</Text>
      <Text style={s.desc}>
        Two groups of dots will flash briefly.{'\n\n'}
        Tap the side with <Text style={s.em}>more dots</Text>.{'\n'}
        You can't count — use your instinct!
      </Text>
      <TouchableOpacity style={s.startBtn} onPress={() => setupTrial(0)}>
        <Text style={s.startBtnTxt}>Start →</Text>
      </TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>✅</Text>
      <Text style={s.title}>Complete!</Text>
      <Text style={s.doneScore}>{scoreRef.current} pts</Text>
    </View>
  );

  const showDots = phase === 'flash';
  const showButtons = phase === 'respond' || phase === 'feedback';

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.counter}>{trialNum + 1}/{TOTAL_TRIALS}</Text>
        <View style={s.timerTrack}>
          <View style={[s.timerFill, { width: `${timerPct * 100}%` as any }]} />
        </View>
        <Text style={s.scoreTxt}>{scoreRef.current}pt</Text>
      </View>

      <Text style={s.instruction}>{showDots ? 'Watch...' : showButtons ? 'Which side had more?' : ''}</Text>

      <View style={s.panelRow}>
        {(['left', 'right'] as const).map(side => {
          const dots = side === 'left' ? leftDots : rightDots;
          return (
            <TouchableOpacity
              key={side}
              style={[
                s.dotPanel,
                phase === 'feedback' && correct !== null && {
                  borderColor: (side === 'left' ? leftCount : rightCount) > (side === 'left' ? rightCount : leftCount)
                    ? '#66bb6a' : '#2a2a5e',
                },
              ]}
              onPress={() => handleSide(side)}
              disabled={!showButtons}
              activeOpacity={0.85}
            >
              {showDots && dots.map((d, i) => (
                <View key={i} style={[s.dot, { left: `${d.x}%` as any, top: `${d.y}%` as any }]} />
              ))}
              {!showDots && (
                <Text style={s.sideLabel}>{side === 'left' ? '◀ LEFT' : 'RIGHT ▶'}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {phase === 'feedback' && correct !== null && (
        <Text style={[s.feedback, { color: correct ? '#66bb6a' : '#ef5350' }]}>
          {correct ? '✓ Correct' : '✗ Wrong'}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigEmoji: { fontSize: 52, marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  desc: { color: '#9999cc', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  em: { color: '#e0e0ff', fontWeight: '700' },
  startBtn: { backgroundColor: '#5c6bc0', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  doneScore: { color: '#5c6bc0', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 50 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3, backgroundColor: '#5c6bc0' },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  instruction: { color: '#7777aa', fontSize: 14, textAlign: 'center', marginBottom: 16, height: 22 },
  panelRow: { flex: 1, flexDirection: 'row', gap: 12 },
  dotPanel: {
    flex: 1, backgroundColor: '#16213e', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#2a2a5e',
    position: 'relative', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#e0e0ff' },
  sideLabel: { color: '#5555aa', fontSize: 14, fontWeight: '600' },
  feedback: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
});
