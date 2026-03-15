import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

type Variant = 'deduction' | 'patterns' | 'verbal';

interface Question {
  prompt: string;
  options: string[];
  answer: number; // index of correct option
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: { variant: Variant };
}

const QUESTIONS: Record<Variant, Question[]> = {
  deduction: [
    { prompt: 'All Zorbs are Blips. All Blips are Glinks. Sam is a Zorb. Therefore:', options: ['Sam is a Glink', 'Sam may be a Glink', 'Sam is not a Glink', 'Cannot determine'], answer: 0 },
    { prompt: 'If it rains, the game is cancelled. The game was NOT cancelled. Therefore:', options: ['It did not rain', 'It definitely rained', 'The game was postponed', 'Cannot determine'], answer: 0 },
    { prompt: 'All members scored over 50. Alex scored 45. Therefore:', options: ['Alex is not a member', 'Alex needs to improve', 'Alex is a new member', 'Cannot determine'], answer: 0 },
    { prompt: 'X > Y and Y > Z. Therefore:', options: ['X > Z', 'Z > X', 'X = Z', 'Cannot determine'], answer: 0 },
    { prompt: 'Every red button triggers an alarm. No alarm was triggered. Therefore:', options: ['No red button was pressed', 'A red button was pressed', 'The alarms are broken', 'Nothing can be concluded'], answer: 0 },
    { prompt: 'Some doctors are runners. Some runners are fast. Therefore:', options: ['No firm conclusion about doctors and speed', 'Some doctors are fast', 'All doctors are fast', 'No doctors are fast'], answer: 0 },
    { prompt: 'P → Q. Q is false. Therefore:', options: ['P must be false', 'P must be true', 'P may be true or false', 'Q causes P'], answer: 0 },
    { prompt: 'Only verified users can post. A post was made. Therefore:', options: ['The poster is a verified user', 'The poster may be verified', 'The post is invalid', 'The system has a flaw'], answer: 0 },
    { prompt: 'No flights depart in fog. There is fog now. Therefore:', options: ['No flight will depart', 'Some flights may depart', 'Flights are delayed', 'The fog will clear'], answer: 0 },
    { prompt: 'All A students pass the exam. Ben passed. Therefore:', options: ['Ben may or may not be an A student', 'Ben is an A student', 'Ben is the top student', 'Ben will always pass'], answer: 0 },
  ],
  patterns: [
    { prompt: 'What comes next?  2, 4, 8, 16, __', options: ['32', '24', '20', '28'], answer: 0 },
    { prompt: 'What comes next?  1, 4, 9, 16, __', options: ['25', '20', '24', '21'], answer: 0 },
    { prompt: 'What comes next?  1, 1, 2, 3, 5, 8, __', options: ['13', '11', '10', '14'], answer: 0 },
    { prompt: 'What comes next?  100, 50, 25, 12.5, __', options: ['6.25', '5', '10', '8'], answer: 0 },
    { prompt: 'What comes next?  2, 3, 5, 8, 12, __', options: ['17', '16', '15', '18'], answer: 0 },
    { prompt: 'What comes next?  81, 27, 9, 3, __', options: ['1', '0', '2', '3'], answer: 0 },
    { prompt: 'What comes next?  2, 6, 12, 20, 30, __', options: ['42', '40', '36', '44'], answer: 0 },
    { prompt: 'What is the missing number?  3, 7, __, 15, 19', options: ['11', '10', '12', '13'], answer: 0 },
    { prompt: 'What comes next?  1, 8, 27, 64, __', options: ['125', '100', '81', '144'], answer: 0 },
    { prompt: 'What comes next?  5, 10, 20, 40, __', options: ['80', '60', '70', '90'], answer: 0 },
  ],
  verbal: [
    { prompt: 'Book is to Library as Painting is to __', options: ['Museum', 'Artist', 'Canvas', 'Gallery'], answer: 0 },
    { prompt: 'Doctor is to Hospital as Teacher is to __', options: ['School', 'Library', 'Student', 'Book'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Carrot', 'Apple', 'Orange', 'Banana'], answer: 0 },
    { prompt: 'Cold is to Hot as Dark is to __', options: ['Light', 'Bright', 'Sun', 'Day'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Keyboard', 'Hammer', 'Wrench', 'Screwdriver'], answer: 0 },
    { prompt: 'Bird is to Nest as Human is to __', options: ['House', 'City', 'Bed', 'Office'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Television', 'Piano', 'Guitar', 'Violin'], answer: 0 },
    { prompt: 'Clock is to Time as Thermometer is to __', options: ['Temperature', 'Heat', 'Weather', 'Degrees'], answer: 0 },
    { prompt: 'Eye is to See as Ear is to __', options: ['Hear', 'Sound', 'Listen', 'Music'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Pyramid', 'Circle', 'Square', 'Triangle'], answer: 0 },
  ],
};

const QUESTIONS_PER_GAME = 7;
const TIME_PER_QUESTION = 30; // seconds

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

export default function LogicDeductionGame({ sessionId, onComplete, config }: Props) {
  const variant = config.variant ?? 'deduction';
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qStartRef = useRef(0);

  const advance = useCallback((finalScore: number, correct: number) => {
    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'game_complete',
      timestamp: Date.now(),
      data: { score: finalScore, correctCount: correct, totalQuestions: QUESTIONS_PER_GAME },
    }).catch(() => {});
    setPhase('done');
    onComplete(finalScore);
  }, [sessionId, variant, onComplete]);

  function startGame() {
    const pool = [...QUESTIONS[variant]]
      .sort(() => Math.random() - 0.5)
      .slice(0, QUESTIONS_PER_GAME)
      .map(q => {
        // Shuffle options so the correct answer isn't always at index 0
        const correctAnswer = q.options[q.answer];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        return { ...q, options: shuffled, answer: shuffled.indexOf(correctAnswer) };
      });
    setQuestions(pool);
    setCurrentQ(0);
    setScore(0);
    setCorrectCount(0);
    setPhase('playing');
    qStartRef.current = Date.now();
    setTimeLeft(TIME_PER_QUESTION);
  }

  // Countdown timer — visual tick only; game logic timeout handled separately
  useEffect(() => {
    if (phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    // Visual countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    // Actual timeout that triggers game logic
    timeoutRef.current = setTimeout(() => {
      clearInterval(timerRef.current!);
      handleAnswer(-1);
    }, TIME_PER_QUESTION * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, currentQ]);

  function handleAnswer(optionIndex: number) {
    if (phase !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentQ];
    const correct = optionIndex === q.answer;
    const timeSpent = (Date.now() - qStartRef.current) / 1000;
    const timeBonus = correct ? Math.round(Math.max(0, (TIME_PER_QUESTION - timeSpent) / TIME_PER_QUESTION) * 5) : 0;
    const qScore = correct ? 10 + timeBonus : 0;
    const newScore = score + qScore;
    const newCorrect = correctCount + (correct ? 1 : 0);

    setSelected(optionIndex);
    setScore(newScore);
    setCorrectCount(newCorrect);
    setPhase('feedback');

    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'question_answer',
      timestamp: Date.now(),
      data: { questionIndex: currentQ, correct, timeSpent, score: qScore },
    }).catch(() => {});

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        advance(newScore, newCorrect);
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setPhase('playing');
        qStartRef.current = Date.now();
        setTimeLeft(TIME_PER_QUESTION);
      }
    }, 1000);
  }

  const gameTitle = variant === 'deduction' ? '🔎 Logic Deduction' : variant === 'patterns' ? '🔲 Abstract Patterns' : '💬 Word Logic';
  const gameDesc = variant === 'deduction'
    ? 'Each puzzle has one logically correct conclusion. Think carefully.'
    : variant === 'patterns'
    ? 'Identify the rule and find the missing number.'
    : 'Word analogies and odd-one-out puzzles.';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{gameTitle}</Text>
        {phase === 'playing' && (
          <View style={styles.headerRow}>
            <Text style={styles.sub}>Q {currentQ + 1} / {questions.length}  ·  Score: {score}</Text>
            <View style={[styles.timerBadge, timeLeft <= 8 && styles.timerUrgent]}>
              <Text style={[styles.timerText, timeLeft <= 8 && styles.timerTextUrgent]}>{timeLeft}s</Text>
            </View>
          </View>
        )}
      </View>

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>{gameDesc}</Text>
          <Text style={styles.infoSub}>{QUESTIONS_PER_GAME} questions · {TIME_PER_QUESTION}s per question</Text>
          <TouchableOpacity style={styles.btn} onPress={startGame}>
            <Text style={styles.btnText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {(phase === 'playing' || phase === 'feedback') && questions.length > 0 && (
        <View style={styles.qContainer}>
          <View style={styles.qBox}>
            <Text style={styles.qText}>{questions[currentQ].prompt}</Text>
          </View>
          <View style={styles.options}>
            {questions[currentQ].options.map((opt, i) => {
              const isCorrect = i === questions[currentQ].answer;
              const isSelected = selected === i;
              let bg = '#16213e';
              let border = '#2a2a5e';
              if (phase === 'feedback') {
                if (isCorrect) { bg = '#1a3a1a'; border = '#66bb6a'; }
                else if (isSelected && !isCorrect) { bg = '#3a1a1a'; border = '#ef5350'; }
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => handleAnswer(i)}
                  disabled={phase === 'feedback'}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabel}>{String.fromCharCode(65 + i)}.</Text>
                  <Text style={styles.optionText}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  header: { marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sub: { color: '#9999cc', fontSize: 13 },
  timerBadge: { backgroundColor: '#16213e', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#3a3a6e' },
  timerUrgent: { backgroundColor: '#3a1a1a', borderColor: '#ef5350' },
  timerText: { color: '#9999cc', fontSize: 13, fontWeight: '700' },
  timerTextUrgent: { color: '#ef5350' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  infoText: { color: '#c0c0ee', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  infoSub: { color: '#6666aa', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: '#5c6bc0', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  qContainer: { flex: 1 },
  qBox: { backgroundColor: '#16213e', borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2a2a5e' },
  qText: { color: '#e0e0ff', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1.5, gap: 10 },
  optionLabel: { color: '#5c6bc0', fontSize: 15, fontWeight: '700', width: 24 },
  optionText: { color: '#c0c0ee', fontSize: 15, flex: 1 },
});
