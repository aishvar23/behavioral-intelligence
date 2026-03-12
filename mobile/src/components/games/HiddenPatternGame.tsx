/**
 * Game 2: Hidden Pattern Game
 * User sees a sequence of numbers and must identify the rule.
 * Rules change after every 3 correct guesses. 5 rounds total.
 * Behavioral signals: time to first guess, wrong guesses, adaptation speed after rule change.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { trackEvent } from '../../utils/eventLogger';

type Rule = {
  label: string;
  sequence: (n: number) => number;
};

const RULES: Rule[] = [
  { label: '+3', sequence: n => n * 3 + (n === 0 ? 2 : 0) },
  { label: '*2', sequence: n => Math.pow(2, n + 1) },
  { label: 'squares', sequence: n => (n + 1) * (n + 1) },
  { label: 'fibonacci-like', sequence: n => [3, 5, 8, 13, 21, 34][n] ?? 0 },
  { label: '+7', sequence: n => 7 + n * 7 },
];

function pickRule(): Rule {
  return RULES[Math.floor(Math.random() * RULES.length)];
}

function buildSequence(rule: Rule, length = 4): number[] {
  return Array.from({ length }, (_, i) => rule.sequence(i));
}

interface Props {
  sessionId: string;
  onComplete: () => void;
}

const ROUNDS_PER_RULE = 3;
const TOTAL_ROUNDS = 9;

export default function HiddenPatternGame({ onComplete }: Props) {
  const [rule, setRule] = useState<Rule>(pickRule);
  const [sequence, setSequence] = useState<number[]>(() => buildSequence(pickRule()));
  const [guess, setGuess] = useState('');
  const [round, setRound] = useState(1);
  const [correctInRule, setCorrectInRule] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const roundStart = useRef<number>(Date.now());
  const firstGuessMade = useRef(false);
  const firstGuessTime = useRef<number | null>(null);
  const ruleChangeRound = useRef<number | null>(null);

  useEffect(() => {
    const r = pickRule();
    setRule(r);
    setSequence(buildSequence(r));
    roundStart.current = Date.now();
    firstGuessMade.current = false;
    firstGuessTime.current = null;
  }, []);

  function nextNumber(): number {
    return rule.sequence(sequence.length);
  }

  function handleGuess() {
    const val = parseInt(guess, 10);
    if (isNaN(val)) return;

    const now = Date.now();
    if (!firstGuessMade.current) {
      firstGuessTime.current = now - roundStart.current;
      firstGuessMade.current = true;
    }

    const correct = val === nextNumber();
    const adaptSpeed =
      ruleChangeRound.current !== null ? round - ruleChangeRound.current : null;

    trackEvent('pattern', correct ? 'correct_guess' : 'wrong_guess', {
      round,
      guess: val,
      expected: nextNumber(),
      timeToFirstGuess: firstGuessTime.current,
      wrongCount,
      adaptationRound: adaptSpeed,
    });

    if (correct) {
      setFeedback('✅ Correct!');
      const newCorrect = correctInRule + 1;
      const newRound = round + 1;

      if (newRound > TOTAL_ROUNDS) {
        setTimeout(onComplete, 800);
        return;
      }

      let newRule = rule;
      let newCorrectInRule = newCorrect;

      if (newCorrect >= ROUNDS_PER_RULE) {
        newRule = pickRule();
        newCorrectInRule = 0;
        ruleChangeRound.current = newRound;
        setFeedback('✅ Rule changed! Find the new pattern.');
      }

      setCorrectInRule(newCorrectInRule);
      setRule(newRule);
      setSequence(buildSequence(newRule));
      setRound(newRound);
      setWrongCount(0);
      roundStart.current = Date.now();
      firstGuessMade.current = false;
    } else {
      setWrongCount(w => w + 1);
      setFeedback('❌ Wrong. Try again.');
    }

    setGuess('');
    setTimeout(() => setFeedback(null), 1200);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Hidden Pattern Game</Text>
      <Text style={styles.sub}>Round {round} / {TOTAL_ROUNDS}</Text>

      <View style={styles.sequenceBox}>
        {sequence.map((n, i) => (
          <View key={i} style={styles.numBox}>
            <Text style={styles.numText}>{n}</Text>
          </View>
        ))}
        <View style={[styles.numBox, styles.questionBox]}>
          <Text style={styles.numText}>?</Text>
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
      />

      <TouchableOpacity style={styles.button} onPress={handleGuess}>
        <Text style={styles.buttonText}>Guess</Text>
      </TouchableOpacity>

      {feedback && <Text style={styles.feedback}>{feedback}</Text>}

      <Text style={styles.wrongCount}>Wrong guesses this round: {wrongCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#e0e0ff', marginBottom: 6 },
  sub: { color: '#9999cc', fontSize: 14, marginBottom: 24 },
  sequenceBox: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  numBox: {
    width: 48,
    height: 48,
    backgroundColor: '#16213e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionBox: { backgroundColor: '#3a3a6e' },
  numText: { color: '#e0e0ff', fontSize: 18, fontWeight: 'bold' },
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
  button: {
    backgroundColor: '#5c6bc0',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  feedback: { color: '#e0e0ff', fontSize: 16, marginTop: 16 },
  wrongCount: { color: '#666', fontSize: 13, marginTop: 12 },
});
