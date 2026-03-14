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
  Modal,
} from 'react-native';
import { trackEvent } from '../../utils/eventLogger';

// ─── Rule types ───────────────────────────────────────────────────────────────

type Rule = {
  label: string;
  tier: 1 | 2 | 3;
  /** Called fresh each time the rule is picked — randomises starting values. */
  seed: () => number[];
  /** Given the full history so far, return the next number. */
  next: (history: number[]) => number;
};

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Tier 1 — Alternating difference patterns (3 numbers shown) ───────────────
// Insight required: notice the gap alternates, not just grows.
const TIER1_RULES: Rule[] = [
  {
    // +1 then +3, repeating: 5, 6, 9, 10, 13, 14…
    label: 'Alt +1/+3',
    tier: 1,
    seed: () => { const r = rnd(2, 9); return [r, r + 1, r + 4]; },
    next: h => (h[h.length - 1] - h[h.length - 2] === 1)
      ? h[h.length - 1] + 3
      : h[h.length - 1] + 1,
  },
  {
    // +2 then +4, repeating: 3, 5, 9, 11, 15, 17…
    label: 'Alt +2/+4',
    tier: 1,
    seed: () => { const r = rnd(1, 8); return [r, r + 2, r + 6]; },
    next: h => (h[h.length - 1] - h[h.length - 2] === 2)
      ? h[h.length - 1] + 4
      : h[h.length - 1] + 2,
  },
  {
    // +3 then −1 zigzag: 7, 10, 9, 12, 11, 14, 13…
    label: 'Zigzag +3/−1',
    tier: 1,
    seed: () => { const r = rnd(4, 12); return [r, r + 3, r + 2]; },
    next: h => (h[h.length - 1] - h[h.length - 2] === -1)
      ? h[h.length - 1] + 3
      : h[h.length - 1] - 1,
  },
  {
    // +4 then +2, repeating: 2, 6, 8, 12, 14, 18…
    label: 'Alt +4/+2',
    tier: 1,
    seed: () => { const r = rnd(1, 7); return [r, r + 4, r + 6]; },
    next: h => (h[h.length - 1] - h[h.length - 2] === 4)
      ? h[h.length - 1] + 2
      : h[h.length - 1] + 4,
  },
];

// ─── Tier 2 — 2nd-order and two-lane patterns (4 numbers shown) ──────────────
// Insight required: look at differences-of-differences, or spot two interleaved tracks.
const TIER2_RULES: Rule[] = [
  {
    // Gaps grow by 1 each step: 2, 3, 5, 8, 12, 17…
    label: 'Growing gaps',
    tier: 2,
    seed: () => { const r = rnd(1, 5); return [r, r + 1, r + 3, r + 6]; },
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 1,
  },
  {
    // Perfect squares — recognise, don't calculate: 1, 4, 9, 16, 25…
    label: 'Square steps',
    tier: 2,
    seed: () => [1, 4, 9, 16],
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 2,
  },
  {
    // Two interleaved lanes, each advancing independently:
    // Lane A (+1 each step), Lane B (+2 each step)
    // e.g. 2, 10, 3, 12, 4, 14, 5…
    label: 'Two lanes',
    tier: 2,
    seed: () => {
      const a = rnd(1, 5);
      const b = rnd(10, 18);
      return [a, b, a + 1, b + 2];
    },
    next: h => h.length % 2 === 0
      ? h[h.length - 2] + 1   // Lane A: 0-indexed even positions
      : h[h.length - 2] + 2,  // Lane B: 0-indexed odd positions
  },
  {
    // Gaps grow by 2 each step: 1, 3, 7, 13, 21, 31…
    label: 'Double-grow gaps',
    tier: 2,
    seed: () => { const r = rnd(1, 4); return [r, r + 2, r + 6, r + 12]; },
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 2,
  },
];

// ─── Tier 3 — Complex relational patterns (5 numbers shown) ──────────────────
// Insight required: relationship spans multiple terms, or two rules interleave.
const TIER3_RULES: Rule[] = [
  {
    // Fibonacci-style: each term = sum of the two before it.
    // Seed is randomised so it never starts 1,1,2,3,5.
    label: 'Sum prev 2',
    tier: 3,
    seed: () => {
      const a = rnd(1, 5);
      const b = rnd(a + 1, a + 6);
      const c = a + b; const d = b + c; const e = c + d;
      return [a, b, c, d, e];
    },
    next: h => h[h.length - 2] + h[h.length - 1],
  },
  {
    // Up/Down lanes: one track rises +1, the other falls −2.
    // e.g. 1, 20, 2, 18, 3, 16, 4, 14…
    label: 'Up / Down lanes',
    tier: 3,
    seed: () => {
      const a = rnd(1, 4);
      const b = rnd(18, 26);
      return [a, b, a + 1, b - 2, a + 2];
    },
    next: h => h.length % 2 === 0
      ? h[h.length - 2] + 1   // rising lane
      : h[h.length - 2] - 2,  // falling lane
  },
  {
    // Alternate: ×2, then +1, then ×2, then +1…
    // e.g. 1, 2, 3, 6, 7, 14, 15, 30…
    label: '×2 then +1',
    tier: 3,
    seed: () => {
      const a = rnd(1, 4);
      const b = a * 2;
      return [a, b, b + 1, (b + 1) * 2, (b + 1) * 2 + 1];
    },
    next: h => h.length % 2 === 0
      ? h[h.length - 1] + 1
      : h[h.length - 1] * 2,
  },
  {
    // Gaps are the sequence of odd numbers: 1, 3, 5, 7, 9…
    // Result: 0, 1, 4, 9, 16, 25… — the square numbers, but the insight is in the gaps.
    label: 'Odd-number gaps',
    tier: 3,
    seed: () => { const r = rnd(0, 3); return [r, r + 1, r + 4, r + 9, r + 16]; },
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 2,
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
  onComplete: (score: number) => void;
}

export default function HiddenPatternGame({ onComplete }: Props) {
  // Current tier index (0 = easy, 1 = medium, 2 = hard)
  const tierRef = useRef<0 | 1 | 2>(0);

  const [rule, setRule] = useState<Rule>(TIER1_RULES[0]);
  const [history, setHistory] = useState<number[]>([...TIER1_RULES[0].seed()]);

  const [guess, setGuess] = useState('');
  const [round, setRound] = useState(1);
  const [correctInRule, setCorrectInRule] = useState(0);
  const [wrongThisRound, setWrongThisRound] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const roundStart = useRef<number>(Date.now());
  const firstGuessMade = useRef(false);
  const firstGuessTime = useRef<number | null>(null);
  const ruleChangeRound = useRef<number | null>(null);

  // Initialize consistently on mount
  useEffect(() => {
    tierRef.current = 0;
    const r = pickRuleForTier(0);
    setRule(r);
    setHistory([...r.seed()]);
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
    currentCorrectInRule: number,
    currentRound: number,
    earnedPoints: number,
    currentScore: number,
  ) {
    const newCorrectInRule = currentCorrectInRule + 1;
    const newRound = currentRound + 1;
    const newScore = currentScore + earnedPoints;

    setScore(newScore);

    if (newRound > TOTAL_ROUNDS) {
      trackEvent('pattern', 'game_complete', { finalScore: newScore });
      setTimeout(() => onComplete(newScore), 900);
      return;
    }

    if (newCorrectInRule >= ROUNDS_PER_RULE) {
      // Advance to the next difficulty tier (cap at tier 3)
      const nextTier = Math.min(tierRef.current + 1, 2) as 0 | 1 | 2;
      tierRef.current = nextTier;
      const newRule = pickRuleForTier(nextTier);
      ruleChangeRound.current = newRound;
      setRule(newRule);
      setHistory([...newRule.seed()]);
      setCorrectInRule(0);
      setFeedback('🔄 New pattern — find the rule!');
    } else {
      setHistory([...currentRule.seed()]);
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
      const capturedCorrectInRule = correctInRule;
      const capturedRound = round;
      const capturedScore = score;
      setTimeout(() => {
        setFeedback(null);
        advanceRound(capturedRule, capturedCorrectInRule, capturedRound, pts, capturedScore);
      }, 800);
    } else {
      setWrongThisRound(w => w + 1);
      setFeedback('❌ Wrong. Try again.');
      setTimeout(() => setFeedback(null), 1000);
    }
  }

  function handleQuit() {
    trackEvent('pattern', 'quit', { round, score });
    onComplete(score);
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
    const capturedCorrectInRule = correctInRule;
    const capturedRound = round;
    const capturedScore = score;
    setTimeout(() => {
      setRevealAnswer(false);
      setFeedback(null);
      advanceRound(capturedRule, capturedCorrectInRule, capturedRound, 0, capturedScore);
    }, 1500);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const visible = getVisible(history);
  const answerForReveal = revealAnswer ? getNextAnswer(rule, history) : null;
  const tierLabel = ['Easy', 'Medium', 'Hard'][tierRef.current];
  const tierColor = ['#4caf50', '#ff9800', '#f44336'][tierRef.current];

  return (
    <View style={styles.container}>
      {/* Rules modal */}
      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔍 How to Play</Text>
            <Text style={styles.modalText}>
              {'• A sequence of numbers is shown with a ? at the end.\n\n'}
              {'• Figure out the pattern and type what comes next, then press Guess.\n\n'}
              {'• Scoring per round:\n   +10 correct on first try\n   +5 correct after 1 wrong\n   +2 correct after 2+ wrongs\n   +0 for Pass\n\n'}
              {'• Press Pass to reveal the answer and move on (no points).\n\n'}
              {'• Difficulty increases every 3 rounds:\n   Rounds 1–3: Easy — gaps alternate between two values\n   Rounds 4–6: Medium — gaps grow, or two hidden tracks interleave\n   Rounds 7–9: Hard — multiple terms interact, or two tracks move in opposite directions\n\n'}
              {'• 9 rounds total.'}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowRules(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header: title + score */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>🔍 Hidden Pattern</Text>
            <TouchableOpacity style={styles.rulesBtn} onPress={() => setShowRules(true)}>
              <Text style={styles.rulesBtnText}>?</Text>
            </TouchableOpacity>
          </View>
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

      <TouchableOpacity style={styles.quitBtn} onPress={handleQuit}>
        <Text style={styles.quitText}>Quit Game</Text>
      </TouchableOpacity>
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
  quitBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c62828',
  },
  quitText: { color: '#ff6666', fontSize: 14 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rulesBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#16213e', borderWidth: 1, borderColor: '#5c6bc0',
    alignItems: 'center', justifyContent: 'center',
  },
  rulesBtnText: { color: '#9999cc', fontSize: 12, fontWeight: 'bold' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#3a3a6e', width: '100%' },
  modalTitle: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalText: { color: '#aaaacc', fontSize: 14, lineHeight: 22 },
  modalClose: { marginTop: 20, backgroundColor: '#5c6bc0', borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
