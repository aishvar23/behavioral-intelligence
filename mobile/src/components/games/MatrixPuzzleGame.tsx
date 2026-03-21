/**
 * Matrix Puzzle Game (Pattern Matrix / Raven-style)
 * A 3×3 grid of cells with one missing. Each puzzle has TWO independent rules:
 *   1. Shape rule  — which shape appears in each cell
 *   2. Count rule  — how many of that shape appear (1, 2, or 3)
 *   3. Color rule  — background color of the cell
 *
 * Four puzzle types vary which dimension follows which axis rule,
 * preventing the player from memorising a single strategy.
 * Measures: analytical_thinking, learning_speed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 8;
const TIME_PER_ROUND = 22_000;

const SHAPES = ['●', '■', '▲'];
const BG_COLORS = ['#1e0d3e', '#0d1e3e', '#0d3e1e'];
const FG_COLORS = ['#c084fc', '#60a5fa', '#4ade80'];

// All 6 permutations of [0,1,2]
const PERMS = [
  [0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0],
];

interface Cell { shape: string; bgColor: string; fgColor: string; count: 1|2|3 }

// ── Puzzle type definitions ───────────────────────────────────────────────────
// Each type is a different combination of shape/color/count rules across axes.
// sp = shape perm index, cp = color perm index (each 0-5 from PERMS)

type PuzzleType = 'A'|'B'|'C'|'D';

function buildPuzzle(round: number): {
  grid: (Cell|null)[][]; answer: Cell; distractors: Cell[]; typeLabel: string
} {
  // Cycle through 4 types, 2 rounds each → 8 unique styles per game
  const type: PuzzleType = (['A','B','C','D'] as PuzzleType[])[Math.floor(round / 2) % 4];
  const sp = PERMS[round % PERMS.length];
  const cp = PERMS[(round + 2) % PERMS.length];
  const ctp = PERMS[(round + 4) % PERMS.length]; // count permutation

  function cell(r: number, c: number): Cell {
    let shapeIdx: number, colIdx: number, count: 1|2|3;
    switch (type) {
      case 'A':
        // Shape cycles diagonally; color fixed per column; count = 1
        shapeIdx = sp[(r + c) % 3];
        colIdx   = cp[c];
        count    = 1;
        break;
      case 'B':
        // Shape fixed per row; color fixed per column; count cycles diagonally
        shapeIdx = sp[r % 3];
        colIdx   = cp[c];
        count    = ([1,2,3] as (1|2|3)[])[ctp[(r + c) % 3]];
        break;
      case 'C':
        // Shape cycles diagonally; color fixed per row; count fixed per column
        shapeIdx = sp[(r + c) % 3];
        colIdx   = cp[r];
        count    = ([1,2,3] as (1|2|3)[])[ctp[c]];
        break;
      case 'D':
        // Shape fixed per column; color cycles diagonally; count fixed per row
        shapeIdx = sp[c % 3];
        colIdx   = cp[(r + c) % 3];
        count    = ([1,2,3] as (1|2|3)[])[ctp[r]];
        break;
    }
    return { shape: SHAPES[shapeIdx], bgColor: BG_COLORS[colIdx], fgColor: FG_COLORS[colIdx], count };
  }

  const grid: (Cell|null)[][] = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c): Cell|null => (r === 2 && c === 2) ? null : cell(r, c))
  );

  const answer = cell(2, 2);

  // Thoughtful distractors: each satisfies some rules but not all
  const wrongShapeCell = cell(2, 2);
  wrongShapeCell.shape = SHAPES[(SHAPES.indexOf(answer.shape) + 1) % 3];

  const wrongCountCell = { ...answer, count: ([1,2,3] as (1|2|3)[])[(answer.count % 3)] }; // count + 1, wraps

  const wrongColorCell = { ...answer, bgColor: BG_COLORS[(BG_COLORS.indexOf(answer.bgColor) + 1) % 3], fgColor: FG_COLORS[(FG_COLORS.indexOf(answer.bgColor) + 1) % 3] };

  const allWrong: Cell = {
    shape: SHAPES[(SHAPES.indexOf(answer.shape) + 2) % 3],
    bgColor: BG_COLORS[(BG_COLORS.indexOf(answer.bgColor) + 2) % 3],
    fgColor: FG_COLORS[(FG_COLORS.indexOf(answer.bgColor) + 2) % 3],
    count: ([1,2,3] as (1|2|3)[])[(answer.count + 1) % 3],
  };

  const typeLabels: Record<PuzzleType, string> = {
    A: 'Diagonal shape + column colour',
    B: 'Row shape + column colour + diagonal count',
    C: 'Diagonal shape + row colour + column count',
    D: 'Column shape + diagonal colour + row count',
  };

  return { grid, answer, distractors: [wrongShapeCell, wrongCountCell, wrongColorCell, allWrong].slice(0,3), typeLabel: typeLabels[type] };
}

// ── Cell renderer ─────────────────────────────────────────────────────────────

function CellView({ cell, size = 52 }: { cell: Cell|null; size?: number }) {
  if (!cell) {
    return (
      <View style={[cv.cell, { width: size, height: size, backgroundColor: '#0a0a1a', borderColor: '#5c6bc0', borderStyle: 'dashed' }]}>
        <Text style={cv.question}>?</Text>
      </View>
    );
  }
  const { shape, bgColor, fgColor, count } = cell;
  const fontSize = count === 1 ? 22 : count === 2 ? 16 : 12;
  return (
    <View style={[cv.cell, { width: size, height: size, backgroundColor: bgColor }]}>
      <View style={cv.shapeRow}>
        {Array.from({ length: count }, (_, i) => (
          <Text key={i} style={[cv.shape, { color: fgColor, fontSize }]}>{shape}</Text>
        ))}
      </View>
    </View>
  );
}

const cv = StyleSheet.create({
  cell: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a5e' },
  question: { color: '#5c6bc0', fontSize: 22, fontWeight: 'bold' },
  shapeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 2 },
  shape: { fontWeight: 'bold' },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function MatrixPuzzleGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro'|'playing'|'done'>('intro');
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState<(Cell|null)[][]>([]);
  const [options, setOptions] = useState<Cell[]>([]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const [ruleHint, setRuleHint] = useState('');
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const answered = useRef(false);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();

  const startRound = useCallback((r: number) => {
    const { grid: newGrid, answer, distractors, typeLabel } = buildPuzzle(r);
    setGrid(newGrid);
    setRuleHint(typeLabel);
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
        setShowTimeoutDialog(true);
      }
    }, 80);
    return () => clearInterval(timerInterval.current);
  }, [phase, round, timerKey]);

  function handleMoreTime() {
    logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'timeout_extended',
      timestamp: Date.now(), data: { round, extensionSecs: 20 } }).catch(() => {});
    roundStart.current = Date.now();
    answered.current = false;
    setShowTimeoutDialog(false);
    setTimerKey(k => k + 1);
  }

  function handleSkipRound() {
    logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'timeout_skip',
      timestamp: Date.now(), data: { round } }).catch(() => {});
    answered.current = true;
    void logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'option_selected', timestamp: Date.now(), data: { correct: false, responseTime: TIME_PER_ROUND, selectedIdx: null, correctIdx, round, timedOut: true } });
    setSelected(-1);
    setShowTimeoutDialog(false);
    advance(round + 1);
  }

  function handleOption(idx: number) {
    if (answered.current || phase !== 'playing') return;
    clearInterval(timerInterval.current);
    answered.current = true;
    const rt = Date.now() - roundStart.current;
    const isCorrect = idx === correctIdx;
    // Harder rounds (later = more rules to track) award more base points
    const difficultyBonus = Math.floor(round / 2) * 5;
    const pts = isCorrect ? Math.max(5, Math.round((20 + difficultyBonus) * timerPct)) : 0;
    scoreRef.current += pts;
    void logEvent({ sessionId, gameId: 'matrix_puzzle', eventType: 'option_selected', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, selectedIdx: idx, correctIdx, round } });
    setSelected(idx);
    setTimeout(() => advance(round + 1), isCorrect ? 900 : 5000);
  }

  function advance(next: number) {
    if (next >= ROUNDS) { setPhase('done'); onComplete(scoreRef.current); }
    else { setRound(next); startRound(next); }
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>🔲</Text>
      <Text style={s.title}>Pattern Matrix</Text>
      <Text style={s.desc}>
        A 3×3 grid of shapes — one cell is missing.{'\n\n'}
        Each puzzle has <Text style={s.em}>two hidden rules</Text>: one for the shapes,{'\n'}one for the count, one for the colors.{'\n\n'}
        Find all the rules and pick the missing piece.
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

      {/* Timeout dialog overlay */}
      {showTimeoutDialog && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10,10,30,0.92)',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 32,
        }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>⏰</Text>
          <Text style={{ color: '#e0e0ff', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>Time's Up!</Text>
          <Text style={{ color: '#9999cc', fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
            Do you need more time, or would you like to skip this one?
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#5c6bc0', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, marginBottom: 14, width: '100%', alignItems: 'center' }}
            onPress={handleMoreTime}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>⏱ Take More Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: '#1e1e3e', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, borderWidth: 1, borderColor: '#3a3a6e', width: '100%', alignItems: 'center' }}
            onPress={handleSkipRound}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#9999cc', fontSize: 16 }}>Skip →</Text>
          </TouchableOpacity>
        </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 80 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  matrixSection: { alignItems: 'center', marginBottom: 14 },
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
