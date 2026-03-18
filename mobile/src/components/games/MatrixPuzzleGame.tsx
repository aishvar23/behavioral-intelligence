/**
 * Matrix Puzzle Game (Pattern Matrix / Raven-style)
 * A 3×3 grid of shapes. The bottom-right cell is missing.
 * Row rule: each row has all 3 shapes in cyclic order.
 * Column rule: each column has a consistent background color.
 * Pick the correct missing piece from 4 options.
 * Measures: analytical_thinking, learning_speed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 6;
const TIME_PER_ROUND = 20_000;

const SHAPES = ['●', '■', '▲'];
const BG_COLORS = ['#1e0d3e', '#0d1e3e', '#0d3e1e']; // purple, blue, green tones
const FG_COLORS = ['#c084fc', '#60a5fa', '#4ade80']; // matching foreground

// Permutations for shape order per puzzle
const SHAPE_PERMS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];
// Permutations for bg color per column
const COLOR_PERMS = [
  [0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2], [2, 1, 0],
];

interface Cell {
  shape: string;
  bgColor: string;
  fgColor: string;
}

function buildPuzzle(round: number): { grid: (Cell | null)[][]; answer: Cell; distractors: Cell[] } {
  const shapeOrder = SHAPE_PERMS[round % SHAPE_PERMS.length];
  const colorOrder = COLOR_PERMS[round % COLOR_PERMS.length];

  // grid[r][c]: shape = SHAPES[shapeOrder[(r + c) % 3]], bgColor = BG_COLORS[colorOrder[c]]
  const grid: (Cell | null)[][] = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c): Cell | null => {
      if (r === 2 && c === 2) return null; // missing cell
      const shapeIdx = shapeOrder[(r + c) % 3];
      const colIdx = colorOrder[c];
      return { shape: SHAPES[shapeIdx], bgColor: BG_COLORS[colIdx], fgColor: FG_COLORS[colIdx] };
    })
  );

  // Derive correct answer for [2][2]
  const answerShapeIdx = shapeOrder[(2 + 2) % 3];
  const answerColIdx = colorOrder[2];
  const answer: Cell = {
    shape: SHAPES[answerShapeIdx],
    bgColor: BG_COLORS[answerColIdx],
    fgColor: FG_COLORS[answerColIdx],
  };

  // Generate 3 distractors: wrong shape + right color, right shape + wrong color, wrong both
  const wrongShapeIdx = (answerShapeIdx + 1) % 3;
  const wrongColIdx = (answerColIdx + 1) % 3;
  const distractors: Cell[] = [
    { shape: SHAPES[wrongShapeIdx], bgColor: BG_COLORS[answerColIdx], fgColor: FG_COLORS[answerColIdx] },
    { shape: SHAPES[answerShapeIdx], bgColor: BG_COLORS[wrongColIdx], fgColor: FG_COLORS[wrongColIdx] },
    { shape: SHAPES[(answerShapeIdx + 2) % 3], bgColor: BG_COLORS[(answerColIdx + 2) % 3], fgColor: FG_COLORS[(answerColIdx + 2) % 3] },
  ];

  return { grid, answer, distractors };
}

function CellView({ cell, size = 52 }: { cell: Cell | null; size?: number }) {
  if (!cell) {
    return (
      <View style={[cv.cell, { width: size, height: size, backgroundColor: '#0a0a1a', borderColor: '#5c6bc0', borderStyle: 'dashed' }]}>
        <Text style={cv.question}>?</Text>
      </View>
    );
  }
  return (
    <View style={[cv.cell, { width: size, height: size, backgroundColor: cell.bgColor }]}>
      <Text style={[cv.shape, { color: cell.fgColor }]}>{cell.shape}</Text>
    </View>
  );
}

const cv = StyleSheet.create({
  cell: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a5e' },
  question: { color: '#5c6bc0', fontSize: 22, fontWeight: 'bold' },
  shape: { fontSize: 24, fontWeight: 'bold' },
});

export default function MatrixPuzzleGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState<(Cell | null)[][]>([]);
  const [options, setOptions] = useState<Cell[]>([]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const answered = useRef(false);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();

  const startRound = useCallback((r: number) => {
    const { grid: newGrid, answer, distractors } = buildPuzzle(r);
    setGrid(newGrid);
    // Shuffle answer into options
    const allOptions = [...distractors];
    const ci = Math.floor(Math.random() * 4);
    allOptions.splice(ci, 0, answer);
    setOptions(allOptions);
    setCorrectIdx(ci);
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
        void logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'option_selected', timestamp: Date.now(), data: { correct: false, responseTime: TIME_PER_ROUND, selectedIdx: null, correctIdx, round, timedOut: true } });
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
    const pts = isCorrect ? Math.max(5, Math.round(25 * timerPct)) : 0;
    scoreRef.current += pts;
    void logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'option_selected', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, selectedIdx: idx, correctIdx, round, difficulty: round < 2 ? 'easy' : round < 4 ? 'medium' : 'hard' } });
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
      <Text style={s.bigEmoji}>🔲</Text>
      <Text style={s.title}>Pattern Matrix</Text>
      <Text style={s.desc}>
        A 3×3 grid of shapes appears — one cell is missing.{'\n\n'}
        Find the <Text style={s.em}>pattern in the rows and columns</Text>,{'\n'}then pick the missing piece.
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

      {/* 3×3 matrix */}
      <View style={s.matrixSection}>
        <View style={s.matrix}>
          {grid.map((row, r) => (
            <View key={r} style={s.matrixRow}>
              {row.map((cell, c) => (
                <CellView key={c} cell={cell} size={76} />
              ))}
            </View>
          ))}
        </View>
      </View>

      <Text style={s.question}>Which piece completes the pattern?</Text>

      {/* 4 options */}
      <View style={s.optionsGrid}>
        {options.map((opt, idx) => {
          let borderColor = '#2a2a5e';
          let opacity = 1;
          if (selected !== null) {
            if (idx === correctIdx) borderColor = '#66bb6a';
            else if (idx === selected) borderColor = '#ef5350';
            else opacity = 0.5;
          }
          return (
            <TouchableOpacity
              key={idx}
              style={[s.optionBtn, { borderColor, opacity }]}
              onPress={() => handleOption(idx)}
              activeOpacity={0.8}
              disabled={selected !== null}
            >
              <Text style={s.optionLetter}>{String.fromCharCode(65 + idx)}</Text>
              <CellView cell={opt} size={52} />
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
  matrixSection: { alignItems: 'center', marginBottom: 16 },
  matrix: { gap: 6 },
  matrixRow: { flexDirection: 'row', gap: 6 },
  question: { color: '#9999cc', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  optionBtn: {
    width: '44%', backgroundColor: '#16213e',
    borderRadius: 14, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 6,
  },
  optionLetter: { color: '#5555aa', fontSize: 11, fontWeight: '700' },
});
