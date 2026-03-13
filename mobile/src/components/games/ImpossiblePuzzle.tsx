/**
 * Game 3: Impossible Puzzle
 * A deliberately very hard slider-style puzzle (9 tiles, scrambled).
 * Behavioral signals: attempts, hint requests, time spent, pauses, quit behavior.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { trackEvent } from '../../utils/eventLogger';

const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 0 = empty slot
const SIZE = 3;
const MAX_MOVES = 50;

function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Ensure it's not already solved and is solvable (ensure even parity)
  if (isSolved(a)) return shuffle(arr);
  if (!isSolvable(a)) {
    // Swap two non-zero tiles to fix parity
    [a[0], a[1]] = [a[1], a[0]];
  }
  return a;
}

function isSolvable(arr: number[]): boolean {
  let inversions = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] && arr[j] && arr[i] > arr[j]) inversions++;
    }
  }
  return inversions % 2 === 0;
}

function isSolved(arr: number[]): boolean {
  return arr.every((v, i) => v === SOLVED[i]);
}

interface Props {
  sessionId: string;
  onComplete: () => void;
}

export default function ImpossiblePuzzle({ onComplete }: Props) {
  const [tiles, setTiles] = useState<number[]>(() => shuffle([...SOLVED]));
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [hintTile, setHintTile] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const startTime = useRef(Date.now());
  const lastMoveTime = useRef(Date.now());
  const pauseAccumulator = useRef(0);

  useEffect(() => {
    // Track pause times between moves (>5s = pause)
    const interval = setInterval(() => {
      const gap = Date.now() - lastMoveTime.current;
      if (gap > 5000) {
        pauseAccumulator.current += 1000; // accumulate pause time
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function handleTilePress(index: number) {
    const emptyIdx = tiles.indexOf(0);
    const r = Math.floor(index / SIZE);
    const c = index % SIZE;
    const er = Math.floor(emptyIdx / SIZE);
    const ec = emptyIdx % SIZE;

    const adjacent =
      (Math.abs(r - er) === 1 && c === ec) ||
      (Math.abs(c - ec) === 1 && r === er);

    if (!adjacent) return;

    const now = Date.now();
    const pause = now - lastMoveTime.current;
    lastMoveTime.current = now;

    const next = [...tiles];
    [next[index], next[emptyIdx]] = [next[emptyIdx], next[index]];
    setTiles(next);
    setAttempts(a => a + 1);
    setHintTile(null);

    trackEvent('puzzle', 'move', {
      tileValue: tiles[index],
      pauseMs: pause,
      totalPauseMs: pauseAccumulator.current,
      attemptNumber: attempts + 1,
    });

    const newAttempts = attempts + 1;

    if (isSolved(next)) {
      const elapsed = Date.now() - startTime.current;
      trackEvent('puzzle', 'solved', {
        timeMs: elapsed,
        totalAttempts: newAttempts,
        hintRequests: hints,
        pauseMs: pauseAccumulator.current,
      });
      Alert.alert('Solved!', `You solved it in ${newAttempts} moves!`, [
        { text: 'Next', onPress: onComplete },
      ]);
    } else if (newAttempts >= MAX_MOVES) {
      const elapsed = Date.now() - startTime.current;
      trackEvent('puzzle', 'max_moves_reached', {
        timeMs: elapsed,
        totalAttempts: newAttempts,
        hintRequests: hints,
        pauseMs: pauseAccumulator.current,
      });
      Alert.alert('Time\'s up!', `You've used all ${MAX_MOVES} moves.`, [
        { text: 'Next', onPress: onComplete },
      ]);
    }
  }

  function requestHint() {
    if (hintsRemaining <= 0) return;
    // Find any tile not in correct position and highlight it
    const wrongIdx = tiles.findIndex((v, i) => v !== 0 && v !== SOLVED[i]);
    setHintTile(wrongIdx >= 0 ? tiles[wrongIdx] : null);
    setHints(h => h + 1);
    setHintsRemaining(h => h - 1);
    trackEvent('puzzle', 'hint_request', { hintsUsed: hints + 1, attempts });
  }

  function handleQuit() {
    const elapsed = Date.now() - startTime.current;
    trackEvent('puzzle', 'quit', {
      timeMs: elapsed,
      attempts,
      hintRequests: hints,
      pauseMs: pauseAccumulator.current,
    });
    onComplete();
  }

  return (
    <View style={styles.container}>
      {/* Rules modal */}
      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🧩 How to Play</Text>
            <Text style={styles.modalText}>
              {'• Arrange tiles 1 through 8 in order, left-to-right, top-to-bottom.\n\n'}
              {'• Tap any tile next to the blank space to slide it in.\n\n'}
              {'• You have 3 hints — each hint highlights a tile that is out of place.\n\n'}
              {'• Use as few moves as possible!\n\n'}
              {'• If you get stuck, press Skip Game to move on.'}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowRules(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.titleRow}>
        <Text style={styles.title}>🧩 Impossible Puzzle</Text>
        <TouchableOpacity style={styles.rulesBtn} onPress={() => setShowRules(true)}>
          <Text style={styles.rulesBtnText}>?</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Moves: {attempts}</Text>

      <View style={styles.board}>
        {tiles.map((value, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.tile,
              value === 0 && styles.emptyTile,
              hintTile === value && value !== 0 && styles.hintTile,
            ]}
            onPress={() => handleTilePress(index)}
            disabled={value === 0}
          >
            {value !== 0 && <Text style={styles.tileText}>{value}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, hintsRemaining === 0 && styles.disabledBtn]}
          onPress={requestHint}
          disabled={hintsRemaining === 0}
        >
          <Text style={styles.actionBtnText}>💡 Hint ({hintsRemaining})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.quitBtn]} onPress={handleQuit}>
          <Text style={styles.actionBtnText}>Skip Game</Text>
        </TouchableOpacity>
      </View>

      {hintTile !== null && (
        <Text style={styles.hintText}>Tile {hintTile} is highlighted — it's out of place!</Text>
      )}
    </View>
  );
}

const TILE_SIZE = 90;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#e0e0ff' },
  rulesBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#16213e', borderWidth: 1, borderColor: '#5c6bc0',
    alignItems: 'center', justifyContent: 'center',
  },
  rulesBtnText: { color: '#9999cc', fontSize: 14, fontWeight: 'bold' },
  sub: { color: '#9999cc', fontSize: 14, marginBottom: 24 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#3a3a6e', width: '100%' },
  modalTitle: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalText: { color: '#aaaacc', fontSize: 14, lineHeight: 22 },
  modalClose: { marginTop: 20, backgroundColor: '#5c6bc0', borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: TILE_SIZE * 3 + 12,
    gap: 4,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: '#16213e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a3a6e',
  },
  emptyTile: { backgroundColor: '#0f3460', borderColor: '#1a1a2e' },
  hintTile: { borderColor: '#ffca28', backgroundColor: '#3a3000' },
  tileText: { color: '#e0e0ff', fontSize: 28, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 28 },
  actionBtn: {
    backgroundColor: '#16213e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#5c6bc0',
  },
  disabledBtn: { opacity: 0.4 },
  quitBtn: { borderColor: '#c62828' },
  actionBtnText: { color: '#e0e0ff', fontSize: 14 },
  hintText: { color: '#ffca28', marginTop: 16, fontSize: 13 },
});
