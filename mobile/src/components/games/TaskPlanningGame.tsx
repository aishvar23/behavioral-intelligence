/**
 * Task Planning Game (Dependency Ordering)
 * A set of tasks with dependency constraints are shown as cards.
 * Tap them in a valid topological order — prerequisites must be completed first.
 * A wrong tap (locked task) causes a penalty and visual feedback.
 * Measures: systematic_thinking, analytical_thinking
 *
 * Within-game adaptive difficulty:
 *   After round 1 (2 rounds played), evaluates cumulative mistakes:
 *   - 0 mistakes → hard mode: remaining rounds use complex DAGs (indices 3-5)
 *   - ≥4 mistakes → easy mode: remaining rounds use simpler DAGs (indices 0-2)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
}

const ROUNDS = 6;
const TIME_PER_ROUND = 45_000;

interface Task {
  id: string;
  label: string;
  emoji: string;
  deps: string[]; // prerequisite task IDs
}

interface RoundDef {
  description: string;
  tasks: Task[];
}

// Indices 0-2: simpler (3 tasks), 3-5: harder (4-6 tasks with complex DAGs)
const ROUND_DEFS: RoundDef[] = [
  {
    description: 'Simple chain — each step follows the previous',
    tasks: [
      { id: 'A', label: 'Setup',  emoji: '⚙️', deps: [] },
      { id: 'B', label: 'Build',  emoji: '🔨', deps: ['A'] },
      { id: 'C', label: 'Deploy', emoji: '🚀', deps: ['B'] },
    ],
  },
  {
    description: 'Design first, then code, then test',
    tasks: [
      { id: 'A', label: 'Plan',   emoji: '📌', deps: [] },
      { id: 'B', label: 'Code',   emoji: '💻', deps: ['A'] },
      { id: 'C', label: 'Review', emoji: '📋', deps: ['B'] },
    ],
  },
  {
    description: 'Two independent tasks both needed before the final step',
    tasks: [
      { id: 'A', label: 'Research',  emoji: '🔬', deps: [] },
      { id: 'B', label: 'Prototype', emoji: '🛠️', deps: [] },
      { id: 'C', label: 'Present',   emoji: '🎤', deps: ['A', 'B'] },
    ],
  },
  {
    description: 'Diamond: two parallel paths meet at the end',
    tasks: [
      { id: 'A', label: 'Plan',      emoji: '📌', deps: [] },
      { id: 'B', label: 'Frontend',  emoji: '🖥️', deps: ['A'] },
      { id: 'C', label: 'Backend',   emoji: '⚙️', deps: ['A'] },
      { id: 'D', label: 'Integrate', emoji: '🔗', deps: ['B', 'C'] },
    ],
  },
  {
    description: 'Complex five-step pipeline',
    tasks: [
      { id: 'A', label: 'Brief',   emoji: '📄', deps: [] },
      { id: 'B', label: 'Gather',  emoji: '📊', deps: ['A'] },
      { id: 'C', label: 'Analyze', emoji: '🧮', deps: ['B'] },
      { id: 'D', label: 'Report',  emoji: '📑', deps: ['C'] },
      { id: 'E', label: 'Deliver', emoji: '📬', deps: ['D'] },
    ],
  },
  {
    description: 'Full pipeline: two branches merge before the final step',
    tasks: [
      { id: 'A', label: 'Research',  emoji: '🔍', deps: [] },
      { id: 'B', label: 'Architect', emoji: '🏗️', deps: ['A'] },
      { id: 'C', label: 'Frontend',  emoji: '🖥️', deps: ['B'] },
      { id: 'D', label: 'Backend',   emoji: '⚙️', deps: ['B'] },
      { id: 'E', label: 'Test',      emoji: '🧪', deps: ['C', 'D'] },
      { id: 'F', label: 'Ship It!',  emoji: '🚀', deps: ['E'] },
    ],
  },
];

function getRoundDef(r: number, mode: 'normal' | 'hard' | 'easy'): RoundDef {
  if (mode === 'hard' && r >= 2) return ROUND_DEFS[3 + ((r - 2) % 3)];
  if (mode === 'easy' && r >= 2) return ROUND_DEFS[(r - 2) % 3];
  return ROUND_DEFS[r % ROUND_DEFS.length];
}

type TaskStatus = 'pending' | 'available' | 'done' | 'error';

interface TaskState {
  task: Task;
  status: TaskStatus;
}

function buildInitialState(tasks: Task[]): TaskState[] {
  return tasks.map(t => ({
    task: t,
    status: t.deps.length === 0 ? 'available' : 'pending',
  }));
}

function recomputeAvailability(states: TaskState[]): TaskState[] {
  const done = new Set(states.filter(s => s.status === 'done').map(s => s.task.id));
  return states.map(s => {
    if (s.status === 'done') return s;
    const allDepsDone = s.task.deps.every(dep => done.has(dep));
    return { ...s, status: allDepsDone ? 'available' : 'pending' };
  });
}

export default function TaskPlanningGame({ sessionId, onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [states, setStates] = useState<TaskState[]>([]);
  const [timerPct, setTimerPct] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [adaptBanner, setAdaptBanner] = useState<string | null>(null);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const scoreRef = useRef(0);
  const roundStart = useRef(0);
  const timerInterval = useRef<ReturnType<typeof setInterval>>();
  const adaptMode = useRef<'normal' | 'hard' | 'easy'>('normal');
  const totalMistakesRef = useRef(0);
  // Track per-round mistakes to accumulate accurately
  const roundMistakesRef = useRef(0);

  const startRound = useCallback((r: number) => {
    const def = getRoundDef(r, adaptMode.current);
    setStates(buildInitialState(def.tasks));
    setTimerPct(1);
    setMistakes(0);
    setAdaptBanner(null);
    roundMistakesRef.current = 0;
    roundStart.current = Date.now();
    setRound(r);
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerInterval.current = setInterval(() => {
      const pct = Math.max(0, 1 - (Date.now() - roundStart.current) / TIME_PER_ROUND);
      setTimerPct(pct);
      if (pct === 0) {
        clearInterval(timerInterval.current);
        setShowTimeoutDialog(true);
      }
    }, 80);
    return () => clearInterval(timerInterval.current);
  }, [phase, round, timerKey]);

  function handleMoreTime() {
    logEvent({ sessionId, gameId: 'task_planning', eventType: 'timeout_extended',
      timestamp: Date.now(), data: { round, extensionSecs: 30 } }).catch(() => {});
    roundStart.current = Date.now();
    setShowTimeoutDialog(false);
    setTimerKey(k => k + 1);
  }

  function handleSkipRound() {
    logEvent({ sessionId, gameId: 'task_planning', eventType: 'timeout_skip',
      timestamp: Date.now(), data: { round } }).catch(() => {});
    void logEvent({ sessionId, gameId: 'task_planning', eventType: 'round_complete',
      timestamp: Date.now(), data: { round, completed: false, timedOut: true, mistakes: roundMistakesRef.current } });
    setShowTimeoutDialog(false);
    advance(round + 1);
  }

  function handleTap(idx: number) {
    if (phase !== 'playing') return;
    const s = states[idx];
    if (s.status === 'done') return;

    if (s.status !== 'available') {
      const missingDeps = s.task.deps.filter(dep =>
        states.find(st => st.task.id === dep)?.status !== 'done'
      );
      void logEvent({ sessionId, gameId: 'task_planning', eventType: 'wrong_tap',
        timestamp: Date.now(), data: { round, taskId: s.task.id, missingDeps } });
      roundMistakesRef.current += 1;
      totalMistakesRef.current += 1;
      setMistakes(m => m + 1);
      setStates(prev => {
        const next = [...prev];
        next[idx] = { ...s, status: 'error' };
        return next;
      });
      setTimeout(() => {
        setStates(prev => {
          const next = [...prev];
          next[idx] = { ...s, status: 'pending' };
          return next;
        });
      }, 600);
      return;
    }

    // Correct tap
    void logEvent({ sessionId, gameId: 'task_planning', eventType: 'task_done',
      timestamp: Date.now(), data: { round, taskId: s.task.id, rt: Date.now() - roundStart.current } });

    const next = recomputeAvailability(
      states.map((st, i) => i === idx ? { ...st, status: 'done' } : st)
    );
    setStates(next);

    if (next.every(st => st.status === 'done')) {
      clearInterval(timerInterval.current);
      const mistakePenalty = roundMistakesRef.current * 5;
      const timeBonus = Math.round(timerPct * 20);
      const pts = Math.max(0, 20 + timeBonus - mistakePenalty);
      scoreRef.current += pts;
      void logEvent({ sessionId, gameId: 'task_planning', eventType: 'round_complete',
        timestamp: Date.now(), data: { round, completed: true, mistakes: roundMistakesRef.current, pts } });
      setTimeout(() => advance(round + 1), 600);
    }
  }

  function checkAdaptation(completedRound: number) {
    // Evaluate after round index 1 (2 rounds played) if still in normal mode
    if (completedRound !== 2 || adaptMode.current !== 'normal') return null;
    const total = totalMistakesRef.current;

    if (total === 0) {
      adaptMode.current = 'hard';
      void logEvent({ sessionId, gameId: 'task_planning', eventType: 'adapt_difficulty',
        timestamp: Date.now(), data: { mode: 'hard', totalMistakes: total } });
      return 'hard';
    } else if (total >= 4) {
      adaptMode.current = 'easy';
      void logEvent({ sessionId, gameId: 'task_planning', eventType: 'adapt_difficulty',
        timestamp: Date.now(), data: { mode: 'easy', totalMistakes: total } });
      return 'easy';
    }
    return null;
  }

  function advance(next: number) {
    if (next >= ROUNDS) { setPhase('done'); onComplete(scoreRef.current); return; }
    const newMode = checkAdaptation(next);
    if (newMode === 'hard') {
      setAdaptBanner('🔥 Impressive! Increasing complexity.');
    } else if (newMode === 'easy') {
      setAdaptBanner('💡 Adjusting difficulty — keep going!');
    }
    startRound(next);
  }

  if (phase === 'intro') return (
    <View style={s.center}>
      <Text style={s.bigEmoji}>📋</Text>
      <Text style={s.title}>Task Planner</Text>
      <Text style={s.desc}>
        Tasks are shown as cards. Some depend on others finishing first.{'\n\n'}
        Figure out the correct order and tap them in sequence.{'\n\n'}
        Tap a task that isn't ready yet and you lose points — choose carefully.
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

  const def = getRoundDef(round, adaptMode.current);

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

      <Text style={s.instruction}>{def.description}</Text>
      {mistakes > 0 && (
        <Text style={s.mistakesTxt}>Mistakes: {mistakes}  (−{mistakes * 5}pts)</Text>
      )}

      {/* Task cards — all undone cards look identical; player must deduce order */}
      <View style={s.taskGrid}>
        {states.map((st, idx) => {
          const done  = st.status === 'done';
          const error = st.status === 'error';
          return (
            <TouchableOpacity
              key={st.task.id}
              style={[
                s.taskCard,
                done  && s.taskCardDone,
                error && s.taskCardError,
              ]}
              onPress={() => handleTap(idx)}
              activeOpacity={0.75}
              disabled={done}
            >
              <Text style={[s.taskEmoji, done && s.taskEmojiDone]}>{st.task.emoji}</Text>
              <Text style={[s.taskLabel, done && s.taskLabelDone]}>{st.task.label}</Text>
              {done && <Text style={s.doneCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

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
  diffBadge: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 4, letterSpacing: 0.5 },
  diffBadgeHard: { color: '#ff7043' },
  diffBadgeEasy: { color: '#66bb6a' },
  instruction: { color: '#9999cc', fontSize: 13, textAlign: 'center', marginBottom: 6 },
  mistakesTxt: { color: '#ef5350', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  taskGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start', marginTop: 8 },
  taskCard: {
    width: '46%', backgroundColor: '#16213e',
    borderRadius: 16, borderWidth: 1.5, borderColor: '#5c6bc0',
    padding: 16, alignItems: 'center', gap: 6, minHeight: 90,
  },
  taskCardDone:    { backgroundColor: '#0d2e1e', borderColor: '#66bb6a' },
  taskCardError:   { backgroundColor: '#3e1a1a', borderColor: '#ef5350' },
  taskCardBlocked: { backgroundColor: '#0d0d1e', borderColor: '#2a2a5e', opacity: 0.7 },
  taskEmoji:       { fontSize: 28 },
  taskEmojiDone:   { opacity: 0.6 },
  taskLabel:       { color: '#e0e0ff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  taskLabelDone:   { color: '#66bb6a' },
  taskLabelBlocked:{ color: '#5555aa' },
  lockedIcon:      { fontSize: 14, opacity: 0.5 },
  doneCheck:       { color: '#66bb6a', fontSize: 20, fontWeight: 'bold' },
});
