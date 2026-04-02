/**
 * Radar Sweep — Working Memory (T06 / G09)
 *
 * Circular radar display. Contacts blink sequentially as the sweep passes
 * each position. User must tap all Contacts in REVERSE order.
 * Mental Rotation: radar rotates 90° before the input phase at higher levels.
 *
 * Rendered entirely with View + Math.cos/sin positioning — no SVG.
 *
 * KPIs:
 *   maxReverseSpan       — highest N recalled correctly in reverse
 *   spatialErrorDeg      — mean angular error (degrees) from correct contact
 *   interferenceResistance — accuracy on decoy rounds vs clean rounds
 *
 * Config params (via traitCatalog gameParams):
 *   contactCount   number   real contacts per round (3–8)
 *   fieldDegrees   number   180 | 360 sweep arc
 *   decoys         boolean  false blinks that must be ignored
 *   mentalRotation boolean  radar rotates 90° before input phase
 *   displayMs      number   ms each contact blinks during display
 *   rounds         number   sequences per session
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: number;
  angleDeg: number;       // position on radar (0° = top, clockwise)
  isDecoy: boolean;
  displayOrder: number;   // 1-based order it blinked (decoys get 0)
}

interface RadarSweepConfig {
  contactCount: number;
  fieldDegrees: number;
  decoys: boolean;
  mentalRotation: boolean;
  displayMs: number;
  rounds: number;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<RadarSweepConfig>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULTS: RadarSweepConfig = {
  contactCount: 3,
  fieldDegrees: 180,
  decoys: false,
  mentalRotation: false,
  displayMs: 900,
  rounds: 3,
};

const RADAR_SIZE = 260;      // outer circle diameter
const RADAR_R = RADAR_SIZE / 2;
const CONTACT_ORBIT_R = RADAR_R * 0.72; // contacts orbit at 72% of radar radius
const DOT_R = 14;            // contact dot radius
const SWEEP_INTERVAL_MS = 80; // sweep animation step

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert display angle (0°=top, clockwise) to Math.atan2 angle (0°=right, CCW) */
function toMathRad(displayDeg: number): number {
  return ((displayDeg - 90) * Math.PI) / 180;
}

/** Dot position on canvas given a display angle */
function contactPosition(angleDeg: number): { left: number; top: number } {
  const rad = toMathRad(angleDeg);
  return {
    left: RADAR_R + CONTACT_ORBIT_R * Math.cos(rad) - DOT_R,
    top:  RADAR_R + CONTACT_ORBIT_R * Math.sin(rad) - DOT_R,
  };
}

/** Angular difference between two display angles (0–180) */
function angularDiff(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/** Generate random non-overlapping angles within fieldDegrees */
function randomAngles(count: number, fieldDeg: number, minSepDeg = 30): number[] {
  const startDeg = fieldDeg < 360 ? (360 - fieldDeg) / 2 : 0;
  const angles: number[] = [];
  let attempts = 0;
  while (angles.length < count && attempts < 500) {
    attempts++;
    const candidate = startDeg + Math.random() * fieldDeg;
    const tooClose = angles.some(a => angularDiff(a, candidate) < minSepDeg);
    if (!tooClose) angles.push(candidate);
  }
  return angles;
}

// ── Sweep line (rotating View) ────────────────────────────────────────────────

interface SweepLineProps {
  sweepDeg: Animated.Value;
}

function SweepLine({ sweepDeg }: SweepLineProps) {
  const rotate = sweepDeg.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sweepLine,
        { transform: [{ rotate }] },
      ]}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'display' | 'rotation' | 'recall' | 'feedback' | 'done';

export default function RadarSweepGame({ sessionId, onComplete, config }: Props) {
  const cfg: RadarSweepConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContactId, setActiveContactId] = useState<number | null>(null); // currently blinking
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());      // all shown so far
  const [recallQueue, setRecallQueue] = useState<number[]>([]);  // correct reverse order
  const [userTaps, setUserTaps] = useState<number[]>([]);        // ids user has tapped
  const [lastFeedback, setLastFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState<number | null>(null);

  // Sweep animation
  const sweepDeg = useRef(new Animated.Value(0)).current;
  const sweepLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Radar rotation for mental rotation phase
  const radarRotation = useRef(new Animated.Value(0)).current;

  // Stats
  const totalCorrectRef = useRef(0);
  const totalTapsRef = useRef(0);
  const spatialErrorsRef = useRef<number[]>([]);
  const maxSpanRef = useRef(0);
  const decoySurvivedRef = useRef<number[]>([]); // per decoy-round accuracy
  const cleanRoundAccRef = useRef<number[]>([]);

  const contactsRef = useRef<Contact[]>([]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  const sessionActiveRef = useRef(false);
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      sweepLoopRef.current?.stop();
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current);
    };
  }, []);

  // ── Sweep loop ────────────────────────────────────────────────────────────

  const startSweep = useCallback(() => {
    sweepDeg.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweepDeg, {
        toValue: 360,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    sweepLoopRef.current = loop;
    loop.start();
  }, [sweepDeg]);

  const stopSweep = useCallback(() => {
    sweepLoopRef.current?.stop();
    sweepLoopRef.current = null;
  }, []);

  // ── Build round ────────────────────────────────────────────────────────────

  const buildRound = useCallback((): Contact[] => {
    const realAngles = randomAngles(cfg.contactCount, cfg.fieldDegrees);
    const contactList: Contact[] = realAngles.map((a, i) => ({
      id: i + 1,
      angleDeg: a,
      isDecoy: false,
      displayOrder: i + 1,
    }));

    if (cfg.decoys) {
      // Add 1-2 decoys at random positions
      const decoyCount = 1 + Math.floor(Math.random() * 2);
      const existingAngles = realAngles.slice();
      const decoyAngles = randomAngles(decoyCount, cfg.fieldDegrees, 25);
      decoyAngles.forEach((a, i) => {
        const tooClose = existingAngles.some(ea => angularDiff(ea, a) < 25);
        if (!tooClose) {
          contactList.push({
            id: 100 + i,
            angleDeg: a,
            isDecoy: true,
            displayOrder: 0,
          });
          existingAngles.push(a);
        }
      });
    }

    return contactList;
  }, [cfg.contactCount, cfg.fieldDegrees, cfg.decoys]);

  // ── Display phase: show contacts one by one ────────────────────────────────

  const displayContacts = useCallback((roundContacts: Contact[]) => {
    setPhase('display');
    setRevealedIds(new Set());
    setActiveContactId(null);

    // Sort: real contacts first in displayOrder; decoys interspersed randomly
    const reals = roundContacts.filter(c => !c.isDecoy).sort((a, b) => a.displayOrder - b.displayOrder);
    const decoys = roundContacts.filter(c => c.isDecoy);

    // Build display sequence: interleave decoys randomly among reals
    const displaySeq: Contact[] = [...reals];
    decoys.forEach(d => {
      const insertAt = Math.floor(Math.random() * (displaySeq.length + 1));
      displaySeq.splice(insertAt, 0, d);
    });

    let idx = 0;
    const revealNext = () => {
      if (!sessionActiveRef.current || idx >= displaySeq.length) {
        // All shown — start rotation or go to recall
        setActiveContactId(null);
        if (cfg.mentalRotation) {
          startMentalRotation(roundContacts);
        } else {
          beginRecall(roundContacts);
        }
        return;
      }
      const contact = displaySeq[idx];
      setActiveContactId(contact.id);
      setRevealedIds(prev => new Set([...prev, contact.id]));
      idx++;
      displayTimerRef.current = setTimeout(revealNext, cfg.displayMs + 200);
    };

    // Small delay before first contact
    displayTimerRef.current = setTimeout(revealNext, 400);
  }, [cfg.mentalRotation, cfg.displayMs]);

  // ── Mental rotation ────────────────────────────────────────────────────────

  const startMentalRotation = useCallback((roundContacts: Contact[]) => {
    setPhase('rotation');
    // Animate radar rotating 90°
    Animated.timing(radarRotation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      beginRecall(roundContacts);
    });
  }, [radarRotation]);

  // ── Recall phase ───────────────────────────────────────────────────────────

  const beginRecall = useCallback((roundContacts: Contact[]) => {
    const reals = roundContacts
      .filter(c => !c.isDecoy)
      .sort((a, b) => b.displayOrder - a.displayOrder); // reverse order
    setRecallQueue(reals.map(c => c.id));
    setUserTaps([]);
    setPhase('recall');
  }, []);

  // ── Handle tap on contact ──────────────────────────────────────────────────

  const handleContactTap = useCallback((contact: Contact) => {
    if (phase !== 'recall') return;
    if (contact.isDecoy) {
      // Tapping a decoy is wrong
      setLastFeedback('wrong');
      setTimeout(() => setLastFeedback(null), 400);
      return;
    }

    setUserTaps(prev => {
      const newTaps = [...prev, contact.id];
      const expectedIdx = newTaps.length - 1;
      const expectedId = recallQueue[expectedIdx];
      const correct = contact.id === expectedId;

      if (!correct) {
        // Compute spatial error
        const expected = contactsRef.current.find(c => c.id === expectedId);
        if (expected) {
          spatialErrorsRef.current.push(angularDiff(contact.angleDeg, expected.angleDeg));
        }
        setLastFeedback('wrong');
        setTimeout(() => setLastFeedback(null), 400);
      } else {
        totalCorrectRef.current += 1;
        spatialErrorsRef.current.push(0); // perfect spatial match
        setLastFeedback('correct');
        setTimeout(() => setLastFeedback(null), 300);
      }

      totalTapsRef.current += 1;

      if (newTaps.length >= recallQueue.length) {
        // Round done
        const roundCorrect = newTaps.filter((id, i) => id === recallQueue[i]).length;
        const allCorrect = roundCorrect === recallQueue.length;
        if (allCorrect) maxSpanRef.current = Math.max(maxSpanRef.current, recallQueue.length);

        // Track interference resistance
        const hasDecoy = contactsRef.current.some(c => c.isDecoy);
        const acc = roundCorrect / recallQueue.length;
        if (hasDecoy) decoySurvivedRef.current.push(acc);
        else cleanRoundAccRef.current.push(acc);

        setTimeout(() => advanceRound(), 600);
      }
      return newTaps;
    });
  }, [phase, recallQueue]);

  // ── Advance to next round ──────────────────────────────────────────────────

  const advanceRound = useCallback(() => {
    if (!sessionActiveRef.current) return;
    // Reset radar rotation
    radarRotation.setValue(0);
    stopSweep();

    const nextRound = round + 1;
    setRound(nextRound);
    setLastFeedback(null);

    if (nextRound >= cfg.rounds) {
      finalizeSession();
      return;
    }

    const roundContacts = buildRound();
    setContacts(roundContacts);
    startSweep();
    setPhase('feedback');
    setTimeout(() => displayContacts(roundContacts), 700);
  }, [round, cfg.rounds, buildRound, startSweep, stopSweep, displayContacts, radarRotation]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    sessionActiveRef.current = true;
    totalCorrectRef.current = 0;
    totalTapsRef.current = 0;
    spatialErrorsRef.current = [];
    maxSpanRef.current = 0;
    decoySurvivedRef.current = [];
    cleanRoundAccRef.current = [];
    radarRotation.setValue(0);
    setRound(0);
    setUserTaps([]);
    setLastFeedback(null);

    const roundContacts = buildRound();
    setContacts(roundContacts);
    startSweep();
    displayContacts(roundContacts);
  }, [buildRound, startSweep, displayContacts, radarRotation]);

  // ── Finalize session ───────────────────────────────────────────────────────

  const finalizeSession = useCallback(() => {
    sessionActiveRef.current = false;
    stopSweep();
    setPhase('done');

    const accuracy = totalTapsRef.current > 0
      ? totalCorrectRef.current / totalTapsRef.current
      : 0;

    const avgSpatialError = spatialErrorsRef.current.length > 0
      ? spatialErrorsRef.current.reduce((a, b) => a + b, 0) / spatialErrorsRef.current.length
      : 0;

    const avgClean = cleanRoundAccRef.current.length > 0
      ? cleanRoundAccRef.current.reduce((a, b) => a + b, 0) / cleanRoundAccRef.current.length
      : accuracy;
    const avgDecoy = decoySurvivedRef.current.length > 0
      ? decoySurvivedRef.current.reduce((a, b) => a + b, 0) / decoySurvivedRef.current.length
      : avgClean;
    const interferenceResistance = avgClean > 0 ? Math.min(1, avgDecoy / avgClean) : 1;

    const spanBonus = Math.min(1, (maxSpanRef.current - 3) / 5); // 3-8 span → 0–1

    /*
     * Scoring (0–100):
     *   Reverse Span    (55 pts): accuracy × 55
     *   Spatial Error   (25 pts): 0° = 25, 90°+ = 0; linear
     *   Interference    (10 pts): interferenceResistance × 10
     *   Span Bonus      (10 pts): spanBonus × 10
     */
    const spanScore  = accuracy * 55;
    const spatScore  = Math.max(0, (1 - avgSpatialError / 90)) * 25;
    const intfScore  = interferenceResistance * 10;
    const bonusScore = spanBonus * 10;

    const total = Math.round(spanScore + spatScore + intfScore + bonusScore);

    console.info('[RadarSweepGame:finalizeSession]', {
      sessionId,
      maxReverseSpan: maxSpanRef.current,
      avgSpatialErrorDeg: Math.round(avgSpatialError),
      interferenceResistance: Math.round(interferenceResistance * 100),
      score: total,
    });

    setScore(total);
    onComplete(total);
  }, [stopSweep, sessionId, onComplete]);

  // ── Radar rotation interpolation ───────────────────────────────────────────

  const radarRotateDeg = radarRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Radar Sweep</Text>
        <Text style={styles.subtitle}>
          Watch the sweep reveal Contacts.{'\n'}
          Tap them in REVERSE order when ready.
        </Text>
        <View style={styles.introRules}>
          <View style={styles.introRow}>
            <View style={[styles.introDot, { backgroundColor: '#38bdf8' }]} />
            <Text style={styles.introText}>Contact — remember the order</Text>
          </View>
          {cfg.decoys && (
            <View style={styles.introRow}>
              <View style={[styles.introDot, { backgroundColor: '#f87171' }]} />
              <Text style={styles.introText}>Decoy — ignore these</Text>
            </View>
          )}
          {cfg.mentalRotation && (
            <View style={styles.introRow}>
              <Text style={styles.introIcon}>🔄</Text>
              <Text style={styles.introText}>Radar rotates 90° before input — adjust mentally</Text>
            </View>
          )}
        </View>
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
          <Text style={styles.resultsDetail}>Max span: {maxSpanRef.current} items</Text>
          <Text style={styles.resultsDetail}>
            {totalCorrectRef.current}/{totalTapsRef.current} correct recalls
          </Text>
        </View>
      </View>
    );
  }

  // ── Playing phases ─────────────────────────────────────────────────────────

  const tappedSet = new Set(userTaps);
  const nextExpectedId = recallQueue[userTaps.length] ?? null;

  const phaseLabel =
    phase === 'display'   ? 'MEMORISE' :
    phase === 'rotation'  ? 'ROTATING…' :
    phase === 'recall'    ? 'RECALL (REVERSE)' :
    phase === 'feedback'  ? 'NEXT ROUND…' : '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>ROUND</Text>
          <Text style={styles.headerValue}>{round + 1}/{cfg.rounds}</Text>
        </View>
        <Text style={styles.headerTitle}>RADAR SWEEP</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>SPAN</Text>
          <Text style={styles.headerValue}>{cfg.contactCount}</Text>
        </View>
      </View>

      {/* Phase label */}
      <View style={styles.phasePill}>
        <Text style={[
          styles.phaseText,
          phase === 'recall' && { color: '#86efac' },
          phase === 'rotation' && { color: '#fbbf24' },
        ]}>
          {phaseLabel}
        </Text>
      </View>

      {/* Recall progress */}
      {phase === 'recall' && (
        <View style={styles.recallProgress}>
          {recallQueue.map((id, i) => {
            const tapped = i < userTaps.length;
            const correct = tapped && userTaps[i] === id;
            return (
              <View
                key={i}
                style={[
                  styles.recallDot,
                  tapped && (correct ? styles.recallDotCorrect : styles.recallDotWrong),
                  !tapped && i === userTaps.length && styles.recallDotNext,
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Radar canvas */}
      <Animated.View
        style={[
          styles.radarWrapper,
          { transform: [{ rotate: radarRotateDeg }] },
        ]}
      >
        {/* Radar circle rings */}
        <View style={styles.radarOuter}>
          <View style={styles.radarInner1} />
          <View style={styles.radarInner2} />
          {/* Center dot */}
          <View style={styles.radarCenter} />

          {/* Sweep line */}
          {(phase === 'display' || phase === 'recall' || phase === 'rotation') && (
            <SweepLine sweepDeg={sweepDeg} />
          )}

          {/* 180° boundary line (only for 180° field) */}
          {cfg.fieldDegrees < 360 && (
            <View style={styles.halfMask} />
          )}

          {/* Contacts */}
          {contacts.map(contact => {
            const pos = contactPosition(contact.angleDeg);
            const isActive    = activeContactId === contact.id;
            const wasRevealed = revealedIds.has(contact.id);
            const wasTapped   = tappedSet.has(contact.id);
            // Visibility rules
            let visible = false;
            let color   = '#38bdf8';
            let opacity = 1;

            if (phase === 'display' || phase === 'rotation') {
              visible = wasRevealed;
              color   = contact.isDecoy ? '#f87171' : '#38bdf8';
              opacity = isActive ? 1 : 0.35;
            } else if (phase === 'recall') {
              visible = true;
              if (wasTapped) {
                color   = '#334155'; // tapped = dimmed out
                opacity = 0.3;
              } else if (contact.isDecoy) {
                color   = '#f87171';
                opacity = 0.20;
              } else {
                // All untapped contacts look identical — user must recall order themselves
                color   = '#38bdf8';
                opacity = 0.55;
              }
            }

            if (!visible) return null;

            return (
              <TouchableOpacity
                key={contact.id}
                style={[
                  styles.contact,
                  {
                    left:            pos.left,
                    top:             pos.top,
                    width:           DOT_R * 2,
                    height:          DOT_R * 2,
                    borderRadius:    DOT_R,
                    backgroundColor: color,
                    opacity,
                    transform: isActive ? [{ scale: 1.3 }] : [],
                  },
                ]}
                onPress={() => handleContactTap(contact)}
                disabled={phase !== 'recall' || wasTapped || contact.isDecoy}
              />
            );
          })}
        </View>
      </Animated.View>

      {/* Feedback flash */}
      {lastFeedback && (
        <View style={[
          styles.feedbackBadge,
          lastFeedback === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong,
        ]}>
          <Text style={styles.feedbackText}>
            {lastFeedback === 'correct' ? '✓' : '✗'}
          </Text>
        </View>
      )}

      {/* Instruction */}
      <Text style={styles.instruction}>
        {phase === 'display'  ? 'Watch the contacts appear…' :
         phase === 'rotation' ? 'Radar rotating — adjust mentally' :
         phase === 'recall'   ? `Tap contact ${userTaps.length + 1} of ${recallQueue.length}` :
         ''}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030c14',
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
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    gap: 12,
    marginBottom: 24,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  introIcon: {
    fontSize: 14,
  },
  introText: {
    fontSize: 12,
    color: '#cbd5e1',
    flex: 1,
  },
  startBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  startBtnText: {
    color: '#030c14',
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
  headerLeft:  { alignItems: 'flex-start', minWidth: 50 },
  headerRight: { alignItems: 'flex-end', minWidth: 50 },
  headerLabel: { fontSize: 9, color: '#475569', letterSpacing: 1, fontWeight: '700' },
  headerValue: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  headerTitle: { fontSize: 11, fontWeight: '700', color: '#334155', letterSpacing: 2 },

  phasePill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: 1.5,
  },

  recallProgress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  recallDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  recallDotCorrect: { backgroundColor: '#86efac', borderColor: '#86efac' },
  recallDotWrong:   { backgroundColor: '#f87171', borderColor: '#f87171' },
  recallDotNext:    { borderColor: '#38bdf8', borderWidth: 2 },

  radarWrapper: {
    marginVertical: 8,
  },
  radarOuter: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_R,
    backgroundColor: 'rgba(3,20,30,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.30)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarInner1: {
    position: 'absolute',
    width: RADAR_SIZE * 0.65,
    height: RADAR_SIZE * 0.65,
    borderRadius: RADAR_SIZE * 0.325,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  radarInner2: {
    position: 'absolute',
    width: RADAR_SIZE * 0.32,
    height: RADAR_SIZE * 0.32,
    borderRadius: RADAR_SIZE * 0.16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.10)',
  },
  radarCenter: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
    opacity: 0.8,
  },
  sweepLine: {
    position: 'absolute',
    bottom: '50%',
    left: '50%',
    width: 1.5,
    height: RADAR_R - 4,
    backgroundColor: 'rgba(134,239,172,0.7)',
    transformOrigin: 'bottom center',
    marginLeft: -0.75,
  },
  halfMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RADAR_SIZE,
    height: RADAR_R,
    backgroundColor: 'rgba(3,20,30,0.75)',
  },

  contact: {
    position: 'absolute',
  },

  feedbackBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  feedbackCorrect: { backgroundColor: 'rgba(134,239,172,0.2)' },
  feedbackWrong:   { backgroundColor: 'rgba(248,113,113,0.2)' },
  feedbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
  },

  instruction: {
    fontSize: 11,
    color: '#475569',
    marginTop: 8,
    textAlign: 'center',
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
  scoreLabel:    { fontSize: 13, color: '#64748b', letterSpacing: 1, marginBottom: 4 },
  scoreBig:      { fontSize: 64, fontWeight: '800', color: '#38bdf8', lineHeight: 72 },
  resultsDetail: { fontSize: 13, color: '#94a3b8', marginTop: 6 },
});
