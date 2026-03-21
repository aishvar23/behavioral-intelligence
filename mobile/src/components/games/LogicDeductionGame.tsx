import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

type Variant = 'deduction' | 'patterns' | 'verbal' | 'boolean' | 'quantitative' | 'spatial' | 'situational' | 'attention';

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
    { prompt: 'No Flurbs are Snorps. All Snorps are Twirps. Therefore:', options: ['No Flurbs are Twirps', 'Some Flurbs are Twirps', 'All Twirps are Flurbs', 'Cannot determine'], answer: 3 },
    { prompt: 'If A then B. If B then C. A is true. Therefore:', options: ['C is true', 'C may be true', 'C is false', 'Cannot determine'], answer: 0 },
    { prompt: 'All artists are creative. Jordan is not creative. Therefore:', options: ['Jordan is not an artist', 'Jordan is an artist', 'Jordan may be an artist', 'Cannot determine'], answer: 0 },
    { prompt: 'Some cats are black. All black things are elegant. Therefore:', options: ['Some cats are elegant', 'All cats are elegant', 'No cats are elegant', 'Cannot determine'], answer: 0 },
    { prompt: 'P implies Q. Q is false. Therefore:', options: ['P is false', 'P is true', 'P may be true', 'Cannot determine'], answer: 0 },
  ],
  patterns: [
    { prompt: 'What comes next? 2, 4, 8, 16, __', options: ['32', '24', '20', '18'], answer: 0 },
    { prompt: 'What comes next? 1, 4, 9, 16, __', options: ['25', '20', '22', '18'], answer: 0 },
    { prompt: 'What comes next? 3, 6, 9, 12, __', options: ['15', '14', '16', '18'], answer: 0 },
    { prompt: 'What comes next? 100, 50, 25, 12.5, __', options: ['6.25', '10', '5', '8'], answer: 0 },
    { prompt: 'What comes next? 1, 1, 2, 3, 5, 8, __', options: ['13', '11', '10', '14'], answer: 0 },
    { prompt: 'What comes next? 0, 3, 8, 15, 24, __', options: ['35', '30', '33', '28'], answer: 0 },
    { prompt: 'What comes next? 5, 10, 20, 40, __', options: ['80', '60', '70', '50'], answer: 0 },
    { prompt: 'What comes next? 1, 8, 27, 64, __', options: ['125', '100', '112', '144'], answer: 0 },
    { prompt: 'What comes next? 2, 6, 12, 20, 30, __', options: ['42', '40', '36', '44'], answer: 0 },
    { prompt: 'What comes next? 81, 27, 9, 3, __', options: ['1', '2', '0', '0.5'], answer: 0 },
  ],
  verbal: [
    { prompt: 'Which word is the odd one out? Apple, Banana, Carrot, Grape', options: ['Carrot', 'Apple', 'Banana', 'Grape'], answer: 0 },
    { prompt: 'Hot is to Cold as Day is to:', options: ['Night', 'Sun', 'Warm', 'Light'], answer: 0 },
    { prompt: 'Which word is the odd one out? Run, Walk, Jump, Swim, Think', options: ['Think', 'Run', 'Walk', 'Jump'], answer: 0 },
    { prompt: 'Doctor is to Hospital as Teacher is to:', options: ['School', 'Student', 'Lesson', 'Classroom'], answer: 0 },
    { prompt: 'Which word is the odd one out? Piano, Guitar, Violin, Trumpet, Canvas', options: ['Canvas', 'Piano', 'Guitar', 'Trumpet'], answer: 0 },
    { prompt: 'Book is to Library as Painting is to:', options: ['Museum', 'Artist', 'Brush', 'Canvas'], answer: 0 },
    { prompt: 'Which word does NOT belong? Iron, Copper, Wood, Aluminium, Gold', options: ['Wood', 'Iron', 'Copper', 'Gold'], answer: 0 },
    { prompt: 'Slow is to Fast as Quiet is to:', options: ['Loud', 'Sound', 'Noise', 'Silent'], answer: 0 },
    { prompt: 'Which word is the odd one out? Circle, Square, Triangle, Rectangle, Red', options: ['Red', 'Circle', 'Square', 'Triangle'], answer: 0 },
    { prompt: 'Fish is to Water as Bird is to:', options: ['Air', 'Sky', 'Wing', 'Tree'], answer: 0 },
  ],
  boolean: [
    { prompt: 'If (A AND B) is true, what must be true?', options: ['Both A and B are true', 'Only A is true', 'Only B is true', 'Neither is certain'], answer: 0 },
    { prompt: 'If (A OR B) is false, what must be true?', options: ['Both A and B are false', 'A is false', 'B is false', 'Cannot determine'], answer: 0 },
    { prompt: 'NOT (NOT A) equals:', options: ['A', 'NOT A', 'True', 'False'], answer: 0 },
    { prompt: 'If A is true and (A AND B) is false, then B is:', options: ['False', 'True', 'Unknown', 'Equal to A'], answer: 0 },
    { prompt: '(True AND False) OR True evaluates to:', options: ['True', 'False', 'Undefined', 'Cannot determine'], answer: 0 },
    { prompt: 'If NOT A is true, then A is:', options: ['False', 'True', 'Unknown', 'Null'], answer: 0 },
    { prompt: '(A OR B) AND NOT A simplifies to:', options: ['B', 'A', 'True', 'False'], answer: 0 },
    { prompt: 'True XOR True equals:', options: ['False', 'True', 'Undefined', 'True XOR'], answer: 0 },
    { prompt: 'If (A AND NOT A) what is the result?', options: ['Always false', 'Always true', 'Depends on A', 'Cannot determine'], answer: 0 },
    { prompt: '(False OR False) AND True evaluates to:', options: ['False', 'True', 'Null', 'Undefined'], answer: 0 },
  ],
  quantitative: [
    { prompt: 'A train travels 120km in 2 hours. At the same speed, how far in 3.5 hours?', options: ['210km', '180km', '240km', '200km'], answer: 0 },
    { prompt: 'If 5 workers complete a job in 8 days, how many days for 10 workers?', options: ['4 days', '16 days', '8 days', '6 days'], answer: 0 },
    { prompt: 'What is 15% of 240?', options: ['36', '30', '40', '24'], answer: 0 },
    { prompt: 'A rectangle has perimeter 36 and width 6. What is its area?', options: ['72', '54', '48', '84'], answer: 0 },
    { prompt: 'If a price increases by 20% then decreases by 20%, the net change is:', options: ['A 4% decrease', 'No change', 'A 4% increase', 'A 20% decrease'], answer: 0 },
    { prompt: 'The average of 5 numbers is 14. Four of them are 10, 12, 16, 18. The fifth is:', options: ['14', '12', '16', '10'], answer: 0 },
    { prompt: 'A container fills in 12 minutes. A drain empties it in 20 minutes. Both open: how long to fill?', options: ['30 minutes', '8 minutes', '16 minutes', '24 minutes'], answer: 0 },
    { prompt: 'If 3x + 7 = 22, what is x?', options: ['5', '3', '7', '4'], answer: 0 },
    { prompt: 'A bag has 4 red and 6 blue balls. Probability of picking red?', options: ['40%', '60%', '25%', '50%'], answer: 0 },
    { prompt: 'What is the next number? 3, 6, 12, 24, __', options: ['48', '36', '30', '42'], answer: 0 },
  ],
  spatial: [
    { prompt: 'A square is folded in half diagonally. The resulting shape is:', options: ['A triangle', 'A rectangle', 'A smaller square', 'A trapezoid'], answer: 0 },
    { prompt: 'A cube has 6 faces. How many edges does it have?', options: ['12', '8', '6', '16'], answer: 0 },
    { prompt: 'If you rotate the letter "d" 180°, it becomes:', options: ['p', 'b', 'q', 'd'], answer: 0 },
    { prompt: 'A clock reads 3:00. What angle do the hands make?', options: ['90°', '45°', '180°', '60°'], answer: 0 },
    { prompt: 'Looking at a cube straight on at a corner, how many faces are visible at once?', options: ['3', '2', '4', '1'], answer: 0 },
    { prompt: 'A 3×3 grid has its centre and 4 corners shaded. How many cells are unshaded?', options: ['4', '3', '5', '6'], answer: 0 },
    { prompt: 'If you fold a paper square in half twice then cut a triangle from the centre, unfolded you get:', options: ['4 holes', '1 hole', '2 holes', '8 holes'], answer: 0 },
    { prompt: 'A rectangle has dimensions 8×6. A triangle is cut from one corner with legs 2×3. The remaining area is:', options: ['45', '48', '42', '46'], answer: 0 },
    { prompt: 'Which 2D shape has the most lines of symmetry?', options: ['A circle (infinite)', 'A square (4)', 'A regular hexagon (6)', 'An equilateral triangle (3)'], answer: 0 },
    { prompt: 'If north is behind you and east is to your left, which direction are you facing?', options: ['South', 'North', 'West', 'East'], answer: 0 },
  ],
  situational: [
    { prompt: 'You are 80% done with a task when you realise a better approach exists. You:', options: ['Evaluate the time cost of switching vs. the benefit', 'Always switch to the best approach', 'Always finish what you started', 'Ask someone else to decide'], answer: 0 },
    { prompt: 'Two team members disagree on an approach. Both have valid points. Best action?', options: ['Facilitate a discussion to weigh trade-offs together', 'Choose the more senior person\'s view', 'Pick either option at random to move forward', 'Defer the decision indefinitely'], answer: 0 },
    { prompt: 'You receive a task with unclear instructions and a tight deadline. First action?', options: ['Clarify the key ambiguities before starting', 'Start with your best guess and correct later', 'Wait until instructions are perfect', 'Decline the task'], answer: 0 },
    { prompt: 'A process you own has been running the same way for years. You notice an inefficiency. You:', options: ['Investigate and propose a change with evidence', 'Leave it — it has always worked', 'Change it immediately without telling anyone', 'Assume someone else has already noticed'], answer: 0 },
    { prompt: 'You are given more responsibility than you feel ready for. Best response?', options: ['Accept, identify gaps, seek help where needed', 'Decline — wait until fully ready', 'Accept and pretend confidence in all areas', 'Accept but do only the parts you know well'], answer: 0 },
    { prompt: 'Halfway through a plan, new information suggests a different outcome. You:', options: ['Reassess the plan in light of the new information', 'Ignore it — changing course mid-plan is always wrong', 'Scrap the plan entirely and restart', 'Wait to see if the information is confirmed first'], answer: 0 },
    { prompt: 'You must deliver results but lack one key resource. Best approach?', options: ['Find a creative alternative or escalate the gap clearly', 'Deliver poor results without mentioning the constraint', 'Delay until the resource is available', 'Blame the resource shortage for failure'], answer: 0 },
    { prompt: 'You spot an error in work that has already been signed off. You:', options: ['Raise it — even if it causes rework', 'Leave it since it has been approved', 'Fix it quietly without telling anyone', 'Only raise it if someone else notices'], answer: 0 },
    { prompt: 'A solution works but feels overly complicated. You should:', options: ['Look for a simpler solution before committing', 'Ship it — working is enough', 'Complicate it further so it appears thorough', 'Use it only if no one questions it'], answer: 0 },
    { prompt: 'You strongly disagree with a group decision. The best course of action is:', options: ['Voice your concerns clearly, then commit if overruled', 'Comply silently but undermine execution', 'Refuse to participate', 'Escalate to authority immediately'], answer: 0 },
  ],
  attention: [
    { prompt: 'Spot the difference: ABCDEEF vs ABCDEFF. What changed?', options: ['Letters E and F swapped at the end', 'Nothing changed', 'A letter was removed', 'A letter was added'], answer: 0 },
    { prompt: 'Which number breaks the pattern? 2, 4, 6, 9, 12, 14', options: ['9', '2', '12', '14'], answer: 0 },
    { prompt: 'Count the letter F: "FINISHED FILES ARE THE RESULT OF YEARS OF SCIENTIFIC STUDY OF PHENOMENA"', options: ['6', '3', '4', '5'], answer: 0 },
    { prompt: 'Which pair is NOT a match? A:1 B:2 C:3 D:5 E:5', options: ['D:5 and E:5 (duplicate value)', 'A:1', 'B:2', 'C:3'], answer: 0 },
    { prompt: 'A 6-digit code is 482916. Reversed, it is:', options: ['619284', '912846', '619248', '829146'], answer: 0 },
    { prompt: 'A list of numbers: 14, 22, 31, 40, 49, 58, 67, 77. Which one breaks the pattern?', options: ['77 (should be 76)', '14', '49', '67'], answer: 0 },
    { prompt: 'Find the odd one out: 16, 25, 36, 48, 64, 81', options: ['48 (not a perfect square)', '16', '36', '81'], answer: 0 },
    { prompt: 'Read this sequence once: 7, 3, 9, 1, 5. The sum of the 2nd and 4th numbers is:', options: ['4', '12', '6', '8'], answer: 0 },
    { prompt: 'Which word is spelled differently? RHYTHM, OCCASION, ACCOMODATE, NECESSARY', options: ['ACCOMODATE (missing a c)', 'RHYTHM', 'OCCASION', 'NECESSARY'], answer: 0 },
    { prompt: 'A table shows: Jan=42, Feb=38, Mar=41, Apr=38, May=43. Which month is the outlier if the trend is increasing?', options: ['February (drops when trend should rise)', 'January', 'March', 'May'], answer: 0 },
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
  const [timerKey, setTimerKey] = useState(0);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setTimerKey(0);
    setShowTimeoutDialog(false);
  }

  // Countdown timer — restarts when timerKey changes
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
    // Actual timeout that triggers dialog
    timeoutRef.current = setTimeout(() => {
      clearInterval(timerRef.current!);
      setShowTimeoutDialog(true);
    }, TIME_PER_QUESTION * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, currentQ, timerKey]);

  function handleMoreTime() {
    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'timeout_extended',
      timestamp: Date.now(),
      data: { questionIndex: currentQ, extensionSecs: 20 },
    }).catch(() => {});
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    qStartRef.current = Date.now();
    setTimeLeft(20);
    setShowTimeoutDialog(false);
    setTimerKey(k => k + 1);
  }

  function handleSkipRound() {
    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'timeout_skip',
      timestamp: Date.now(),
      data: { questionIndex: currentQ },
    }).catch(() => {});
    setShowTimeoutDialog(false);
    // Show correct answer for 2s then advance
    handleAnswer(-1);
  }

  function handleAnswer(optionIndex: number) {
    if (phase !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

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

    // Wrong answer: show correct answer for 5000ms; correct/skip: 1000ms
    const delay = correct ? 1000 : 5000;
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => doAdvance(newScore, newCorrect), delay);
  }

  function doAdvance(finalScore: number, finalCorrect: number) {
    if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
    if (currentQ + 1 >= questions.length) {
      advance(finalScore, finalCorrect);
    } else {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setPhase('playing');
      qStartRef.current = Date.now();
      setTimeLeft(TIME_PER_QUESTION);
      setTimerKey(k => k + 1);
    }
  }

  const VARIANT_META: Record<Variant, { title: string; desc: string }> = {
    deduction:   { title: '🔎 Logic Deduction',    desc: 'Each puzzle has one logically correct conclusion. Think carefully.' },
    patterns:    { title: '🔲 Abstract Patterns',   desc: 'Identify the rule and find the missing number.' },
    verbal:      { title: '💬 Word Logic',          desc: 'Word analogies and odd-one-out puzzles.' },
    boolean:     { title: '⚙️ Boolean Logic',       desc: 'Logical conditions and boolean expressions. Think precisely.' },
    quantitative:{ title: '🔢 Quantitative Logic',  desc: 'Numerical reasoning — ratios, rates, and probability.' },
    spatial:     { title: '🔷 Spatial Reasoning',   desc: 'Visualise shapes, rotations, and spatial relationships.' },
    situational: { title: '🎯 Situational Judgment',desc: 'What would you do? Decisions under ambiguity and constraint.' },
    attention:   { title: '🔍 Attention to Detail', desc: 'Spot errors, patterns, and differences. Precision counts.' },
  };
  const { title: gameTitle, desc: gameDesc } = VARIANT_META[variant] ?? VARIANT_META.deduction;

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
          {phase === 'feedback' && selected !== questions[currentQ]?.answer && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => doAdvance(score, correctCount)}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnTxt}>Next →</Text>
            </TouchableOpacity>
          )}
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
  nextBtn: { marginTop: 16, backgroundColor: '#2a2a5e', borderRadius: 24, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#5c6bc0' },
  nextBtnTxt: { color: '#c0c0ff', fontSize: 15, fontWeight: '700' },
});
