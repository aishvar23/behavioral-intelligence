/**
 * Black Box Game (Rule Discovery)
 * A hidden function f(x) is shown as "???". Test preset inputs to see their outputs,
 * then deduce the rule and predict the output for a challenge number.
 * Measures: analytical_thinking, learning_speed, systematic_thinking
 *
 * Within-game adaptive difficulty:
 *   After round 2 (3 rounds played), evaluates performance:
 *   - ≥2/3 correct AND avg tests ≤ 2.5 → hard mode: harder rules + 30s timer
 *   - ≤1/3 correct → easy mode: simpler rules + 55s timer
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 8;
const TIME_NORMAL = 40_000;
const TIME_HARD   = 30_000;
const TIME_EASY   = 55_000;

interface RuleDef {
  fn: (x: number) => number;
  label: string;
  testValues: number[];
  challenge: number;
}

// Indices 0-3: simpler (linear), 4-7: harder (quadratic / non-linear)
const RULES: RuleDef[] = [
  { fn: x => x + 5,       label: 'f(x) = x + 5',     testValues: [1,2,3,4,5,6], challenge: 8  }, // 0 → 13
  { fn: x => x * 2,       label: 'f(x) = x × 2',     testValues: [1,2,3,4,5,6], challenge: 9  }, // 1 → 18
  { fn: x => x * 2 + 3,   label: 'f(x) = 2x + 3',    testValues: [1,2,3,4,5,6], challenge: 7  }, // 2 → 17
  { fn: x => 15 - x,      label: 'f(x) = 15 − x',    testValues: [1,2,3,4,5,6], challenge: 8  }, // 3 → 7
  { fn: x => x * x,       label: 'f(x) = x²',        testValues: [1,2,3,4,5,6], challenge: 7  }, // 4 → 49
  { fn: x => x * x + 1,   label: 'f(x) = x² + 1',    testValues: [1,2,3,4,5,6], challenge: 5  }, // 5 → 26
  { fn: x => x * (x + 1), label: 'f(x) = x×(x+1)',   testValues: [1,2,3,4,5,6], challenge: 6  }, // 6 → 42
  { fn: x => x * x - x,   label: 'f(x) = x² − x',    testValues: [2,3,4,5,6,7], challenge: 8  }, // 7 → 56
];

function getRuleIndex(r: number, mode: 'normal' | 'hard' | 'easy'): number {
  if (mode === 'hard' && r >= 3) return 4 + ((r - 3) % 4);
  if (mode === 'easy' && r >= 3) return (r - 3) % 4;
  return r % RULES.length;
}

interface TestPair { input: number; output: number }
interface RoundResult { correct: boolean; testsUsed: number }

export default function BlackBoxGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [tested, setTested] = useState<TestPair[]>([]);
  const [answerDigits, setAnswerDigits] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [timerPct, setTimerPct] = useState(1);
  const [adaptBanner, setAdaptBanner] = useState<string | null>(null);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();
  const adaptMode = useRef<'normal' | 'hard' | 'easy'>('normal');
  const timeLimit = useRef(TIME_NORMAL);
  const roundResults = useRef<RoundResult[]>([]);

  // Current rule derived from round + adaptMode (re-derived each render)
  const ruleIdx = getRuleIndex(round, adaptMode.current);
  const rule = RULES[ruleIdx];

  const startRound = useCallback((r: number) => {
    setTested([]);
    setAnswerDigits('');
    setSubmitted(false);
    setWasCorrect(null);
    setTimerPct(1);
    setAdaptBanner(null);
    roundStart.current = Date.now();
    setRound(r);
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || submitted) return;
    const limit = timeLimit.current;
    timerInterval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - roundStart.current) / limit);
      setTimerPct(pct);
      if (pct === 0) {
        clearInterval(timerInterval.current);
        setShowTimeoutDialog(true);
      }
    }, 80);
    return () => clearInterval(timerInterval.current);
  }, [phase, round, submitted, timerKey]);

  function handleMoreTime() {
    logEvent({ sessionId, gameId: 'black_box', eventType: 'timeout_extended',
      timestamp: Date.now(), data: { round, extensionSecs: 30 } }).catch(() => {});
    roundStart.current = Date.now();
    timeLimit.current = 30_000;
    setShowTimeoutDialog(false);
    setTimerKey(k => k + 1);
  }

  function handleSkipRound() {
    logEvent({ sessionId, gameId: 'black_box', eventType: 'timeout_skip',
      timestamp: Date.now(), data: { round } }).catch(() => {});
    roundResults.current.push({ correct: false, testsUsed: 0 });
    void logEvent({ sessionId, gameId: 'black_box', eventType: 'prediction_submitted',
      timestamp: Date.now(), data: { round, predicted: null, correct: false, testsUsed: tested.length, timedOut: true } });
    setSubmitted(true);
    setWasCorrect(false);
    setShowTimeoutDialog(false);
    setTimeout(() => advance(round + 1), 5000);
  }

  function handleTest(val: number) {
    if (submitted) return;
    if (tested.some(p => p.input === val)) return;
    const output = rule.fn(val);
    const next = [...tested, { input: val, output }];
    setTested(next);
    void logEvent({ sessionId, gameId: 'black_box', eventType: 'input_tested',
      timestamp: Date.now(), data: { round, input: val, output } });
  }

  function handleDigit(d: string) {
    if (submitted) return;
    if (answerDigits.length >= 3) return;
    setAnswerDigits(prev => prev + d);
  }

  function handleBackspace() {
    setAnswerDigits(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (submitted || answerDigits.length === 0) return;
    clearInterval(timerInterval.current);
    const predicted = parseInt(answerDigits, 10);
    const correct = predicted === rule.fn(rule.challenge);
    const testsUsed = tested.length;
    const rt = Date.now() - roundStart.current;

    roundResults.current.push({ correct, testsUsed });

    const basePoints = testsUsed <= 2 ? 30 : testsUsed <= 4 ? 20 : 10;
    const pts = correct ? Math.round(basePoints + timerPct * 10) : 0;
    scoreRef.current += pts;

    void logEvent({ sessionId, gameId: 'black_box', eventType: 'prediction_submitted',
      timestamp: Date.now(), data: { round, predicted, correct, testsUsed, responseTime: rt } });

    setSubmitted(true);
    setWasCorrect(correct);
    setTimeout(() => advance(round + 1), correct ? 1500 : 5000);
  }

  function checkAdaptation(completedRound: number) {
    // Evaluate after round index 2 (3 rounds played) if still in normal mode
    if (completedRound !== 3 || adaptMode.current !== 'normal') return null;
    const results = roundResults.current.slice(0, 3);
    const correctCount = results.filter(r => r.correct).length;
    const avgTests = results.reduce((s, r) => s + r.testsUsed, 0) / 3;

    if (correctCount >= 2 && avgTests <= 2.5) {
      adaptMode.current = 'hard';
      timeLimit.current = TIME_HARD;
      void logEvent({ sessionId, gameId: 'black_box', eventType: 'adapt_difficulty',
        timestamp: Date.now(), data: { mode: 'hard', correctCount, avgTests } });
      return 'hard';
    } else if (correctCount <= 1) {
      adaptMode.current = 'easy';
      timeLimit.current = TIME_EASY;
      void logEvent({ sessionId, gameId: 'black_box', eventType: 'adapt_difficulty',
        timestamp: Date.now(), data: { mode: 'easy', correctCount, avgTests } });
      return 'easy';
    }
    return null;
  }

  function advance(next: number) {
    if (next >= ROUNDS) { setPhase('done'); onComplete(scoreRef.current); return; }
    const newMode = checkAdaptation(next);
    if (newMode === 'hard') {
      setAdaptBanner('🔥 Stepping it up — harder rules ahead!');
    } else if (newMode === 'easy') {
      setAdaptBanner('💡 Adjusting pace — take your time.');
    }
    startRound(next);
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>⬛</Text>
      <Text style={s.title}>Black Box</Text>
      <Text style={s.desc}>
        A hidden function <Text style={s.em}>f(x) = ???</Text> sits inside a black box.{'\n\n'}
        Test input numbers to see their outputs.{'\n'}
        Deduce the rule, then predict the output{'\n'}for a mystery number.
      </Text>
      <TouchableOpacity style={s.startBtn} onPress={() => startRound(0)}>
        <Text style={s.startBtnTxt}>Start →</Text>
      </TouchableOpacity>
    </View>
  );

  if (phase === 'done') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>✅</Text>
      <Text style={s.title}>Complete!</Text>
      <Text style={s.doneScore}>{scoreRef.current} pts</Text>
    </View>
  );

  const currentRule = RULES[getRuleIndex(round, adaptMode.current)];
  const challengeAnswer = currentRule.fn(currentRule.challenge);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.counter}>Round {round + 1}/{ROUNDS}</Text>
        <View style={s.timerTrack}>
          <View style={[s.timerFill, { width: `${timerPct * 100}%` as any,
            backgroundColor: timerPct > 0.35 ? '#5c6bc0' : '#ef5350' }]} />
        </View>
        <Text style={s.scoreTxt}>{scoreRef.current}pt</Text>
      </View>

      {/* Adaptive difficulty banner */}
      {adaptBanner && (
        <View style={s.adaptBanner}>
          <Text style={s.adaptBannerTxt}>{adaptBanner}</Text>
        </View>
      )}

      {/* Difficulty badge */}
      {adaptMode.current !== 'normal' && (
        <Text style={[s.diffBadge, adaptMode.current === 'hard' ? s.diffBadgeHard : s.diffBadgeEasy]}>
          {adaptMode.current === 'hard' ? '🔥 Hard Mode' : '💡 Easy Mode'}
        </Text>
      )}

      {/* Function display */}
      <View style={s.funcBox}>
        <Text style={s.funcLabel}>f(x) = ???</Text>
        <Text style={s.funcSub}>Find the hidden rule</Text>
      </View>

      {/* Test panel */}
      <Text style={s.sectionLabel}>Test an input:</Text>
      <View style={s.testBtnRow}>
        {currentRule.testValues.map(v => {
          const alreadyTested = tested.some(p => p.input === v);
          return (
            <TouchableOpacity
              key={v}
              style={[s.testBtn, alreadyTested && s.testBtnUsed]}
              onPress={() => handleTest(v)}
              disabled={alreadyTested || submitted}
              activeOpacity={0.75}
            >
              <Text style={[s.testBtnTxt, alreadyTested && s.testBtnUsedTxt]}>
                {alreadyTested ? `${v}→${currentRule.fn(v)}` : v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Challenge */}
      <View style={s.challengeBox}>
        <Text style={s.challengeLabel}>
          Predict:  <Text style={s.challengeNum}>f({currentRule.challenge}) = ?</Text>
        </Text>
        {submitted && (
          <Text style={[s.reveal, { color: wasCorrect ? '#66bb6a' : '#ef5350' }]}>
            {wasCorrect ? `✓ Correct! ${challengeAnswer}` : `✗ Answer was ${challengeAnswer}  ·  Rule: ${currentRule.label}`}
          </Text>
        )}
      </View>

      {/* Answer input */}
      {!submitted && (
        <View style={s.inputArea}>
          <View style={s.answerDisplay}>
            <Text style={s.answerTxt}>{answerDigits || '—'}</Text>
          </View>
          <View style={s.numpad}>
            {['7','8','9','4','5','6','1','2','3','⌫','0','✓'].map((key) => (
              <TouchableOpacity
                key={key}
                style={[s.numKey, key === '✓' && s.numKeySubmit, key === '⌫' && s.numKeyBack]}
                onPress={() => {
                  if (key === '⌫') handleBackspace();
                  else if (key === '✓') handleSubmit();
                  else handleDigit(key);
                }}
                activeOpacity={0.75}
              >
                <Text style={[s.numKeyTxt, key === '✓' && s.numKeySubmitTxt]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Timeout dialog overlay */}
      {showTimeoutDialog && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10,10,30,0.92)',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 32,
        }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>⏰</Text>
          <Text style={{ color: '#e0e0ff', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>Time's Up!</Text>
          <Text style={{ color: '#9999cc', fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
            Do you need more time, or would you like to skip this one?
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#5c6bc0', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, marginBottom: 14, width: '100%', alignItems: 'center' }}
            onPress={handleMoreTime}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>⏱ Take More Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: '#1e1e3e', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, borderWidth: 1, borderColor: '#3a3a6e', width: '100%', alignItems: 'center' }}
            onPress={handleSkipRound}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#9999cc', fontSize: 16 }}>Skip →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigEmoji: { fontSize: 52, marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  desc: { color: '#9999cc', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  em: { color: '#e0e0ff', fontWeight: '700' },
  startBtn: { backgroundColor: '#5c6bc0', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 30 },
  startBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  doneScore: { color: '#5c6bc0', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  counter: { color: '#5555aa', fontSize: 13, minWidth: 80 },
  timerTrack: { flex: 1, height: 6, backgroundColor: '#2a2a5e', borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, borderRadius: 3 },
  scoreTxt: { color: '#5555aa', fontSize: 13, minWidth: 40, textAlign: 'right' },
  adaptBanner: {
    backgroundColor: '#1e1e3e', borderRadius: 8, borderWidth: 1, borderColor: '#5c6bc0',
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, alignItems: 'center',
  },
  adaptBannerTxt: { color: '#c0c0ff', fontSize: 13, fontWeight: '600' },
  diffBadge: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6, letterSpacing: 0.5 },
  diffBadgeHard: { color: '#ff7043' },
  diffBadgeEasy: { color: '#66bb6a' },
  funcBox: {
    backgroundColor: '#0d0d1e', borderRadius: 14, borderWidth: 1.5, borderColor: '#5c6bc0',
    alignItems: 'center', paddingVertical: 14, marginBottom: 16,
  },
  funcLabel: { color: '#c084fc', fontSize: 22, fontWeight: 'bold', letterSpacing: 2 },
  funcSub: { color: '#5555aa', fontSize: 12, marginTop: 4 },
  sectionLabel: { color: '#7777aa', fontSize: 13, marginBottom: 8 },
  testBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  testBtn: {
    minWidth: 48, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: '#16213e', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a5e',
    alignItems: 'center',
  },
  testBtnUsed: { backgroundColor: '#0d2e1e', borderColor: '#4ade80' },
  testBtnTxt: { color: '#9999cc', fontSize: 15, fontWeight: '600' },
  testBtnUsedTxt: { color: '#4ade80', fontSize: 13 },
  challengeBox: {
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a5e',
    padding: 14, marginBottom: 12,
  },
  challengeLabel: { color: '#9999cc', fontSize: 15 },
  challengeNum: { color: '#e0e0ff', fontWeight: 'bold', fontSize: 18 },
  reveal: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  inputArea: { flex: 1 },
  answerDisplay: {
    backgroundColor: '#0d0d1e', borderRadius: 10, borderWidth: 1.5, borderColor: '#5c6bc0',
    alignItems: 'center', paddingVertical: 10, marginBottom: 10,
  },
  answerTxt: { color: '#e0e0ff', fontSize: 28, fontWeight: 'bold', letterSpacing: 4, minHeight: 40 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  numKey: {
    width: '28%', paddingVertical: 14,
    backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a5e',
    alignItems: 'center',
  },
  numKeyBack: { borderColor: '#5c6bc0' },
  numKeySubmit: { backgroundColor: '#5c6bc0', borderColor: '#7986cb' },
  numKeyTxt: { color: '#c0c0ee', fontSize: 20, fontWeight: '600' },
  numKeySubmitTxt: { color: '#fff' },
});
