import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

type Variant = 'basic' | 'inhibition' | 'speed';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: { variant: Variant };
}

const TOTAL_ROUNDS = 10;
const STIMULUS_WINDOW = 2000; // ms to react
const PRE_DELAY_MIN = 800;
const PRE_DELAY_MAX = 2200;

type Phase = 'intro' | 'waiting' | 'stimulus' | 'feedback' | 'done';
type StimulusType = 'go' | 'nogo';

function randomDelay() {
  return PRE_DELAY_MIN + Math.random() * (PRE_DELAY_MAX - PRE_DELAY_MIN);
}

export default function ReactionTestGame({ sessionId, onComplete, config }: Props) {
  const variant = config.variant ?? 'basic';
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [stimulusType, setStimulusType] = useState<StimulusType>('go');
  const [highlightIndex, setHighlightIndex] = useState(0); // for speed variant
  const [stimulusTime, setStimulusTime] = useState(0);
  const [lastResult, setLastResult] = useState<string>('');
  const [score, setScore] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = () => {
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    if (missTimerRef.current) clearTimeout(missTimerRef.current);
  };

  const nextRound = useCallback((r: number, currentScore: number, times: number[]) => {
    if (r >= TOTAL_ROUNDS) {
      const avgRT = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 999;
      logEvent({
        sessionId,
        gameId: `reaction_${variant}`,
        eventType: 'game_complete',
        timestamp: Date.now(),
        data: { score: currentScore, avgReactionTime: avgRT, rounds: TOTAL_ROUNDS },
      }).catch(() => {});
      setPhase('done');
      onComplete(currentScore);
      return;
    }

    setRound(r);
    setPhase('waiting');
    setLastResult('');

    const isNogo = variant === 'inhibition' && Math.random() < 0.3; // 30% nogo
    const sType: StimulusType = isNogo ? 'nogo' : 'go';
    const hi = Math.floor(Math.random() * 4);

    waitTimerRef.current = setTimeout(() => {
      setStimulusType(sType);
      setHighlightIndex(hi);
      setStimulusTime(Date.now());
      setPhase('stimulus');

      // Auto-miss if no tap within window
      missTimerRef.current = setTimeout(() => {
        const correct = sType === 'nogo'; // correct to NOT tap a nogo
        const pts = correct ? 8 : 0;
        const newScore = currentScore + pts;
        setScore(newScore);
        setLastResult(sType === 'nogo' ? '✓ Good — correctly ignored' : '✗ Too slow!');
        setPhase('feedback');

        logEvent({
          sessionId,
          gameId: `reaction_${variant}`,
          eventType: 'stimulus_response',
          timestamp: Date.now(),
          data: { correct, reactionTime: STIMULUS_WINDOW, stimulusType: sType, responded: false },
        }).catch(() => {});

        setTimeout(() => nextRound(r + 1, newScore, times), 800);
      }, STIMULUS_WINDOW);
    }, randomDelay());
  }, [sessionId, variant, onComplete]);

  function handleTap(tapIndex?: number) {
    if (phase === 'waiting') {
      // Tapped too early
      cleanup();
      setLastResult('✗ Too early!');
      setPhase('feedback');
      logEvent({ sessionId, gameId: `reaction_${variant}`, eventType: 'stimulus_response', timestamp: Date.now(), data: { correct: false, reactionTime: 0, stimulusType: 'go', responded: true, tooEarly: true } }).catch(() => {});
      setTimeout(() => nextRound(round + 1, score, reactionTimes), 800);
      return;
    }
    if (phase !== 'stimulus') return;
    cleanup();

    const rt = Date.now() - stimulusTime;
    const isNogo = stimulusType === 'nogo';
    const wrongTarget = variant === 'speed' && tapIndex !== undefined && tapIndex !== highlightIndex;
    const correct = !isNogo && !wrongTarget;

    let pts = 0;
    let result = '';
    if (isNogo) {
      result = '✗ Should not tap red!';
    } else if (wrongTarget) {
      result = '✗ Wrong target!';
    } else {
      // Score based on reaction time: fast = more points
      pts = Math.round(Math.max(5, 15 - (rt / STIMULUS_WINDOW) * 10));
      result = `✓ ${rt}ms`;
    }

    const newScore = score + pts;
    const newTimes = correct ? [...reactionTimes, rt] : reactionTimes;
    setScore(newScore);
    setReactionTimes(newTimes);
    setLastResult(result);
    setPhase('feedback');

    logEvent({
      sessionId,
      gameId: `reaction_${variant}`,
      eventType: 'stimulus_response',
      timestamp: Date.now(),
      data: { correct, reactionTime: rt, stimulusType, responded: true },
    }).catch(() => {});

    setTimeout(() => nextRound(round + 1, newScore, newTimes), 800);
  }

  useEffect(() => { return cleanup; }, []);

  const gameTitle = variant === 'basic' ? '⚡ Quick Tap' : variant === 'inhibition' ? '🛑 Stop & Go' : '🏎️ Speed Challenge';
  const gameDesc = variant === 'basic'
    ? 'Tap the circle the instant it appears. Fast and accurate wins.'
    : variant === 'inhibition'
    ? 'Tap GREEN circles. Do NOT tap RED circles. Impulse control matters.'
    : 'Four targets will appear. Tap only the highlighted one — fast.';

  const stimColor = stimulusType === 'nogo' ? '#ef5350' : '#66bb6a';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{gameTitle}</Text>
        {phase !== 'intro' && (
          <Text style={styles.sub}>Round {round + 1} / {TOTAL_ROUNDS}  ·  Score: {score}</Text>
        )}
      </View>

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>{gameDesc}</Text>
          <Text style={styles.infoSub}>{TOTAL_ROUNDS} rounds</Text>
          <TouchableOpacity style={styles.btn} onPress={() => nextRound(0, 0, [])}>
            <Text style={styles.btnText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'waiting' && (
        <TouchableOpacity style={styles.arena} onPress={() => handleTap()} activeOpacity={1}>
          <Text style={styles.waitText}>Get ready...</Text>
        </TouchableOpacity>
      )}

      {phase === 'stimulus' && variant !== 'speed' && (
        <TouchableOpacity
          style={[styles.arena, styles.arenaActive]}
          onPress={() => handleTap()}
          activeOpacity={0.8}
        >
          <View style={[styles.bigCircle, { backgroundColor: stimColor }]} />
          {variant === 'inhibition' && (
            <Text style={styles.stimHint}>{stimulusType === 'go' ? 'TAP!' : 'DO NOT TAP!'}</Text>
          )}
        </TouchableOpacity>
      )}

      {phase === 'stimulus' && variant === 'speed' && (
        <View style={styles.arena}>
          <Text style={styles.waitText}>Tap the highlighted!</Text>
          <View style={styles.speedGrid}>
            {[0, 1, 2, 3].map(i => (
              <TouchableOpacity
                key={i}
                style={[styles.speedTarget, i === highlightIndex && styles.speedTargetLit]}
                onPress={() => handleTap(i)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        </View>
      )}

      {phase === 'feedback' && (
        <View style={styles.center}>
          <Text style={[styles.feedbackText, lastResult.startsWith('✓') ? styles.good : styles.bad]}>
            {lastResult}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  header: { marginBottom: 12 },
  title: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  sub: { color: '#9999cc', fontSize: 13, textAlign: 'center', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  infoText: { color: '#c0c0ee', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  infoSub: { color: '#6666aa', fontSize: 13 },
  btn: { backgroundColor: '#5c6bc0', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  arena: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  arenaActive: { backgroundColor: '#0f0f20', borderRadius: 20 },
  waitText: { color: '#5555aa', fontSize: 18 },
  bigCircle: { width: 140, height: 140, borderRadius: 70 },
  stimHint: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  speedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: 200, marginTop: 20 },
  speedTarget: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#16213e', borderWidth: 2, borderColor: '#2a2a5e' },
  speedTargetLit: { backgroundColor: '#66bb6a', borderColor: '#90ee90' },
  feedbackText: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  good: { color: '#66bb6a' },
  bad: { color: '#ef5350' },
});
