/**
 * Reactor Chaos — Panic Management (T04)
 *
 * The Reactor in Chaos Phase. Fuel rods still fall and must be sorted,
 * but the game periodically triggers "System Failure" events that stress-test
 * the user's ability to remain accurate, fast, and composed.
 *
 * Chaos Effects (level-driven):
 *   flicker       — screen rapidly dims and brightens
 *   steam         — opaque cloud covers portion of play field
 *   shake         — screen jolts (X and Y)
 *   dim           — persistent dark overlay reduces visibility
 *   inversion     — bin colors temporarily swap (elite / L10 only)
 *   input_lag     — taps register with artificial delay (simulates sluggishness)
 *
 * T04-Specific Metrics (logged per session):
 *   precision_delta   calmAcc − chaosAcc  (how much accuracy drops in chaos)
 *   recovery_ms       time from chaos event end to first correct tap
 *   panic_clicks      rapid non-target taps during chaos (≤250ms apart)
 *   chaos_rt_sd       std deviation of RT during chaos events
 *
 * Score formula:
 *   calmAccuracy    × 25  +  (1 − precisionDelta) × 35
 *   + (1 − panicClickRate)×20  +  recoveryScore × 20
 *
 * Professional benchmarks:
 *   Commercial Pilot      L10, precision_delta < 0.03,  recovery < 150ms
 *   Air Traffic Controller L9+, zero panic_clicks
 *   Stock Trader           L8+, high consistency during inversion events
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
const ROD_H    = 50;
const ROD_W    = 50;
const HEADER_H = 90;
const PLAY_H   = SCREEN_H - HEADER_H - BIN_H - 40;

const BIN_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899'] as const;
const BIN_LABELS = ['RED', 'BLUE', 'GOLD', 'GREEN', 'VIOLET', 'PINK'] as const;

type RodType = 'high' | 'low' | 'distractor';
type Effect  = 'flicker' | 'steam' | 'shake' | 'dim' | 'inversion' | 'input_lag';

interface FallingRod {
  id:          string;
  binIndex:    number;
  type:        RodType;
  yAnim:       Animated.Value;
  opacAnim:    Animated.Value;
  appearedAt:  number;
  resolved:    boolean;
  inChaos:     boolean;  // was chaos active when this rod appeared?
}

export interface ChaosConfig {
  numBins:            number;
  fallDurationMs:     number;
  totalRods:          number;
  highRatio:          number;
  distractorRatio:    number;
  // Chaos event config
  chaosIntervalMs:    number;   // avg ms between chaos events
  chaosDurationMs:    number;   // how long each event lasts
  effects:            Effect[];
  inputLagMs:         number;   // artificial delay added to taps during chaos
  steamOpacity:       number;   // 0-1 opacity of steam overlay
  dimOpacity:         number;   // 0-1 of darkness overlay
  shakeIntensityX:    number;   // px
  shakeIntensityY:    number;   // px
  invertColors:       boolean;  // swap bin colour assignments
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<ChaosConfig>;
}

let _id = 0;
function rid(): string { return `r_${++_id}`; }

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq   = arr.map(x => (x - mean) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / arr.length);
}

const DEFAULTS: ChaosConfig = {
  numBins: 2, fallDurationMs: 3500, totalRods: 14,
  highRatio: 0.40, distractorRatio: 0,
  chaosIntervalMs: 9999999, chaosDurationMs: 0, effects: [],
  inputLagMs: 0, steamOpacity: 0, dimOpacity: 0,
  shakeIntensityX: 0, shakeIntensityY: 0, invertColors: false,
};

export default function ReactorChaosGame({ sessionId, onComplete, config }: Props) {
  const cfg: ChaosConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase]     = useState<'intro' | 'playing' | 'done'>('intro');
  const [rods, setRods]       = useState<FallingRod[]>([]);
  const [inChaos, setInChaos] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [chaosLabel, setChaosLabel]     = useState('');
  const [colorsInverted, setColorsInverted] = useState(false);

  // Animated values for visual effects
  const shakeX    = useRef(new Animated.Value(0)).current;
  const shakeY    = useRef(new Animated.Value(0)).current;
  const dimAnim   = useRef(new Animated.Value(0)).current;
  const steamAnim = useRef(new Animated.Value(0)).current;
  const flickAnim = useRef(new Animated.Value(1)).current;
  const binXAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;

  // Metrics refs
  const rodsRef            = useRef<FallingRod[]>([]);
  const spawnedRef         = useRef(0);
  const inChaosRef         = useRef(false);
  const chaosStartRef      = useRef(0);
  const chaosEndRef        = useRef(0);
  const calmCorrectRef     = useRef(0);
  const calmTotalRef       = useRef(0);
  const chaosCorrectRef    = useRef(0);
  const chaosTotalRef      = useRef(0);
  const panicClicksRef     = useRef(0);
  const lastTapTimeRef     = useRef(0);
  const recoveryMsRef      = useRef<number[]>([]);
  const waitingRecovery    = useRef(false);
  const chaosRtRef         = useRef<number[]>([]);
  const gameStartRef       = useRef(0);
  const animRefsMap        = useRef<{ [id: string]: Animated.CompositeAnimation }>({});

  const spawnTimer         = useRef<ReturnType<typeof setInterval> | null>(null);
  const chaosTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaosEndTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flickerLoop        = useRef<Animated.CompositeAnimation | null>(null);
  const invertTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Column positions ───────────────────────────────────────────────────────
  const colX = useCallback((bi: number) => {
    const colW = SCREEN_W / cfg.numBins;
    return colW * bi + colW / 2 - ROD_W / 2;
  }, [cfg.numBins]);

  // ── Score computation ──────────────────────────────────────────────────────
  function computeScore(): number {
    const calmAcc   = calmTotalRef.current > 0 ? calmCorrectRef.current / calmTotalRef.current : 1;
    const chaosAcc  = chaosTotalRef.current > 0 ? chaosCorrectRef.current / chaosTotalRef.current : 1;
    const delta     = Math.max(0, calmAcc - chaosAcc);
    const avgRecovMs = recoveryMsRef.current.length > 0
      ? recoveryMsRef.current.reduce((a, b) => a + b, 0) / recoveryMsRef.current.length
      : 300;
    const recoverySc = Math.max(0, 1 - (avgRecovMs - 150) / 3000);
    const totalChaosRods = chaosTotalRef.current || 1;
    const panicRate = Math.min(panicClicksRef.current / Math.max(totalChaosRods, 3), 1);

    const raw = (calmAcc * 25) + ((1 - delta) * 35) + ((1 - panicRate) * 20) + (recoverySc * 20);
    return Math.min(100, Math.max(0, Math.round(raw)));
  }

  // ── Shake ─────────────────────────────────────────────────────────────────
  function triggerShake(ix = cfg.shakeIntensityX, iy = cfg.shakeIntensityY) {
    if (ix === 0 && iy === 0) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(shakeX, { toValue:  ix,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue:  iy,  duration: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(shakeX, { toValue: -ix,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue: -iy,  duration: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(shakeX, { toValue:  ix * 0.6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue: -iy * 0.6, duration: 50, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeY, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
    ]).start();
  }

  // ── Chaos event start/end ─────────────────────────────────────────────────
  const startChaos = useCallback(() => {
    if (phase !== 'playing' && !gameStartRef.current) return;
    inChaosRef.current   = true;
    chaosStartRef.current = Date.now();
    setInChaos(true);
    waitingRecovery.current = true;

    const effects = cfg.effects;

    if (effects.includes('shake')) triggerShake();
    if (effects.includes('flicker')) {
      flickerLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flickAnim, { toValue: 0.15, duration: 80, useNativeDriver: true }),
          Animated.timing(flickAnim, { toValue: 1.00, duration: 80, useNativeDriver: true }),
        ])
      );
      flickerLoop.current.start();
    }
    if (effects.includes('dim')) {
      Animated.timing(dimAnim, { toValue: cfg.dimOpacity, duration: 200, useNativeDriver: true }).start();
    }
    if (effects.includes('steam')) {
      Animated.timing(steamAnim, { toValue: cfg.steamOpacity, duration: 300, useNativeDriver: true }).start();
    }
    if (effects.includes('inversion') && cfg.invertColors) {
      setColorsInverted(true);
      setChaosLabel('⚠ COLORS INVERTED');
      if (invertTimer.current) clearTimeout(invertTimer.current);
      invertTimer.current = setTimeout(() => {
        setColorsInverted(false);
        setChaosLabel('SYSTEM FAILURE');
      }, 5000);
    } else {
      setChaosLabel('⚠ SYSTEM FAILURE');
    }

    // Bins oscillate during chaos if shake is active
    if (effects.includes('shake')) {
      binXAnims.slice(0, cfg.numBins).forEach((a, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        Animated.loop(
          Animated.sequence([
            Animated.timing(a, { toValue: 18 * dir,  duration: 500, useNativeDriver: true }),
            Animated.timing(a, { toValue: -18 * dir, duration: 500, useNativeDriver: true }),
          ])
        ).start();
      });
    }

    chaosEndTimer.current = setTimeout(endChaos, cfg.chaosDurationMs);
  }, [cfg, phase]);

  const endChaos = useCallback(() => {
    inChaosRef.current  = false;
    chaosEndRef.current = Date.now();
    setInChaos(false);
    setChaosLabel('');
    setColorsInverted(false);

    flickerLoop.current?.stop();
    Animated.timing(flickAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    Animated.timing(dimAnim,   { toValue: 0, duration: 300, useNativeDriver: true }).start();
    Animated.timing(steamAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    binXAnims.forEach(a => { a.stopAnimation(); a.setValue(0); });

    // Schedule next chaos event
    const jitter = (Math.random() - 0.5) * cfg.chaosIntervalMs * 0.4;
    const nextIn = Math.max(1500, cfg.chaosIntervalMs + jitter);
    if (spawnedRef.current < cfg.totalRods) {
      chaosTimer.current = setTimeout(startChaos, nextIn);
    }
  }, [cfg, startChaos, binXAnims]);

  // ── Spawn rod ──────────────────────────────────────────────────────────────
  const spawnRod = useCallback(() => {
    if (spawnedRef.current >= cfg.totalRods) return;
    const id = rid();

    const rand = Math.random();
    let type: RodType;
    if (cfg.distractorRatio > 0 && rand < cfg.distractorRatio) type = 'distractor';
    else if (rand < cfg.distractorRatio + cfg.highRatio)        type = 'high';
    else                                                          type = 'low';

    const binIndex = Math.floor(Math.random() * cfg.numBins);
    const fallMs   = type === 'high' ? cfg.fallDurationMs * 0.82 : cfg.fallDurationMs;
    const yAnim    = new Animated.Value(-ROD_H);
    const opacAnim = new Animated.Value(1);

    const rod: FallingRod = {
      id, binIndex, type, yAnim, opacAnim,
      appearedAt: Date.now(), resolved: false,
      inChaos: inChaosRef.current,
    };

    rodsRef.current = [...rodsRef.current, rod];
    setRods([...rodsRef.current]);
    spawnedRef.current += 1;

    const fall = Animated.timing(yAnim, {
      toValue: PLAY_H + ROD_H + 20,
      duration: fallMs,
      useNativeDriver: true,
    });
    animRefsMap.current[id] = fall;

    fall.start(({ finished }) => {
      if (!finished) return;
      const r = rodsRef.current.find(x => x.id === id);
      if (!r || r.resolved) return;

      r.resolved = true;
      rodsRef.current = rodsRef.current.filter(x => x.id !== id);
      setRods([...rodsRef.current]);

      // Miss penalty tracking
      if (r.inChaos) {
        chaosTotalRef.current += 1;
        // Miss = incorrect for high-priority
      } else {
        calmTotalRef.current += 1;
      }

      if (r.type === 'high' && inChaosRef.current) triggerShake(6, 4);

      logTrial({
        sessionId, gameId: 'reactor_chaos',
        trialIndex: spawnedRef.current,
        stimulus: { rod_type: r.type, bin_index: r.binIndex, in_chaos: r.inChaos },
        response:  { action: 'missed' },
        isCorrect: r.type !== 'high', responseTimeMs: fallMs, skipped: false,
      }).catch(() => {});

      checkComplete();
    });
  }, [cfg, sessionId]);

  // ── Tap handler ────────────────────────────────────────────────────────────
  function handleTapRod(rod: FallingRod) {
    if (rod.resolved || phase !== 'playing') return;

    const now = Date.now();

    // Panic click detection: rapid taps ≤250ms apart during chaos
    if (inChaosRef.current && now - lastTapTimeRef.current <= 250) {
      panicClicksRef.current += 1;
    }
    lastTapTimeRef.current = now;

    // Input lag simulation
    const lagMs = cfg.effects.includes('input_lag') && inChaosRef.current ? cfg.inputLagMs : 0;

    const applyTap = () => {
      if (rod.resolved) return;
      rod.resolved = true;
      animRefsMap.current[rod.id]?.stop();
      rod.opacAnim.stopAnimation();
      Animated.timing(rod.opacAnim, { toValue: 0, duration: 130, useNativeDriver: true })
        .start(() => {
          rodsRef.current = rodsRef.current.filter(x => x.id !== rod.id);
          setRods([...rodsRef.current]);
        });

      const latencyMs = Date.now() - rod.appearedAt;
      const isCorrect = rod.type !== 'distractor';

      if (rod.inChaos || inChaosRef.current) {
        chaosTotalRef.current += 1;
        if (isCorrect) {
          chaosCorrectRef.current += 1;
          chaosRtRef.current.push(latencyMs);
        }
        // Recovery: first correct tap after chaos event ends
        if (waitingRecovery.current && !inChaosRef.current && isCorrect) {
          const recMs = Date.now() - chaosEndRef.current;
          recoveryMsRef.current.push(recMs);
          waitingRecovery.current = false;
        }
      } else {
        calmTotalRef.current += 1;
        if (isCorrect) calmCorrectRef.current += 1;
        if (!isCorrect) { /* false alarm during calm */ }
      }

      if (!isCorrect && inChaosRef.current) triggerShake(8, 6);

      setDisplayScore(computeScore());

      logTrial({
        sessionId, gameId: 'reactor_chaos',
        trialIndex: spawnedRef.current,
        stimulus: { rod_type: rod.type, bin_index: rod.binIndex, in_chaos: inChaosRef.current },
        response:  { action: 'tapped', latency_ms: latencyMs, lag_ms: lagMs },
        isCorrect,
        responseTimeMs: latencyMs, skipped: false,
      }).catch(() => {});

      checkComplete();
    };

    if (lagMs > 0) {
      setTimeout(applyTap, lagMs);
    } else {
      applyTap();
    }
  }

  function checkComplete() {
    const allSpawned    = spawnedRef.current >= cfg.totalRods;
    const noneInFlight  = rodsRef.current.filter(r => !r.resolved).length === 0;
    if (allSpawned && noneInFlight) finishGame();
  }

  // ── Finish ─────────────────────────────────────────────────────────────────
  const finishGame = useCallback(() => {
    if (spawnTimer.current)   clearInterval(spawnTimer.current);
    if (chaosTimer.current)   clearTimeout(chaosTimer.current);
    if (chaosEndTimer.current)clearTimeout(chaosEndTimer.current);
    if (invertTimer.current)  clearTimeout(invertTimer.current);
    flickerLoop.current?.stop();
    binXAnims.forEach(a => { a.stopAnimation(); a.setValue(0); });

    const finalScore = computeScore();

    logGamePlay({
      sessionId, gameId: 'reactor_chaos',
      startedAt: gameStartRef.current, endedAt: Date.now(),
      strategyJson: {
        numBins: cfg.numBins,
        calmAccuracy:    calmTotalRef.current > 0 ? calmCorrectRef.current / calmTotalRef.current : 1,
        chaosAccuracy:   chaosTotalRef.current > 0 ? chaosCorrectRef.current / chaosTotalRef.current : 1,
        precisionDelta:  Math.max(0, (calmCorrectRef.current / Math.max(calmTotalRef.current, 1)) - (chaosCorrectRef.current / Math.max(chaosTotalRef.current, 1))),
        panicClicks:     panicClicksRef.current,
        avgRecoveryMs:   recoveryMsRef.current.length > 0 ? Math.round(recoveryMsRef.current.reduce((a, b) => a + b, 0) / recoveryMsRef.current.length) : 0,
        chaosRtSd:       Math.round(stdDev(chaosRtRef.current)),
      },
    }).catch(() => {});

    setPhase('done');
    onComplete(finalScore);
  }, [cfg, sessionId, onComplete]);

  // ── Start ──────────────────────────────────────────────────────────────────
  function startGame() {
    gameStartRef.current     = Date.now();
    spawnedRef.current       = 0;
    calmCorrectRef.current   = 0;
    calmTotalRef.current     = 0;
    chaosCorrectRef.current  = 0;
    chaosTotalRef.current    = 0;
    panicClicksRef.current   = 0;
    recoveryMsRef.current    = [];
    chaosRtRef.current       = [];
    rodsRef.current          = [];
    setRods([]);
    setPhase('playing');

    const totalMs      = cfg.fallDurationMs * 1.5;
    const spawnInterval = Math.max(400, totalMs / cfg.totalRods);

    spawnRod();
    spawnTimer.current = setInterval(() => {
      if (spawnedRef.current >= cfg.totalRods) {
        if (spawnTimer.current) clearInterval(spawnTimer.current);
        return;
      }
      spawnRod();
    }, spawnInterval);

    // First chaos event after initial calm period
    if (cfg.chaosDurationMs > 0) {
      chaosTimer.current = setTimeout(startChaos, cfg.chaosIntervalMs);
    }
  }

  useEffect(() => {
    return () => {
      if (spawnTimer.current)   clearInterval(spawnTimer.current);
      if (chaosTimer.current)   clearTimeout(chaosTimer.current);
      if (chaosEndTimer.current)clearTimeout(chaosEndTimer.current);
      if (invertTimer.current)  clearTimeout(invertTimer.current);
      flickerLoop.current?.stop();
      Object.values(animRefsMap.current).forEach(a => (a as any).stop?.());
    };
  }, []);

  // ── Color map (supports inversion at L10) ────────────────────────────────
  const effectiveColors = colorsInverted
    ? [...BIN_COLORS.slice(0, cfg.numBins)].reverse()
    : BIN_COLORS.slice(0, cfg.numBins);
  const effectiveLabels = colorsInverted
    ? [...BIN_LABELS.slice(0, cfg.numBins)].reverse()
    : BIN_LABELS.slice(0, cfg.numBins);

  const totalHigh = Math.round(cfg.totalRods * cfg.highRatio);

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>☢️  Reactor: Chaos Mode</Text>
        <Text style={styles.desc}>
          Sort fuel rods as usual — but the reactor is unstable.{'\n'}
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>System Failures</Text> will trigger without warning.{'\n'}
          Stay precise. Stay calm. Don't panic-click.
        </Text>
        <View style={styles.binPreview}>
          {effectiveColors.map((c, i) => (
            <View key={i} style={[styles.binPill, { borderColor: c, backgroundColor: c + '22' }]}>
              <Text style={[styles.binPillText, { color: c }]}>{effectiveLabels[i]}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btn} onPress={startGame}>
          <Text style={styles.btnText}>Enter Reactor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const calmAcc  = calmTotalRef.current  > 0 ? Math.round((calmCorrectRef.current  / calmTotalRef.current)  * 100) : 100;
    const chaosAcc = chaosTotalRef.current > 0 ? Math.round((chaosCorrectRef.current / chaosTotalRef.current) * 100) : 100;
    const delta    = Math.max(0, calmAcc - chaosAcc);
    const avgRec   = recoveryMsRef.current.length > 0
      ? Math.round(recoveryMsRef.current.reduce((a, b) => a + b, 0) / recoveryMsRef.current.length)
      : 0;
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Reactor Stabilised</Text>
        <Text style={styles.scoreText}>{displayScore}</Text>
        <View style={styles.statsGrid}>
          <Stat label="Calm Accuracy"    value={`${calmAcc}%`}       color="#22c55e" />
          <Stat label="Chaos Accuracy"   value={`${chaosAcc}%`}      color={delta > 15 ? '#ef4444' : '#f59e0b'} />
          <Stat label="Precision Delta"  value={`${delta}%`}         color={delta < 5 ? '#22c55e' : '#ef4444'} />
          <Stat label="Avg Recovery"     value={avgRec > 0 ? `${avgRec}ms` : '—'} color="#a78bfa" />
          <Stat label="Panic Clicks"     value={String(panicClicksRef.current)}    color={panicClicksRef.current === 0 ? '#22c55e' : '#ef4444'} />
          <Stat label="Chaos RT σ"       value={`${Math.round(stdDev(chaosRtRef.current))}ms`} color="#9ca3af" />
        </View>
      </View>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[styles.gameContainer, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}
    >
      {/* Header */}
      <View style={[styles.header, inChaos && styles.headerChaos]}>
        <Text style={styles.headerTitle}>
          {inChaos ? '🚨  SYSTEM FAILURE' : '☢️  Reactor: Chaos Mode'}
        </Text>
        {chaosLabel ? (
          <Text style={styles.chaosLabel}>{chaosLabel}</Text>
        ) : (
          <View style={styles.statRow}>
            <Text style={styles.statText}>⚡ {calmCorrectRef.current + chaosCorrectRef.current}/{totalHigh}</Text>
            <Text style={styles.statText}>Score {displayScore}</Text>
            <Text style={styles.statText}>⚡⚡ {panicClicksRef.current} panic</Text>
          </View>
        )}
      </View>

      {/* Play field */}
      <Animated.View style={[styles.playField, { opacity: flickAnim }]} pointerEvents="box-none">
        {rods.map(rod => {
          const x = colX(rod.binIndex);
          const isHigh = rod.type === 'high';
          const isDist = rod.type === 'distractor';
          const rodColor = isDist
            ? '#6b7280'
            : effectiveColors[rod.binIndex % effectiveColors.length];

          return (
            <Animated.View
              key={rod.id}
              style={[
                styles.rod,
                { backgroundColor: rodColor + (isHigh ? 'ff' : '88'), left: x },
                { transform: [{ translateY: rod.yAnim }], opacity: rod.opacAnim },
                isHigh && { shadowColor: rodColor, shadowOpacity: 0.9, shadowRadius: 14, elevation: 8 },
              ]}
            >
              <TouchableOpacity onPress={() => handleTapRod(rod)} style={styles.rodTouch} activeOpacity={0.7}>
                <Text style={styles.rodIcon}>{isDist ? '💨' : isHigh ? '⚡' : '◦'}</Text>
                {isHigh && <View style={[styles.glowRing, { borderColor: rodColor }]} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Dim overlay */}
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#000', opacity: dimAnim }]}
        />

        {/* Steam overlay */}
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#9ca3af', opacity: steamAnim }]}
        >
          <Text style={styles.steamText}>💨💨💨</Text>
        </Animated.View>
      </Animated.View>

      {/* Bins */}
      <View style={styles.binsRow}>
        {effectiveColors.map((c, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bin,
              { backgroundColor: c + '22', borderColor: c },
              inChaos && { borderColor: '#ef4444' },
              { transform: [{ translateX: binXAnims[i] }] },
            ]}
          >
            <Text style={[styles.binLabel, { color: inChaos ? '#fca5a5' : c }]}>
              {effectiveLabels[i]}
            </Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:     { fontSize: 22, fontWeight: '800', color: '#e0e0ff', marginBottom: 12, textAlign: 'center' },
  desc:      { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  binPreview:{ flexDirection: 'row', gap: 6, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  binPill:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  binPillText:{ fontSize: 11, fontWeight: '700' },
  btn:       { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },

  scoreText: { fontSize: 68, fontWeight: '800', color: '#a78bfa', marginBottom: 16 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 14, width: '100%',
  },
  statItem: { width: '30%', alignItems: 'center', paddingVertical: 8 },
  statVal:  { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  statLbl:  { fontSize: 9, color: '#9ca3af', letterSpacing: 0.4, textAlign: 'center' },

  gameContainer: { flex: 1, backgroundColor: '#0a0a14' },

  header: {
    paddingTop: 10, paddingHorizontal: 14, paddingBottom: 8,
    backgroundColor: '#111120', borderBottomWidth: 1, borderBottomColor: '#1e1d2e',
  },
  headerChaos: { backgroundColor: '#1c0a0a', borderBottomColor: '#ef4444' },
  headerTitle: { fontSize: 13, fontWeight: '700', color: '#a78bfa', textAlign: 'center', marginBottom: 4 },
  chaosLabel:  { fontSize: 12, color: '#fca5a5', fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  statRow:     { flexDirection: 'row', justifyContent: 'space-around' },
  statText:    { fontSize: 12, color: '#d1d5db', fontWeight: '600' },

  playField: { flex: 1, position: 'relative', overflow: 'hidden' },
  overlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  steamText: { fontSize: 48, opacity: 0.6 },

  rod: {
    position: 'absolute', width: ROD_W, height: ROD_H,
    borderRadius: ROD_H / 2, alignItems: 'center', justifyContent: 'center',
  },
  rodTouch: {
    width: ROD_W + 8, height: ROD_H + 8,
    borderRadius: (ROD_H + 8) / 2, alignItems: 'center', justifyContent: 'center',
  },
  rodIcon:  { fontSize: 20 },
  glowRing: {
    position: 'absolute', width: ROD_W + 12, height: ROD_H + 12,
    borderRadius: (ROD_H + 12) / 2, borderWidth: 2, opacity: 0.6,
  },

  binsRow: {
    flexDirection: 'row', height: BIN_H,
    backgroundColor: '#0f0e17', borderTopWidth: 1, borderTopColor: '#1e1d2e',
  },
  bin:      { flex: 1, borderTopWidth: 2, alignItems: 'center', justifyContent: 'center' },
  binLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
});
