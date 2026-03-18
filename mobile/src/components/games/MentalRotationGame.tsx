/**
 * Mental Rotation Game
 * A shape is shown. Four options appear — one is the same shape rotated.
 * Pick the correct rotation (not a mirror image, not a different shape).
 * Measures: analytical_thinking (spatial), systematic_thinking
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 8;
const TIME_PER_ROUND = 12_000;

// Shapes as [row, col] pairs in a 4×4 grid
const BASE_SHAPES: [number, number][][] = [
  [[0,0],[1,0],[2,0],[2,1]],           // L
  [[0,1],[1,1],[2,0],[2,1]],           // J
  [[0,0],[0,1],[0,2],[1,1]],           // T
  [[0,1],[0,2],[1,0],[1,1]],           // S
  [[0,0],[0,1],[1,1],[1,2]],           // Z
  [[0,0],[1,0],[2,0],[3,0]],           // I
  [[0,0],[0,1],[1,0],[2,0],[2,1]],     // P
  [[0,0],[0,1],[0,2],[1,2],[2,2]],     // F
];

function rot90([r, c]: [number, number]): [number, number] {
  return [c, 3 - r];
}

function mirrorH([r, c]: [number, number]): [number, number] {
  return [r, 3 - c];
}

function applyAll(cells: [number, number][], fn: (p: [number, number]) => [number, number]): [number, number][] {
  return cells.map(fn);
}

function normalize(cells: [number, number][]): [number, number][] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

function rotate(cells: [number, number][], times: number): [number, number][] {
  let result = cells;
  for (let i = 0; i < times; i++) result = applyAll(result, rot90);
  return normalize(result);
}

function generateRound(shapeIdx: number): {
  target: [number, number][];
  options: [number, number][][];
  correctIdx: number;
} {
  const base = normalize(BASE_SHAPES[shapeIdx % BASE_SHAPES.length]);
  const targetRot = Math.floor(Math.random() * 4);
  const target = rotate(base, targetRot);

  // Correct: a different rotation of the same shape
  const correctRot = (targetRot + 1 + Math.floor(Math.random() * 3)) % 4;
  const correct = rotate(base, correctRot);

  // Wrong 1: mirror of the shape (different rotation)
  const mirror = normalize(applyAll(rotate(base, correctRot), mirrorH));

  // Wrong 2 & 3: different base shapes
  const otherIdx1 = (shapeIdx + 1) % BASE_SHAPES.length;
  const otherIdx2 = (shapeIdx + 2) % BASE_SHAPES.length;
  const wrong2 = normalize(BASE_SHAPES[otherIdx1]);
  const wrong3 = normalize(BASE_SHAPES[otherIdx2]);

  // Build 4 options: shuffle correct into a random slot
  const wrongOptions = [mirror, wrong2, wrong3];
  const slots = [0, 1, 2, 3];
  const correctIdx = Math.floor(Math.random() * 4);
  const wrongs = wrongOptions.slice(0, 3);
  const options: [number, number][][] = [];
  let wi = 0;
  for (let i = 0; i < 4; i++) {
    if (i === correctIdx) options.push(correct);
    else options.push(wrongs[wi++]);
  }

  return { target, options, correctIdx };
}

function ShapeGrid({ cells, size = 28, color = '#5c6bc0' }: { cells: [number, number][]; size?: number; color?: string }) {
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  const rows = 4, cols = 4;
  return (
    <View style={{ gap: 2 }}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: cols }, (_, c) => (
            <View
              key={c}
              style={{
                width: size, height: size, borderRadius: 4,
                backgroundColor: set.has(`${r},${c}`) ? color : '#0f1228',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function MentalRotationGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<[number, number][]>([]);
  const [options, setOptions] = useState<[number, number][][]>([]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const answered = useRef(false);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();

  const startRound = useCallback((r: number) => {
    const data = generateRound(r);
    setTarget(data.target);
    setOptions(data.options);
    setCorrectIdx(data.correctIdx);
    setSelected(null);
    setTimerPct(1);
    answered.current = false;
    roundStart.current = Date.now();
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerInterval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - roundStart.current) / TIME_PER_ROUND);
      setTimerPct(pct);
      if (pct === 0 && !answered.current) {
        clearInterval(timerInterval.current);
        answered.current = true;
        void logEvent({ sessionId, gameId: 'spatial_rotation', eventType: 'option_selected', timestamp: Date.now(), data: { correct: false, responseTime: TIME_PER_ROUND, selectedIdx: null, correctIdx, round, timedOut: true } });
        setSelected(-1);
        setTimeout(() => advance(round + 1, 0), 900);
      }
    }, 80);
    return () => clearInterval(timerInterval.current);
  }, [phase, round]);

  function handleOption(idx: number) {
    if (answered.current || phase !== 'playing') return;
    clearInterval(timerInterval.current);
    answered.current = true;
    const rt = Date.now() - roundStart.current;
    const isCorrect = idx === correctIdx;
    const pts = isCorrect ? Math.max(5, Math.round(20 * timerPct)) : 0;
    scoreRef.current += pts;
    void logEvent({ sessionId, gameId: 'spatial_rotation', eventType: 'option_selected', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, selectedIdx: idx, correctIdx, round } });
    setSelected(idx);
    setTimeout(() => advance(round + 1, pts), 900);
  }

  function advance(next: number, _pts: number) {
    if (next >= ROUNDS) {
      setPhase('done');
      onComplete(scoreRef.current);
    } else {
      setRound(next);
      startRound(next);
    }
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>🔷</Text>
      <Text style={s.title}>Mental Rotation</Text>
      <Text style={s.desc}>
        A shape is shown on the left.{'\n\n'}
        Pick the option that is the <Text style={s.em}>same shape, just rotated</Text>.{'\n'}
        Watch out for mirror images — they don't count!
      </Text>
      <TouchableOpacity style={s.startBtn} onPress={() => startRound(0)}>
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
      <View style={s.headerRow}>
        <Text style={s.counter}>Round {round + 1}/{ROUNDS}</Text>
        <View style={s.timerTrack}>
          <View style={[s.timerFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerPct > 0.35 ? '#5c6bc0' : '#ef5350' }]} />
        </View>
        <Text style={s.scoreTxt}>{scoreRef.current}pt</Text>
      </View>

      <View style={s.targetSection}>
        <Text style={s.sectionLabel}>TARGET SHAPE</Text>
        <View style={s.targetBox}>
          <ShapeGrid cells={target} size={32} color="#42a5f5" />
        </View>
      </View>

      <Text style={s.question}>Which option is the same shape, just rotated?</Text>

      <View style={s.optionsGrid}>
        {options.map((opt, idx) => {
          let borderColor = '#2a2a5e';
          let bgColor = '#16213e';
          if (selected !== null) {
            if (idx === correctIdx) { borderColor = '#66bb6a'; bgColor = '#0d2d1a'; }
            else if (idx === selected) { borderColor = '#ef5350'; bgColor = '#2d0d0d'; }
          }
          return (
            <TouchableOpacity
              key={idx}
              style={[s.optionBox, { borderColor, backgroundColor: bgColor }]}
              onPress={() => handleOption(idx)}
              activeOpacity={0.8}
              disabled={selected !== null}
            >
              <Text style={s.optionLetter}>{String.fromCharCode(65 + idx)}</Text>
              <ShapeGrid cells={opt} size={26} color={selected !== null && idx === correctIdx ? '#66bb6a' : '#9999cc'} />
            </TouchableOpacity>
          );
        })}
      </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 80 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  targetSection: { alignItems: 'center', marginBottom: 16 },
  sectionLabel: { color: '#5555aa', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  targetBox: { backgroundColor: '#0f1228', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#42a5f5' },
  question: { color: '#9999cc', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  optionBox: {
    width: '44%', borderRadius: 14, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 8,
  },
  optionLetter: { color: '#5555aa', fontSize: 12, fontWeight: '700' },
});
