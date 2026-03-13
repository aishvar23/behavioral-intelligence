/**
 * Game 2: Hidden Pattern Game
 * Progressive difficulty across 3 tiers (3 rounds per tier, 9 rounds total).
 * Sequences never repeat — each correct answer extends a running history window.
 * Behavioral signals: time to first guess, wrong guesses, pass rate, adaptation speed.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { trackEvent } from '../../utils/eventLogger';

// ─── Rule types ───────────────────────────────────────────────────────────────

type Rule = {
  label: string;
  tier: 1 | 2 | 3;
  seed: number[];
  /** Given the full history so far, return the next number. */
  next: (history: number[]) => number;
};

// Tier 1 — simple arithmetic (add a constant)
const TIER1_RULES: Rule[] = [
  { label: '+2',  tier: 1, seed: [2, 4, 6],    next: h => h[h.length - 1] + 2 },
  { label: '+3',  tier: 1, seed: [3, 6, 9],    next: h => h[h.length - 1] + 3 },
  { label: '+4',  tier: 1, seed: [4, 8, 12],   next: h => h[h.length - 1] + 4 },
  { label: '+5',  tier: 1, seed: [5, 10, 15],  next: h => h[h.length - 1] + 5 },
];

// Tier 2 — multiplicative / quadratic
const TIER2_RULES: Rule[] = [
  { label: '×2',  tier: 2, seed: [2, 4, 8, 16],  next: h => h[h.length - 1] * 2 },
  { label: '×3',  tier: 2, seed: [3, 9, 27, 81], next: h => h[h.length - 1] * 3 },
  {
    // Perfect squares: 1, 4, 9, 16, 25… differences increase by 2 each step
    label: 'n²',
    tier: 2,
    seed: [1, 4, 9, 16],
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 2,
  },
];

// Tier 3 — complex multi-step rules
const TIER3_RULES: Rule[] = [
  {
    // Fibonacci-like: each term = sum of previous two
    label: 'Sum of prev 2',
    tier: 3,
    seed: [2, 3, 5, 8, 13],
    next: h => h[h.length - 2] + h[h.length - 1],
  },
  {
    // Triangular numbers: 1, 3, 6, 10, 15… differences increase by 1 each step
    label: 'Triangular',
    tier: 3,
    seed: [1, 3, 6, 10],
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 1,
  },
  {
    // Double-step Fibonacci variant with different seed
    label: 'Sum of prev 2',
    tier: 3,
    seed: [1, 2, 3, 5, 8],
    next: h => h[h.length - 2] + h[h.length - 1],
  },
];

const TIER_RULES: Rule[][] = [TIER1_RULES, TIER2_RULES, TIER3_RULES];
/** How many numbers the user sees per tier (sequence window size) */
const VISIBLE_BY_TIER = [3, 4, 5];

function pickRuleForTier(tier: 0 | 1 | 2): Rule {
  const pool = TIER_RULES[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUNDS_PER_RULE = 3;
const TOTAL_ROUNDS = 9;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  onComplete: () => void;
}

export default function HiddenPatternGame({ onComplete }: Props) {
  // Current tier index (0 = easy, 1 = medium, 2 = hard)
  const tierRef = useRef<0 | 1 | 2>(0);

  const [rule, setRule] = useState<Rule>(TIER1_RULES[0]);
  const [history, setHistory] = useState<number[]>([...TIER1_RULES[0].seed]);

  const [guess, setGuess] = useState('');
  const [round, setRound] = useState(1);
  const [correctInRule, setCorrectInRule] = useState(0);
  const [wrongThisRound, setWrongThisRound] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const roundStart = useRef<number>(Date.now());
  const firstGuessMade = useRef(false);
  const firstGuessTime = useRef<number | null>(null);
  const ruleChangeRound = useRef<number | null>(null);

  // Initialize consistently on mount
  useEffect(() => {
    tierRef.current = 0;
    const r = pickRuleForTier(0);
    setRule(r);
    setHistory([...r.seed]);
    roundStart.current = Date.now();
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function getNextAnswer(currentRule: Rule, currentHistory: number[]): number {
    return currentRule.next(currentHistory);
  }

  function getVisible(currentHistory: number[]): number[] {
    const len = VISIBLE_BY_TIER[tierRef.current];
    return currentHistory.slice(-len);
  }

  function pointsForGuess(wrongs: number): number {
    if (wrongs === 0) return 10;
    if (wrongs === 1) return 5;
    return 2;
  }

  /**
   * Advance to the next round after a correct answer or a pass.
   * All values passed explicitly to avoid stale-closure issues inside setTimeout.
   */
  function advanceRound(
    currentRule: Rule,
    currentHistory: number[],
    currentCorrectInRule: number,
    currentRound: number,
    earnedPoints: number,
    currentScore: number,
  ) {
    const answer = getNextAnswer(currentRule, currentHistory);
    const newHistory = [...currentHistory, answer];
    const newCorrectInRule = currentCorrectInRule + 1;
    const newRound = currentRound + 1;
    const newScore = currentScore + earnedPoints;

    setScore(newScore);

    if (newRound > TOTAL_ROUNDS) {
      setHistory(newHistory);
      trackEvent('pattern', 'game_complete', { finalScore: newScore });
      setTimeout(() => onComplete(), 900);
      return;
    }

    if (newCorrectInRule >= ROUNDS_PER_RULE) {
      // Advance to the next difficulty tier (cap at tier 3)
      const nextTier = Math.min(tierRef.current + 1, 2) as 0 | 1 | 2;
      tierRef.current = nextTier;
      const newRule = pickRuleForTier(nextTier);
      ruleChangeRound.current = newRound;
      setRule(newRule);
      setHistory([...newRule.seed]);
      setCorrectInRule(0);
      setFeedback('🔄 New pattern — find the rule!');
    } else {
      setHistory(newHistory);
      setCorrectInRule(newCorrectInRule);
    }

    setRound(newRound);
    setWrongThisRound(0);
    roundStart.current = Date.now();
    firstGuessMade.current = false;
    firstGuessTime.current = null;
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleGuess() {
    const val = parseInt(guess, 10);
    if (isNaN(val) || revealAnswer) return;

    const now = Date.now();
    if (!firstGuessMade.current) {
      firstGuessTime.current = now - roundStart.current;
      firstGuessMade.current = true;
    }

    const expected = getNextAnswer(rule, history);
    const correct = val === expected;
    const adaptSpeed =
      ruleChangeRound.current !== null ? round - ruleChangeRound.current : null;

    trackEvent('pattern', correct ? 'correct_guess' : 'wrong_guess', {
      round,
      tier: tierRef.current + 1,
      guess: val,
      expected,
      timeToFirstGuess: firstGuessTime.current,
      wrongThisRound,
      adaptationRound: adaptSpeed,
    });

    setGuess('');

    if (correct) {
      const pts = pointsForGuess(wrongThisRound);
      setFeedback(`✅ Correct! +${pts}`);
      // Capture current values for the timeout closure
      const capturedRule = rule;
      const capturedHistory = history;
      const capturedCorrectInRule = correctInRule;
      const capturedRound = round;
      const capturedScore = score;
      setTimeout(() => {
        setFeedback(null);
        advanceRound(capturedRule, capturedHistory, capturedCorrectInRule, capturedRound, pts, capturedScore);
      }, 800);
    } else {
      setWrongThisRound(w => w + 1);
      setFeedback('❌ Wrong. Try again.');
      setTimeout(() => setFeedback(null), 1000);
    }
  }

  function handlePass() {
    if (revealAnswer) return;

    const expected = getNextAnswer(rule, history);
    trackEvent('pattern', 'pass', {
      round,
      tier: tierRef.current + 1,
      answer: expected,
    });

    setRevealAnswer(true);
    setGuess('');
    setFeedback(`Answer: ${expected}`);

    const capturedRule = rule;
    const capturedHistory = history;
    const capturedCorrectInRule = correctInRule;
    const capturedRound = round;
    const capturedScore = score;
    setTimeout(() => {
      setRevealAnswer(false);
      setFeedback(null);
      advanceRound(capturedRule, capturedHistory, capturedCorrectInRule, capturedRound, 0, capturedScore);
    }, 1500);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const visible = getVisible(history);
  const answerForReveal = revealAnswer ? getNextAnswer(rule, history) : null;
  const tierLabel = ['Easy', 'Medium', 'Hard'][tierRef.current];
  const tierColor = ['#4caf50', '#ff9800', '#f44336'][tierRef.current];

  return (
    <View style={styles.container}>
      {/* Header: title + score */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🔍 Hidden Pattern</Text>
          <Text style={styles.sub}>Round {round} / {TOTAL_ROUNDS}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={[styles.tierBadge, { color: tierColor }]}>{tierLabel}</Text>
        </View>
      </View>

      {/* Sequence row */}
      <View style={styles.sequenceBox}>
        {visible.map((n, i) => (
          <View key={i} style={styles.numBox}>
            <Text style={styles.numText}>{n}</Text>
          </View>
        ))}
        <View style={[styles.numBox, styles.questionBox, revealAnswer && styles.revealBox]}>
          <Text style={styles.numText}>
            {revealAnswer ? answerForReveal : '?'}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>What comes next?</Text>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={guess}
        onChangeText={setGuess}
        placeholder="Enter number"
        placeholderTextColor="#555"
        onSubmitEditing={handleGuess}
        editable={!revealAnswer}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, revealAnswer && styles.buttonDisabled]}
          onPress={handleGuess}
          disabled={revealAnswer}
        >
          <Text style={styles.buttonText}>Guess</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.passButton, revealAnswer && styles.buttonDisabled]}
          onPress={handlePass}
          disabled={revealAnswer}
        >
          <Text style={styles.passText}>Pass</Text>
        </TouchableOpacity>
      </View>

      {feedback ? (
        <Text style={styles.feedback}>{feedback}</Text>
      ) : (
        <Text style={styles.wrongCount}>Wrong this round: {wrongThisRound}</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 28,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#e0e0ff' },
  sub: { color: '#9999cc', fontSize: 14, marginTop: 2 },

  scoreBox: { alignItems: 'flex-end' },
  scoreLabel: { color: '#9999cc', fontSize: 11, letterSpacing: 1 },
  scoreValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  tierBadge: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  sequenceBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
    justifyContent: 'center',
  },
  numBox: {
    width: 52,
    height: 52,
    backgroundColor: '#16213e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionBox: { backgroundColor: '#3a3a6e' },
  revealBox: { backgroundColor: '#1a4a1a' },
  numText: { color: '#e0e0ff', fontSize: 17, fontWeight: 'bold' },

  hint: { color: '#9999cc', marginBottom: 16 },

  input: {
    backgroundColor: '#16213e',
    color: '#e0e0ff',
    fontSize: 20,
    borderRadius: 10,
    padding: 14,
    width: '60%',
    textAlign: 'center',
    marginBottom: 16,
  },

  buttonRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  button: {
    backgroundColor: '#5c6bc0',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  passButton: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#444466',
  },
  passText: { color: '#888aaa', fontSize: 15 },

  feedback: { color: '#e0e0ff', fontSize: 16, marginTop: 16 },
  wrongCount: { color: '#666', fontSize: 13, marginTop: 16 },
});
