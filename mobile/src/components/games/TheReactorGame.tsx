/**
 * The Reactor — Triage (T01)
 *
 * Nuclear Core Maintenance metaphor.
 * Fuel rods fall from the top. The user must tap them into the correct
 * color-coded bins — but only act on glowing (high-priority) rods and
 * ignore steam/static distractors.
 *
 * Mechanic:
 *   - Rods fall in columns (each column = one color bin)
 *   - TAP a rod to bin it in its column
 *   - ⚡ Glowing / HIGH-PRIORITY: must tap — miss = penalty
 *   - ◦  DULL  / LOW-PRIORITY:   optional — tap for bonus
 *   - 💨 STEAM / DISTRACTOR:     must NOT tap — tap = false alarm penalty
 *
 * Level params (via config.gameParams from traitCatalog):
 *   numBins            2–6
 *   fallDurationMs     base rod fall time (lower = faster)
 *   distractors        enable steam icons
 *   highPriorityBoost  0.2 = high-priority falls 20% faster
 *   oscillate          bins sway left-right (level 7–8)
 *   meltdown           screen shake + flicker + priority rule flip every 15s (level 9–10)
 *   totalRods          total rods to spawn per session
 *   highRatio          fraction of rods that are high-priority
 *   distractorRatio    fraction that are distractors
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
const BIN_H       = 72;
const ROD_H       = 52;
const ROD_W       = 52;
const HEADER_H    = 80;
const PLAY_H      = SCREEN_H - HEADER_H - BIN_H - 40;

// Bin color palette — first N colors used based on numBins
const BIN_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899'] as const;
const BIN_LABELS = ['RED', 'BLUE', 'GOLD', 'GREEN', 'VIOLET', 'PINK'] as const;

type RodType = 'high' | 'low' | 'distractor';

interface FallingRod {
  id:          string;
  binIndex:    number;     // which bin column it belongs to
  type:        RodType;
  yAnim:       Animated.Value;
  opacAnim:    Animated.Value;
  appearedAt:  number;
  resolved:    boolean;    // tapped or missed
}

interface ReactorConfig {
  numBins:           number;
  fallDurationMs:    number;
  distractors:       boolean;
  highPriorityBoost: number;
  oscillate:         boolean;
  meltdown:          boolean;
  totalRods:         number;
  highRatio:         number;
  distractorRatio:   number;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<ReactorConfig>;
  /** HUD mode: auto-starts, uses compact sizing, suppresses intro/done screens */
  compact?: boolean;
  /** Called after each rod resolution with current high-priority miss rate (0–1) */
  onMissRateUpdate?: (missRate: number) => void;
}

let _rodIdCounter = 0;
function rodId(): string { return `rod_${++_rodIdCounter}`; }

const DEFAULT_CONFIG: ReactorConfig = {
  numBins: 2, fallDurationMs: 3500, distractors: false,
  highPriorityBoost: 0, oscillate: false, meltdown: false,
  totalRods: 12, highRatio: 0.4, distractorRatio: 0,
};

export default function TheReactorGame({ sessionId, onComplete, config, compact = false, onMissRateUpdate }: Props) {
  const cfg: ReactorConfig = { ...DEFAULT_CONFIG, ...config };

  // Compact sizing — used when rendering as HUD strip inside EmpathyResponseGame L10
  const playH = compact
    ? Math.max(70, SCREEN_H * 0.16)
    : SCREEN_H - HEADER_H - BIN_H - 40;
  const rodH_c = compact ? 20 : ROD_H;
  const rodW_c = compact ? 20 : ROD_W;

  // Keep onMissRateUpdate in a ref so spawnRod/handleTapRod closures don't need it as a dep
  const onMissRateRef = useRef(onMissRateUpdate);
  useEffect(() => { onMissRateRef.current = onMissRateUpdate; }, [onMissRateUpdate]);

  function emitMissRate() {
    if (!onMissRateRef.current) return;
    const totalHigh = Math.round(cfg.totalRods * cfg.highRatio);
    onMissRateRef.current(totalHigh > 0 ? highMissedRef.current / totalHigh : 0);
  }

  const [phase, setPhase]         = useState<'intro' | 'playing' | 'done'>('intro');
  const [rods, setRods]           = useState<FallingRod[]>([]);
  const [highCaught, setHighCaught]   = useState(0);
  const [highMissed, setHighMissed]   = useState(0);
  const [falseTaps, setFalseTaps]     = useState(0);
  const [lowCaught, setLowCaught]     = useState(0);
  const [rodsSpawned, setRodsSpawned] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  // Meltdown state
  const [rulesFlipped, setRulesFlipped] = useState(false);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const binXAnims  = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;

  const rodsRef       = useRef<FallingRod[]>([]);
  const spawnedRef    = useRef(0);
  const highCaughtRef = useRef(0);
  const highMissedRef = useRef(0);
  const falseTapsRef  = useRef(0);
  const lowCaughtRef  = useRef(0);
  const gameStartRef  = useRef(0);
  const spawnTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const meltdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRefs      = useRef<{ [id: string]: Animated.CompositeAnimation }>({});

  // Column x-positions
  const colX = useCallback((binIndex: number): number => {
    const colW = SCREEN_W / cfg.numBins;
    return colW * binIndex + colW / 2 - rodW_c / 2;
  }, [cfg.numBins, rodW_c]);

  // ── Scoring ──────────────────────────────────────────────────────────────

  function computeScore(hc: number, hm: number, ft: number, lc: number, totalHigh: number): number {
    const highAcc  = totalHigh > 0 ? hc / totalHigh : 1;
    const falseRate = ft / Math.max(spawnedRef.current * cfg.distractorRatio, 1);
    const bonus    = Math.min(lc * 2, 10); // small bonus for low-priority
    const raw = (highAcc * 70) + (Math.max(0, 1 - falseRate) * 30) + bonus;
    return Math.min(100, Math.round(raw));
  }

  // ── Screen shake ─────────────────────────────────────────────────────────

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60,  useNativeDriver: true }),
    ]).start();
  }

  // ── Bin oscillation ───────────────────────────────────────────────────────

  function startOscillation() {
    binXAnims.forEach((anim, i) => {
      const phase = i % 2 === 0 ? 1 : -1;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 14 * phase,  duration: 700, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -14 * phase, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    });
  }

  function stopOscillation() {
    binXAnims.forEach(a => { a.stopAnimation(); a.setValue(0); });
  }

  // ── Spawn a rod ───────────────────────────────────────────────────────────

  const spawnRod = useCallback(() => {
    if (spawnedRef.current >= cfg.totalRods) return;

    const id = rodId();

    // Determine rod type
    const rand = Math.random();
    let type: RodType;
    if (cfg.distractors && rand < cfg.distractorRatio) {
      type = 'distractor';
    } else if (rand < cfg.distractorRatio + cfg.highRatio) {
      type = 'high';
    } else {
      type = 'low';
    }

    // Meltdown rule flip: swap high ↔ low labels (visual only, scoring still tracks original type)
    const visualType: RodType = cfg.meltdown && rulesFlipped
      ? (type === 'high' ? 'low' : type === 'low' ? 'high' : type)
      : type;

    const binIndex = Math.floor(Math.random() * cfg.numBins);
    const fallMs   = type === 'high'
      ? cfg.fallDurationMs * (1 - cfg.highPriorityBoost)
      : cfg.fallDurationMs;

    const yAnim   = new Animated.Value(-ROD_H);
    const opacAnim = new Animated.Value(1);

    const rod: FallingRod = {
      id, binIndex, type, yAnim, opacAnim,
      appearedAt: Date.now(), resolved: false,
    };

    rodsRef.current = [...rodsRef.current, rod];
    setRods([...rodsRef.current]);
    spawnedRef.current += 1;
    setRodsSpawned(spawnedRef.current);

    // Flicker effect for meltdown
    if (cfg.meltdown) {
      const flickerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacAnim, { toValue: 0.2, duration: 120, useNativeDriver: true }),
          Animated.timing(opacAnim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
        ])
      );
      setTimeout(() => {
        if (!rod.resolved) flickerLoop.start();
      }, Math.random() * 1500);
    }

    // Fall animation
    const fall = Animated.timing(yAnim, {
      toValue: playH + rodH_c + 20,
      duration: fallMs,
      useNativeDriver: true,
    });

    animRefs.current[id] = fall;

    fall.start(({ finished }) => {
      if (!finished) return; // was stopped (rod tapped)
      // Rod reached bottom unresolved = miss
      const r = rodsRef.current.find(x => x.id === id);
      if (!r || r.resolved) return;

      r.resolved = true;
      rodsRef.current = rodsRef.current.filter(x => x.id !== id);
      setRods([...rodsRef.current]);

      if (r.type === 'high') {
        highMissedRef.current += 1;
        setHighMissed(highMissedRef.current);
        if (cfg.meltdown) triggerShake();
        emitMissRate();
      }

      logTrial({
        sessionId,
        gameId: 'the_reactor',
        trialIndex: spawnedRef.current,
        stimulus: { rod_type: r.type, bin_index: r.binIndex, meltdown: cfg.meltdown },
        response:  { action: 'missed', latency_ms: fallMs },
        isCorrect: r.type !== 'high',
        responseTimeMs: fallMs,
        skipped: false,
      }).catch(() => {});

      checkComplete();
    });
  }, [cfg, rulesFlipped, sessionId]);

  // ── Tap handler ───────────────────────────────────────────────────────────

  function handleTapRod(rod: FallingRod) {
    if (rod.resolved || phase !== 'playing') return;

    const latencyMs = Date.now() - rod.appearedAt;
    rod.resolved = true;
    rod.opacAnim.stopAnimation();

    // Stop fall animation
    animRefs.current[rod.id]?.stop();

    // Fade out
    Animated.timing(rod.opacAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      rodsRef.current = rodsRef.current.filter(x => x.id !== rod.id);
      setRods([...rodsRef.current]);
    });

    let isCorrect = false;

    if (rod.type === 'high') {
      isCorrect = true;
      highCaughtRef.current += 1;
      setHighCaught(highCaughtRef.current);
      emitMissRate();
    } else if (rod.type === 'low') {
      isCorrect = true;
      lowCaughtRef.current += 1;
      setLowCaught(lowCaughtRef.current);
    } else {
      // distractor tapped = false alarm
      isCorrect = false;
      falseTapsRef.current += 1;
      setFalseTaps(falseTapsRef.current);
      if (cfg.meltdown) triggerShake();
    }

    const sc = computeScore(
      highCaughtRef.current, highMissedRef.current,
      falseTapsRef.current, lowCaughtRef.current,
      Math.round(cfg.totalRods * cfg.highRatio)
    );
    setDisplayScore(sc);

    logTrial({
      sessionId,
      gameId: 'the_reactor',
      trialIndex: spawnedRef.current,
      stimulus: { rod_type: rod.type, bin_index: rod.binIndex, meltdown: cfg.meltdown },
      response:  { action: 'tapped', latency_ms: latencyMs },
      isCorrect,
      responseTimeMs: latencyMs,
      skipped: false,
    }).catch(() => {});

    checkComplete();
  }

  function checkComplete() {
    const allSpawned = spawnedRef.current >= cfg.totalRods;
    const noneInFlight = rodsRef.current.filter(r => !r.resolved).length === 0;
    if (allSpawned && noneInFlight) {
      finishGame();
    }
  }

  // ── Finish ────────────────────────────────────────────────────────────────

  const finishGame = useCallback(() => {
    if (spawnTimer.current)    clearInterval(spawnTimer.current);
    if (meltdownTimer.current) clearInterval(meltdownTimer.current);
    stopOscillation();

    const totalHigh = Math.round(cfg.totalRods * cfg.highRatio);
    const finalScore = computeScore(
      highCaughtRef.current, highMissedRef.current,
      falseTapsRef.current, lowCaughtRef.current, totalHigh
    );

    logGamePlay({
      sessionId,
      gameId: 'the_reactor',
      startedAt: gameStartRef.current,
      endedAt: Date.now(),
      strategyJson: {
        numBins: cfg.numBins,
        highCaught: highCaughtRef.current,
        highMissed: highMissedRef.current,
        falseTaps:  falseTapsRef.current,
        lowCaught:  lowCaughtRef.current,
        totalRods:  spawnedRef.current,
      },
    }).catch(() => {});

    setPhase('done');
    onComplete(finalScore);
  }, [cfg, sessionId, onComplete]);

  // ── Start game ────────────────────────────────────────────────────────────

  function startGame() {
    gameStartRef.current  = Date.now();
    spawnedRef.current    = 0;
    highCaughtRef.current = 0;
    highMissedRef.current = 0;
    falseTapsRef.current  = 0;
    lowCaughtRef.current  = 0;
    rodsRef.current       = [];
    setRods([]);
    setPhase('playing');

    if (cfg.oscillate) startOscillation();

    // Meltdown: flip rules every 15s
    if (cfg.meltdown) {
      meltdownTimer.current = setInterval(() => {
        setRulesFlipped(f => !f);
        triggerShake();
      }, 15_000);
    }

    // Spawn interval: spread totalRods over the expected play time
    const totalMs      = cfg.fallDurationMs * 1.6;
    const spawnInterval = Math.max(500, totalMs / cfg.totalRods);

    spawnRod(); // spawn first immediately

    spawnTimer.current = setInterval(() => {
      if (spawnedRef.current >= cfg.totalRods) {
        if (spawnTimer.current) clearInterval(spawnTimer.current);
        return;
      }
      spawnRod();
    }, spawnInterval);
  }

  useEffect(() => {
    return () => {
      if (spawnTimer.current)    clearInterval(spawnTimer.current);
      if (meltdownTimer.current) clearInterval(meltdownTimer.current);
      stopOscillation();
      Object.values(animRefs.current).forEach(a => a.stop?.());
    };
  }, []);

  // Compact HUD: auto-start on mount, skip intro
  useEffect(() => {
    if (compact && phase === 'intro') startGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  // ── Render ────────────────────────────────────────────────────────────────

  const colors = BIN_COLORS.slice(0, cfg.numBins);
  const labels = BIN_LABELS.slice(0, cfg.numBins);
  const totalHigh = Math.round(cfg.totalRods * cfg.highRatio);

  // Compact HUD suppresses intro / done screens — parent component manages layout
  if (compact && (phase === 'intro' || phase === 'done')) return null;

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>☢️  The Reactor</Text>
        <Text style={styles.desc}>
          Fuel rods are falling. Tap the <Text style={{ color: '#fbbf24', fontWeight: '700' }}>⚡ glowing</Text> rods to bin them.{'\n'}
          Ignore <Text style={{ color: '#6b7280', fontWeight: '700' }}>dull</Text> rods.{'\n'}
          Never tap <Text style={{ color: '#9ca3af', fontWeight: '700' }}>💨 steam</Text> — they're distractors.
        </Text>
        <View style={styles.binPreview}>
          {colors.map((c, i) => (
            <View key={i} style={[styles.binPreviewItem, { backgroundColor: c + '33', borderColor: c }]}>
              <Text style={[styles.binPreviewLabel, { color: c }]}>{labels[i]}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btn} onPress={startGame}>
          <Text style={styles.btnText}>Start Reactor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Core Stable</Text>
        <Text style={styles.scoreText}>{displayScore}</Text>
        <View style={styles.statsBox}>
          <Stat label="Priority Caught" value={`${highCaughtRef.current}/${totalHigh}`} color="#22c55e" />
          <Stat label="Missed"          value={String(highMissedRef.current)}           color="#ef4444" />
          <Stat label="False Alarms"    value={String(falseTapsRef.current)}            color="#f59e0b" />
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.gameContainer, { transform: [{ translateX: shakeAnim }] }]}>
      {/* Header */}
      <View style={[styles.gameHeader, compact && { paddingTop: 4, paddingBottom: 3 }]}>
        <Text style={styles.gameTitle}>☢️ Reactor</Text>
        <View style={styles.statRow}>
          <Text style={styles.statText}>⚡ {highCaughtRef.current}/{totalHigh}</Text>
          <Text style={styles.statText}>Score: {displayScore}</Text>
          {cfg.distractors && <Text style={styles.statText}>💨 ✗ {falseTapsRef.current}</Text>}
        </View>
        {cfg.meltdown && rulesFlipped && (
          <View style={styles.flipBanner}>
            <Text style={styles.flipText}>⚠ PRIORITY RULES FLIPPED</Text>
          </View>
        )}
      </View>

      {/* Play field */}
      <View style={styles.playField} pointerEvents="box-none">
        {rods.map(rod => {
          const x = colX(rod.binIndex);
          const isHigh = rod.type === 'high';
          const isDist = rod.type === 'distractor';
          const rodColor = isDist ? '#6b7280'
            : colors[rod.binIndex % colors.length];
          const glow = isHigh ? { shadowColor: rodColor, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 } : {};

          return (
            <Animated.View
              key={rod.id}
              style={[
                styles.rod,
                compact && { width: rodW_c, height: rodH_c, borderRadius: rodH_c / 2 },
                { backgroundColor: rodColor + (isHigh ? 'ff' : '88') },
                { left: x },
                { transform: [{ translateY: rod.yAnim }] },
                { opacity: rod.opacAnim },
                glow,
              ]}
            >
              <TouchableOpacity
                onPress={() => handleTapRod(rod)}
                style={[styles.rodTouchable, compact && { width: rodW_c + 8, height: rodH_c + 8, borderRadius: (rodH_c + 8) / 2 }]}
                activeOpacity={0.7}
              >
                <Text style={styles.rodIcon}>
                  {isDist ? '💨' : isHigh ? '⚡' : '◦'}
                </Text>
                {isHigh && (
                  <View style={[styles.glowRing, { borderColor: rodColor }]} />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Bins */}
      <View style={[styles.binsRow, compact && { height: 28 }]}>
        {colors.map((c, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bin,
              { backgroundColor: c + '22', borderColor: c },
              { transform: [{ translateX: binXAnims[i] }] },
            ]}
          >
            <Text style={[styles.binLabel, { color: c }]}>{labels[i]}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 24 },

  title:     { fontSize: 24, fontWeight: '800', color: '#e0e0ff', marginBottom: 14, textAlign: 'center' },
  desc:      { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  binPreview:{ flexDirection: 'row', gap: 8, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center' },
  binPreviewItem: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  binPreviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  btn:     { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  scoreText: { fontSize: 72, fontWeight: '800', color: '#a78bfa', marginBottom: 16 },
  statsBox:  { flexDirection: 'row', gap: 20, backgroundColor: '#1e1d2e', borderRadius: 12, padding: 16 },
  statItem:  { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#9ca3af', letterSpacing: 0.5 },

  // Game layout
  gameContainer: { flex: 1, backgroundColor: '#0a0a14' },

  gameHeader: {
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: '#111120', borderBottomWidth: 1, borderBottomColor: '#1e1d2e',
  },
  gameTitle: { fontSize: 14, fontWeight: '700', color: '#a78bfa', textAlign: 'center', marginBottom: 4 },
  statRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  statText:  { fontSize: 13, color: '#d1d5db', fontWeight: '600' },

  flipBanner: {
    backgroundColor: '#7c2d12', borderRadius: 6, paddingVertical: 3,
    alignItems: 'center', marginTop: 6,
  },
  flipText: { fontSize: 11, color: '#fca5a5', fontWeight: '700', letterSpacing: 1 },

  playField: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  rod: {
    position: 'absolute',
    width: ROD_W,
    height: ROD_H,
    borderRadius: ROD_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodTouchable: {
    width: ROD_W + 8,
    height: ROD_H + 8,
    borderRadius: (ROD_H + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodIcon:  { fontSize: 20 },
  glowRing: {
    position: 'absolute',
    width: ROD_W + 12,
    height: ROD_H + 12,
    borderRadius: (ROD_H + 12) / 2,
    borderWidth: 2,
    opacity: 0.6,
  },

  binsRow: {
    flexDirection: 'row',
    height: BIN_H,
    backgroundColor: '#0f0e17',
    borderTopWidth: 1,
    borderTopColor: '#1e1d2e',
  },
  bin: {
    flex: 1,
    borderTopWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  binLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
});
