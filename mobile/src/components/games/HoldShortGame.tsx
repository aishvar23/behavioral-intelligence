/**
 * Hold-Short — Panic Management (T04 / G08)
 *
 * Runway intersection controller. Toggle Hold or Proceed for each inbound
 * aircraft — zero collisions, optimal throughput.
 *
 * KPIs:
 *   safetyViolations  — near-miss or collision events
 *   triageAccuracy    — % of optimal Hold/Proceed decisions
 *   stressRecoveryMs  — latency from Mayday event to restored accuracy
 *
 * Config params (via traitCatalog gameParams):
 *   aircraftCount    number   max simultaneous aircraft (2–12)
 *   maydayInterrupts boolean  random emergency aircraft (must always Proceed)
 *   lowVisFog        boolean  near-zero visibility, proximity-only alerts
 *   approachSpeed    number   ms between aircraft spawns (lower = faster)
 *   totalAircraft    number   total aircraft in session
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

type AircraftStatus = 'approaching' | 'holding' | 'proceeding' | 'cleared' | 'collision';
type RunwayId = 'R1' | 'R2' | 'R3';

interface Aircraft {
  id: number;
  callsign: string;
  runway: RunwayId;
  isMayday: boolean;
  status: AircraftStatus;
  spawnMs: number;
  decisionMs: number | null;  // ms when user acted
  optimalDecision: 'hold' | 'proceed';
  userDecision: 'hold' | 'proceed' | null;
  isCorrect: boolean | null;
}

interface HoldShortConfig {
  aircraftCount: number;
  maydayInterrupts: boolean;
  lowVisFog: boolean;
  approachSpeed: number;  // ms between spawns
  totalAircraft: number;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<HoldShortConfig>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULTS: HoldShortConfig = {
  aircraftCount: 3,
  maydayInterrupts: false,
  lowVisFog: false,
  approachSpeed: 4000,
  totalAircraft: 10,
};

const RUNWAYS: RunwayId[] = ['R1', 'R2', 'R3'];
const CALLSIGN_PREFIXES = ['UAL', 'DAL', 'AAL', 'SWA', 'FDX', 'UPS', 'BAW', 'AFR'];
const CALLSIGN_SUFFIX = () => String(Math.floor(100 + Math.random() * 900));

// Aircraft decision window before it auto-resolves
const DECISION_WINDOW_MS = 5000;

// How long a runway stays occupied after an aircraft is cleared to proceed.
// Must be longer than approachSpeed at low levels to guarantee hold scenarios.
const RUNWAY_CLEAR_TIME_MS = 6000;

// Fog: only show callsign when within proximity
const FOG_PROXIMITY_REVEAL_MS = 2000; // reveal callsign 2s after spawn in fog

// ── Helpers ───────────────────────────────────────────────────────────────────

let _callsignPool = [...CALLSIGN_PREFIXES];
function nextCallsign(): string {
  if (_callsignPool.length === 0) _callsignPool = [...CALLSIGN_PREFIXES];
  const idx = Math.floor(Math.random() * _callsignPool.length);
  const prefix = _callsignPool.splice(idx, 1)[0];
  return `${prefix}${CALLSIGN_SUFFIX()}`;
}

/**
 * Determine optimal decision based on runway occupancy.
 * A runway is occupied for RUNWAY_CLEAR_TIME_MS after any aircraft is cleared to proceed.
 * Mayday aircraft always Proceed regardless of runway state.
 */
function computeOptimal(
  aircraft: Aircraft,
  occupiedUntil: Record<RunwayId, number>,
): 'hold' | 'proceed' {
  if (aircraft.isMayday) return 'proceed';
  return Date.now() < (occupiedUntil[aircraft.runway] ?? 0) ? 'hold' : 'proceed';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HoldShortGame({ sessionId, onComplete, config }: Props) {
  const cfg: HoldShortConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [violations, setViolations] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [maydayFlash, setMaydayFlash] = useState(false);
  const [fogActive, setFogActive] = useState(false);
  const [fogRevealMap, setFogRevealMap] = useState<Record<number, boolean>>({});

  // Internal refs
  const aircraftRef = useRef<Aircraft[]>([]);
  useEffect(() => { aircraftRef.current = aircraft; }, [aircraft]);

  const violationsRef = useRef(0);
  const correctDecisionsRef = useRef(0);
  const totalDecisionsRef = useRef(0);
  const spawnedRef = useRef(0);
  const idCounter = useRef(0);
  const sessionActiveRef = useRef(false);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decisionTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Runway occupancy: maps each runway to the timestamp it becomes free again
  const runwayOccupiedUntilRef = useRef<Record<RunwayId, number>>({ R1: 0, R2: 0, R3: 0 });

  // Mayday stress recovery tracking
  const lastMaydayMs = useRef<number | null>(null);
  const postMaydayRts = useRef<number[]>([]);
  const preMaydayRts = useRef<number[]>([]);
  const isPostMaydayWindow = useRef(false);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
      decisionTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ── Fog reveal effect ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!cfg.lowVisFog || phase !== 'playing') return;
    setFogActive(true);
    // Fog reveal interval — every 200ms check which aircraft should be revealed
    const iv = setInterval(() => {
      const now = Date.now();
      setFogRevealMap(prev => {
        const next = { ...prev };
        aircraftRef.current.forEach(a => {
          if (!next[a.id] && now - a.spawnMs >= FOG_PROXIMITY_REVEAL_MS) {
            next[a.id] = true;
          }
        });
        return next;
      });
    }, 200);
    return () => clearInterval(iv);
  }, [cfg.lowVisFog, phase]);

  // ── Spawn next aircraft ────────────────────────────────────────────────────

  const spawnAircraft = useCallback(() => {
    if (!sessionActiveRef.current) return;
    if (spawnedRef.current >= cfg.totalAircraft) return;

    // Don't exceed max simultaneous
    const current = aircraftRef.current.filter(a => a.status === 'approaching' || a.status === 'holding');
    if (current.length >= cfg.aircraftCount) {
      // Retry shortly
      spawnTimerRef.current = setTimeout(spawnAircraft, 500);
      return;
    }

    const isMayday = cfg.maydayInterrupts && Math.random() < 0.15;
    // Use fewer runways than aircraft slots so conflicts are guaranteed.
    // aircraftCount 2-3 → 2 runways, 4-6 → 2 runways, 7+ → 3 runways
    const numRunways = cfg.aircraftCount >= 7 ? 3 : 2;
    const runway = RUNWAYS[Math.floor(Math.random() * numRunways)];
    const newAircraft: Aircraft = {
      id: ++idCounter.current,
      callsign: nextCallsign(),
      runway,
      isMayday,
      status: 'approaching',
      spawnMs: Date.now(),
      decisionMs: null,
      optimalDecision: 'proceed', // computed after registration
      userDecision: null,
      isCorrect: null,
    };

    spawnedRef.current += 1;

    if (isMayday) {
      setMaydayFlash(true);
      lastMaydayMs.current = Date.now();
      isPostMaydayWindow.current = true;
      setTimeout(() => {
        setMaydayFlash(false);
        isPostMaydayWindow.current = false;
      }, 3000);
    }

    setAircraft(prev => {
      const optimal = computeOptimal(newAircraft, runwayOccupiedUntilRef.current);
      const registered: Aircraft = { ...newAircraft, optimalDecision: optimal };
      const next = [...prev, registered];
      aircraftRef.current = next;

      // Auto-resolve if user doesn't decide in time
      const timer = setTimeout(() => {
        autoResolve(registered.id);
      }, DECISION_WINDOW_MS);
      decisionTimersRef.current.set(registered.id, timer);

      return next;
    });

    if (spawnedRef.current < cfg.totalAircraft) {
      spawnTimerRef.current = setTimeout(spawnAircraft, cfg.approachSpeed);
    }
  }, [cfg.totalAircraft, cfg.aircraftCount, cfg.maydayInterrupts, cfg.approachSpeed]);

  // ── Auto-resolve (timeout) ─────────────────────────────────────────────────

  const autoResolve = useCallback((id: number) => {
    if (!sessionActiveRef.current) return;

    setAircraft(prev => {
      const a = prev.find(x => x.id === id);
      if (!a || a.userDecision !== null) return prev;

      // Treat timeout as wrong decision
      totalDecisionsRef.current += 1;
      // If optimal was proceed → timeout = collision risk
      if (a.optimalDecision === 'proceed') {
        violationsRef.current += 1;
        setViolations(violationsRef.current);
      }

      const next = prev.map(x =>
        x.id === id ? { ...x, status: 'cleared' as AircraftStatus, isCorrect: false } : x
      );
      aircraftRef.current = next;

      checkSessionComplete(next);
      return next;
    });
  }, []);

  // ── User decision: Hold / Proceed ──────────────────────────────────────────

  const handleDecision = useCallback((id: number, decision: 'hold' | 'proceed') => {
    if (!sessionActiveRef.current) return;

    const timer = decisionTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      decisionTimersRef.current.delete(id);
    }

    const rt = Date.now();

    setAircraft(prev => {
      const a = prev.find(x => x.id === id);
      if (!a || a.userDecision !== null) return prev;

      const correct = decision === a.optimalDecision;
      totalDecisionsRef.current += 1;
      if (correct) correctDecisionsRef.current += 1;

      // Track RT for stress recovery KPI
      const decisionRt = rt - a.spawnMs;
      if (isPostMaydayWindow.current) {
        postMaydayRts.current.push(decisionRt);
      } else {
        preMaydayRts.current.push(decisionRt);
      }

      // Safety violation: proceed when should hold (collision risk)
      if (decision === 'proceed' && a.optimalDecision === 'hold') {
        violationsRef.current += 1;
        setViolations(violationsRef.current);
      }

      const newStatus: AircraftStatus = decision === 'proceed' ? 'proceeding' : 'holding';
      // Mark runway occupied so the next arriving aircraft must hold
      if (decision === 'proceed') {
        runwayOccupiedUntilRef.current[a.runway] = Date.now() + RUNWAY_CLEAR_TIME_MS;
      }
      let next = prev.map(x =>
        x.id === id
          ? { ...x, userDecision: decision, decisionMs: decisionRt, status: newStatus, isCorrect: correct }
          : x
      );

      // If proceeding, clear after 1.5s
      if (decision === 'proceed') {
        setTimeout(() => {
          setAircraft(prev2 => {
            const next2 = prev2.map(x =>
              x.id === id && x.status === 'proceeding' ? { ...x, status: 'cleared' as AircraftStatus } : x
            );
            aircraftRef.current = next2;
            setClearedCount(c => c + 1);
            checkSessionComplete(next2);
            return next2;
          });
        }, 1500);
      } else {
        // Holding aircraft auto-clear after 3s (assume runway opens)
        setTimeout(() => {
          setAircraft(prev2 => {
            const heldAircraft = prev2.find(x => x.id === id);
            if (!heldAircraft || heldAircraft.status !== 'holding') return prev2;
            // Re-evaluate: if runway now clear, proceed
            const next2 = prev2.map(x =>
              x.id === id ? { ...x, status: 'cleared' as AircraftStatus } : x
            );
            aircraftRef.current = next2;
            setClearedCount(c => c + 1);
            checkSessionComplete(next2);
            return next2;
          });
        }, 3000);
      }

      aircraftRef.current = next;
      return next;
    });
  }, []);

  // ── Check session complete ─────────────────────────────────────────────────

  const checkSessionComplete = useCallback((current: Aircraft[]) => {
    const active = current.filter(a => a.status === 'approaching' || a.status === 'holding' || a.status === 'proceeding');
    if (spawnedRef.current >= cfg.totalAircraft && active.length === 0) {
      // Defer outside the state-updater call stack so React doesn't warn about
      // updating a parent (LevelGameScreen) while rendering this component.
      setTimeout(() => finalizeSession(), 0);
    }
  }, [cfg.totalAircraft, finalizeSession]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    sessionActiveRef.current = true;
    spawnedRef.current = 0;
    violationsRef.current = 0;
    correctDecisionsRef.current = 0;
    totalDecisionsRef.current = 0;
    postMaydayRts.current = [];
    preMaydayRts.current = [];
    runwayOccupiedUntilRef.current = { R1: 0, R2: 0, R3: 0 };
    setViolations(0);
    setClearedCount(0);
    setAircraft([]);
    setFogRevealMap({});
    setPhase('playing');
    spawnTimerRef.current = setTimeout(spawnAircraft, 800);
  }, [spawnAircraft]);

  // ── Finalize session ───────────────────────────────────────────────────────

  const finalizeSession = useCallback(() => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    decisionTimersRef.current.forEach(t => clearTimeout(t));

    const triageAccuracy = totalDecisionsRef.current > 0
      ? correctDecisionsRef.current / totalDecisionsRef.current
      : 0;
    const viol = violationsRef.current;

    // Stress recovery: avg RT post-mayday vs pre-mayday
    const avgPost = postMaydayRts.current.length > 0
      ? postMaydayRts.current.reduce((a, b) => a + b, 0) / postMaydayRts.current.length
      : 0;
    const avgPre = preMaydayRts.current.length > 0
      ? preMaydayRts.current.reduce((a, b) => a + b, 0) / preMaydayRts.current.length
      : 0;
    const stressRecoveryMs = Math.max(0, Math.round(avgPost - avgPre));

    /*
     * Scoring (0–100):
     *   Safety (40 pts):     0 violations = 40, each violation = -10, min 0
     *   Triage (45 pts):     triageAccuracy × 45
     *   Recovery (15 pts):   0ms spike = 15, 2000ms+ spike = 0
     */
    const safetyScore = Math.max(0, 40 - viol * 10);
    const triageScore = triageAccuracy * 45;
    const maxRecovery = 2000;
    const recoveryScore = cfg.maydayInterrupts
      ? Math.max(0, ((maxRecovery - stressRecoveryMs) / maxRecovery) * 15)
      : 15; // full recovery points if no mayday events

    const total = Math.round(safetyScore + triageScore + recoveryScore);

    console.info('[HoldShortGame:finalizeSession] session complete', {
      sessionId,
      violations: viol,
      triageAccuracy: Math.round(triageAccuracy * 100),
      stressRecoveryMs,
      score: total,
    });

    setScore(total);
    setPhase('done');
    onComplete(total);
  }, [cfg.maydayInterrupts, sessionId, onComplete]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const activeAircraft = aircraft.filter(
    a => a.status === 'approaching' || a.status === 'holding' || a.status === 'proceeding'
  );

  const statusColor: Record<AircraftStatus, string> = {
    approaching: '#94a3b8',
    holding: '#fbbf24',
    proceeding: '#86efac',
    cleared: '#334155',
    collision: '#f87171',
  };

  // ── Intro ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Hold-Short</Text>
        <Text style={styles.subtitle}>
          Clear inbound aircraft — decide Hold or Proceed.{'\n'}
          Zero collisions. Optimal throughput.
        </Text>
        <View style={styles.introRules}>
          <View style={styles.introRule}>
            <View style={[styles.introChip, { backgroundColor: '#86efac22', borderColor: '#86efac' }]}>
              <Text style={[styles.introChipText, { color: '#86efac' }]}>PROCEED</Text>
            </View>
            <Text style={styles.introRuleText}>Runway is clear — clear the aircraft</Text>
          </View>
          <View style={styles.introRule}>
            <View style={[styles.introChip, { backgroundColor: '#fbbf2422', borderColor: '#fbbf24' }]}>
              <Text style={[styles.introChipText, { color: '#fbbf24' }]}>HOLD SHORT</Text>
            </View>
            <Text style={styles.introRuleText}>Runway conflict — hold aircraft</Text>
          </View>
          {cfg.maydayInterrupts && (
            <View style={styles.introRule}>
              <View style={[styles.introChip, { backgroundColor: '#f8717122', borderColor: '#f87171' }]}>
                <Text style={[styles.introChipText, { color: '#f87171' }]}>🚨 MAYDAY</Text>
              </View>
              <Text style={styles.introRuleText}>Emergency — always Proceed immediately</Text>
            </View>
          )}
        </View>
        {cfg.lowVisFog && (
          <Text style={styles.warningText}>⚠️ Low-vis fog: callsigns reveal on close approach</Text>
        )}
        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const triageAcc = totalDecisionsRef.current > 0
      ? Math.round((correctDecisionsRef.current / totalDecisionsRef.current) * 100)
      : 0;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Session Complete</Text>
        <View style={styles.resultsBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreBig}>{score ?? 0}</Text>
          <Text style={[styles.resultsDetail, violations > 0 && { color: '#f87171' }]}>
            {violations} violation{violations !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.resultsDetail}>
            {triageAcc}% triage accuracy
          </Text>
          <Text style={styles.resultsDetail}>
            {clearedCount}/{cfg.totalAircraft} aircraft cleared
          </Text>
        </View>
      </View>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>VIOLATIONS</Text>
          <Text style={[styles.headerValue, violations > 0 && { color: '#f87171' }]}>
            {violations}
          </Text>
        </View>
        <Text style={styles.headerTitle}>HOLD-SHORT</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>CLEARED</Text>
          <Text style={styles.headerValue}>{clearedCount}/{cfg.totalAircraft}</Text>
        </View>
      </View>

      {/* Mayday flash */}
      {maydayFlash && (
        <View style={styles.maydayBanner}>
          <Text style={styles.maydayText}>🚨 MAYDAY — EMERGENCY AIRCRAFT — ALWAYS PROCEED 🚨</Text>
        </View>
      )}

      {/* Fog overlay label */}
      {fogActive && (
        <Text style={styles.fogLabel}>⛅ Low-Vis: proximity approach only</Text>
      )}

      {/* Runway diagram */}
      <View style={styles.runwayArea}>
        {RUNWAYS.slice(0, Math.ceil(cfg.aircraftCount / 3)).map(rwy => (
          <View key={rwy} style={styles.runwayRow}>
            <Text style={styles.runwayId}>{rwy}</Text>
            <View style={styles.runwayStrip} />
          </View>
        ))}
      </View>

      {/* Aircraft queue */}
      <View style={styles.aircraftList}>
        {activeAircraft.length === 0 ? (
          <Text style={styles.waitingText}>Awaiting inbound traffic…</Text>
        ) : (
          activeAircraft.map(a => {
            const revealed = !cfg.lowVisFog || fogRevealMap[a.id];
            return (
              <View
                key={a.id}
                style={[
                  styles.aircraftCard,
                  a.isMayday && styles.aircraftCardMayday,
                  a.status === 'holding' && styles.aircraftCardHold,
                  a.status === 'proceeding' && styles.aircraftCardProceed,
                ]}
              >
                <View style={styles.aircraftInfo}>
                  {a.isMayday && <Text style={styles.maydayBadge}>🚨 MAYDAY</Text>}
                  <Text style={styles.aircraftCallsign}>
                    {revealed ? a.callsign : '???-???'}
                  </Text>
                  <Text style={styles.aircraftRunway}>
                    {revealed ? `Runway ${a.runway}` : '⛅ approach proximity'}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor[a.status]}22` }]}>
                    <Text style={[styles.statusText, { color: statusColor[a.status] }]}>
                      {a.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {a.userDecision === null && (
                  <View style={styles.decisionBtns}>
                    <TouchableOpacity
                      style={[styles.decisionBtn, styles.holdBtn]}
                      onPress={() => handleDecision(a.id, 'hold')}
                    >
                      <Text style={styles.holdBtnText}>HOLD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.decisionBtn,
                        styles.proceedBtn,
                        a.isMayday && styles.proceedBtnMayday,
                      ]}
                      onPress={() => handleDecision(a.id, 'proceed')}
                    >
                      <Text style={styles.proceedBtnText}>
                        {a.isMayday ? '🚨 PROCEED' : 'PROCEED'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06101a',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },

  // Intro
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  introRules: {
    width: '88%',
    gap: 12,
    marginBottom: 16,
  },
  introRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 90,
    alignItems: 'center',
  },
  introChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  introRuleText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  warningText: {
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  startBtn: {
    backgroundColor: '#86efac',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  startBtnText: {
    color: '#06101a',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // Playing
  header: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { alignItems: 'flex-start', minWidth: 70 },
  headerRight: { alignItems: 'flex-end', minWidth: 70 },
  headerLabel: { fontSize: 9, color: '#475569', letterSpacing: 1, fontWeight: '700' },
  headerValue: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  headerTitle: { fontSize: 11, fontWeight: '700', color: '#334155', letterSpacing: 2 },

  maydayBanner: {
    backgroundColor: '#f87171',
    width: '100%',
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  maydayText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  fogLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },

  runwayArea: {
    width: '90%',
    gap: 4,
    marginBottom: 10,
  },
  runwayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runwayId: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    width: 22,
  },
  runwayStrip: {
    flex: 1,
    height: 3,
    backgroundColor: '#1e293b',
    borderRadius: 2,
  },

  aircraftList: {
    width: '100%',
    paddingHorizontal: 12,
    gap: 8,
    flex: 1,
  },
  waitingText: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  aircraftCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aircraftCardMayday: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  aircraftCardHold: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251,191,36,0.04)',
  },
  aircraftCardProceed: {
    borderColor: '#86efac',
    backgroundColor: 'rgba(134,239,172,0.04)',
  },
  aircraftInfo: { gap: 2 },
  maydayBadge: { fontSize: 10, color: '#f87171', fontWeight: '700' },
  aircraftCallsign: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  aircraftRunway: { fontSize: 11, color: '#64748b' },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  decisionBtns: {
    flexDirection: 'column',
    gap: 6,
  },
  decisionBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 90,
  },
  holdBtn: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  holdBtnText: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  proceedBtn: {
    backgroundColor: 'rgba(134,239,172,0.15)',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  proceedBtnMayday: {
    backgroundColor: 'rgba(248,113,113,0.2)',
    borderColor: '#f87171',
  },
  proceedBtnText: {
    color: '#86efac',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },

  // Done
  resultsBox: {
    marginTop: 40,
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
    color: '#86efac',
    lineHeight: 72,
  },
  resultsDetail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
});
