/**
 * Vector Flow — Processing Speed (T21 / G10)
 *
 * Mach-speed classification tunnel. Objects rush toward you — classify
 * Mechanical vs Biological before they pass. Rule-flips swap L/R every 10s.
 *
 * KPIs:
 *   mrt           — Mean Reaction Time from object appearance to tap (ms)
 *   accuracy      — % of correctly classified objects
 *   switchingCost — RT spike (ms) immediately after a rule flip
 *
 * Config params (via traitCatalog gameParams):
 *   speed          number   approach duration (ms) — lower = faster
 *   classCount     number   2 (Mech/Bio) | 4 (sub-classes)
 *   tunnelRotation boolean  barrel slowly rotates
 *   ruleFlips      boolean  L/R swap every 10s
 *   totalObjects   number   objects per session
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'mechanical' | 'biological';
type SubClass = 'engine' | 'circuit' | 'plant' | 'creature';

interface TunnelObject {
  id: number;
  label: string;
  emoji: string;
  category: Category;
  subClass: SubClass;
  spawnTime: number;
}

interface VectorFlowConfig {
  speed: number;         // fall duration ms (approach time)
  classCount: number;    // 2 | 4
  tunnelRotation: boolean;
  ruleFlips: boolean;
  totalObjects: number;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<VectorFlowConfig>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DEFAULTS: VectorFlowConfig = {
  speed: 3000,
  classCount: 2,
  tunnelRotation: false,
  ruleFlips: false,
  totalObjects: 12,
};

const RULE_FLIP_INTERVAL_MS = 10_000;

// Object pools by sub-class
const OBJECT_POOL: Record<SubClass, { label: string; emoji: string }[]> = {
  engine: [
    { label: 'Piston', emoji: '⚙️' },
    { label: 'Turbine', emoji: '🌀' },
    { label: 'Gear', emoji: '⚙️' },
    { label: 'Motor', emoji: '🔧' },
  ],
  circuit: [
    { label: 'Microchip', emoji: '💾' },
    { label: 'Capacitor', emoji: '🔌' },
    { label: 'Relay', emoji: '📡' },
    { label: 'Diode', emoji: '⚡' },
  ],
  plant: [
    { label: 'Fern', emoji: '🌿' },
    { label: 'Moss', emoji: '🍃' },
    { label: 'Cactus', emoji: '🌵' },
    { label: 'Spore', emoji: '🍄' },
  ],
  creature: [
    { label: 'Bacterium', emoji: '🦠' },
    { label: 'Insect', emoji: '🐛' },
    { label: 'Fish', emoji: '🐟' },
    { label: 'Bird', emoji: '🦅' },
  ],
};

const SUB_CLASS_CATEGORY: Record<SubClass, Category> = {
  engine: 'mechanical',
  circuit: 'mechanical',
  plant: 'biological',
  creature: 'biological',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateObject(id: number, classCount: number): TunnelObject {
  const subClasses: SubClass[] =
    classCount >= 4
      ? ['engine', 'circuit', 'plant', 'creature']
      : ['engine', 'creature'];

  const subClass = pickRandom(subClasses);
  const pool = OBJECT_POOL[subClass];
  const item = pickRandom(pool);
  return {
    id,
    label: item.label,
    emoji: item.emoji,
    category: SUB_CLASS_CATEGORY[subClass],
    subClass,
    spawnTime: Date.now(),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VectorFlowGame({ sessionId, onComplete, config }: Props) {
  const cfg: VectorFlowConfig = { ...DEFAULTS, ...config };

  // Phase: 'intro' | 'playing' | 'done'
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [currentObj, setCurrentObj] = useState<TunnelObject | null>(null);

  // Rule state: which side is Mechanical
  // Default: LEFT = Mechanical, RIGHT = Biological
  const [mechLeft, setMechLeft] = useState(true);
  const [ruleFlipCount, setRuleFlipCount] = useState(0);
  const [showFlashBanner, setShowFlashBanner] = useState(false);

  // Stats
  const [score, setScore] = useState<number | null>(null);
  const [objectsDone, setObjectsDone] = useState(0);
  const [hitCount, setHitCount] = useState(0);

  // Tunnel rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Approach animation (scale: small → large, simulating tunnel approach)
  const approachAnim = useRef(new Animated.Value(0)).current;
  const approachAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Internal state tracked via refs (to avoid stale closure issues)
  const mechLeftRef = useRef(mechLeft);
  useEffect(() => { mechLeftRef.current = mechLeft; }, [mechLeft]);

  const objectsDoneRef = useRef(0);
  const hitCountRef = useRef(0);
  const totalRtRef = useRef(0);
  const rtSamplesRef = useRef<number[]>([]);       // all RT values
  const postFlipRtRef = useRef<number[]>([]);      // RT values for first object after each flip
  const preFlipRtRef = useRef<number[]>([]);       // RT values for objects before flips (baseline)
  const sessionActiveRef = useRef(false);
  const currentObjRef = useRef<TunnelObject | null>(null);
  useEffect(() => { currentObjRef.current = currentObj; }, [currentObj]);

  const objIdCounter = useRef(0);
  const ruleFlipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextFlipInRef = useRef(false); // flags the next object as post-flip

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      if (ruleFlipTimerRef.current) clearTimeout(ruleFlipTimerRef.current);
      if (objectTimerRef.current) clearTimeout(objectTimerRef.current);
      approachAnimRef.current?.stop();
    };
  }, []);

  // ── Tunnel rotation loop ───────────────────────────────────────────────────

  useEffect(() => {
    if (!cfg.tunnelRotation || phase !== 'playing') return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [cfg.tunnelRotation, phase, rotateAnim]);

  // ── Spawn next object ──────────────────────────────────────────────────────

  const spawnNextObject = useCallback(() => {
    if (!sessionActiveRef.current) return;
    if (objectsDoneRef.current >= cfg.totalObjects) return;

    const isPostFlip = nextFlipInRef.current;
    nextFlipInRef.current = false;

    const obj = generateObject(++objIdCounter.current, cfg.classCount);
    obj.spawnTime = Date.now();

    // Tag if this is a post-flip object (for switchingCost KPI)
    // We store the flag separately on the ref so classifyObject can read it
    (obj as any)._isPostFlip = isPostFlip;
    if (!isPostFlip) {
      // Pre-flip baseline: record the spawn time to compute RT later
      (obj as any)._isPreFlip = true;
    }

    setCurrentObj(obj);
    approachAnim.setValue(0);

    // Start approach animation
    const anim = Animated.timing(approachAnim, {
      toValue: 1,
      duration: cfg.speed,
      useNativeDriver: true,
    });
    approachAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (!finished || !sessionActiveRef.current) return;
      // Object passed without classification — miss
      handleMiss();
    });
  }, [cfg.totalObjects, cfg.classCount, cfg.speed, approachAnim]);

  // ── Rule flip ─────────────────────────────────────────────────────────────

  const scheduleRuleFlip = useCallback(() => {
    if (!cfg.ruleFlips || !sessionActiveRef.current) return;
    ruleFlipTimerRef.current = setTimeout(() => {
      if (!sessionActiveRef.current) return;

      // Mark that the next spawned object is post-flip
      nextFlipInRef.current = true;

      setMechLeft(prev => !prev);
      setRuleFlipCount(prev => prev + 1);

      // Flash the banner briefly
      setShowFlashBanner(true);
      setTimeout(() => setShowFlashBanner(false), 1200);

      scheduleRuleFlip();
    }, RULE_FLIP_INTERVAL_MS);
  }, [cfg.ruleFlips]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    sessionActiveRef.current = true;
    objectsDoneRef.current = 0;
    hitCountRef.current = 0;
    totalRtRef.current = 0;
    rtSamplesRef.current = [];
    postFlipRtRef.current = [];
    preFlipRtRef.current = [];
    setObjectsDone(0);
    setHitCount(0);
    setPhase('playing');

    if (cfg.ruleFlips) scheduleRuleFlip();
    // Small delay before first object
    objectTimerRef.current = setTimeout(spawnNextObject, 500);
  }, [cfg.ruleFlips, scheduleRuleFlip, spawnNextObject]);

  // ── Handle miss (object passed without tap) ────────────────────────────────

  const handleMiss = useCallback(() => {
    if (!sessionActiveRef.current) return;

    objectsDoneRef.current += 1;
    setObjectsDone(objectsDoneRef.current);
    setCurrentObj(null);

    if (objectsDoneRef.current >= cfg.totalObjects) {
      finalizeSession();
      return;
    }
    objectTimerRef.current = setTimeout(spawnNextObject, 400);
  }, [cfg.totalObjects, spawnNextObject]);

  // ── Classify object ────────────────────────────────────────────────────────

  const classifyObject = useCallback((chosenLeft: boolean) => {
    const obj = currentObjRef.current;
    if (!obj || !sessionActiveRef.current) return;

    approachAnimRef.current?.stop();

    const rt = Date.now() - obj.spawnTime;
    rtSamplesRef.current.push(rt);

    const chosenCategory: Category = chosenLeft
      ? (mechLeftRef.current ? 'mechanical' : 'biological')
      : (mechLeftRef.current ? 'biological' : 'mechanical');

    const correct = chosenCategory === obj.category;
    if (correct) {
      hitCountRef.current += 1;
      setHitCount(hitCountRef.current);
    }

    // Track post-flip and pre-flip RTs for switchingCost
    if ((obj as any)._isPostFlip) {
      postFlipRtRef.current.push(rt);
    } else {
      preFlipRtRef.current.push(rt);
    }

    objectsDoneRef.current += 1;
    setObjectsDone(objectsDoneRef.current);
    setCurrentObj(null);

    if (objectsDoneRef.current >= cfg.totalObjects) {
      finalizeSession();
      return;
    }
    objectTimerRef.current = setTimeout(spawnNextObject, 300);
  }, [cfg.totalObjects, spawnNextObject]);

  // ── Finalize session ───────────────────────────────────────────────────────

  const finalizeSession = useCallback(() => {
    sessionActiveRef.current = false;
    if (ruleFlipTimerRef.current) clearTimeout(ruleFlipTimerRef.current);

    const samples = rtSamplesRef.current;
    const mrt = samples.length > 0
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : 999;

    const accuracy = cfg.totalObjects > 0
      ? hitCountRef.current / cfg.totalObjects
      : 0;

    // Switching cost: average post-flip RT minus average pre-flip RT
    const avgPostFlip = postFlipRtRef.current.length > 0
      ? postFlipRtRef.current.reduce((a, b) => a + b, 0) / postFlipRtRef.current.length
      : mrt;
    const avgPreFlip = preFlipRtRef.current.length > 0
      ? preFlipRtRef.current.reduce((a, b) => a + b, 0) / preFlipRtRef.current.length
      : mrt;
    const switchingCost = Math.max(0, Math.round(avgPostFlip - avgPreFlip));

    /*
     * Scoring (0–100):
     *   MRT component  (40 pts): 0 = 250ms+, 40 = 120ms
     *   Accuracy       (45 pts): linear 0–45
     *   Switching Cost (15 pts): 0 = 400ms+ cost, 15 = 0ms cost
     */
    const MAX_MRT = 250;
    const MIN_MRT = 120;
    const mrtScore = Math.max(0, Math.min(40, ((MAX_MRT - mrt) / (MAX_MRT - MIN_MRT)) * 40));

    const accScore = accuracy * 45;

    const MAX_SC = 400;
    const scScore = Math.max(0, Math.min(15, ((MAX_SC - switchingCost) / MAX_SC) * 15));

    const total = Math.round(mrtScore + accScore + scScore);

    console.info('[VectorFlowGame:finalizeSession] session complete', {
      sessionId,
      mrt,
      accuracy: Math.round(accuracy * 100),
      switchingCost,
      score: total,
    });

    setScore(total);
    setPhase('done');
    onComplete(total);
  }, [cfg.totalObjects, sessionId, onComplete]);

  // ── Approach animation interpolations ─────────────────────────────────────

  const objScale = approachAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 2.8],
  });
  const objOpacity = approachAnim.interpolate({
    inputRange: [0, 0.15, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  const tunnelRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Render helpers ─────────────────────────────────────────────────────────

  const leftLabel = mechLeft ? 'MECHANICAL' : 'BIOLOGICAL';
  const rightLabel = mechLeft ? 'BIOLOGICAL' : 'MECHANICAL';
  const leftColor = mechLeft ? '#38bdf8' : '#86efac';
  const rightColor = mechLeft ? '#86efac' : '#38bdf8';

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Vector Flow</Text>
        <Text style={styles.subtitle}>Classify objects as they rush toward you</Text>

        <View style={styles.introRuleBox}>
          <View style={[styles.introSide, { borderColor: '#38bdf8' }]}>
            <Text style={[styles.introSideLabel, { color: '#38bdf8' }]}>LEFT</Text>
            <Text style={styles.introSideValue}>MECHANICAL</Text>
            <Text style={styles.introSideHint}>Gears · Circuits</Text>
          </View>
          <View style={styles.introVsDivider}>
            <Text style={styles.introVsText}>VS</Text>
          </View>
          <View style={[styles.introSide, { borderColor: '#86efac' }]}>
            <Text style={[styles.introSideLabel, { color: '#86efac' }]}>RIGHT</Text>
            <Text style={styles.introSideValue}>BIOLOGICAL</Text>
            <Text style={styles.introSideHint}>Plants · Creatures</Text>
          </View>
        </View>

        {cfg.ruleFlips && (
          <Text style={styles.ruleFlipWarning}>
            ⚠️ Rules swap every 10s — stay alert
          </Text>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Session Complete</Text>
        <View style={styles.resultsBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreBig}>{score ?? 0}</Text>
          <Text style={styles.resultsDetail}>
            {hitCountRef.current}/{cfg.totalObjects} correct
          </Text>
          {cfg.ruleFlips && (
            <Text style={styles.resultsDetail}>
              {ruleFlipCount} rule flip{ruleFlipCount !== 1 ? 's' : ''} survived
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── Playing phase ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerStat}>{objectsDone}/{cfg.totalObjects}</Text>
        <Text style={styles.headerTitle}>VECTOR FLOW</Text>
        <Text style={styles.headerStat}>{hitCount} ✓</Text>
      </View>

      {/* Rule flip banner */}
      {showFlashBanner && (
        <View style={styles.flipBanner}>
          <Text style={styles.flipBannerText}>⚡ RULES SWAPPED ⚡</Text>
        </View>
      )}

      {/* Current rule labels */}
      <View style={styles.ruleRow}>
        <Text style={[styles.ruleLabel, { color: leftColor }]}>{leftLabel}</Text>
        <Text style={styles.ruleSep}>◀  ▶</Text>
        <Text style={[styles.ruleLabel, { color: rightColor }]}>{rightLabel}</Text>
      </View>

      {/* Tunnel viewport */}
      <Animated.View
        style={[
          styles.tunnel,
          cfg.tunnelRotation && { transform: [{ rotate: tunnelRotate }] },
        ]}
      >
        {/* Concentric tunnel rings */}
        {[90, 72, 54, 36, 20].map((size, i) => (
          <View
            key={i}
            style={[
              styles.tunnelRing,
              {
                width: `${size}%` as any,
                height: `${size}%` as any,
                borderColor: `rgba(56,189,248,${0.12 + i * 0.05})`,
              },
            ]}
          />
        ))}

        {/* Approaching object */}
        {currentObj && (
          <Animated.View
            style={[
              styles.objectWrapper,
              {
                opacity: objOpacity,
                transform: [{ scale: objScale }],
              },
            ]}
          >
            <Text style={styles.objectEmoji}>{currentObj.emoji}</Text>
            <Text style={styles.objectLabel}>{currentObj.label}</Text>
            {cfg.classCount >= 4 && (
              <Text style={styles.objectSubLabel}>
                [{currentObj.subClass.toUpperCase()}]
              </Text>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* Classification buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.classifyBtn, { borderColor: leftColor }]}
          onPress={() => classifyObject(true)}
          activeOpacity={0.75}
        >
          <Text style={[styles.classifyBtnText, { color: leftColor }]}>◀ LEFT</Text>
          <Text style={[styles.classifyBtnSub, { color: leftColor }]}>{leftLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.classifyBtn, { borderColor: rightColor }]}
          onPress={() => classifyObject(false)}
          activeOpacity={0.75}
        >
          <Text style={[styles.classifyBtnText, { color: rightColor }]}>RIGHT ▶</Text>
          <Text style={[styles.classifyBtnSub, { color: rightColor }]}>{rightLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },

  // ── Intro ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  introRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  introSide: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  introSideLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  introSideValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  introSideHint: {
    fontSize: 11,
    color: '#64748b',
  },
  introVsDivider: {
    paddingHorizontal: 4,
  },
  introVsText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  ruleFlipWarning: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  startBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  startBtnText: {
    color: '#0a0a1a',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // ── Playing ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerStat: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    minWidth: 50,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 2,
  },
  flipBanner: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  flipBannerText: {
    color: '#0a0a1a',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  ruleLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  ruleSep: {
    color: '#334155',
    fontSize: 12,
  },
  tunnel: {
    width: SCREEN_W - 32,
    height: SCREEN_W - 32,
    borderRadius: (SCREEN_W - 32) / 2,
    backgroundColor: 'rgba(14,22,38,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  tunnelRing: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 1,
  },
  objectWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  objectLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.5,
  },
  objectSubLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  classifyBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  classifyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  classifyBtnSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 3,
    opacity: 0.8,
  },

  // ── Done ───────────────────────────────────────────────────────────────────
  resultsBox: {
    marginTop: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreBig: {
    fontSize: 64,
    fontWeight: '800',
    color: '#38bdf8',
    lineHeight: 72,
  },
  resultsDetail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
});
