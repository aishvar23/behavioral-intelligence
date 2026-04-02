/**
 * Signal Sift — Anomaly Detection (T19 / G07)
 *
 * 8-track scrolling bar-waveform monitor. Tap Spikes and Phase-shifts
 * before they scroll off screen.
 *
 * Waveform rendered as a grid of View bars (varying heights) — no SVG.
 *
 * KPIs:
 *   hitRate                — anomalies correctly tapped ÷ total anomalies
 *   falseAlarmPct          — incorrect taps ÷ total taps
 *   peripheralDetectionRate — hit rate on tracks 5–8 vs 1–4
 *
 * Config params (via traitCatalog gameParams):
 *   trackCount      number   1–8 simultaneous tracks
 *   visualSnow      boolean  random noise bars throughout
 *   phaseShifts     boolean  timing-based pattern inversions (taller = lower)
 *   lowContrast     boolean  subtle amplitude deviations (harder)
 *   durationMs      number   total session length in ms
 *   anomalyRate     number   expected anomalies per second per track (0.1–0.5)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

type AnomalyType = 'spike' | 'phase_shift';

interface Anomaly {
  id: number;
  trackIndex: number;
  columnIndex: number;  // position in the scrolling window where it appears
  type: AnomalyType;
  spawnMs: number;
  expiresMs: number;
  tapped: boolean;
  missed: boolean;
}

interface SignalSiftConfig {
  trackCount: number;
  visualSnow: boolean;
  phaseShifts: boolean;
  lowContrast: boolean;
  durationMs: number;
  anomalyRate: number;  // anomalies per second per track
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<SignalSiftConfig>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const DEFAULTS: SignalSiftConfig = {
  trackCount: 2,
  visualSnow: false,
  phaseShifts: false,
  lowContrast: false,
  durationMs: 60_000,
  anomalyRate: 0.2,
};

const COLS = 20;              // visible columns in the waveform window
const TICK_MS = 300;          // ms per scroll tick
const BAR_GAP = 2;            // px between bars
const TRACK_HEIGHT = 48;      // px per track
const ANOMALY_VISIBLE_TICKS = 4; // how many ticks an anomaly stays on screen

// Normal bar heights (0–10 scale, rendered as fraction of TRACK_HEIGHT)
const BASE_AMPLITUDE = 5;     // normal signal center
const SPIKE_AMPLITUDE = 10;   // spike height
const LOW_AMPLITUDE = 0;      // phase-shift inverted

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Generate normal bar heights for one tick on one track */
function normalBars(count: number, snow: boolean, lowContrast: boolean): number[] {
  return Array.from({ length: count }, () => {
    const base = randomBetween(3, 7); // normal signal amplitude
    const noise = snow ? randomBetween(-2, 2) : randomBetween(-0.5, 0.5);
    return clamp(base + noise, 0, 10);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignalSiftGame({ sessionId, onComplete, config }: Props) {
  const cfg: SignalSiftConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [score, setScore] = useState<number | null>(null);

  // Waveform: trackCount × COLS grid of bar amplitudes (0–10)
  const [waveform, setWaveform] = useState<number[][]>(() =>
    Array.from({ length: cfg.trackCount }, () =>
      Array.from({ length: COLS }, () => randomBetween(3, 7))
    )
  );

  // Active anomalies on screen
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const anomaliesRef = useRef<Anomaly[]>([]);
  useEffect(() => { anomaliesRef.current = anomalies; }, [anomalies]);

  // Stats
  const [timeRemainingMs, setTimeRemainingMs] = useState(cfg.durationMs);

  // Internal refs
  const tickRef = useRef(0);         // current scroll column offset
  const totalAnomaliesRef = useRef(0);
  const tappedAnomaliesRef = useRef(0);
  const falseTapsRef = useRef(0);
  const totalTapsRef = useRef(0);
  const trackHits = useRef<number[]>(Array(cfg.trackCount).fill(0));
  const trackMisses = useRef<number[]>(Array(cfg.trackCount).fill(0));
  const anomalyIdCounter = useRef(0);
  const sessionActiveRef = useRef(false);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Tick function (scroll + anomaly management) ────────────────────────────

  const tick = useCallback(() => {
    if (!sessionActiveRef.current) return;
    tickRef.current += 1;

    // Age out missed anomalies
    const now = Date.now();
    setAnomalies(prev => {
      const updated = prev.map(a => {
        if (!a.tapped && !a.missed && now > a.expiresMs) {
          // Missed
          trackMisses.current[a.trackIndex] = (trackMisses.current[a.trackIndex] ?? 0) + 1;
          return { ...a, missed: true };
        }
        return a;
      }).filter(a => !a.missed || now - a.expiresMs < TICK_MS * 2); // keep briefly to remove cleanly
      return updated;
    });

    // Possibly spawn new anomaly on each track
    const newAnomalies: Anomaly[] = [];
    for (let t = 0; t < cfg.trackCount; t++) {
      const roll = Math.random();
      const spawnProb = cfg.anomalyRate * (TICK_MS / 1000);
      if (roll < spawnProb) {
        const type: AnomalyType = cfg.phaseShifts && Math.random() < 0.4 ? 'phase_shift' : 'spike';
        const anomaly: Anomaly = {
          id: ++anomalyIdCounter.current,
          trackIndex: t,
          columnIndex: COLS - 1, // rightmost column — will scroll left
          type,
          spawnMs: now,
          expiresMs: now + TICK_MS * ANOMALY_VISIBLE_TICKS,
          tapped: false,
          missed: false,
        };
        newAnomalies.push(anomaly);
        totalAnomaliesRef.current += 1;
      }
    }
    if (newAnomalies.length > 0) {
      setAnomalies(prev => [...prev, ...newAnomalies]);
    }

    // Scroll waveform: drop oldest column, add new column on right
    setWaveform(prev => {
      return prev.map((track, tIdx) => {
        const scrolled = track.slice(1); // drop leftmost

        // Determine if rightmost column has an anomaly for this track
        const activeAnomaly = newAnomalies.find(a => a.trackIndex === tIdx);
        let newColBars: number;
        if (activeAnomaly) {
          if (activeAnomaly.type === 'spike') {
            newColBars = cfg.lowContrast ? 8.5 : SPIKE_AMPLITUDE;
          } else {
            // Phase shift: invert (high becomes low, low becomes high)
            newColBars = cfg.lowContrast ? 1.5 : LOW_AMPLITUDE;
          }
        } else {
          const base = randomBetween(3, 7);
          const noise = cfg.visualSnow ? randomBetween(-2.5, 2.5) : randomBetween(-0.5, 0.5);
          newColBars = clamp(base + noise, 0, 10);
        }

        scrolled.push(newColBars);
        return scrolled;
      });
    });

    tickTimerRef.current = setTimeout(tick, TICK_MS);
  }, [cfg.trackCount, cfg.anomalyRate, cfg.phaseShifts, cfg.lowContrast, cfg.visualSnow]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    sessionActiveRef.current = true;
    tickRef.current = 0;
    totalAnomaliesRef.current = 0;
    tappedAnomaliesRef.current = 0;
    falseTapsRef.current = 0;
    totalTapsRef.current = 0;
    trackHits.current = Array(cfg.trackCount).fill(0);
    trackMisses.current = Array(cfg.trackCount).fill(0);
    setTimeRemainingMs(cfg.durationMs);
    setAnomalies([]);
    setPhase('playing');

    // Countdown timer
    const endAt = Date.now() + cfg.durationMs;
    countdownRef.current = setInterval(() => {
      const remaining = endAt - Date.now();
      setTimeRemainingMs(Math.max(0, remaining));
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        sessionActiveRef.current = false;
        if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
        finalizeSession();
      }
    }, 500);

    tickTimerRef.current = setTimeout(tick, TICK_MS);
  }, [cfg.trackCount, cfg.durationMs, tick]);

  // ── Tap handler ────────────────────────────────────────────────────────────

  const handleTapTrack = useCallback((trackIndex: number) => {
    if (!sessionActiveRef.current) return;

    totalTapsRef.current += 1;
    const now = Date.now();
    const currentAnomalies = anomaliesRef.current;

    // Find an active, untapped anomaly on this track
    const target = currentAnomalies.find(
      a => a.trackIndex === trackIndex && !a.tapped && !a.missed && now <= a.expiresMs
    );

    if (target) {
      tappedAnomaliesRef.current += 1;
      trackHits.current[trackIndex] = (trackHits.current[trackIndex] ?? 0) + 1;
      setAnomalies(prev =>
        prev.map(a => (a.id === target.id ? { ...a, tapped: true } : a))
      );
    } else {
      // False alarm
      falseTapsRef.current += 1;
    }
  }, []);

  // ── Finalize session ───────────────────────────────────────────────────────

  const finalizeSession = useCallback(() => {
    const total = totalAnomaliesRef.current;
    const tapped = tappedAnomaliesRef.current;
    const totalTaps = totalTapsRef.current;
    const falseTaps = falseTapsRef.current;

    const hitRate = total > 0 ? tapped / total : 0;
    const falseAlarmPct = totalTaps > 0 ? falseTaps / totalTaps : 0;

    // Peripheral detection rate: tracks 5–8 vs 1–4
    const peripheralTrackStart = Math.min(4, cfg.trackCount); // index 4 = track 5
    const coreHits = trackHits.current.slice(0, peripheralTrackStart).reduce((a, b) => a + b, 0);
    const peripheralHits = trackHits.current.slice(peripheralTrackStart).reduce((a, b) => a + b, 0);
    const coreAnomalies = total > 0 ? Math.ceil(total * (peripheralTrackStart / cfg.trackCount)) : 1;
    const peripheralAnomalies = total > 0 ? Math.floor(total * ((cfg.trackCount - peripheralTrackStart) / cfg.trackCount)) : 0;
    const coreRate = coreAnomalies > 0 ? coreHits / coreAnomalies : 0;
    const peripheralRate = peripheralAnomalies > 0 ? peripheralHits / peripheralAnomalies : coreRate;

    /*
     * Scoring (0–100):
     *   Hit Rate         (60 pts): linear 0–60
     *   False Alarm      (25 pts): 0 false alarms = 25pts; linear penalty
     *   Peripheral Rate  (15 pts): peripheralRate / coreRate ratio × 15
     */
    const hitScore = hitRate * 60;
    const falseScore = Math.max(0, (1 - falseAlarmPct * 5) * 25);
    const peripheralScore = coreRate > 0
      ? Math.min(1, peripheralRate / coreRate) * 15
      : peripheralRate * 15;

    const total_score = Math.round(hitScore + falseScore + peripheralScore);

    console.info('[SignalSiftGame:finalizeSession] session complete', {
      sessionId,
      hitRate: Math.round(hitRate * 100),
      falseAlarmPct: Math.round(falseAlarmPct * 100),
      peripheralDetectionRate: Math.round(peripheralRate * 100),
      score: total_score,
    });

    setScore(total_score);
    setPhase('done');
    onComplete(total_score);
  }, [cfg.trackCount, sessionId, onComplete]);

  // ── Bar height → pixel ─────────────────────────────────────────────────────

  const barPx = (amp: number) =>
    Math.round(clamp(amp / 10, 0, 1) * (TRACK_HEIGHT - 6)) + 3;

  const barWidth = Math.floor((SCREEN_W - 32 - BAR_GAP * (COLS - 1)) / COLS);

  // ── Check if a column has an active (untapped) anomaly ────────────────────

  // Anomaly position: we want to show which column is "active"
  // Since we scroll every TICK_MS, the column index drifts left.
  // We represent position by time: column ~COLS-1 at spawn, drifts to 0.
  const getAnomalyColumn = (a: Anomaly): number => {
    const now = Date.now();
    const elapsed = now - a.spawnMs;
    const ticksElapsed = Math.floor(elapsed / TICK_MS);
    return Math.max(0, COLS - 1 - ticksElapsed);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Signal Sift</Text>
        <Text style={styles.subtitle}>
          Watch the waveform tracks.{'\n'}
          Tap a track when you see a spike or anomaly.
        </Text>
        <View style={styles.introGuide}>
          <View style={styles.introGuideRow}>
            <View style={[styles.demoBar, { height: 40, backgroundColor: '#f87171' }]} />
            <Text style={styles.introGuideText}>SPIKE — sudden amplitude peak</Text>
          </View>
          {cfg.phaseShifts && (
            <View style={styles.introGuideRow}>
              <View style={[styles.demoBar, { height: 4, backgroundColor: '#a78bfa' }]} />
              <Text style={styles.introGuideText}>PHASE SHIFT — signal drops flat</Text>
            </View>
          )}
          <View style={styles.introGuideRow}>
            <View style={[styles.demoBar, { height: 20, backgroundColor: '#38bdf8' }]} />
            <Text style={styles.introGuideText}>Normal signal — don't tap</Text>
          </View>
        </View>
        {cfg.visualSnow && (
          <Text style={styles.warningText}>⚠️ Visual noise active — filter carefully</Text>
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
            {tappedAnomaliesRef.current}/{totalAnomaliesRef.current} anomalies caught
          </Text>
          <Text style={styles.resultsDetail}>
            {falseTapsRef.current} false alarm{falseTapsRef.current !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Playing
  const secsRemaining = Math.ceil(timeRemainingMs / 1000);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerStat}>
          {tappedAnomaliesRef.current}✓  {falseTapsRef.current}✗
        </Text>
        <Text style={styles.headerTitle}>SIGNAL SIFT</Text>
        <Text style={styles.headerTimer}>{secsRemaining}s</Text>
      </View>

      {/* Waveform tracks */}
      <View style={styles.waveformArea}>
        {waveform.map((track, tIdx) => {
          // Find active anomaly column for this track
          const activeAnomaly = anomalies.find(
            a => a.trackIndex === tIdx && !a.tapped && !a.missed
          );
          const anomalyCol = activeAnomaly ? getAnomalyColumn(activeAnomaly) : -1;

          return (
            <TouchableOpacity
              key={tIdx}
              style={styles.trackRow}
              onPress={() => handleTapTrack(tIdx)}
              activeOpacity={0.85}
            >
              {/* Track label */}
              <Text style={styles.trackLabel}>T{tIdx + 1}</Text>

              {/* Bar columns */}
              <View style={styles.trackBars}>
                {track.map((amp, cIdx) => {
                  const isAnomalyCol = cIdx === anomalyCol;
                  const type = activeAnomaly?.type;
                  const barH = barPx(amp);
                  const barColor = isAnomalyCol
                    ? (type === 'phase_shift' ? '#a78bfa' : '#f87171')
                    : cfg.visualSnow
                      ? `rgba(56,189,248,${0.3 + Math.random() * 0.4})`
                      : '#38bdf8';

                  return (
                    <View
                      key={cIdx}
                      style={[
                        styles.bar,
                        {
                          width: barWidth,
                          height: barH,
                          backgroundColor: barColor,
                          marginRight: BAR_GAP,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.tapHint}>Tap a track row when you see an anomaly</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050d18',
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
  introGuide: {
    width: '90%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  introGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demoBar: {
    width: 16,
    borderRadius: 2,
  },
  introGuideText: {
    fontSize: 12,
    color: '#cbd5e1',
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
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  startBtnText: {
    color: '#050d18',
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
    marginBottom: 6,
  },
  headerStat: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    minWidth: 70,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 2,
  },
  headerTimer: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
    minWidth: 40,
    textAlign: 'right',
  },
  waveformArea: {
    width: '100%',
    paddingHorizontal: 8,
    gap: 6,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(56,189,248,0.04)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.08)',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  trackLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    width: 18,
    textAlign: 'center',
    marginRight: 2,
    marginBottom: 2,
  },
  trackBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
  },
  bar: {
    borderRadius: 1,
  },
  tapHint: {
    fontSize: 10,
    color: '#334155',
    marginTop: 10,
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
