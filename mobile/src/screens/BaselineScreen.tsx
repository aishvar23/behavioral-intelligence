/**
 * Baseline Calibration Screen
 *
 * Step 2 of the Cognitive Mirror flow.
 * 30-second calibration: tap the circle the instant it appears.
 * Measures device latency (render → visible) and user's resting reaction speed.
 * Results are stored via /assessment/baseline then navigation moves to LevelGame.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { submitBaseline } from '../services/assessmentApi';
import { DiscoveredTrait } from '../services/assessmentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Baseline'>;

type Phase = 'intro' | 'waiting' | 'ready' | 'complete';

const TOTAL_TAPS    = 10;
const MIN_DELAY_MS  = 800;
const MAX_DELAY_MS  = 2500;
const DEVICE_LAG_MS = 16; // approximate frame render time

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function BaselineScreen({ route, navigation }: Props) {
  const { sessionId, profession, traits } = route.params;

  const [phase, setPhase]           = useState<Phase>('intro');
  const [tapsLeft, setTapsLeft]     = useState(TOTAL_TAPS);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [falseTaps, setFalseTaps]   = useState(0);
  const [saving, setSaving]         = useState(false);

  const circleAnim  = useRef(new Animated.Value(0)).current;
  const shownAt     = useRef<number>(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowing   = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showCircle = useCallback(() => {
    isShowing.current = true;
    shownAt.current   = Date.now();
    Animated.timing(circleAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, [circleAnim]);

  const scheduleNext = useCallback(() => {
    isShowing.current = false;
    Animated.timing(circleAnim, { toValue: 0, duration: 60, useNativeDriver: true }).start();
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timerRef.current = setTimeout(showCircle, delay);
  }, [circleAnim, showCircle]);

  // Start calibration
  const handleStart = useCallback(() => {
    setPhase('waiting');
    setTapsLeft(TOTAL_TAPS);
    setReactionTimes([]);
    setFalseTaps(0);
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    timerRef.current = setTimeout(() => { setPhase('ready'); showCircle(); }, delay);
  }, [showCircle]);

  // Tap handler
  const handleTap = useCallback(() => {
    if (phase !== 'ready') return;

    if (!isShowing.current) {
      // False tap — circle wasn't visible
      setFalseTaps(f => f + 1);
      return;
    }

    const rt = Date.now() - shownAt.current - DEVICE_LAG_MS;
    const clamped = Math.max(100, rt); // floor at 100ms to avoid negatives

    setReactionTimes(prev => {
      const next = [...prev, clamped];
      const remaining = TOTAL_TAPS - next.length;
      setTapsLeft(remaining);
      if (remaining <= 0) {
        clearTimer();
        setPhase('complete');
      } else {
        scheduleNext();
      }
      return next;
    });
  }, [phase, clearTimer, scheduleNext]);

  // Save and continue
  const handleContinue = useCallback(async () => {
    setSaving(true);
    const baselineRtMs     = median(reactionTimes);
    const baselineDeviceMs = DEVICE_LAG_MS;
    try {
      await submitBaseline(sessionId, baselineRtMs, baselineDeviceMs);
    } catch {
      // Non-fatal — continue even if save fails
    }
    setSaving(false);
    navigation.replace('LevelGame', { sessionId, profession, traits, baselineRtMs });
  }, [reactionTimes, sessionId, profession, traits, navigation]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Block Android hardware back button during active calibration phases
  useEffect(() => {
    if (phase === 'intro') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Baseline Calibration</Text>
        <Text style={styles.body}>
          Before we begin, we need to measure your resting reaction speed and calibrate for your device.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>◎  Tap the circle the instant it appears</Text>
          <Text style={styles.infoText}>◎  {TOTAL_TAPS} taps · approximately 30 seconds</Text>
          <Text style={styles.infoText}>◎  This data personalises your difficulty curve</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleStart}>
          <Text style={styles.btnText}>Start Calibration</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'complete') {
    const rtMedian = Math.round(median(reactionTimes));
    const best     = Math.round(Math.min(...reactionTimes));
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Calibration Complete</Text>
        <View style={styles.resultsBox}>
          <Stat label="Median RT"   value={`${rtMedian}ms`} />
          <Stat label="Best RT"     value={`${best}ms`} />
          <Stat label="False taps"  value={String(falseTaps)} />
        </View>
        <Text style={styles.body}>
          {rtMedian < 250
            ? 'Elite baseline. Your difficulty curve will start higher.'
            : rtMedian < 350
            ? 'Sharp baseline. Calibration matched.'
            : 'Relaxed baseline recorded. The system will calibrate accordingly.'}
        </Text>
        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? 'Saving…' : 'Begin Assessment →'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // waiting | ready — tap zone
  const circleScale = circleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <TouchableOpacity
      style={styles.tapZone}
      onPress={handleTap}
      activeOpacity={1}
    >
      {phase === 'waiting' && (
        <Text style={styles.waitText}>Get ready…</Text>
      )}
      <Animated.View
        style={[
          styles.circle,
          { opacity: circleAnim, transform: [{ scale: circleScale }] },
        ]}
      />
      {phase === 'ready' && (
        <Text style={styles.tapCount}>{tapsLeft} taps remaining</Text>
      )}
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f0e17', padding: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  title:    { fontSize: 24, fontWeight: '700', color: '#e0e0ff', marginBottom: 14, textAlign: 'center' },
  body:     { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 21, marginBottom: 24 },

  infoBox: {
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 18,
    marginBottom: 28, width: '100%', gap: 10,
  },
  infoText: { fontSize: 13, color: '#d1d5db', lineHeight: 19 },

  btn: {
    backgroundColor: '#7c3aed', borderRadius: 12,
    paddingVertical: 15, paddingHorizontal: 40,
  },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.4 },

  tapZone: {
    flex: 1, backgroundColor: '#0f0e17',
    alignItems: 'center', justifyContent: 'center',
  },
  waitText: { fontSize: 18, color: '#6b7280', position: 'absolute', top: '40%' },
  circle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 20,
  },
  tapCount: {
    position: 'absolute', bottom: 80,
    fontSize: 14, color: '#6b7280',
  },

  resultsBox: {
    flexDirection: 'row', gap: 20, marginBottom: 24,
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 20,
  },
  stat:      { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#a78bfa', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#9ca3af', letterSpacing: 0.5 },
});
