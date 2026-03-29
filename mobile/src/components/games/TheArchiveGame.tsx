import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { logTrial, logGamePlay } from '../../services/api';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ArchiveConfig {
  gridSize: number;
  seqLength: number;
  blackoutMs: number;
  flashMs: number;
  interference: boolean;
  nBack: number;
  dualChannel: boolean;
  rounds: number;
}

const DEFAULT_CONFIG: ArchiveConfig = {
  gridSize: 3,
  seqLength: 3,
  blackoutMs: 0,
  flashMs: 1200,
  interference: false,
  nBack: 0,
  dualChannel: false,
  rounds: 4,
};

// ─── Glyphs & Colors ─────────────────────────────────────────────────────────

const GLYPHS = ['◆', '▲', '●', '★', '■', '⬟', '◉', '⬢', '⊕', '⊗', '⊙', '◈'];
const GLYPH_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#22c55e',
  '#a855f7',
  '#ec4899',
];

function glyphColor(glyphIndex: number): string {
  return GLYPH_COLORS[glyphIndex % GLYPH_COLORS.length];
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'intro'
  | 'flashing'
  | 'blackout'
  | 'interference'
  | 'recall'
  | 'feedback'
  | 'nback_playing'
  | 'done';

interface GlyphCell {
  glyphIndex: number;
  cellIndex: number;
  color: string;
}

interface NBackStimulus {
  glyph: string;
  glyphIndex: number;
  color: string;
  cellIndex: number;
}

interface ClassicMetrics {
  maxSpan: number;
  avgAccuracy: number;
  interferenceAccuracy: number | null;
}

interface NBackMetrics {
  hitRate: number;
  falseAlarmRate: number;
  dPrime: number;
  dualColorScore: number | null;
  dualSymbolScore: number | null;
}

interface MathProblem {
  a: number;
  b: number;
  answer: number;
  options: number[];
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<ArchiveConfig>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateSequence(seqLength: number, totalCells: number): GlyphCell[] {
  const cells = shuffle(Array.from({ length: totalCells }, (_, i) => i)).slice(0, seqLength);
  return cells.map((cellIndex) => {
    const glyphIndex = randInt(0, GLYPHS.length - 1);
    return { glyphIndex, cellIndex, color: glyphColor(glyphIndex) };
  });
}

function generateMathProblem(): MathProblem {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  const answer = a + b;
  const wrong1 = answer + randInt(1, 4);
  const wrong2 = answer - randInt(1, 4) <= 0 ? answer + randInt(5, 8) : answer - randInt(1, 4);
  const options = shuffle([answer, wrong1, wrong2]);
  return { a, b, answer, options };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TheArchiveGame({ sessionId, onComplete, config }: Props) {
  const cfg: ArchiveConfig = { ...DEFAULT_CONFIG, ...config };
  const totalCells = cfg.gridSize * cfg.gridSize;
  const STIMULUS_MS = 1500;
  const GAP_MS = 800;

  // ── Phase & round state ──
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);

  // ── Classic recall state ──
  const [sequence, setSequence] = useState<GlyphCell[]>([]);
  const [flashIndex, setFlashIndex] = useState(-1);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'correct' | 'wrong'>>({});
  const [mathProblem, setMathProblem] = useState<MathProblem | null>(null);
  const [mathSolved, setMathSolved] = useState(false);

  // ── Classic metrics accumulation ──
  const classicMetrics = useRef({ totalCorrect: 0, totalTarget: 0, maxSpan: 0, intCorrect: 0, intTotal: 0 });

  // ── N-Back state ──
  const [nbackTrial, setNbackTrial] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState<NBackStimulus | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [nbackAnswered, setNbackAnswered] = useState(false);
  const stimulusHistory = useRef<NBackStimulus[]>([]);
  const nbackMetrics = useRef({ hits: 0, misses: 0, falseAlarms: 0, crs: 0, colorHits: 0, colorFAs: 0, symbolHits: 0, symbolFAs: 0, colorTotal: 0, symbolTotal: 0 });

  // ── Final results ──
  const [finalScore, setFinalScore] = useState(0);
  const [classicResult, setClassicResult] = useState<ClassicMetrics | null>(null);
  const [nbackResult, setNbackResult] = useState<NBackMetrics | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ─── Classic: start a round ───────────────────────────────────────────────

  const startClassicRound = useCallback((roundNum: number) => {
    const seq = generateSequence(cfg.seqLength, totalCells);
    setSequence(seq);
    setFlashIndex(-1);
    setGuesses([]);
    setFeedbackMap({});
    setPhase('flashing');

    let idx = 0;
    const flashNext = () => {
      if (idx < seq.length) {
        setFlashIndex(idx);
        addTimer(() => {
          setFlashIndex(-1);
          addTimer(() => {
            idx++;
            flashNext();
          }, 150);
        }, cfg.flashMs);
      } else {
        // all flashed — go to blackout
        if (cfg.blackoutMs > 0) {
          setPhase('blackout');
          if (cfg.interference) {
            const problem = generateMathProblem();
            setMathProblem(problem);
            setMathSolved(false);
            addTimer(() => setPhase('interference'), 300);
          } else {
            addTimer(() => setPhase('recall'), cfg.blackoutMs);
          }
        } else {
          setPhase('recall');
        }
      }
    };
    addTimer(flashNext, 400);
  }, [cfg, totalCells, addTimer]);

  // ─── Classic: handle cell tap ─────────────────────────────────────────────

  const handleCellTap = useCallback((cellIndex: number) => {
    if (phase !== 'recall') return;
    const newGuesses = [...guesses, cellIndex];
    setGuesses(newGuesses);

    if (newGuesses.length >= cfg.seqLength) {
      // evaluate
      const fb: Record<number, 'correct' | 'wrong'> = {};
      let correct = 0;
      newGuesses.forEach((guessCell, i) => {
        const target = sequence[i]?.cellIndex;
        if (guessCell === target) {
          fb[guessCell] = 'correct';
          correct++;
        } else {
          fb[guessCell] = 'wrong';
          if (target !== undefined) fb[target] = 'wrong';
        }
      });
      setFeedbackMap(fb);
      setPhase('feedback');

      const m = classicMetrics.current;
      m.totalCorrect += correct;
      m.totalTarget += cfg.seqLength;
      if (correct === cfg.seqLength) m.maxSpan = cfg.seqLength;

      logTrial(sessionId, 'archive_classic', { round, correct, total: cfg.seqLength });

      addTimer(() => {
        const nextRound = round + 1;
        if (nextRound >= cfg.rounds) {
          finishClassic();
        } else {
          setRound(nextRound);
          startClassicRound(nextRound);
        }
      }, 800);
    }
  }, [phase, guesses, sequence, cfg, round, sessionId, addTimer]);

  const finishClassic = useCallback(() => {
    const m = classicMetrics.current;
    const avgAcc = m.totalTarget > 0 ? (m.totalCorrect / m.totalTarget) * 100 : 0;
    const sc = Math.round(avgAcc);
    const intAcc = m.intTotal > 0 ? (m.intCorrect / m.intTotal) * 100 : null;
    const result: ClassicMetrics = { maxSpan: m.maxSpan, avgAccuracy: avgAcc, interferenceAccuracy: intAcc };
    setClassicResult(result);
    setFinalScore(sc);
    setScore(sc);
    logGamePlay(sessionId, 'archive', sc, result);
    setPhase('done');
  }, [sessionId]);

  // ─── Interference math answer ─────────────────────────────────────────────

  const handleMathAnswer = useCallback((val: number) => {
    if (!mathProblem) return;
    const correct = val === mathProblem.answer;
    const m = classicMetrics.current;
    m.intTotal++;
    if (correct) m.intCorrect++;
    setMathSolved(true);
    addTimer(() => setPhase('recall'), 400);
  }, [mathProblem, addTimer]);

  // ─── N-Back: run trials ───────────────────────────────────────────────────

  const runNBackTrial = useCallback((trialNum: number) => {
    if (trialNum >= cfg.rounds) {
      finishNBack();
      return;
    }

    const glyphIndex = randInt(0, GLYPHS.length - 1);
    const cellIndex = randInt(0, totalCells - 1);
    const stimulus: NBackStimulus = {
      glyph: GLYPHS[glyphIndex],
      glyphIndex,
      color: glyphColor(glyphIndex),
      cellIndex,
    };

    stimulusHistory.current.push(stimulus);
    setCurrentStimulus(stimulus);
    setNbackTrial(trialNum);
    setNbackAnswered(false);

    const answerable = trialNum >= cfg.nBack;
    setShowAnswer(answerable);

    // auto-advance after stimulus + gap
    addTimer(() => {
      setCurrentStimulus(null);
      addTimer(() => {
        if (answerable && !nbackAnswered) {
          // no answer given — count as miss or CR based on target
          recordNBackAutoMiss(trialNum);
        }
        runNBackTrial(trialNum + 1);
      }, GAP_MS);
    }, STIMULUS_MS);
  }, [cfg, totalCells, addTimer]);

  const recordNBackAutoMiss = useCallback((trialNum: number) => {
    const history = stimulusHistory.current;
    const target = history[trialNum - cfg.nBack];
    const current = history[trialNum];
    if (!target || !current) return;

    const symbolMatch = current.glyphIndex === target.glyphIndex;
    const colorMatch = current.color === target.color;
    const m = nbackMetrics.current;

    if (cfg.dualChannel) {
      if (symbolMatch) m.misses++; else m.crs++;
      if (colorMatch) m.misses++; else m.crs++;
    } else {
      if (symbolMatch) m.misses++; else m.crs++;
    }
  }, [cfg]);

  const handleNBackAnswer = useCallback((type: 'yes' | 'no' | 'color_yes' | 'color_no' | 'symbol_yes' | 'symbol_no') => {
    if (nbackAnswered) return;
    setNbackAnswered(true);

    const history = stimulusHistory.current;
    const trialNum = nbackTrial;
    const target = history[trialNum - cfg.nBack];
    const current = history[trialNum];
    if (!target || !current) return;

    const m = nbackMetrics.current;
    const symbolMatch = current.glyphIndex === target.glyphIndex;
    const colorMatch = current.color === target.color;

    if (cfg.dualChannel) {
      if (type === 'symbol_yes' || type === 'yes') {
        if (symbolMatch) m.hits++; else m.falseAlarms++;
      } else if (type === 'symbol_no') {
        if (!symbolMatch) m.crs++; else m.misses++;
      }
      if (type === 'color_yes') {
        if (colorMatch) m.hits++; else m.falseAlarms++;
      } else if (type === 'color_no') {
        if (!colorMatch) m.crs++; else m.misses++;
      }
    } else {
      if (type === 'yes') {
        if (symbolMatch) m.hits++; else m.falseAlarms++;
      } else {
        if (!symbolMatch) m.crs++; else m.misses++;
      }
    }

    logTrial(sessionId, 'archive_nback', { trial: trialNum, type, symbolMatch, colorMatch });
  }, [nbackAnswered, nbackTrial, cfg, sessionId]);

  const finishNBack = useCallback(() => {
    const m = nbackMetrics.current;
    const total = m.hits + m.misses + m.falseAlarms + m.crs;
    const accuracy = total > 0 ? ((m.hits + m.crs) / total) * 100 : 0;
    const sc = Math.round(accuracy);

    const hitRate = (m.hits + m.misses) > 0 ? m.hits / (m.hits + m.misses) : 0;
    const faRate = (m.falseAlarms + m.crs) > 0 ? m.falseAlarms / (m.falseAlarms + m.crs) : 0;
    const dPrime = hitRate - faRate;

    const result: NBackMetrics = {
      hitRate,
      falseAlarmRate: faRate,
      dPrime,
      dualColorScore: cfg.dualChannel ? m.colorHits : null,
      dualSymbolScore: cfg.dualChannel ? m.symbolHits : null,
    };

    setNbackResult(result);
    setFinalScore(sc);
    setScore(sc);
    logGamePlay(sessionId, 'archive', sc, result);
    setPhase('done');
  }, [cfg, sessionId]);

  // ─── Start game ───────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (cfg.nBack >= 2) {
      stimulusHistory.current = [];
      nbackMetrics.current = { hits: 0, misses: 0, falseAlarms: 0, crs: 0, colorHits: 0, colorFAs: 0, symbolHits: 0, symbolFAs: 0, colorTotal: 0, symbolTotal: 0 };
      setPhase('nback_playing');
      addTimer(() => runNBackTrial(0), 600);
    } else {
      classicMetrics.current = { totalCorrect: 0, totalTarget: 0, maxSpan: 0, intCorrect: 0, intTotal: 0 };
      setRound(0);
      startClassicRound(0);
    }
  }, [cfg, addTimer, runNBackTrial, startClassicRound]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const { width } = Dimensions.get('window');
  const gridWidth = Math.min(width - 48, 320);
  const cellSize = Math.floor((gridWidth - (cfg.gridSize - 1) * 6) / cfg.gridSize);

  const renderGrid = () => {
    const rows: JSX.Element[] = [];
    for (let r = 0; r < cfg.gridSize; r++) {
      const cells: JSX.Element[] = [];
      for (let c = 0; c < cfg.gridSize; c++) {
        const cellIndex = r * cfg.gridSize + c;
        const flashedItem = phase === 'flashing' && flashIndex >= 0 ? sequence[flashIndex] : null;
        const isFlashing = flashedItem?.cellIndex === cellIndex;
        const fb = feedbackMap[cellIndex];
        const isGuessed = guesses.includes(cellIndex);

        let bgColor = '#0f172a';
        let borderColor = '#1e293b';
        let glyphText = '';
        let glyphCol = '#fff';

        if (isFlashing && flashedItem) {
          bgColor = flashedItem.color + '33';
          borderColor = flashedItem.color;
          glyphText = GLYPHS[flashedItem.glyphIndex];
          glyphCol = flashedItem.color;
        } else if (phase === 'feedback') {
          if (fb === 'correct') { bgColor = '#22c55e33'; borderColor = '#22c55e'; }
          else if (fb === 'wrong') { bgColor = '#ef444433'; borderColor = '#ef4444'; }
          if (isGuessed) {
            const seq = sequence.find(s => s.cellIndex === cellIndex);
            if (seq) { glyphText = GLYPHS[seq.glyphIndex]; glyphCol = seq.color; }
          }
        }

        const tappable = phase === 'recall' && !isGuessed;

        cells.push(
          <TouchableOpacity
            key={cellIndex}
            activeOpacity={tappable ? 0.7 : 1}
            onPress={() => tappable && handleCellTap(cellIndex)}
            style={[
              styles.cell,
              { width: cellSize, height: cellSize, backgroundColor: bgColor, borderColor },
              tappable && styles.cellTappable,
            ]}
          >
            {glyphText !== '' && (
              <Text style={[styles.cellGlyph, { color: glyphCol, fontSize: cellSize * 0.42 }]}>
                {glyphText}
              </Text>
            )}
          </TouchableOpacity>
        );
      }
      rows.push(
        <View key={r} style={styles.gridRow}>
          {cells}
        </View>
      );
    }
    return rows;
  };

  const renderNBackStimulus = () => {
    if (!currentStimulus) return <View style={[styles.nbackCell, { width: cellSize * 1.5, height: cellSize * 1.5, borderColor: '#1e293b' }]} />;
    return (
      <View style={[styles.nbackCell, { width: cellSize * 1.5, height: cellSize * 1.5, borderColor: currentStimulus.color, backgroundColor: currentStimulus.color + '22' }]}>
        <Text style={[styles.nbackGlyph, { color: currentStimulus.color, fontSize: cellSize * 0.8 }]}>
          {currentStimulus.glyph}
        </Text>
      </View>
    );
  };

  // ─── Screens ──────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    const modeLabel = cfg.nBack === 0 ? 'Classic Recall' : cfg.nBack === 2 ? 'N-Back 2' : 'Dual N-Back 3';
    return (
      <View style={styles.screen}>
        <Text style={styles.titleLabel}>WORKING MEMORY</Text>
        <Text style={styles.gameTitle}>The Archive</Text>
        <Text style={styles.metaText}>{modeLabel} · {cfg.rounds} {cfg.nBack >= 2 ? 'trials' : 'rounds'}</Text>
        <Text style={styles.instrText}>
          {cfg.nBack === 0
            ? `Watch glyphs appear on the grid.\nAfter the blackout, tap the cells in order.`
            : cfg.dualChannel
            ? `A glyph flashes. Does it match\nboth the COLOR and SYMBOL from ${cfg.nBack} turns ago?`
            : `A glyph flashes. Does it match\nthe one from ${cfg.nBack} turns ago?`}
        </Text>
        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>BEGIN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.screen}>
        <Text style={styles.titleLabel}>WORKING MEMORY</Text>
        <Text style={styles.doneTitle}>Archive Complete</Text>
        <Text style={styles.scoreText}>{finalScore}<Text style={styles.scoreSub}> pts</Text></Text>

        {classicResult && (
          <View style={styles.metricsGrid}>
            <MetricRow label="Max Span" value={`${classicResult.maxSpan}`} />
            <MetricRow label="Avg Accuracy" value={`${classicResult.avgAccuracy.toFixed(0)}%`} />
            {classicResult.interferenceAccuracy !== null && (
              <MetricRow label="Interference Acc" value={`${classicResult.interferenceAccuracy.toFixed(0)}%`} />
            )}
          </View>
        )}

        {nbackResult && (
          <View style={styles.metricsGrid}>
            <MetricRow label="Hit Rate" value={`${(nbackResult.hitRate * 100).toFixed(0)}%`} />
            <MetricRow label="False Alarm Rate" value={`${(nbackResult.falseAlarmRate * 100).toFixed(0)}%`} />
            <MetricRow label="d′ Score" value={nbackResult.dPrime.toFixed(2)} />
            {nbackResult.dualColorScore !== null && (
              <MetricRow label="Color Hits" value={`${nbackResult.dualColorScore}`} />
            )}
            {nbackResult.dualSymbolScore !== null && (
              <MetricRow label="Symbol Hits" value={`${nbackResult.dualSymbolScore}`} />
            )}
          </View>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={() => onComplete(finalScore)}>
          <Text style={styles.startBtnText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'nback_playing') {
    const answerable = nbackTrial >= cfg.nBack;
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>WORKING MEMORY</Text>
          <Text style={styles.headerSub}>Trial {nbackTrial + 1} / {cfg.rounds}</Text>
        </View>

        <View style={styles.nbackArea}>
          {renderNBackStimulus()}
          <Text style={styles.nbackTrialLabel}>
            {!answerable ? 'Memorising...' : `Does this match ${cfg.nBack} turns ago?`}
          </Text>
        </View>

        {answerable && !nbackAnswered && (
          <View style={styles.nbackButtons}>
            {cfg.dualChannel ? (
              <>
                <View style={styles.nbackBtnRow}>
                  <TouchableOpacity style={[styles.nbackBtn, styles.btnYes]} onPress={() => handleNBackAnswer('symbol_yes')}>
                    <Text style={styles.nbackBtnText}>SYMBOL ✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.nbackBtn, styles.btnNo]} onPress={() => handleNBackAnswer('symbol_no')}>
                    <Text style={styles.nbackBtnText}>SYMBOL ✗</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.nbackBtnRow}>
                  <TouchableOpacity style={[styles.nbackBtn, styles.btnYes]} onPress={() => handleNBackAnswer('color_yes')}>
                    <Text style={styles.nbackBtnText}>COLOR ✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.nbackBtn, styles.btnNo]} onPress={() => handleNBackAnswer('color_no')}>
                    <Text style={styles.nbackBtnText}>COLOR ✗</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.nbackBtnRow}>
                <TouchableOpacity style={[styles.nbackBtn, styles.btnYes]} onPress={() => handleNBackAnswer('yes')}>
                  <Text style={styles.nbackBtnText}>YES</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nbackBtn, styles.btnNo]} onPress={() => handleNBackAnswer('no')}>
                  <Text style={styles.nbackBtnText}>NO</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  if (phase === 'interference' && mathProblem && !mathSolved) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>WORKING MEMORY</Text>
          <Text style={styles.headerSub}>Round {round + 1} / {cfg.rounds}</Text>
        </View>
        <View style={styles.interferenceBox}>
          <Text style={styles.interferenceLead}>Quick calculation:</Text>
          <Text style={styles.mathProblem}>{mathProblem.a} + {mathProblem.b} = ?</Text>
          <View style={styles.mathOptions}>
            {mathProblem.options.map((opt) => (
              <TouchableOpacity key={opt} style={styles.mathBtn} onPress={() => handleMathAnswer(opt)}>
                <Text style={styles.mathBtnText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Classic phases: flashing, blackout, recall, feedback
  const phaseLabel =
    phase === 'flashing' ? 'Memorise the glyphs' :
    phase === 'blackout' ? 'Remembering...' :
    phase === 'recall' ? `Tap cells in order (${guesses.length}/${cfg.seqLength})` :
    phase === 'feedback' ? 'Result' : '';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>WORKING MEMORY</Text>
        <Text style={styles.headerSub}>Round {round + 1} / {cfg.rounds}  ·  Score {score}</Text>
      </View>

      <Text style={styles.phaseLabel}>{phaseLabel}</Text>

      <View style={styles.grid}>
        {renderGrid()}
      </View>
    </View>
  );
}

// ─── MetricRow ────────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '700',
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  titleLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 8,
  },
  gameTitle: {
    color: '#e2e8f0',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  metaText: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 16,
  },
  instrText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  startBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  phaseLabel: {
    color: '#94a3b8',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 24,
    marginTop: 80,
  },
  grid: {
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  cell: {
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellTappable: {
    borderColor: '#334155',
  },
  cellGlyph: {
    fontWeight: '700',
  },
  nbackArea: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 32,
  },
  nbackCell: {
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  nbackGlyph: {
    fontWeight: '700',
  },
  nbackTrialLabel: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
  },
  nbackButtons: {
    gap: 12,
    alignItems: 'center',
  },
  nbackBtnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  nbackBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  btnYes: {
    backgroundColor: '#22c55e',
  },
  btnNo: {
    backgroundColor: '#ef4444',
  },
  nbackBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  interferenceBox: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 28,
    marginTop: 60,
  },
  interferenceLead: {
    color: '#64748b',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 12,
  },
  mathProblem: {
    color: '#e2e8f0',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 24,
  },
  mathOptions: {
    flexDirection: 'row',
    gap: 14,
  },
  mathBtn: {
    backgroundColor: '#334155',
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathBtnText: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  doneTitle: {
    color: '#e2e8f0',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 8,
  },
  scoreText: {
    color: '#3b82f6',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 72,
    marginBottom: 28,
  },
  scoreSub: {
    color: '#64748b',
    fontSize: 22,
    fontWeight: '400',
  },
  metricsGrid: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  metricValue: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
});
