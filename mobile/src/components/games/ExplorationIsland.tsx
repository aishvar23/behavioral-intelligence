/**
 * Game 1: Exploration Island
 * 8x8 grid with fog of war. Tiles are hidden until visited.
 * Some tiles have rewards (+), some traps (-), most are empty.
 * Players have 30 moves. Behavioral signals are logged on each move.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { trackEvent } from '../../utils/eventLogger';

const GRID_SIZE = 8;
const MAX_MOVES = 30;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

type TileType = 'empty' | 'reward' | 'trap';

interface Tile {
  type: TileType;
  revealed: boolean;
  visited: boolean;
}

function buildGrid(): Tile[][] {
  const grid: Tile[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ type: 'empty' as TileType, revealed: false, visited: false }))
  );
  // Place 8 rewards and 6 traps randomly
  placeTiles(grid, 'reward', 8);
  placeTiles(grid, 'trap', 6);
  return grid;
}

function placeTiles(grid: Tile[][], type: TileType, count: number) {
  let placed = 0;
  while (placed < count) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    if (grid[r][c].type === 'empty') {
      grid[r][c].type = type;
      placed++;
    }
  }
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

export default function ExplorationIsland({ onComplete }: Props) {
  const [grid, setGrid] = useState<Tile[][]>(buildGrid);
  const [playerPos, setPlayerPos] = useState({ r: 0, c: 0 });
  const [movesLeft, setMovesLeft] = useState(MAX_MOVES);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const lastMoveTime = useRef<number>(Date.now());
  const visitCounts = useRef<Record<string, number>>({});

  const revealInitial = useCallback((g: Tile[][]) => {
    g[0][0].revealed = true;
    g[0][0].visited = true;
  }, []);

  // Reveal starting tile on first render
  useState(() => {
    setGrid(prev => {
      const next = prev.map(row => row.map(t => ({ ...t })));
      revealInitial(next);
      return next;
    });
  });

  function move(dr: number, dc: number) {
    if (done) return;
    const nr = playerPos.r + dr;
    const nc = playerPos.c + dc;
    if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return;

    const now = Date.now();
    const timeSinceLast = now - lastMoveTime.current;
    lastMoveTime.current = now;

    const key = `${nr},${nc}`;
    visitCounts.current[key] = (visitCounts.current[key] ?? 0) + 1;

    setGrid(prev => {
      const next = prev.map(row => row.map(t => ({ ...t })));
      next[nr][nc].revealed = true;
      next[nr][nc].visited = true;
      return next;
    });

    const tile = grid[nr][nc];
    let scoreChange = 0;
    if (tile.type === 'reward') scoreChange = 10;
    if (tile.type === 'trap') scoreChange = -5;
    setScore(s => s + scoreChange);

    const exploredCount = countExplored();
    trackEvent('exploration', 'move', {
      from: playerPos,
      to: { r: nr, c: nc },
      tileType: tile.type,
      timeSinceLast,
      revisit: visitCounts.current[key] > 1,
      explorationPct: exploredCount / TOTAL_TILES,
      movesUsed: MAX_MOVES - movesLeft + 1,
    });

    setPlayerPos({ r: nr, c: nc });
    const remaining = movesLeft - 1;
    setMovesLeft(remaining);

    if (remaining === 0) {
      finishGame(exploredCount);
    }
  }

  function countExplored(): number {
    return grid.flat().filter(t => t.visited).length;
  }

  function finishGame(explored: number) {
    setDone(true);
    const pct = (explored / TOTAL_TILES * 100).toFixed(0);
    Alert.alert('Game Over', `You explored ${pct}% of the island!\nScore: ${score}`, [
      { text: 'Next Game', onPress: () => onComplete(score) },
    ]);
  }

  function tileColor(tile: Tile, r: number, c: number): string {
    if (r === playerPos.r && c === playerPos.c) return '#5c6bc0';
    if (!tile.revealed) return '#0f3460';
    if (tile.type === 'reward') return '#2e7d32';
    if (tile.type === 'trap') return '#c62828';
    return '#263238';
  }

  function tileLabel(tile: Tile, r: number, c: number): string {
    if (r === playerPos.r && c === playerPos.c) return '🧭';
    if (!tile.revealed) return '';
    if (tile.type === 'reward') return '💎';
    if (tile.type === 'trap') return '💀';
    return '';
  }

  return (
    <View style={styles.container}>
      {/* Rules modal */}
      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🏝️ How to Play</Text>
            <Text style={styles.modalText}>
              {'• You start at the top-left corner (🧭) of an 8×8 fog-covered island.\n\n'}
              {'• Use the arrow buttons to move one tile at a time.\n\n'}
              {'• Revealed tiles may contain:\n   💎 Reward — +10 points\n   💀 Trap — −5 points\n   Empty — no effect\n\n'}
              {'• You have 30 moves total.\n\n'}
              {'• Goal: explore as much of the island as you can and maximise your score!'}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowRules(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.titleRow}>
        <Text style={styles.title}>🏝️ Exploration Island</Text>
        <TouchableOpacity style={styles.rulesBtn} onPress={() => setShowRules(true)}>
          <Text style={styles.rulesBtnText}>?</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>Moves Left: {movesLeft}</Text>
        <Text style={styles.stat}>Score: {score}</Text>
      </View>

      <View style={styles.grid}>
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((tile, c) => (
              <View key={c} style={[styles.tile, { backgroundColor: tileColor(tile, r, c) }]}>
                <Text style={styles.tileText}>{tileLabel(tile, r, c)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.dpad}>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => move(-1, 0)}>
            <Text style={styles.dpadLabel}>▲</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => move(0, -1)}>
            <Text style={styles.dpadLabel}>◀</Text>
          </TouchableOpacity>
          <View style={[styles.dpadBtn, { backgroundColor: 'transparent' }]} />
          <TouchableOpacity style={styles.dpadBtn} onPress={() => move(0, 1)}>
            <Text style={styles.dpadLabel}>▶</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => move(1, 0)}>
            <Text style={styles.dpadLabel}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const TILE_SIZE = 36;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#e0e0ff' },
  rulesBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#16213e', borderWidth: 1, borderColor: '#5c6bc0',
    alignItems: 'center', justifyContent: 'center',
  },
  rulesBtnText: { color: '#9999cc', fontSize: 14, fontWeight: 'bold' },
  stats: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#3a3a6e', width: '100%' },
  modalTitle: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalText: { color: '#aaaacc', fontSize: 14, lineHeight: 22 },
  modalClose: { marginTop: 20, backgroundColor: '#5c6bc0', borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stat: { color: '#9999cc', fontSize: 14 },
  grid: { borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row' },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderWidth: 0.5,
    borderColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontSize: 14 },
  dpad: { marginTop: 24, alignItems: 'center', gap: 4 },
  dpadRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  dpadBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#16213e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadLabel: { color: '#e0e0ff', fontSize: 22 },
});
