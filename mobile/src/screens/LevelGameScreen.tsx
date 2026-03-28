/**
 * Level Game Screen — Cognitive Mirror
 *
 * Manages the full adaptive assessment loop:
 *   For each of 5 traits:
 *     Play levels 1–10 (adaptive)
 *     → Skip rule: Level 1 score ≥ skipScore → jump to level 4
 *     → Ceiling rule: score drops ≥40% over 3 consecutive levels → end trait
 *     → Complete: level 10 done or ceiling hit
 *
 * After all 5 traits: run Trait Talk → navigate to ArchetypeCard.
 *
 * This screen acts as the orchestrator. The actual game UI is rendered via
 * the existing GameScreen-compatible game components, bridged through a
 * minimal inline game wrapper.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  TRAIT_CATALOG,
  adaptiveDecision,
  LevelConfig,
  TraitDefinition,
} from '../data/traitCatalog';
import {
  submitLevelResult,
  runTraitTalk,
  generateArchetype,
  DiscoveredTrait,
  TraitResult,
  TraitTalkResult,
} from '../services/assessmentApi';

// ── Game components (same as GameScreen uses) ─────────────────────────────────
import BlackBoxGame         from '../components/games/BlackBoxGame';
import TaskPlanningGame     from '../components/games/TaskPlanningGame';
import MemorySequenceGame   from '../components/games/MemorySequenceGame';
import LogicDeductionGame   from '../components/games/LogicDeductionGame';
import ReactionTestGame     from '../components/games/ReactionTestGame';
import StroopGame           from '../components/games/StroopGame';
import VisualSearchGame     from '../components/games/VisualSearchGame';
import TheReactorGame       from '../components/games/TheReactorGame';
import ReactorChaosGame     from '../components/games/ReactorChaosGame';

type Props = NativeStackScreenProps<RootStackParamList, 'LevelGame'>;

type Phase =
  | 'trait_intro'   // show current trait + level info before playing
  | 'playing'       // game component is active
  | 'level_result'  // show score + adaptive decision
  | 'trait_complete'// all levels for this trait done
  | 'processing'    // running trait talk + generating archetype
  | 'error';

export default function LevelGameScreen({ route, navigation }: Props) {
  const { sessionId, profession, traits, baselineRtMs } = route.params;

  // ── State ─────────────────────────────────────────────────────────────────
  const [traitIndex, setTraitIndex]   = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [phase, setPhase]             = useState<Phase>('trait_intro');
  const [lastScore, setLastScore]     = useState<number | null>(null);
  const [outcomeLabel, setOutcomeLabel] = useState('');
  const [allTraitResults, setAllTraitResults] = useState<TraitResult[]>([]);
  const [error, setError]             = useState<string | null>(null);

  // Per-trait tracking
  const levelScoresRef  = useRef<number[]>([]);
  const startTimeRef    = useRef<number>(0);
  const trialRtsRef     = useRef<number[]>([]);
  const trialCorrectRef = useRef<number>(0);
  const trialTotalRef   = useRef<number>(0);

  const currentTrait: DiscoveredTrait = traits[traitIndex];
  const traitDef: TraitDefinition | undefined = currentTrait
    ? TRAIT_CATALOG[currentTrait.id]
    : undefined;
  const levelConfig: LevelConfig | undefined = traitDef?.levels[currentLevel - 1];

  // ── Progress indicators ───────────────────────────────────────────────────
  const overallProgress = ((traitIndex) / traits.length) * 100;

  // ── Handle game complete (called by game component) ───────────────────────
  const handleGameComplete = useCallback((score: number) => {
    if (!traitDef || !levelConfig) return;

    const durationMs = Date.now() - startTimeRef.current;
    const accuracy   = trialTotalRef.current > 0
      ? trialCorrectRef.current / trialTotalRef.current
      : score / 100;
    const avgRt = trialRtsRef.current.length > 0
      ? trialRtsRef.current.reduce((a, b) => a + b, 0) / trialRtsRef.current.length
      : durationMs;

    const scores = [...levelScoresRef.current, score];
    levelScoresRef.current = scores;

    const decision = adaptiveDecision(currentTrait.id, currentLevel, score, scores);

    // Save to backend (fire-and-forget, non-blocking)
    submitLevelResult({
      sessionId,
      traitId:  currentTrait.id,
      level:    currentLevel,
      score,
      accuracy,
      avgLatencyMs: avgRt,
      outcome: decision === 'skip' ? 'skip' : decision,
      levelConfigJson: JSON.stringify(levelConfig),
    }).catch(() => {/* non-fatal */});

    setLastScore(score);

    switch (decision) {
      case 'skip': {
        setOutcomeLabel(`Elite performance — jumping to Level 4`);
        setPhase('level_result');
        break;
      }
      case 'ceiling': {
        setOutcomeLabel('Cognitive ceiling reached — moving to next trait');
        setPhase('level_result');
        break;
      }
      case 'complete': {
        setOutcomeLabel('Trait assessment complete');
        setPhase('level_result');
        break;
      }
      case 'continue': {
        setOutcomeLabel(`Level ${currentLevel} done`);
        setPhase('level_result');
        break;
      }
    }
  }, [traitDef, levelConfig, currentTrait, currentLevel, sessionId]);

  // ── Advance after level result screen ─────────────────────────────────────
  function advanceFromLevelResult() {
    if (!traitDef || !levelConfig) return;
    const scores = levelScoresRef.current;
    const decision = adaptiveDecision(currentTrait.id, currentLevel, lastScore ?? 0, scores);

    if (decision === 'skip') {
      setCurrentLevel(4);
      setPhase('trait_intro');
    } else if (decision === 'ceiling' || decision === 'complete') {
      finalizeTrait();
    } else {
      setCurrentLevel(l => l + 1);
      setPhase('trait_intro');
    }
  }

  function finalizeTrait() {
    const scores = levelScoresRef.current;
    const peakScore = scores.length > 0 ? Math.max(...scores) : 0;
    const avgScore  = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const scores_decision = adaptiveDecision(currentTrait.id, currentLevel, lastScore ?? 0, scores);

    const result: TraitResult = {
      traitId:   currentTrait.id,
      traitName: currentTrait.name,
      isPrimary: currentTrait.isPrimary,
      peakLevel: currentLevel,
      peakScore,
      avgScore,
      outcome: scores_decision === 'ceiling' ? 'ceiling' : 'complete',
      scores,
    };

    const updated = [...allTraitResults, result];
    setAllTraitResults(updated);

    if (traitIndex + 1 >= traits.length) {
      // All traits done — run Trait Talk
      finishAssessment(updated);
    } else {
      setPhase('trait_complete');
    }
  }

  function advanceToNextTrait() {
    levelScoresRef.current  = [];
    trialRtsRef.current     = [];
    trialCorrectRef.current = 0;
    trialTotalRef.current   = 0;
    setCurrentLevel(1);
    setTraitIndex(i => i + 1);
    setPhase('trait_intro');
  }

  async function finishAssessment(results: TraitResult[]) {
    setPhase('processing');
    try {
      // Build score map for Trait Talk (use avgScore * 100 / 100 = avgScore)
      const scoreMap: Record<string, number> = {};
      for (const r of results) scoreMap[r.traitId] = r.avgScore;

      const traitTalk: TraitTalkResult = await runTraitTalk(sessionId, scoreMap);
      const archetype = await generateArchetype(sessionId, profession, results, traitTalk);

      navigation.replace('ArchetypeCard', {
        archetype,
        profession,
        traitResults: results,
        traitTalk,
      });
    } catch (err) {
      console.error('[LevelGame] finishAssessment:', err);
      setError('Failed to generate your Archetype Card. Please try again.');
      setPhase('error');
    }
  }

  // Reset trial tracking when phase becomes 'playing'
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current    = Date.now();
      trialRtsRef.current     = [];
      trialCorrectRef.current = 0;
      trialTotalRef.current   = 0;
    }
  }, [phase]);

  // ── Render helpers ────────────────────────────────────────────────────────

  if (phase === 'processing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <Text style={styles.processingText}>Analysing your cognitive profile…</Text>
        <Text style={styles.processingSubText}>Running Trait Talk validation</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => finishAssessment(allTraitResults)}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'trait_complete') {
    const nextTrait = traits[traitIndex + 1];
    return (
      <View style={styles.center}>
        <Text style={styles.doneEmoji}>{traitDef?.icon ?? '✓'}</Text>
        <Text style={styles.traitDoneTitle}>{currentTrait.name}</Text>
        <Text style={styles.traitDoneSubtitle}>Assessment complete</Text>
        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>Next up</Text>
          <Text style={styles.nextName}>{nextTrait?.name}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={advanceToNextTrait}>
          <Text style={styles.btnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'level_result') {
    const score = lastScore ?? 0;
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
      <View style={styles.center}>
        <Text style={styles.levelResultLabel}>Level {currentLevel}</Text>
        <Text style={[styles.levelScore, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.levelScoreLabel}>/ 100</Text>
        <Text style={styles.outcomeText}>{outcomeLabel}</Text>
        <TouchableOpacity style={styles.btn} onPress={advanceFromLevelResult}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'trait_intro') {
    if (!traitDef || !levelConfig) return null;
    return (
      <View style={styles.container}>
        {/* Overall progress bar */}
        <View style={styles.overallProgress}>
          <View style={[styles.overallFill, { width: `${overallProgress}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.traitIndexLabel}>
            Trait {traitIndex + 1} of {traits.length}
          </Text>
          <Text style={styles.traitIcon}>{traitDef.icon}</Text>
          <Text style={styles.traitName}>{traitDef.name}</Text>
          {currentTrait.isPrimary && (
            <View style={styles.primaryPill}><Text style={styles.primaryPillText}>PRIMARY</Text></View>
          )}
          <Text style={styles.traitDesc}>{traitDef.description}</Text>

          <View style={styles.levelInfoBox}>
            <View style={styles.levelRow}>
              <Text style={styles.levelLabel}>Level</Text>
              <Text style={styles.levelValue}>{currentLevel} / 10</Text>
            </View>
            <Text style={styles.levelName}>{levelConfig.label}</Text>

            {/* Level progress dots */}
            <View style={styles.levelDots}>
              {Array.from({ length: 10 }).map((_, i) => {
                const played  = levelScoresRef.current.length > i;
                const current = i + 1 === currentLevel;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      played  && styles.dotPlayed,
                      current && styles.dotCurrent,
                    ]}
                  />
                );
              })}
            </View>

            {/* Complexity badges */}
            <View style={styles.badges}>
              {levelConfig.speedMultiplier > 1.3 && <Badge label={`${levelConfig.speedMultiplier}× Speed`} color="#7c3aed" />}
              {levelConfig.distractorDensity >= 0.5 && <Badge label="High Noise" color="#dc2626" />}
              {levelConfig.ruleShifting && <Badge label="Rule Shift" color="#d97706" />}
              {levelConfig.uiInterference && <Badge label="Interference" color="#db2777" />}
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={() => setPhase('playing')}>
            <Text style={styles.btnText}>Start Level {currentLevel}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Phase: playing — render game component ────────────────────────────────
  if (!traitDef || !levelConfig) return null;

  const gameParams = {
    ...levelConfig.gameParams,
    onComplete: handleGameComplete,
    sessionId,
    // Pass level complexity params so game components can optionally use them
    _levelSpeedMultiplier: levelConfig.speedMultiplier,
    _levelDistrDensity:    levelConfig.distractorDensity,
    _levelRuleShifting:    levelConfig.ruleShifting,
    _levelUiInterference:  levelConfig.uiInterference,
  };

  return (
    <View style={styles.gameContainer}>
      {/* Thin progress strip at top */}
      <View style={styles.gameHeader}>
        <Text style={styles.gameHeaderText}>
          {traitDef.name}  ·  Level {currentLevel}
        </Text>
      </View>
      {renderGameComponent(traitDef.gameEngine, gameParams)}
    </View>
  );
}

// ── Game component dispatcher ─────────────────────────────────────────────────
// Note: some game components do not yet accept a `config` prop (BlackBox,
// TaskPlanning, Stroop, VisualSearch). Level complexity params are stored in
// the catalog for future upgrades; for now those games run with built-in params
// and adaptive progression is driven by the returned score.

function renderGameComponent(
  engine: string,
  params: Record<string, unknown>,
): React.ReactElement | null {
  const onComplete = params.onComplete as (score: number) => void;
  const sid        = params.sessionId as string;
  const variant    = params.variant as string | undefined;

  switch (engine) {
    case 'reaction':
      return (
        <ReactionTestGame
          config={{ variant: (variant ?? 'basic') as 'basic' | 'inhibition' | 'speed' }}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'stroop':
      return (
        <StroopGame
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'memory':
      return (
        <MemorySequenceGame
          config={{ variant: (variant ?? 'sequential') as 'colors' | 'numbers' | 'positions' | 'sequential' | 'faces' | 'code' }}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'logic':
      return (
        <LogicDeductionGame
          config={{ variant: (variant ?? 'deduction') as 'verbal' | 'situational' | 'deduction' | 'patterns' | 'boolean' | 'quantitative' }}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'planning':
      return (
        <TaskPlanningGame
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'rule_discovery':
      return (
        <BlackBoxGame
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'search':
      return (
        <VisualSearchGame
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'reactor':
      return (
        <TheReactorGame
          config={params as Parameters<typeof TheReactorGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'reactor_chaos':
      return (
        <ReactorChaosGame
          config={params as Parameters<typeof ReactorChaosGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    default:
      return null;
  }
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0e17' },
  center:      { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 24 },
  gameContainer: { flex: 1, backgroundColor: '#0f0e17' },

  overallProgress: { height: 3, backgroundColor: '#1e1d2e', width: '100%' },
  overallFill:     { height: 3, backgroundColor: '#7c3aed' },

  introContent:    { padding: 24, alignItems: 'center', paddingBottom: 60 },
  traitIndexLabel: { fontSize: 11, color: '#7c3aed', fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  traitIcon:       { fontSize: 48, marginBottom: 10 },
  traitName:       { fontSize: 26, fontWeight: '700', color: '#e0e0ff', marginBottom: 8 },
  primaryPill:     { backgroundColor: '#7c3aed22', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 14 },
  primaryPillText: { fontSize: 10, color: '#a78bfa', fontWeight: '700', letterSpacing: 1 },
  traitDesc:       { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 21, marginBottom: 24 },

  levelInfoBox: {
    backgroundColor: '#1e1d2e', borderRadius: 14, padding: 18,
    width: '100%', marginBottom: 24,
  },
  levelRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  levelLabel:  { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  levelValue:  { fontSize: 12, color: '#7c3aed', fontWeight: '700' },
  levelName:   { fontSize: 16, fontWeight: '600', color: '#e0e0ff', marginBottom: 14 },

  levelDots: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3d3a5c' },
  dotPlayed:  { backgroundColor: '#7c3aed' },
  dotCurrent: { backgroundColor: '#a78bfa', width: 12, height: 12, borderRadius: 6, marginTop: -2 },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  btn:        { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Level result
  levelResultLabel: { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  levelScore:       { fontSize: 64, fontWeight: '800', marginBottom: 0 },
  levelScoreLabel:  { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  outcomeText:      { fontSize: 14, color: '#d1d5db', textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  // Trait complete
  doneEmoji:        { fontSize: 52, marginBottom: 12 },
  traitDoneTitle:   { fontSize: 22, fontWeight: '700', color: '#e0e0ff', marginBottom: 4 },
  traitDoneSubtitle:{ fontSize: 14, color: '#22c55e', marginBottom: 24 },
  nextBox: {
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 24, width: '80%',
  },
  nextLabel: { fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  nextName:  { fontSize: 17, fontWeight: '600', color: '#e0e0ff' },

  // Processing
  processingText:    { fontSize: 17, fontWeight: '600', color: '#e0e0ff', marginTop: 20 },
  processingSubText: { fontSize: 13, color: '#9ca3af', marginTop: 8 },

  errorText: { fontSize: 15, color: '#f87171', textAlign: 'center', marginBottom: 24 },

  // Game header
  gameHeader: {
    backgroundColor: '#1a1330', paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#3d3a5c',
  },
  gameHeaderText: { fontSize: 12, color: '#a78bfa', fontWeight: '600', textAlign: 'center' },
});
