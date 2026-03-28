/**
 * Speed Reactor — Processing Speed (T21)
 *
 * Nuclear Core Maintenance — Reaction Phase.
 * Fuel rods appear in columns. The user must tap them as fast as possible.
 * Unlike TheReactorGame, scoring is 100% RT-based (not accuracy).
 *
 * What is measured:
 *   Mean Reaction Time (MRT)   — ms from rod spawn to first tap
 *   Motor Consistency          — std-dev of individual RTs (tight = elite)
 *   Peripheral Processing      — RT delta: edge columns vs centre columns
 *   Decay Point                — level where RT degrades past eliteLatencyMs
 *
 * Level complexity axes:
 *   highContrast      true → L1-2 (large, bright rods; easy to spot)
 *   randomInterval    true → L3-4 (jitter spawn timing, breaks rhythm)
 *   peripheralBias    true → L5-6 (rods favour edge columns)
 *   maxSimultaneous   > 1  → L7-8 (batch spawns; tap fastest first)
 *   instantRefresh    true → L9-10 (next rod spawns the moment previous is tapped)
 *
 * Score formula (0-100):
 *   rtScore          = clamp(100 - (MRT - eliteMs) / 4, 0, 100) × 0.60
 *   consistencyScore = clamp(20 × (1 - sdRT / 120), 0, 20)      × 0.25
 *   completionScore  = (tapped / totalRods) × 100                × 0.15
 *   final            = rtScore + consistencyScore + completionScore
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logTrial, logGamePlay } from '../../services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BIN_H    = 72;
const ROD_H    = 52;
const ROD_W    = 52;
const HEADER_H = 80;
const PLAY_H   = SCREEN_H - HEADER_H - BIN_H - 40;

// Matches TheReactorGame palette for visual consistency
const BIN_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899'] as const;
const BIN_LABELS = ['RED', 'BLUE', 'GOLD', 'GREEN', 'VIOLET', 'PINK'] as const;

// Elite RT thresholds per level (ms) — L1 is generous, L10 is esports grade
const ELITE_RT_MS = [450, 420, 390, 360, 330, 300, 280, 255, 225, 200];

export interface SpeedReactorConfig {
  numBins:          number;   // 2–4
  fallDurationMs:   number;   // ms for a rod to cross PLAY_H
  totalRods:        number;
  highContrast:     boolean;  // L1-2: larger bright rods
  randomInterval:   boolean;  // L3-4: ±40% jitter on spawn interval
  peripheralBias:   boolean;  // L5-6: 70% of rods in outermost columns
  maxSimultaneous:  number;   // L7-8: rods per batch (≥2)
  instantRefresh:   boolean;  // L9-10: spawn next rod on tap
  spawnIntervalMs:  number;   // base gap between spawns
  level:            number;   // 1-10 (used for elite threshold lookup)
}

interface FallingRod {
  id:         string;
  binIndex:   number;
  isEdge:     boolean;   // true if outermost column
  yAnim:      Animated.Value;
  opacAnim:   Animated.Value;
  appearedAt: number;
  tapped:     boolean;
  missed:     boolean;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<SpeedReactorConfig>;
}

let _counter = 0;
function uid(): string { return `sr_${++_counter}`; }

const DEFAULTS: SpeedReactorConfig = {
  numBins: 2, fallDurationMs: 3000, totalRods: 12,
  highContrast: true, randomInterval: false, peripheralBias: false,
  maxSimultaneous: 1, instantRefresh: false, spawnIntervalMs: 1800,
  level: 1,
};

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

export default function SpeedReactorGame({ sessionId, onComplete, config }: Props) {
  const cfg: SpeedReactorConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase]           = useState<'intro' | 'playing' | 'done'>('intro');
  const [rods,  setRods]            = useState<FallingRod[]>([]);
  const [tapped, setTapped]         = useState(0);
  const [missed, setMissed]         = useState(0);
  const [displayMrt, setDisplayMrt] = useState<number | null>(null);
  const [finalScore, setFinalScore] = useState(0);

  const rodsRef     = useRef<FallingRod[]>([]);
  const spawnedRef  = useRef(0);
  const rtSamples   = useRef<number[]>([]);
  const centerRts   = useRef<number[]>([]);
  const edgeRts     = useRef<number[]>([]);
  const tappedRef   = useRef(0);
  const missedRef   = useRef(0);
  const spawnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRefs    = useRef<{ [id: string]: Animated.CompositeAnimation }>({});

  const colX = useCallback((binIndex: number): number => {
    const colW = SCREEN_W / cfg.numBins;
    return colW * binIndex + colW / 2 - ROD_W / 2;
  }, [cfg.numBins]);

  // ── Scoring ────────────────────────────────────────────────────────────────

  function computeScore(rts: number[], centRts: number[], edgRts: number[], tappedCount: number): number {
    const eliteMs = ELITE_RT_MS[(cfg.level ?? 1) - 1] ?? 280;
    const mrt = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : eliteMs + 300;
    const sd  = stdDev(rts);

    const rtScore          = Math.max(0, Math.min(100, 100 - (mrt - eliteMs) / 4));
    const consistencyBonus = Math.max(0, 20 * (1 - sd / 120));
    const completionScore  = cfg.totalRods > 0 ? (tappedCount / cfg.totalRods) * 100 : 0;

    return Math.min(100, Math.round(
      rtScore * 0.60 + consistencyBonus * 0.25 + completionScore * 0.15
    ));
  }

  // ── End game ───────────────────────────────────────────────────────────────

  const endGame = useCallback(() => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    Object.values(animRefs.current).forEach(a => a.stop());

    const rts = rtSamples.current;
    const mrt = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
    const sd  = Math.round(stdDev(rts));
    const score = computeScore(rts, centerRts.current, edgeRts.current, tappedRef.current);

    setDisplayMrt(mrt);
    setFinalScore(score);
    setPhase('done');

    const eliteMs = ELITE_RT_MS[(cfg.level ?? 1) - 1] ?? 280;
    const periDelta = (centerRts.current.length > 0 && edgeRts.current.length > 0)
      ? Math.round(
          (edgeRts.current.reduce((a, b) => a + b, 0) / edgeRts.current.length) -
          (centerRts.current.reduce((a, b) => a + b, 0) / centerRts.current.length)
        )
      : null;

    logGamePlay(sessionId, 'speed_reactor', score, {
      mrt,
      sdRt: sd,
      tapped: tappedRef.current,
      missed: missedRef.current,
      totalRods: cfg.totalRods,
      peripheralDeltaMs: periDelta,
      eliteThresholdMs: eliteMs,
      level: cfg.level,
    }).catch(() => {});
  }, [cfg, sessionId]);

  // ── Miss a rod (fell off screen) ───────────────────────────────────────────

  const missRod = useCallback((id: string) => {
    const rod = rodsRef.current.find(r => r.id === id);
    if (!rod || rod.tapped || rod.missed) return;
    rod.missed = true;
    missedRef.current++;
    setMissed(m => m + 1);
    rodsRef.current = rodsRef.current.filter(r => r.id !== id);
    setRods([...rodsRef.current]);

    if (
      spawnedRef.current >= cfg.totalRods &&
      rodsRef.current.filter(r => !r.tapped && !r.missed).length === 0
    ) {
      endGame();
    }
  }, [cfg.totalRods, endGame]);

  // ── Spawn a rod ────────────────────────────────────────────────────────────

  const spawnRod = useCallback((overrideBin?: number) => {
    const id = uid();

    // Peripheral bias: 70% chance of edge column when enabled
    let binIndex: number;
    if (overrideBin !== undefined) {
      binIndex = overrideBin;
    } else if (cfg.peripheralBias && Math.random() < 0.70) {
      binIndex = Math.random() < 0.5 ? 0 : cfg.numBins - 1;
    } else {
      binIndex = Math.floor(Math.random() * cfg.numBins);
    }

    const isEdge = binIndex === 0 || binIndex === cfg.numBins - 1;
    const yAnim   = new Animated.Value(-ROD_H);
    const opacAnim = new Animated.Value(1);

    const rod: FallingRod = {
      id, binIndex, isEdge, yAnim, opacAnim,
      appearedAt: Date.now(), tapped: false, missed: false,
    };

    rodsRef.current = [...rodsRef.current, rod];
    spawnedRef.current++;
    setRods([...rodsRef.current]);

    // Animate fall
    const anim = Animated.timing(yAnim, {
      toValue: PLAY_H + ROD_H,
      duration: cfg.fallDurationMs,
      useNativeDriver: true,
    });
    animRefs.current[id] = anim;
    anim.start(({ finished }) => {
      if (finished) missRod(id);
    });
  }, [cfg.fallDurationMs, cfg.numBins, cfg.peripheralBias, missRod]);

  // ── Tap a rod ──────────────────────────────────────────────────────────────

  const tapRod = useCallback((id: string) => {
    const rod = rodsRef.current.find(r => r.id === id);
    if (!rod || rod.tapped || rod.missed) return;

    const rt = Date.now() - rod.appearedAt;
    rod.tapped = true;
    rtSamples.current.push(rt);
    if (rod.isEdge) {
      edgeRts.current.push(rt);
    } else {
      centerRts.current.push(rt);
    }

    tappedRef.current++;
    setTapped(t => t + 1);
    setDisplayMrt(Math.round(rtSamples.current.reduce((a, b) => a + b, 0) / rtSamples.current.length));

    // Animate fade-out
    animRefs.current[id]?.stop();
    Animated.timing(rod.opacAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      rodsRef.current = rodsRef.current.filter(r => r.id !== id);
      setRods([...rodsRef.current]);

      // Instant refresh: spawn next rod immediately
      if (cfg.instantRefresh && spawnedRef.current < cfg.totalRods) {
        spawnRod();
      }

      if (
        spawnedRef.current >= cfg.totalRods &&
        rodsRef.current.filter(r => !r.tapped && !r.missed).length === 0
      ) {
        endGame();
      }
    });

    logTrial(sessionId, 'speed_reactor', { id, rt, binIndex: rod.binIndex, isEdge: rod.isEdge }).catch(() => {});
  }, [cfg.instantRefresh, cfg.totalRods, sessionId, spawnRod, endGame]);

  // ── Spawn scheduler ────────────────────────────────────────────────────────

  const scheduleNextSpawn = useCallback(() => {
    if (spawnedRef.current >= cfg.totalRods) return;

    let delay = cfg.spawnIntervalMs;
    if (cfg.randomInterval) {
      // ±40% jitter — breaks rhythm
      delay = cfg.spawnIntervalMs * (0.6 + Math.random() * 0.8);
    }

    spawnTimer.current = setTimeout(() => {
      if (cfg.maxSimultaneous > 1) {
        const batch = Math.min(cfg.maxSimultaneous, cfg.totalRods - spawnedRef.current);
        for (let i = 0; i < batch; i++) {
          spawnRod();
        }
      } else if (!cfg.instantRefresh) {
        spawnRod();
      }
      scheduleNextSpawn();
    }, delay);
  }, [cfg, spawnRod]);

  // ── Start ──────────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setPhase('playing');
    // Spawn first rod immediately (or first batch)
    if (cfg.maxSimultaneous > 1) {
      for (let i = 0; i < cfg.maxSimultaneous; i++) spawnRod();
    } else {
      spawnRod();
    }
    if (!cfg.instantRefresh) {
      scheduleNextSpawn();
    }
  }, [cfg.maxSimultaneous, cfg.instantRefresh, spawnRod, scheduleNextSpawn]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
      Object.values(animRefs.current).forEach(a => a.stop());
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const rodSize = cfg.highContrast ? ROD_W + 12 : ROD_W;

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.title}>Processing Speed</Text>
        <Text style={styles.subtitle}>
          Tap each fuel rod{'\n'}the instant it appears.{'\n'}Speed is everything.
        </Text>
        {cfg.peripheralBias && (
          <Text style={styles.hint}>Watch the edges — rods will appear there.</Text>
        )}
        {cfg.maxSimultaneous > 1 && (
          <Text style={styles.hint}>Multiple rods will appear at once. Tap fast.</Text>
        )}
        {cfg.instantRefresh && (
          <Text style={styles.hint}>Continuous Flow — stay locked in.</Text>
        )}
        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startTxt}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    const eliteMs = ELITE_RT_MS[(cfg.level ?? 1) - 1] ?? 280;
    const sd = Math.round(stdDev(rtSamples.current));
    const mrt = displayMrt ?? 0;
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.doneTitle}>Results</Text>
        <View style={styles.metricGrid}>
          <MetricRow label="Mean Reaction Time" value={`${mrt} ms`} good={mrt <= eliteMs} />
          <MetricRow label="Motor Consistency (σ)" value={`${sd} ms`} good={sd < 40} />
          <MetricRow label="Rods Tapped" value={`${tappedRef.current} / ${cfg.totalRods}`} good={tappedRef.current >= cfg.totalRods * 0.85} />
          <MetricRow label="Elite Threshold" value={`${eliteMs} ms`} neutral />
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

  // Playing
  const effectiveBinCount = Math.min(cfg.numBins, 6);
  const colWidth = SCREEN_W / effectiveBinCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PROCESSING SPEED</Text>
        <Text style={styles.mrtDisplay}>
          {displayMrt !== null ? `${displayMrt} ms` : '—'}
        </Text>
        <Text style={styles.progress}>
          {tapped + missed} / {cfg.totalRods}
        </Text>
      </View>

      {/* Play area */}
      <View style={[styles.playArea, { height: PLAY_H }]}>
        {rods.map(rod => (
          <Animated.View
            key={rod.id}
            style={[
              styles.rod,
              {
                width: rodSize,
                height: rodSize,
                left: colX(rod.binIndex),
                backgroundColor: BIN_COLORS[rod.binIndex],
                transform: [{ translateY: rod.yAnim }],
                opacity: rod.opacAnim,
                borderWidth: rod.isEdge ? 3 : 1,
                borderColor: rod.isEdge ? '#fff' : 'rgba(255,255,255,0.3)',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.rodTouch}
              onPress={() => tapRod(rod.id)}
              activeOpacity={0.7}
            />
          </Animated.View>
        ))}
      </View>

      {/* Bin row */}
      <View style={styles.binRow}>
        {Array.from({ length: effectiveBinCount }, (_, i) => (
          <View
            key={i}
            style={[styles.bin, { width: colWidth - 4, backgroundColor: BIN_COLORS[i] + '33', borderColor: BIN_COLORS[i] }]}
          >
            <Text style={styles.binLabel}>{BIN_LABELS[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetricRow({ label, value, good, neutral }: { label: string; value: string; good?: boolean; neutral?: boolean }) {
  const color = neutral ? '#94a3b8' : good ? '#22c55e' : '#ef4444';
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f172a' },
  center:       { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  header:       { height: HEADER_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#1e293b' },
  headerLabel:  { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  mrtDisplay:   { color: '#f1f5f9', fontSize: 22, fontWeight: '800' },
  progress:     { color: '#64748b', fontSize: 13, fontWeight: '600' },
  playArea:     { position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' },
  rod:          { position: 'absolute', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rodTouch:     { ...StyleSheet.absoluteFillObject },
  binRow:       { height: BIN_H, flexDirection: 'row', paddingHorizontal: 2, alignItems: 'center', backgroundColor: '#1e293b' },
  bin:          { height: 56, marginHorizontal: 2, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  binLabel:     { color: '#e2e8f0', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  emoji:        { fontSize: 48, marginBottom: 12 },
  title:        { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  doneTitle:    { color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  subtitle:     { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  hint:         { color: '#f59e0b', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  startBtn:     { marginTop: 24, backgroundColor: '#7c3aed', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  startTxt:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
  metricGrid:   { width: '100%', marginBottom: 20 },
  metricRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  metricLabel:  { color: '#94a3b8', fontSize: 14 },
  metricValue:  { fontSize: 14, fontWeight: '700' },
  scoreBadge:   { alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 8, width: 120 },
  scoreNum:     { color: '#f1f5f9', fontSize: 40, fontWeight: '900' },
  scoreLabel:   { color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
