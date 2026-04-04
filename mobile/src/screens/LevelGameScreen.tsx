/**
 * Level Game Screen — Cognitive Mirror (Round-Based Session Model)
 *
 * Session model:
 *   Each visit = one "round". The user plays ONE level per trait (5 games total).
 *   After the round, progress is saved. Next visit resumes from where they left off.
 *
 * Adaptive progression per trait across rounds:
 *   - Skip rule  : Level 1 score ≥ skipScore → next round starts at Level 4
 *   - Ceiling    : score drops ≥40% over 3 consecutive rounds → trait marked 'ceiling'
 *   - Complete   : Level 10 done → trait marked 'complete'
 *   - Continue   : next round plays currentLevel + 1
 *
 * When all 5 traits reach ceiling/complete, the user is offered Archetype generation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  getDeviceId,
  getTraitProgress,
  saveTraitProgress,
  DiscoveredTrait,
  TraitResult,
  TraitTalkResult,
  TraitProgressItem,
} from '../services/assessmentApi';
import { useAuth } from '../context/AuthContext';

// ── Game components ───────────────────────────────────────────────────────────
import BlackBoxGame         from '../components/games/BlackBoxGame';
import TaskPlanningGame     from '../components/games/TaskPlanningGame';
import MemorySequenceGame   from '../components/games/MemorySequenceGame';
import LogicDeductionGame   from '../components/games/LogicDeductionGame';
import ReactionTestGame     from '../components/games/ReactionTestGame';
import StroopGame           from '../components/games/StroopGame';
import VisualSearchGame     from '../components/games/VisualSearchGame';
import TheReactorGame       from '../components/games/TheReactorGame';
import ReactorChaosGame     from '../components/games/ReactorChaosGame';
import SpeedReactorGame     from '../components/games/SpeedReactorGame';
import TheArchiveGame       from '../components/games/TheArchiveGame';
import CircuitSnapGame      from '../components/games/CircuitSnapGame';
import TheBriefingGame      from '../components/games/TheBriefingGame';
import EmpathyResponseGame  from '../components/games/EmpathyResponseGame';
import RadarSweepGame       from '../components/games/RadarSweepGame';
import VectorFlowGame       from '../components/games/VectorFlowGame';
import SignalSiftGame       from '../components/games/SignalSiftGame';
import HoldShortGame        from '../components/games/HoldShortGame';
import NavLinkGame          from '../components/games/NavLinkGame';

type Props = NativeStackScreenProps<RootStackParamList, 'LevelGame'>;

type Phase =
  | 'loading'         // fetching saved progress on mount
  | 'trait_intro'     // show trait + level to play, start button
  | 'playing'         // game component active
  | 'level_result'    // show score + outcome for this level
  | 'round_complete'  // all traits played this round — show summary
  | 'processing'      // generating archetype (when all traits complete)
  | 'error';

/** One entry per trait played in this round */
interface RoundEntry {
  traitId:    string;
  traitName:  string;
  playedLevel: number;
  score:       number;
  outcome:     'continue' | 'skip' | 'ceiling' | 'complete';
  nextLevel:   number;
  nextStatus:  'in_progress' | 'ceiling' | 'complete';
  bestScore:   number;
  bestLevel:   number;
}

export default function LevelGameScreen({ route, navigation }: Props) {
  const { sessionId, profession, traits, baselineRtMs } = route.params;
  const { userId } = useAuth();

  // ── Core state ────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>('loading');
  const [traitIndex, setTraitIndex]   = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [lastScore, setLastScore]     = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<'continue'|'skip'|'ceiling'|'complete'>('continue');
  const [roundEntries, setRoundEntries] = useState<RoundEntry[]>([]);
  const [error, setError]             = useState<string | null>(null);

  // ── Persistent progress ───────────────────────────────────────────────────
  const [deviceId, setDeviceId]       = useState('');
  // Mutable ref so advanceFromLevelResult can read latest without stale closure
  const savedProgressRef = useRef<Record<string, TraitProgressItem>>({});

  // ── Per-level timing tracking ─────────────────────────────────────────────
  const startTimeRef    = useRef<number>(0);
  const trialRtsRef     = useRef<number[]>([]);
  const trialCorrectRef = useRef<number>(0);
  const trialTotalRef   = useRef<number>(0);

  const currentTrait: DiscoveredTrait      = traits[traitIndex];
  const traitDef: TraitDefinition | undefined = currentTrait ? TRAIT_CATALOG[currentTrait.id] : undefined;
  const levelConfig: LevelConfig | undefined  = traitDef?.levels[currentLevel - 1];

  const overallProgress = (traitIndex / traits.length) * 100;

  // ── Load saved progress on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
        const progress = await getTraitProgress(id);
        savedProgressRef.current = progress;
        // Set starting level for the first trait
        const firstTraitId = traits[0]?.id;
        const firstLevel = firstTraitId
          ? (progress[firstTraitId]?.nextLevel ?? 1)
          : 1;
        setCurrentLevel(firstLevel);
        setPhase('trait_intro');
      } catch (err) {
        console.error('[LevelGameScreen] Failed to load trait progress', {
          sessionId,
          error: err instanceof Error ? err.message : err,
        });
        // Fallback — start from level 1 for all traits
        setCurrentLevel(1);
        setPhase('trait_intro');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset per-level tracking when play begins
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current    = Date.now();
      trialRtsRef.current     = [];
      trialCorrectRef.current = 0;
      trialTotalRef.current   = 0;
    }
  }, [phase]);

  // ── Handle game complete ──────────────────────────────────────────────────
  // Legacy games (stroop, visual_search, blackbox) accumulate raw points
  // instead of emitting a 0-100 score. Normalize before storing.
  const RAW_SCORE_MAX: Record<string, number> = {
    stroop:       360, // 24 trials × max 15 pts each
    visual_search: 200, // 8 rounds × max 25 pts each
    blackbox:     320, // 8 rounds × max 40 pts each
  };

  const handleGameComplete = useCallback((score: number) => {
    if (!traitDef || !levelConfig) return;

    const rawMax = RAW_SCORE_MAX[traitDef.gameEngine];
    const normalizedScore = rawMax
      ? Math.min(100, Math.round((score / rawMax) * 100))
      : score;

    const durationMs = Date.now() - startTimeRef.current;
    const accuracy   = trialTotalRef.current > 0
      ? trialCorrectRef.current / trialTotalRef.current
      : normalizedScore / 100;
    const avgRt = trialRtsRef.current.length > 0
      ? trialRtsRef.current.reduce((a, b) => a + b, 0) / trialRtsRef.current.length
      : durationMs;

    // In round mode each trait is played once per round — pass single score.
    // Ceiling detection accumulates across rounds through the stored nextLevel/status.
    const outcome = adaptiveDecision(currentTrait.id, currentLevel, normalizedScore, [normalizedScore]);

    submitLevelResult({
      sessionId,
      traitId:     currentTrait.id,
      level:       currentLevel,
      score:       normalizedScore,
      accuracy,
      avgLatencyMs: avgRt,
      outcome,
      levelConfigJson: JSON.stringify(levelConfig),
    }).catch((err) => {
      console.warn('[LevelGameScreen] submitLevelResult failed (non-fatal)', {
        sessionId,
        traitId: currentTrait.id,
        level:   currentLevel,
        error:   err instanceof Error ? err.message : err,
      });
    });

    setLastScore(normalizedScore);
    setLastOutcome(outcome);
    setPhase('level_result');
  }, [traitDef, levelConfig, currentTrait, currentLevel, sessionId]);

  // ── Skip current game ─────────────────────────────────────────────────────
  // Records a skipped entry (score 0, level stays the same) and advances
  // to the next trait. The skipped level is replayed next round.
  function handleSkipGame() {
    const saved = savedProgressRef.current[currentTrait.id];

    const entry: RoundEntry = {
      traitId:     currentTrait.id,
      traitName:   currentTrait.name,
      playedLevel: currentLevel,
      score:       0,
      outcome:     'continue',
      nextLevel:   currentLevel,          // replay same level next time
      nextStatus:  'in_progress',
      bestScore:   saved?.bestScore ?? 0, // don't overwrite personal best
      bestLevel:   saved?.bestLevel ?? 0,
    };

    const updatedEntries = [...roundEntries, entry];
    setRoundEntries(updatedEntries);

    if (traitIndex + 1 < traits.length) {
      const nextTraitId    = traits[traitIndex + 1].id;
      const nextTraitLevel = savedProgressRef.current[nextTraitId]?.nextLevel ?? 1;
      setTraitIndex(i => i + 1);
      setCurrentLevel(nextTraitLevel);
      setPhase('trait_intro');
    } else {
      finishRound(updatedEntries);
    }
  }

  // ── Advance after level result ─────────────────────────────────────────────
  function advanceFromLevelResult() {
    const score   = lastScore ?? 0;
    const outcome = lastOutcome;
    const saved   = savedProgressRef.current[currentTrait.id];

    // Compute next level for this trait
    let nextLevel: number;
    if (outcome === 'skip')                        nextLevel = 4;
    else if (outcome === 'continue')               nextLevel = currentLevel + 1;
    else /* ceiling | complete */                  nextLevel = currentLevel;

    // Clamp to 1–10
    nextLevel = Math.max(1, Math.min(10, nextLevel));

    const nextStatus: TraitProgressItem['status'] =
      outcome === 'ceiling'  ? 'ceiling'  :
      outcome === 'complete' ? 'complete' :
      'in_progress';

    const entry: RoundEntry = {
      traitId:     currentTrait.id,
      traitName:   currentTrait.name,
      playedLevel: currentLevel,
      score,
      outcome,
      nextLevel,
      nextStatus,
      bestScore:   Math.max(saved?.bestScore ?? 0, score),
      bestLevel:   Math.max(saved?.bestLevel ?? 0, currentLevel),
    };

    const updatedEntries = [...roundEntries, entry];
    setRoundEntries(updatedEntries);

    if (traitIndex + 1 < traits.length) {
      // Advance to next trait
      const nextTraitId = traits[traitIndex + 1].id;
      const nextTraitLevel = savedProgressRef.current[nextTraitId]?.nextLevel ?? 1;
      setTraitIndex(i => i + 1);
      setCurrentLevel(nextTraitLevel);
      setPhase('trait_intro');
    } else {
      // All traits played this round — finalize
      finishRound(updatedEntries);
    }
  }

  // ── Finish round: save progress ───────────────────────────────────────────
  function finishRound(entries: RoundEntry[]) {
    setPhase('round_complete');

    // Build progress items for the backend
    const items: TraitProgressItem[] = entries.map(e => ({
      traitId:   e.traitId,
      nextLevel: e.nextLevel,
      bestScore: e.bestScore,
      bestLevel: e.bestLevel,
      status:    e.nextStatus,
    }));

    // Update the in-memory progress ref so "Play Another Round" picks up new levels
    const newProgress = { ...savedProgressRef.current };
    for (const item of items) newProgress[item.traitId] = item;
    savedProgressRef.current = newProgress;

    // Save to local storage + backend (non-blocking)
    saveTraitProgress(deviceId, userId ?? undefined, items).catch((err) => {
      console.warn('[LevelGameScreen] saveTraitProgress failed', {
        sessionId,
        error: err instanceof Error ? err.message : err,
      });
    });
  }

  // ── Play another round immediately ────────────────────────────────────────
  function playAnotherRound() {
    const firstTraitId = traits[0]?.id;
    const firstLevel   = savedProgressRef.current[firstTraitId]?.nextLevel ?? 1;
    setTraitIndex(0);
    setCurrentLevel(firstLevel);
    setRoundEntries([]);
    setLastScore(null);
    setPhase('trait_intro');
  }

  // ── Generate archetype from current progress ──────────────────────────────
  // Called on "Done for Today" (always) and when all traits are at ceiling/complete.
  // Uses savedProgressRef which is updated at the end of every round before this runs.
  async function generateCurrentArchetype() {
    setPhase('processing');
    try {
      const traitResults: TraitResult[] = traits.map(t => {
        const p = savedProgressRef.current[t.id];
        const outcome: TraitResult['outcome'] =
          p?.status === 'ceiling'  ? 'ceiling'  :
          p?.status === 'complete' ? 'complete' :
          'continue';
        return {
          traitId:   t.id,
          traitName: t.name,
          isPrimary: t.isPrimary,
          peakLevel: p?.bestLevel ?? 1,
          peakScore: p?.bestScore ?? 0,
          avgScore:  p?.bestScore ?? 0,
          outcome,
          scores:    [p?.bestScore ?? 0],
        };
      });

      const scoreMap: Record<string, number> = {};
      for (const r of traitResults) scoreMap[r.traitId] = r.avgScore;

      const traitTalk: TraitTalkResult = await runTraitTalk(sessionId, scoreMap);
      const archetype = await generateArchetype(sessionId, profession, traitResults, traitTalk);

      navigation.replace('ArchetypeCard', {
        archetype,
        profession,
        traitResults,
        traitTalk,
      });
    } catch (err) {
      console.error('[LevelGameScreen] generateCurrentArchetype failed', {
        sessionId,
        profession,
        error: err instanceof Error ? err.message : err,
      });
      setError('Failed to generate your Archetype Card. Please try again.');
      setPhase('error');
    }
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <Text style={styles.processingText}>Loading your progress…</Text>
      </View>
    );
  }

  // ── Render: processing (archetype) ────────────────────────────────────────
  if (phase === 'processing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <Text style={styles.processingText}>Analysing your cognitive profile…</Text>
        <Text style={styles.processingSubText}>Running Trait Talk validation</Text>
      </View>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={generateCurrentArchetype}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: round complete ─────────────────────────────────────────────────
  if (phase === 'round_complete') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.roundCompleteContent}>
        <Text style={styles.roundCompleteTitle}>Round Complete</Text>
        <Text style={styles.roundCompleteSubtitle}>Progress saved</Text>

        {/* Per-trait summary rows */}
        <View style={styles.summaryBox}>
          {roundEntries.map((entry) => {
            const scoreColor =
              entry.score >= 80 ? '#22c55e' :
              entry.score >= 60 ? '#3b82f6' :
              entry.score >= 40 ? '#f59e0b' : '#ef4444';
            const statusTag =
              entry.nextStatus === 'complete' ? 'DONE' :
              entry.nextStatus === 'ceiling'  ? 'CEILING' :
              `→ L${entry.nextLevel}`;
            return (
              <View key={entry.traitId} style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryTraitName}>{entry.traitName}</Text>
                  <Text style={styles.summaryLevelText}>Level {entry.playedLevel}</Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={[styles.summaryScore, { color: scoreColor }]}>
                    {Math.round(entry.score)}
                  </Text>
                  <Text style={styles.summaryNext}>{statusTag}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.btn} onPress={playAnotherRound}>
          <Text style={styles.btnText}>Play Another Round</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={generateCurrentArchetype}
        >
          <Text style={styles.btnSecondaryText}>Done for Today →  See Analysis</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Render: level result ──────────────────────────────────────────────────
  if (phase === 'level_result') {
    const score = lastScore ?? 0;
    const color =
      score >= 80 ? '#22c55e' :
      score >= 60 ? '#3b82f6' :
      score >= 40 ? '#f59e0b' : '#ef4444';

    const outcomeLabel =
      lastOutcome === 'skip'     ? 'Elite performance — next round starts at Level 4' :
      lastOutcome === 'ceiling'  ? 'Cognitive ceiling reached for this trait' :
      lastOutcome === 'complete' ? 'Trait mastered — maximum level reached' :
      `Level ${currentLevel} complete`;

    const isLastTrait = traitIndex + 1 >= traits.length;
    const nextTrait   = !isLastTrait ? traits[traitIndex + 1] : null;

    return (
      <View style={styles.center}>
        <Text style={styles.levelResultTrait}>{currentTrait.name}</Text>
        <Text style={styles.levelResultLabel}>Level {currentLevel}</Text>
        <Text style={[styles.levelScore, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.levelScoreLabel}>/ 100</Text>
        <Text style={styles.outcomeText}>{outcomeLabel}</Text>

        {nextTrait && (
          <View style={styles.nextBox}>
            <Text style={styles.nextLabel}>Next up</Text>
            <Text style={styles.nextName}>{nextTrait.name}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={advanceFromLevelResult}>
          <Text style={styles.btnText}>
            {isLastTrait ? 'Finish Round' : 'Continue →'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: trait intro ───────────────────────────────────────────────────
  if (phase === 'trait_intro') {
    if (!traitDef || !levelConfig) return null;

    const savedItem = savedProgressRef.current[currentTrait.id];
    const bestScore = savedItem?.bestScore ?? 0;
    const bestLevel = savedItem?.bestLevel ?? 0;
    const hasPlayed = bestLevel > 0;

    return (
      <View style={styles.container}>
        {/* Overall round progress bar */}
        <View style={styles.overallProgress}>
          <View style={[styles.overallFill, { width: `${overallProgress}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.traitIndexLabel}>
            Game {traitIndex + 1} of {traits.length}
          </Text>
          <Text style={styles.traitIcon}>{traitDef.icon}</Text>
          <Text style={styles.traitName}>{traitDef.name}</Text>
          {currentTrait.isPrimary && (
            <View style={styles.primaryPill}>
              <Text style={styles.primaryPillText}>PRIMARY</Text>
            </View>
          )}
          <Text style={styles.traitDesc}>{traitDef.description}</Text>

          <View style={styles.levelInfoBox}>
            <View style={styles.levelRow}>
              <Text style={styles.levelLabel}>Level</Text>
              <Text style={styles.levelValue}>{currentLevel} / 10</Text>
            </View>
            <Text style={styles.levelName}>{levelConfig.label}</Text>

            {/* Progress dots showing where user is */}
            <View style={styles.levelDots}>
              {Array.from({ length: 10 }).map((_, i) => {
                const passed  = i + 1 < currentLevel;
                const current = i + 1 === currentLevel;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      passed  && styles.dotPlayed,
                      current && styles.dotCurrent,
                    ]}
                  />
                );
              })}
            </View>

            {hasPlayed && (
              <View style={styles.personalBestRow}>
                <Text style={styles.personalBestLabel}>Personal best</Text>
                <Text style={styles.personalBestValue}>
                  {Math.round(bestScore)} at Level {bestLevel}
                </Text>
              </View>
            )}

            {/* Complexity badges */}
            <View style={styles.badges}>
              {levelConfig.speedMultiplier > 1.3 && (
                <Badge label={`${levelConfig.speedMultiplier}× Speed`} color="#7c3aed" />
              )}
              {levelConfig.distractorDensity >= 0.5 && (
                <Badge label="High Noise" color="#dc2626" />
              )}
              {levelConfig.ruleShifting && (
                <Badge label="Rule Shift" color="#d97706" />
              )}
              {levelConfig.uiInterference && (
                <Badge label="Interference" color="#db2777" />
              )}
            </View>
          </View>

          {/* How to Play */}
          {(() => {
            const htp = GAME_HOW_TO_PLAY[traitDef.gameEngine];
            if (!htp) return null;
            return (
              <View style={styles.htpBox}>
                <Text style={styles.htpTitle}>How to Play</Text>
                <Text style={styles.htpTagline}>{htp.tagline}</Text>
                {htp.steps.map((step, i) => (
                  <View key={i} style={styles.htpStep}>
                    <Text style={styles.htpBullet}>{i + 1}</Text>
                    <Text style={styles.htpStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          <TouchableOpacity style={styles.btn} onPress={() => setPhase('playing')}>
            <Text style={styles.btnText}>Start Level {currentLevel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkipGame}>
            <Text style={styles.skipBtnText}>Skip this game</Text>
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
    _levelSpeedMultiplier: levelConfig.speedMultiplier,
    _levelDistrDensity:    levelConfig.distractorDensity,
    _levelRuleShifting:    levelConfig.ruleShifting,
    _levelUiInterference:  levelConfig.uiInterference,
  };

  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameHeader}>
        <Text style={styles.gameHeaderText}>
          {traitDef.name}  ·  Level {currentLevel}
        </Text>
        <TouchableOpacity onPress={handleSkipGame} style={styles.gameHeaderSkip}>
          <Text style={styles.gameHeaderSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>
      {renderGameComponent(traitDef.gameEngine, gameParams)}
    </View>
  );
}

// ── How to play — per game engine ────────────────────────────────────────────

interface HowToPlay {
  tagline: string;
  steps: string[];
}

const GAME_HOW_TO_PLAY: Record<string, HowToPlay> = {
  reactor: {
    tagline: 'Sort falling fuel rods into the correct bins',
    steps: [
      'Fuel rods fall from the top — each one belongs in a specific bin',
      'Tap a rod, then tap the matching bin to sort it',
      'Glowing rods are high priority — sort these first',
      'Steam clouds are distractors — ignore them',
      'Letting a rod hit the bottom loses points',
    ],
  },
  hold_short: {
    tagline: 'Control runway traffic — zero collisions',
    steps: [
      'Inbound aircraft appear one at a time, each requesting clearance',
      'Tap PROCEED if the runway is clear for that aircraft',
      'Tap HOLD SHORT if another aircraft is already using the same runway',
      'Mayday aircraft are emergencies — always Proceed immediately',
      'In fog, callsigns reveal only on close approach — decide early',
    ],
  },
  radar_sweep: {
    tagline: 'Memorise contacts on radar, tap them in reverse order',
    steps: [
      'Watch the sweep reveal blinking contacts one by one',
      'Remember each contact\'s position and the order it appeared',
      'When RECALL begins, tap the contacts in reverse order (last seen → first seen)',
      'Red decoys appear at higher levels — do not tap these',
      'At elite levels the radar rotates 90° before input — adjust mentally',
    ],
  },
  logic: {
    tagline: 'Solve logical reasoning problems',
    steps: [
      'Read the scenario or premises carefully',
      'Select the answer that logically follows',
      'Only what is stated can be assumed — no guessing',
      'Work through each step; don\'t skip ahead',
    ],
  },
  nav_link: {
    tagline: 'Route satellite data from Source to Ground',
    steps: [
      'Nodes appear on screen — one is the Source, one is the Ground station',
      'Tap two nodes to create a link between them',
      'Your goal: maintain an unbroken path from Source to Ground at all times',
      'Relay nodes can go offline (brown-out) — reroute quickly',
      'Fewer hops = higher path efficiency score',
    ],
  },
  rule_discovery: {
    tagline: 'Discover the hidden rule by testing inputs',
    steps: [
      'A black box transforms any input you give it by a hidden rule',
      'Submit test inputs and observe the outputs',
      'Use the pattern to deduce the rule',
      'Once confident, submit your prediction for a new input',
      'Fewer tests used = higher score',
    ],
  },
  blackbox: {
    tagline: 'Discover the hidden rule by testing inputs',
    steps: [
      'A black box transforms any input you give it by a hidden rule',
      'Submit test inputs and observe the outputs',
      'Use the pattern to deduce the rule',
      'Once confident, submit your prediction for a new input',
      'Fewer tests used = higher score',
    ],
  },
  visual_search: {
    tagline: 'Find the odd symbols hidden in the grid',
    steps: [
      'A grid of symbols is displayed — most are identical',
      'A few symbols are different — find and tap them all',
      'Work systematically — scan row by row',
      'Speed and accuracy both count toward your score',
    ],
  },
  briefing: {
    tagline: 'Read between the lines — identify hidden intent',
    steps: [
      'A crew communication transcript or scenario is shown',
      'Read what is said and how it is said',
      'Select the option that best reflects the speaker\'s true intent',
      'Professional deference and indirect language often mask real meaning',
    ],
  },
  stroop: {
    tagline: 'Tap the ink color — not what the word says',
    steps: [
      'A color word appears on screen (e.g. "RED") written in a different ink color',
      'Tap the button matching the INK COLOR — ignore what the word spells',
      'Your brain will try to read the word — resist it',
      'Respond as fast as possible without making errors',
    ],
  },
  signal_sift: {
    tagline: 'Detect anomalies in scrolling signal tracks',
    steps: [
      'Multiple signal tracks scroll across the screen as bar waveforms',
      'Most bars are normal — anomalies appear as unusual spikes or pattern breaks',
      'Tap the track row the moment you spot an anomaly',
      'Peripheral tracks (far from centre) count double — watch the edges',
      'False alarms (tapping normal signals) reduce your score',
    ],
  },
  vector_flow: {
    tagline: 'Classify objects rushing through the tunnel',
    steps: [
      'Objects fly toward you through a tunnel at high speed',
      'Tap LEFT for Mechanical objects, RIGHT for Biological (or vice versa)',
      'The rule flips every 10 seconds at higher levels — adapt fast',
      'You have a fraction of a second per object — trust your instincts',
      'Accuracy matters more than speed; a miss is worse than a slow correct tap',
    ],
  },
  reactor_chaos: {
    tagline: 'Sort fuel rods accurately while chaos unfolds',
    steps: [
      'Same as Reactor — sort falling rods into the correct bins',
      'System Failure events strike at random: screen shakes, flickers, dims',
      'Mayday rods are emergencies — sort these without hesitation',
      'Maintain accuracy throughout chaos events — don\'t freeze',
      'Recovery speed after each event is tracked as a KPI',
    ],
  },
  archive: {
    tagline: 'Memorise grid positions then recall them in sequence',
    steps: [
      'Glyphs flash on a grid one by one — memorise each position',
      'After the display phase, the grid goes dark',
      'Tap the positions in the same order they appeared',
      'At higher levels: N-Back mode — match what appeared N steps ago',
      'Dual-channel adds a second attribute to track simultaneously',
    ],
  },
  matrix: {
    tagline: 'Complete the pattern in the missing cell',
    steps: [
      'A 3×3 grid of shapes is shown with one cell missing',
      'Find the rule governing rows and columns',
      'Select the option that correctly completes the pattern',
      'Rules can involve shape, rotation, count, or shading',
    ],
  },
  speed_reactor: {
    tagline: 'Tap fuel rods the instant they appear',
    steps: [
      'Fuel rods appear and fall — tap each one before it hits the bottom',
      'No sorting required — just pure reaction time',
      'Multiple rods may appear simultaneously at higher levels',
      'Peripheral rods (near screen edges) score bonus points',
    ],
  },
};

// ── Game component dispatcher ─────────────────────────────────────────────────
// Note: some components do not accept a `config` prop (BlackBox, TaskPlanning,
// Stroop, VisualSearch). Those run with built-in params; adaptive progression
// is still driven by the returned score.

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
      return <StroopGame onComplete={onComplete} sessionId={sid} />;
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
      return <TaskPlanningGame onComplete={onComplete} sessionId={sid} />;
    case 'rule_discovery':
      return <BlackBoxGame onComplete={onComplete} sessionId={sid} />;
    case 'search':
      return <VisualSearchGame onComplete={onComplete} sessionId={sid} />;
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
    case 'speed_reactor':
      return (
        <SpeedReactorGame
          config={params as Parameters<typeof SpeedReactorGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'archive':
      return (
        <TheArchiveGame
          config={params as Parameters<typeof TheArchiveGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'circuit':
      return (
        <CircuitSnapGame
          config={params as Parameters<typeof CircuitSnapGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'briefing':
      return (
        <TheBriefingGame
          config={params as Parameters<typeof TheBriefingGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'empathy':
      return (
        <EmpathyResponseGame
          config={params as Parameters<typeof EmpathyResponseGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'radar_sweep':
      return (
        <RadarSweepGame
          config={params as Parameters<typeof RadarSweepGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'vector_flow':
      return (
        <VectorFlowGame
          config={params as Parameters<typeof VectorFlowGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'signal_sift':
      return (
        <SignalSiftGame
          config={params as Parameters<typeof SignalSiftGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'hold_short':
      return (
        <HoldShortGame
          config={params as Parameters<typeof HoldShortGame>[0]['config']}
          onComplete={onComplete}
          sessionId={sid}
        />
      );
    case 'nav_link':
      return (
        <NavLinkGame
          config={params as Parameters<typeof NavLinkGame>[0]['config']}
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
  container:    { flex: 1, backgroundColor: '#0f0e17' },
  center:       { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 24 },
  gameContainer:{ flex: 1, backgroundColor: '#0f0e17' },

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
  levelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  levelLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  levelValue: { fontSize: 12, color: '#7c3aed', fontWeight: '700' },
  levelName:  { fontSize: 16, fontWeight: '600', color: '#e0e0ff', marginBottom: 14 },

  levelDots:  { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3d3a5c' },
  dotPlayed:  { backgroundColor: '#7c3aed' },
  dotCurrent: { backgroundColor: '#a78bfa', width: 12, height: 12, borderRadius: 6, marginTop: -2 },

  personalBestRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  personalBestLabel: { fontSize: 11, color: '#6b7280' },
  personalBestValue: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  btn:        { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary:     { borderWidth: 1, borderColor: '#3d3a5c', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  btnSecondaryText: { color: '#9ca3af', fontWeight: '600', fontSize: 15 },

  // Level result
  levelResultTrait:  { fontSize: 13, color: '#a78bfa', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  levelResultLabel:  { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  levelScore:        { fontSize: 64, fontWeight: '800', marginBottom: 0 },
  levelScoreLabel:   { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  outcomeText:       { fontSize: 14, color: '#d1d5db', textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  nextBox: {
    backgroundColor: '#1e1d2e', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 24, width: '80%',
  },
  nextLabel: { fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  nextName:  { fontSize: 17, fontWeight: '600', color: '#e0e0ff' },

  // Round complete
  roundCompleteContent: { padding: 24, alignItems: 'center', paddingBottom: 60 },
  roundCompleteTitle:   { fontSize: 28, fontWeight: '800', color: '#e0e0ff', marginBottom: 4 },
  roundCompleteSubtitle:{ fontSize: 13, color: '#22c55e', marginBottom: 28 },

  summaryBox: {
    backgroundColor: '#1e1d2e', borderRadius: 14, width: '100%', marginBottom: 28,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2a2840',
  },
  summaryLeft:       { flex: 1 },
  summaryTraitName:  { fontSize: 15, fontWeight: '600', color: '#e0e0ff' },
  summaryLevelText:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  summaryRight:      { alignItems: 'flex-end' },
  summaryScore:      { fontSize: 22, fontWeight: '800' },
  summaryNext:       { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  archetypePromptBox: {
    backgroundColor: '#1a0f2e', borderRadius: 14, borderWidth: 1, borderColor: '#7c3aed44',
    padding: 20, width: '100%', marginBottom: 20, alignItems: 'center',
  },
  archetypePromptTitle:    { fontSize: 16, fontWeight: '700', color: '#a78bfa', marginBottom: 6 },
  archetypePromptSubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  archetypeBtn:            { marginBottom: 0 },

  // Processing
  processingText:    { fontSize: 17, fontWeight: '600', color: '#e0e0ff', marginTop: 20 },
  processingSubText: { fontSize: 13, color: '#9ca3af', marginTop: 8 },

  errorText: { fontSize: 15, color: '#f87171', textAlign: 'center', marginBottom: 24 },

  // How to Play
  htpBox: {
    backgroundColor: '#12111f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2840',
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  htpTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  htpTagline: {
    fontSize: 13,
    color: '#c4b5fd',
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 18,
  },
  htpStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  htpBullet: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
    width: 16,
    marginTop: 1,
  },
  htpStepText: {
    fontSize: 13,
    color: '#9ca3af',
    flex: 1,
    lineHeight: 19,
  },

  skipBtn: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    color: '#4b5563',
    textDecorationLine: 'underline',
  },

  // Game header
  gameHeader: {
    backgroundColor: '#1a1330', paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#3d3a5c',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  gameHeaderText: { fontSize: 12, color: '#a78bfa', fontWeight: '600', flex: 1, textAlign: 'center' },
  gameHeaderSkip: { paddingHorizontal: 4, paddingVertical: 2 },
  gameHeaderSkipText: { fontSize: 11, color: '#4b5563', textDecorationLine: 'underline' },
});
