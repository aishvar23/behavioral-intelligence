/**
 * Visual Search Game
 * A grid of symbols — most are identical, a few are different.
 * Find and tap the odd ones out.
 * Measures: attention_to_detail, processing_speed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 8;
const GRID_SIZE = 25; // 5×5
const COLS = 5;
const TIME_PER_ROUND = 30_000; // 30s

// Pairs of visually similar symbols
const SYMBOL_PAIRS = [
  { distractor: 'O', target: '0' },
  { distractor: '◉', target: '●' },
  { distractor: 'S', target: '5' },
  { distractor: '□', target: '■' },
  { distractor: 'Z', target: '2' },
  { distractor: 'M', target: 'N' },
  { distractor: '△', target: '▲' },
  { distractor: 'l', target: 'I' },
];

interface Cell {
  id: number;
  symbol: string;
  isTarget: boolean;
  tapped: boolean;
  wrong: boolean;
}

function buildGrid(round: number): { cells: Cell[]; targetCount: number } {
  const pair = SYMBOL_PAIRS[round % SYMBOL_PAIRS.length];
  const targetCount = round < 3 ? 2 : round < 6 ? 3 : 2;
  const positions = new Set<number>();
  while (positions.size < targetCount) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  const cells: Cell[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    symbol: positions.has(i) ? pair.target : pair.distractor,
    isTarget: positions.has(i),
    tapped: false,
    wrong: false,
  }));
  return { cells, targetCount };
}

export default function VisualSearchGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [targetCount, setTargetCount] = useState(2);
  const [foundCount, setFoundCount] = useState(0);
  const [timerPct, setTimerPct] = useState(1);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();

  const startRound = useCallback((r: number) => {
    const { cells: newCells, targetCount: tc } = buildGrid(r);
    setCells(newCells);
    setTargetCount(tc);
    setFoundCount(0);
    setTimerPct(1);
    roundStart.current = Date.now();
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerInterval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - roundStart.current) / TIME_PER_ROUND);
      setTimerPct(pct);
      if (pct === 0) {
        clearInterval(timerInterval.current);
        nextRound(round, false, 0);
      }
    }, 100);
    return () => clearInterval(timerInterval.current);
  }, [phase, round]);

  function handleCellTap(idx: number) {
    if (phase !== 'playing') return;
    const cell = cells[idx];
    if (cell.tapped || cell.wrong) return;

    const rt = Date.now() - roundStart.current;
    const isCorrect = cell.isTarget;
    void logEvent({ sessionId, gameId: 'visual_search', eventType: 'target_tapped', timestamp: Date.now(), data: { correct: isCorrect, responseTime: rt, round } });

    if (isCorrect) {
      const newFound = foundCount + 1;
      setCells(prev => prev.map((c, i) => i === idx ? { ...c, tapped: true } : c));
      setFoundCount(newFound);
      if (newFound >= targetCount) {
        clearInterval(timerInterval.current);
        const timeBonus = Math.round(timerPct * 10);
        const pts = 15 + timeBonus;
        scoreRef.current += pts;
        setTimeout(() => nextRound(round, true, pts), 600);
      }
    } else {
      setCells(prev => prev.map((c, i) => i === idx ? { ...c, wrong: true } : c));
      scoreRef.current = Math.max(0, scoreRef.current - 3);
      // Reset wrong highlight after a moment
      setTimeout(() => {
        setCells(prev => prev.map((c, i) => i === idx ? { ...c, wrong: false } : c));
      }, 500);
    }
  }

  function nextRound(currentRound: number, _completed: boolean, _pts: number) {
    const next = currentRound + 1;
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
      <Text style={s.bigEmoji}>🔍</Text>
      <Text style={s.title}>Symbol Hunt</Text>
      <Text style={s.desc}>
        A grid of symbols will appear.{'\n'}Most are the same — a few are different.{'\n\n'}
        Tap all the <Text style={s.em}>odd ones out</Text> as fast as you can!
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

  const pair = SYMBOL_PAIRS[round % SYMBOL_PAIRS.length];

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.counter}>Round {round + 1}/{ROUNDS}</Text>
        <View style={s.timerTrack}>
          <View style={[s.timerFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerPct > 0.4 ? '#5c6bc0' : '#ef5350' }]} />
        </View>
        <Text style={s.scoreTxt}>{scoreRef.current}pt</Text>
      </View>

      <Text style={s.instruction}>
        Find {targetCount - foundCount} more  ·  Found {foundCount}/{targetCount}
      </Text>

      <View style={s.exampleRow}>
        <Text style={s.exLabel}>Looking for: </Text>
        <Text style={s.exTarget}>{pair.target}</Text>
        <Text style={s.exLabel}>  in a grid of: </Text>
        <Text style={s.exDistractor}>{pair.distractor}</Text>
      </View>

      <View style={s.grid}>
        {cells.map((cell, idx) => (
          <TouchableOpacity
            key={cell.id}
            style={[
              s.cell,
              cell.tapped && s.cellFound,
              cell.wrong && s.cellWrong,
            ]}
            onPress={() => handleCellTap(idx)}
            activeOpacity={0.7}
          >
            <Text style={[
              s.cellSymbol,
              cell.tapped && s.cellSymbolFound,
              cell.wrong && s.cellSymbolWrong,
            ]}>
              {cell.symbol}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const CELL_SIZE = 58;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 16 },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigEmoji: { fontSize: 52, marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  desc: { color: '#9999cc', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  em: { color: '#e0e0ff', fontWeight: '700' },
  startBtn: { backgroundColor: '#5c6bc0', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  doneScore: { color: '#5c6bc0', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 70 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  instruction: { color: '#9999cc', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  exLabel: { color: '#5555aa', fontSize: 13 },
  exTarget: { color: '#ffd54f', fontSize: 20, fontWeight: 'bold' },
  exDistractor: { color: '#9999cc', fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a5e',
    alignItems: 'center', justifyContent: 'center',
  },
  cellFound: { backgroundColor: '#1a3e2a', borderColor: '#66bb6a' },
  cellWrong: { backgroundColor: '#3e1a1a', borderColor: '#ef5350' },
  cellSymbol: { color: '#c0c0ee', fontSize: 22, fontWeight: '600' },
  cellSymbolFound: { color: '#66bb6a' },
  cellSymbolWrong: { color: '#ef5350' },
});
