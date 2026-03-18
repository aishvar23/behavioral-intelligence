/**
 * Stroop Task
 * A color word appears in a mismatching ink color.
 * Tap the INK color — ignore what the word says.
 * Measures: impulse_control, processing_speed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const WORDS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;
type CW = typeof WORDS[number];

const COLORS: Record<CW, string> = {
  RED: '#ef5350', BLUE: '#42a5f5', GREEN: '#66bb6a', YELLOW: '#ffd54f',
};

const TOTAL_TRIALS = 20;
const TRIAL_MS = 3500;

function newTrial(): { word: CW; ink: CW } {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const others = WORDS.filter(w => w !== word);
  const ink = others[Math.floor(Math.random() * others.length)];
  return { word, ink };
}

export default function StroopGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [trial, setTrial] = useState(newTrial());
  const [trialNum, setTrialNum] = useState(0);
  const [timerPct, setTimerPct] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const scoreRef = useRef(0);
  const trialStart = useRef(0);
  const answered = useRef(false);
  const interval = useRef<ReturnType<typeof setInterval>>();

  const advance = useCallback((pts: number, next: number) => {
    scoreRef.current += pts;
    if (next >= TOTAL_TRIALS) {
      setPhase('done');
      onComplete(scoreRef.current);
      return;
    }
    setTrial(newTrial());
    setTrialNum(next);
    setFeedback(null);
    setTimerPct(1);
    answered.current = false;
    trialStart.current = Date.now();
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    answered.current = false;
    trialStart.current = Date.now();
    interval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - trialStart.current) / TRIAL_MS);
      setTimerPct(pct);
      if (pct === 0 && !answered.current) {
        clearInterval(interval.current);
        answered.current = true;
        void logEvent({ sessionId, gameId: 'stroop', eventType: 'color_tapped', timestamp: Date.now(), data: { correct: false, responseTime: TRIAL_MS, tapped: null, inkColor: trial.ink, word: trial.word, timedOut: true } });
        setFeedback('wrong');
        setTimeout(() => advance(0, trialNum + 1), 600);
      }
    }, 50);
    return () => clearInterval(interval.current);
  }, [phase, trialNum]);

  function handleTap(tapped: CW) {
    if (answered.current || phase !== 'playing') return;
    clearInterval(interval.current);
    answered.current = true;
    const rt = Date.now() - trialStart.current;
    const isCorrect = tapped === trial.ink;
    const pts = isCorrect ? Math.max(5, Math.round(15 * (1 - rt / TRIAL_MS))) : 0;
    void logEvent({ sessionId, gameId: 'stroop', eventType: 'color_tapped', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, tapped, inkColor: trial.ink, word: trial.word } });
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => advance(pts, trialNum + 1), 600);
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>🎨</Text>
      <Text style={s.title}>Color Conflict</Text>
      <Text style={s.desc}>
        A color word will appear in a different ink color.{'\n\n'}
        Tap the <Text style={s.em}>ink color</Text> — ignore what the word says!
      </Text>
      <View style={s.exBox}>
        <Text style={[s.exWord, { color: COLORS.BLUE }]}>RED</Text>
        <Text style={s.exLabel}>→ tap BLUE (the ink color)</Text>
      </View>
      <TouchableOpacity style={s.startBtn} onPress={() => setPhase('playing')}>
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

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.counter}>{trialNum + 1}/{TOTAL_TRIALS}</Text>
        <View style={s.timerTrack}>
          <View style={[s.timerFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerPct > 0.35 ? '#5c6bc0' : '#ef5350' }]} />
        </View>
        <Text style={s.scoreTxt}>{scoreRef.current}pt</Text>
      </View>

      <View style={s.wordArea}>
        <Text style={[s.colorWord, { color: COLORS[trial.ink] }]}>{trial.word}</Text>
        <Text style={s.hint}>Tap the ink color</Text>
        {feedback && <Text style={[s.fbTxt, { color: feedback === 'correct' ? '#66bb6a' : '#ef5350' }]}>{feedback === 'correct' ? '✓' : '✗'}</Text>}
      </View>

      <View style={s.btnGrid}>
        {WORDS.map(w => (
          <TouchableOpacity key={w} style={[s.colorBtn, { backgroundColor: COLORS[w] }, !!feedback && s.btnOff]} onPress={() => handleTap(w)} activeOpacity={0.85}>
            <Text style={s.btnLabel}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigEmoji: { fontSize: 52, marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  desc: { color: '#9999cc', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  em: { color: '#e0e0ff', fontWeight: '700' },
  exBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 32, width: '100%' },
  exWord: { fontSize: 40, fontWeight: '900', marginBottom: 8 },
  exLabel: { color: '#9999cc', fontSize: 13 },
  startBtn: { backgroundColor: '#5c6bc0', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  doneScore: { color: '#5c6bc0', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 50 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  wordArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  colorWord: { fontSize: 58, fontWeight: '900', letterSpacing: 3 },
  hint: { color: '#4a4a7a', fontSize: 13, marginTop: 12 },
  fbTxt: { fontSize: 36, fontWeight: 'bold', marginTop: 12 },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 16 },
  colorBtn: { width: '44%', paddingVertical: 22, borderRadius: 18, alignItems: 'center' },
  btnOff: { opacity: 0.55 },
  btnLabel: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
