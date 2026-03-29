/**
 * Circuit Snap — Systems Thinking (T12)
 *
 * Power Grid Repair metaphor.
 * A blueprint of nodes and logic gates. Flip switches to power the Goal Node.
 * Interdependency mechanic: every switch change ripples through the circuit.
 *
 * Node types:
 *   switch  — user taps to toggle ON/OFF
 *   wire    — passive passthrough
 *   and     — powered when ALL inputs are powered (≥2 inputs)
 *   or      — powered when ANY input is powered
 *   not     — powered when its input is NOT powered (inverter)
 *   goal    — must be powered to win
 *
 * Score formula (0–100):
 *   (goalsAchieved / totalGoals) × 70
 *   + max(0, 1 − wrongMoves / max(totalMoves, 1)) × 30
 *
 * Cascade mode (L9–10): a random switch flips every N seconds — the circuit
 * is constantly degrading, requiring continuous correction.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logTrial, logGamePlay } from '../../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const PLAY_W = Math.min(SCREEN_W - 32, 340);
const PLAY_H = 380;
const NODE_R  = 22;  // half-size of node

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = 'switch' | 'wire' | 'and' | 'or' | 'not' | 'goal';

interface CNode {
  id:    string;
  type:  NodeType;
  label: string;
  x:     number;  // 0–1 (fraction of PLAY_W)
  y:     number;  // 0–1 (fraction of PLAY_H)
}

interface CEdge {
  from: string;
  to:   string;
}

interface CircuitPuzzle {
  id:               string;
  description:      string;
  hint?:            string;
  nodes:            CNode[];
  edges:            CEdge[];
  goalIds:          string[];
  cascadeMode?:     boolean;
  cascadeIntervalMs?: number;
}

export interface CircuitGameConfig {
  levelIndex:        number;
  cascadeMode?:      boolean;
  cascadeIntervalMs?: number;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<CircuitGameConfig>;
}

// ── Circuit evaluator (BFS propagation) ───────────────────────────────────────

function evalCircuit(
  nodes: CNode[],
  edges: CEdge[],
  switchStates: Record<string, boolean>
): Set<string> {
  const powered = new Set<string>();
  const inEdges: Record<string, string[]> = {};
  for (const e of edges) {
    if (!inEdges[e.to]) inEdges[e.to] = [];
    inEdges[e.to].push(e.from);
  }
  for (const n of nodes) {
    if (n.type === 'switch' && switchStates[n.id]) powered.add(n.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (powered.has(n.id)) continue;
      const inputs = inEdges[n.id] ?? [];
      let on = false;
      switch (n.type) {
        case 'wire':
        case 'goal':
        case 'or':
          on = inputs.some(i => powered.has(i));
          break;
        case 'and':
          on = inputs.length >= 2 && inputs.every(i => powered.has(i));
          break;
        case 'not':
          on = inputs.length > 0 && inputs.every(i => !powered.has(i));
          break;
      }
      if (on) { powered.add(n.id); changed = true; }
    }
  }
  return powered;
}

// ── Puzzle definitions (10 levels) ────────────────────────────────────────────

const PUZZLES: CircuitPuzzle[] = [
  // L1 — Linear: S1 → W1 → GOAL
  {
    id: 'l1_linear',
    description: 'Power the goal.',
    hint: 'Flip the switch ON.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',   x: 0.12, y: 0.50 },
      { id: 'W1',   type: 'wire',   label: '',      x: 0.50, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',    x: 0.88, y: 0.50 },
    ],
    edges: [
      { from: 'S1', to: 'W1' },
      { from: 'W1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L2 — OR choice: S1 or S2 → OR → GOAL
  {
    id: 'l2_or',
    description: 'Either path powers the goal.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',  x: 0.12, y: 0.30 },
      { id: 'S2',   type: 'switch', label: 'S2',  x: 0.12, y: 0.70 },
      { id: 'OR1',  type: 'or',     label: 'OR',  x: 0.50, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',  x: 0.88, y: 0.50 },
    ],
    edges: [
      { from: 'S1', to: 'OR1' },
      { from: 'S2', to: 'OR1' },
      { from: 'OR1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L3 — AND gate: S1 AND S2 → GOAL
  {
    id: 'l3_and',
    description: 'Both switches must be ON.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',  x: 0.12, y: 0.30 },
      { id: 'S2',   type: 'switch', label: 'S2',  x: 0.12, y: 0.70 },
      { id: 'AND1', type: 'and',    label: 'AND', x: 0.50, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',  x: 0.88, y: 0.50 },
    ],
    edges: [
      { from: 'S1',  to: 'AND1' },
      { from: 'S2',  to: 'AND1' },
      { from: 'AND1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L4 — OR into AND: (S1 OR S2) AND S3
  {
    id: 'l4_or_and',
    description: '(S1 or S2) AND S3 must be ON.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',  x: 0.10, y: 0.20 },
      { id: 'S2',   type: 'switch', label: 'S2',  x: 0.10, y: 0.50 },
      { id: 'S3',   type: 'switch', label: 'S3',  x: 0.10, y: 0.80 },
      { id: 'OR1',  type: 'or',     label: 'OR',  x: 0.40, y: 0.35 },
      { id: 'AND1', type: 'and',    label: 'AND', x: 0.68, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',  x: 0.92, y: 0.50 },
    ],
    edges: [
      { from: 'S1', to: 'OR1' },
      { from: 'S2', to: 'OR1' },
      { from: 'OR1', to: 'AND1' },
      { from: 'S3', to: 'AND1' },
      { from: 'AND1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L5 — NOT gate: S1 ON, S2 must be OFF (NOT passes when input is absent)
  {
    id: 'l5_not',
    description: 'The NOT gate inverts its input.',
    hint: 'S2 must be OFF for NOT to output power.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',  x: 0.10, y: 0.28 },
      { id: 'S2',   type: 'switch', label: 'S2',  x: 0.10, y: 0.72 },
      { id: 'NOT1', type: 'not',    label: 'NOT', x: 0.42, y: 0.72 },
      { id: 'AND1', type: 'and',    label: 'AND', x: 0.68, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',  x: 0.92, y: 0.50 },
    ],
    edges: [
      { from: 'S1',  to: 'AND1' },
      { from: 'S2',  to: 'NOT1' },
      { from: 'NOT1', to: 'AND1' },
      { from: 'AND1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L6 — Double NOT: S1 ON, S2 OFF, S3 OFF
  {
    id: 'l6_double_not',
    description: 'Two inverter paths feed the AND gate.',
    hint: 'NOT gates pass power when their input switch is OFF.',
    nodes: [
      { id: 'S1',   type: 'switch', label: 'S1',  x: 0.10, y: 0.18 },
      { id: 'S2',   type: 'switch', label: 'S2',  x: 0.10, y: 0.50 },
      { id: 'S3',   type: 'switch', label: 'S3',  x: 0.10, y: 0.82 },
      { id: 'NOT1', type: 'not',    label: 'NOT', x: 0.40, y: 0.50 },
      { id: 'NOT2', type: 'not',    label: 'NOT', x: 0.40, y: 0.82 },
      { id: 'AND1', type: 'and',    label: 'AND', x: 0.70, y: 0.50 },
      { id: 'GOAL', type: 'goal',   label: '⚡',  x: 0.92, y: 0.50 },
    ],
    edges: [
      { from: 'S1',  to: 'AND1' },
      { from: 'S2',  to: 'NOT1' },
      { from: 'S3',  to: 'NOT2' },
      { from: 'NOT1', to: 'AND1' },
      { from: 'NOT2', to: 'AND1' },
      { from: 'AND1', to: 'GOAL' },
    ],
    goalIds: ['GOAL'],
  },

  // L7 — Two goals: S1∧S2 → GOAL1, S2∧S3 → GOAL2
  {
    id: 'l7_two_goals',
    description: 'Power both goals simultaneously.',
    nodes: [
      { id: 'S1',    type: 'switch', label: 'S1',  x: 0.10, y: 0.20 },
      { id: 'S2',    type: 'switch', label: 'S2',  x: 0.10, y: 0.50 },
      { id: 'S3',    type: 'switch', label: 'S3',  x: 0.10, y: 0.80 },
      { id: 'AND1',  type: 'and',    label: 'AND', x: 0.45, y: 0.33 },
      { id: 'AND2',  type: 'and',    label: 'AND', x: 0.45, y: 0.67 },
      { id: 'GOAL1', type: 'goal',   label: '⚡',  x: 0.85, y: 0.33 },
      { id: 'GOAL2', type: 'goal',   label: '⚡',  x: 0.85, y: 0.67 },
    ],
    edges: [
      { from: 'S1', to: 'AND1' },
      { from: 'S2', to: 'AND1' },
      { from: 'S2', to: 'AND2' },
      { from: 'S3', to: 'AND2' },
      { from: 'AND1', to: 'GOAL1' },
      { from: 'AND2', to: 'GOAL2' },
    ],
    goalIds: ['GOAL1', 'GOAL2'],
  },

  // L8 — Mixed two goals: GOAL1 direct, GOAL2 via OR→AND
  {
    id: 'l8_mixed_goals',
    description: 'Two goals, two logic paths.',
    nodes: [
      { id: 'S1',    type: 'switch', label: 'S1',  x: 0.10, y: 0.22 },
      { id: 'S2',    type: 'switch', label: 'S2',  x: 0.10, y: 0.50 },
      { id: 'S3',    type: 'switch', label: 'S3',  x: 0.10, y: 0.78 },
      { id: 'OR1',   type: 'or',     label: 'OR',  x: 0.42, y: 0.64 },
      { id: 'AND1',  type: 'and',    label: 'AND', x: 0.68, y: 0.64 },
      { id: 'GOAL1', type: 'goal',   label: '⚡',  x: 0.88, y: 0.22 },
      { id: 'GOAL2', type: 'goal',   label: '⚡',  x: 0.88, y: 0.64 },
    ],
    edges: [
      { from: 'S1', to: 'GOAL1' },
      { from: 'S2', to: 'OR1' },
      { from: 'S1', to: 'OR1' },
      { from: 'OR1', to: 'AND1' },
      { from: 'S3', to: 'AND1' },
      { from: 'AND1', to: 'GOAL2' },
    ],
    goalIds: ['GOAL1', 'GOAL2'],
  },

  // L9 — Three goals + cascade
  {
    id: 'l9_three_goals',
    description: 'Maintain all three goals under cascade pressure.',
    cascadeMode: true,
    cascadeIntervalMs: 6000,
    nodes: [
      { id: 'S1',    type: 'switch', label: 'S1',  x: 0.10, y: 0.15 },
      { id: 'S2',    type: 'switch', label: 'S2',  x: 0.10, y: 0.38 },
      { id: 'S3',    type: 'switch', label: 'S3',  x: 0.10, y: 0.62 },
      { id: 'S4',    type: 'switch', label: 'S4',  x: 0.10, y: 0.85 },
      { id: 'AND1',  type: 'and',    label: 'AND', x: 0.40, y: 0.25 },
      { id: 'OR1',   type: 'or',     label: 'OR',  x: 0.40, y: 0.72 },
      { id: 'AND2',  type: 'and',    label: 'AND', x: 0.68, y: 0.50 },
      { id: 'GOAL1', type: 'goal',   label: '⚡',  x: 0.90, y: 0.15 },
      { id: 'GOAL2', type: 'goal',   label: '⚡',  x: 0.90, y: 0.50 },
      { id: 'GOAL3', type: 'goal',   label: '⚡',  x: 0.90, y: 0.85 },
    ],
    edges: [
      { from: 'S1', to: 'AND1' },
      { from: 'S2', to: 'AND1' },
      { from: 'AND1', to: 'GOAL1' },
      { from: 'S3', to: 'OR1' },
      { from: 'S4', to: 'OR1' },
      { from: 'S2', to: 'AND2' },
      { from: 'OR1', to: 'AND2' },
      { from: 'AND2', to: 'GOAL2' },
      { from: 'S4', to: 'GOAL3' },
    ],
    goalIds: ['GOAL1', 'GOAL2', 'GOAL3'],
  },

  // L10 — Full cascade: 4 switches, 3 goals, NOT + AND mix, cascade every 4s
  {
    id: 'l10_cascade_full',
    description: 'Total cascade failure. Maintain all goals.',
    hint: 'Every switch change affects multiple goals.',
    cascadeMode: true,
    cascadeIntervalMs: 4000,
    nodes: [
      { id: 'S1',    type: 'switch', label: 'S1',  x: 0.08, y: 0.15 },
      { id: 'S2',    type: 'switch', label: 'S2',  x: 0.08, y: 0.38 },
      { id: 'S3',    type: 'switch', label: 'S3',  x: 0.08, y: 0.62 },
      { id: 'S4',    type: 'switch', label: 'S4',  x: 0.08, y: 0.85 },
      { id: 'OR1',   type: 'or',     label: 'OR',  x: 0.32, y: 0.25 },
      { id: 'AND1',  type: 'and',    label: 'AND', x: 0.58, y: 0.25 },
      { id: 'NOT1',  type: 'not',    label: 'NOT', x: 0.32, y: 0.62 },
      { id: 'AND2',  type: 'and',    label: 'AND', x: 0.58, y: 0.50 },
      { id: 'AND3',  type: 'and',    label: 'AND', x: 0.58, y: 0.78 },
      { id: 'GOAL1', type: 'goal',   label: '⚡',  x: 0.90, y: 0.25 },
      { id: 'GOAL2', type: 'goal',   label: '⚡',  x: 0.90, y: 0.50 },
      { id: 'GOAL3', type: 'goal',   label: '⚡',  x: 0.90, y: 0.78 },
    ],
    edges: [
      { from: 'S1', to: 'OR1' },
      { from: 'S2', to: 'OR1' },
      { from: 'OR1', to: 'AND1' },
      { from: 'S3', to: 'AND1' },
      { from: 'AND1', to: 'GOAL1' },
      { from: 'S2', to: 'AND2' },
      { from: 'NOT1', to: 'AND2' },
      { from: 'S4', to: 'NOT1' },
      { from: 'AND2', to: 'GOAL2' },
      { from: 'S3', to: 'AND3' },
      { from: 'S4', to: 'AND3' },
      { from: 'AND3', to: 'GOAL3' },
    ],
    goalIds: ['GOAL1', 'GOAL2', 'GOAL3'],
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CircuitSnapGame({ sessionId, onComplete, config }: Props) {
  const cfg    = config ?? {};
  const idx    = Math.min(cfg.levelIndex ?? 0, PUZZLES.length - 1);
  const puzzle = PUZZLES[idx];
  const isCascade = cfg.cascadeMode ?? puzzle.cascadeMode ?? false;
  const cascadeMs = cfg.cascadeIntervalMs ?? puzzle.cascadeIntervalMs ?? 5000;

  const switchIds = useMemo(
    () => puzzle.nodes.filter(n => n.type === 'switch').map(n => n.id),
    [puzzle]
  );

  const initStates = useMemo(() => {
    const s: Record<string, boolean> = {};
    for (const id of switchIds) s[id] = false;
    return s;
  }, [switchIds]);

  const [phase,         setPhase]         = useState<'intro' | 'solving' | 'success' | 'done'>('intro');
  const [switchStates,  setSwitchStates]  = useState<Record<string, boolean>>(initStates);
  const [poweredNodes,  setPoweredNodes]  = useState<Set<string>>(new Set());
  const [totalMoves,    setTotalMoves]    = useState(0);
  const [wrongMoves,    setWrongMoves]    = useState(0);
  const [goalsAchieved, setGoalsAchieved] = useState(0);
  const [cascadeWarn,   setCascadeWarn]   = useState(false);
  const [finalScore,    setFinalScore]    = useState(0);

  const prevPoweredGoals = useRef(0);
  const cascadeTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-evaluate circuit whenever switch states change
  useEffect(() => {
    const powered = evalCircuit(puzzle.nodes, puzzle.edges, switchStates);
    setPoweredNodes(powered);

    const nowPowered = puzzle.goalIds.filter(g => powered.has(g)).length;
    setGoalsAchieved(nowPowered);

    if (phase === 'solving' && nowPowered === puzzle.goalIds.length) {
      // All goals powered — win!
      const score = computeScore(nowPowered, puzzle.goalIds.length, wrongMoves, totalMoves);
      setFinalScore(score);
      setPhase('success');
      logGamePlay(sessionId, 'circuit', score, {
        levelIndex: idx,
        totalMoves,
        wrongMoves,
        puzzleId: puzzle.id,
        cascadeMode: isCascade,
      }).catch(() => {});
      successTimer.current = setTimeout(() => setPhase('done'), 1200);
    }
  }, [switchStates, puzzle, phase, wrongMoves, totalMoves, idx, isCascade, sessionId]);

  // Cascade: flip a random switch every N seconds
  useEffect(() => {
    if (phase !== 'solving' || !isCascade) return;

    const schedule = () => {
      warnTimer.current = setTimeout(() => {
        setCascadeWarn(true);
        cascadeTimer.current = setTimeout(() => {
          setCascadeWarn(false);
          setSwitchStates(prev => {
            const ids = Object.keys(prev);
            const target = ids[Math.floor(Math.random() * ids.length)];
            return { ...prev, [target]: !prev[target] };
          });
          schedule();
        }, 2000);
      }, cascadeMs - 2000);
    };

    schedule();

    return () => {
      if (cascadeTimer.current) clearTimeout(cascadeTimer.current);
      if (warnTimer.current)    clearTimeout(warnTimer.current);
    };
  }, [phase, isCascade, cascadeMs]);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      if (cascadeTimer.current) clearTimeout(cascadeTimer.current);
      if (warnTimer.current)    clearTimeout(warnTimer.current);
    };
  }, []);

  const toggleSwitch = useCallback((id: string) => {
    if (phase !== 'solving') return;
    const prevPowered = puzzle.goalIds.filter(g => poweredNodes.has(g)).length;
    setSwitchStates(prev => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
    setTotalMoves(m => m + 1);
    logTrial(sessionId, 'circuit', { switchId: id, puzzleId: puzzle.id }).catch(() => {});

    // Wrong move detection (async — checked after state update)
    setTimeout(() => {
      const newPowered = evalCircuit(puzzle.nodes, puzzle.edges,
        { ...switchStates, [id]: !switchStates[id] }
      );
      const nowGoals = puzzle.goalIds.filter(g => newPowered.has(g)).length;
      if (nowGoals < prevPowered) setWrongMoves(w => w + 1);
    }, 0);
  }, [phase, puzzle, poweredNodes, switchStates, sessionId]);

  // ── Rendering ───────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.title}>Circuit Snap</Text>
        <Text style={styles.subtitle}>{puzzle.description}</Text>
        {puzzle.hint && <Text style={styles.hint}>{puzzle.hint}</Text>}
        {isCascade && <Text style={styles.cascadeWarnTxt}>⚠️ Cascade mode — the circuit will degrade over time.</Text>}
        <TouchableOpacity style={styles.startBtn} onPress={() => setPhase('solving')}>
          <Text style={styles.startTxt}>ENGAGE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    const efficiency = totalMoves > 0 ? Math.round((1 - wrongMoves / totalMoves) * 100) : 100;
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.doneTitle}>Circuit Restored</Text>
        <View style={styles.metricGrid}>
          <MetricRow label="Goals Powered"   value={`${puzzle.goalIds.length} / ${puzzle.goalIds.length}`} good />
          <MetricRow label="Total Moves"     value={`${totalMoves}`}   neutral />
          <MetricRow label="Wrong Moves"     value={`${wrongMoves}`}   good={wrongMoves === 0} />
          <MetricRow label="Efficiency"      value={`${efficiency}%`}  good={efficiency >= 70} />
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreNum}>{finalScore}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
        <TouchableOpacity style={styles.startBtn} onPress={() => onComplete(finalScore)}>
          <Text style={styles.startTxt}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Solving (or success flash)
  const goalPct = puzzle.goalIds.length > 0
    ? Math.round((goalsAchieved / puzzle.goalIds.length) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, cascadeWarn && styles.headerCascade]}>
        <Text style={styles.headerLabel}>SYSTEMS THINKING</Text>
        <Text style={styles.goalProgress}>
          {cascadeWarn ? '⚠️ CASCADE INCOMING' : `Goals: ${goalsAchieved} / ${puzzle.goalIds.length}`}
        </Text>
        <Text style={styles.movesLabel}>Moves: {totalMoves}</Text>
      </View>

      {/* Circuit area */}
      <View style={[styles.playArea, phase === 'success' && styles.playAreaSuccess]}>
        {/* Draw edges first (behind nodes) */}
        {puzzle.edges.map((e, i) => {
          const fromNode = puzzle.nodes.find(n => n.id === e.from);
          const toNode   = puzzle.nodes.find(n => n.id === e.to);
          if (!fromNode || !toNode) return null;
          const x1 = fromNode.x * PLAY_W;
          const y1 = fromNode.y * PLAY_H;
          const x2 = toNode.x * PLAY_W;
          const y2 = toNode.y * PLAY_H;
          const isPowered = poweredNodes.has(e.from) && poweredNodes.has(e.to);
          return <CircuitLine key={i} x1={x1} y1={y1} x2={x2} y2={y2} powered={isPowered} />;
        })}

        {/* Draw nodes on top */}
        {puzzle.nodes.map(node => (
          <CircuitNodeView
            key={node.id}
            node={node}
            powered={poweredNodes.has(node.id)}
            switchOn={node.type === 'switch' ? (switchStates[node.id] ?? false) : false}
            onToggle={node.type === 'switch' ? () => toggleSwitch(node.id) : undefined}
          />
        ))}
      </View>

      {/* Goal progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${goalPct}%` as any }]} />
      </View>
    </View>
  );
}

// ── Node renderer ─────────────────────────────────────────────────────────────

function CircuitNodeView({
  node, powered, switchOn, onToggle,
}: {
  node: CNode;
  powered: boolean;
  switchOn: boolean;
  onToggle?: () => void;
}) {
  const px = node.x * PLAY_W - NODE_R;
  const py = node.y * PLAY_H - NODE_R;

  const bg = (() => {
    if (!powered) return '#334155';
    switch (node.type) {
      case 'switch': return '#22c55e';
      case 'and':
      case 'or':     return '#f59e0b';
      case 'not':    return '#a855f7';
      case 'goal':   return '#fbbf24';
      case 'wire':   return '#3b82f6';
      default:       return '#3b82f6';
    }
  })();

  const switchOffBg = node.type === 'switch' && !switchOn ? '#475569' : bg;

  const inner = (
    <View
      style={[
        styles.nodeBase,
        { left: px, top: py, backgroundColor: switchOffBg },
        node.type === 'goal' && styles.nodeGoal,
        node.type === 'switch' && styles.nodeSwitch,
        node.type === 'goal' && powered && styles.nodeGoalPowered,
      ]}
    >
      <Text style={styles.nodeLabel}>
        {node.type === 'switch' ? node.label : node.type === 'goal' ? (powered ? '⚡' : '○') : node.label}
      </Text>
    </View>
  );

  if (node.type === 'switch') {
    return (
      <TouchableOpacity
        key={node.id}
        activeOpacity={0.7}
        onPress={onToggle}
        style={[styles.nodeBase, { left: px, top: py, backgroundColor: switchOffBg },
          node.type === 'switch' && styles.nodeSwitch]}
      >
        <Text style={styles.nodeLabel}>{node.label}</Text>
        <Text style={styles.nodeSub}>{switchOn ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    );
  }

  return inner;
}

// ── Edge renderer (line) ──────────────────────────────────────────────────────

function CircuitLine({ x1, y1, x2, y2, powered }: { x1: number; y1: number; x2: number; y2: number; powered: boolean }) {
  const dx     = x2 - x1;
  const dy     = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
  const cx     = (x1 + x2) / 2;
  const cy     = (y1 + y2) / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: cx - length / 2,
        top:  cy - 2,
        width: length,
        height: 4,
        borderRadius: 2,
        backgroundColor: powered ? '#3b82f6' : '#334155',
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// ── Score helper ──────────────────────────────────────────────────────────────

function computeScore(achieved: number, total: number, wrong: number, moves: number): number {
  const goalRatio  = total > 0 ? achieved / total : 0;
  const efficiency = moves > 0 ? Math.max(0, 1 - wrong / moves) : 1;
  return Math.min(100, Math.round(goalRatio * 70 + efficiency * 30));
}

// ── MetricRow ─────────────────────────────────────────────────────────────────

function MetricRow({ label, value, good, neutral }: { label: string; value: string; good?: boolean; neutral?: boolean }) {
  const color = neutral ? '#94a3b8' : good ? '#22c55e' : '#ef4444';
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f172a' },
  center:           { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  header:           { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#1e293b' },
  headerCascade:    { backgroundColor: '#7f1d1d' },
  headerLabel:      { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  goalProgress:     { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  movesLabel:       { color: '#64748b', fontSize: 13 },
  playArea:         { flex: 1, position: 'relative', width: PLAY_W, alignSelf: 'center' },
  playAreaSuccess:  { backgroundColor: '#052e16' },
  progressBar:      { height: 6, backgroundColor: '#1e293b', marginHorizontal: 16, borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
  nodeBase:         { position: 'absolute', width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#475569' },
  nodeSwitch:       { width: 52, height: 36, borderRadius: 8, borderColor: '#64748b', borderWidth: 2 },
  nodeGoal:         { width: 48, height: 48, borderRadius: 24, borderColor: '#64748b', borderWidth: 2 },
  nodeGoalPowered:  { borderColor: '#fbbf24', borderWidth: 3 },
  nodeLabel:        { color: '#f1f5f9', fontSize: 11, fontWeight: '700' },
  nodeSub:          { color: '#94a3b8', fontSize: 9, fontWeight: '600' },
  emoji:            { fontSize: 48, marginBottom: 12 },
  title:            { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  doneTitle:        { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  subtitle:         { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  hint:             { color: '#f59e0b', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  cascadeWarnTxt:   { color: '#fca5a5', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  startBtn:         { marginTop: 20, backgroundColor: '#7c3aed', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  startTxt:         { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
  metricGrid:       { width: '100%', marginBottom: 20 },
  metricRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  metricLabel:      { color: '#94a3b8', fontSize: 14 },
  metricValue:      { fontSize: 14, fontWeight: '700' },
  scoreBadge:       { alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 8, width: 120 },
  scoreNum:         { color: '#f1f5f9', fontSize: 40, fontWeight: '900' },
  scoreLabel:       { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
