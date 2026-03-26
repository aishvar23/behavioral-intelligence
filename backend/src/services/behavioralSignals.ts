/**
 * Behavioral Signals Extractor
 * Converts structured TrialRecord rows into human-readable signal strings for the LLM prompt.
 * Each game type produces a 1-2 line summary of observed behaviors.
 */

import { TrialRecord } from './traitEngine';

interface GameResult {
  configId: string;
  gameType: string;
  title: string;
}

// Game ID sets — mirrors traitEngine groupings
const RULE_DISCOVERY_IDS = ['black_box', 'black_box_standard', 'black_box_hard'];
const PLANNING_IDS       = ['task_planning', 'task_planning_standard', 'task_planning_hard'];
const MEMORY_IDS         = ['memory_colors', 'memory_numbers', 'memory_positions', 'memory_sequential', 'memory_faces', 'memory_code'];
const LOGIC_IDS          = ['logic_verbal', 'logic_situational', 'logic_deduction', 'logic_patterns', 'logic_boolean', 'logic_quantitative'];
const REACTION_IDS       = ['reaction_basic', 'reaction_inhibition', 'reaction_speed'];
const STROOP_IDS         = ['stroop', 'stroop_classic'];
const MATRIX_IDS         = ['matrix_puzzle', 'matrix_standard', 'matrix_advanced'];
const SPATIAL_IDS        = ['spatial_rotation', 'spatial'];
const ESTIMATION_IDS     = ['dot_estimation'];
const SEARCH_IDS         = ['visual_search', 'visual_search_standard', 'visual_search_hard'];

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

// ── Per-game description helpers ──────────────────────────────────────────────

function describeRuleDiscovery(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No rounds recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const testsPerRound = active.map(t => ((t.response.inputs_tested as unknown[]) ?? []).length);
  const avgTests = round1(avg(testsPerRound));
  const patterns = active.map(t => t.response.exploration_pattern as string).filter(Boolean);
  const patternCounts: Record<string, number> = {};
  for (const p of patterns) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
  const dominantPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  let line = `${title}: ${correct}/${active.length} predictions correct (${pct(correct, active.length)}% accuracy), avg ${avgTests} test inputs used per rule`;
  if (dominantPattern) line += `, predominant exploration: ${dominantPattern}`;
  return line + '.';
}

function describePlanning(trials: TrialRecord[], title: string): string {
  if (trials.length === 0) return `${title}: No rounds recorded — game may have been skipped.`;

  const completed = trials.filter(t => t.response.completed === true);
  const avgMistakes = completed.length > 0
    ? round1(avg(completed.map(t => (t.response.mistakes as number) ?? 0)))
    : 0;

  let line = `${title}: ${completed.length}/${trials.length} tasks completed`;
  if (completed.length > 0) line += `, avg ${avgMistakes} mistakes on completed tasks`;
  return line + '.';
}

function describeMemory(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No rounds recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgRt = Math.round(avg(active.map(t => t.response_time_ms)));
  const maxSeqLen = Math.max(...active.map(t => (t.stimulus.sequence_length as number) ?? 0), 0);

  let line = `${title}: ${correct}/${active.length} sequences recalled correctly (${pct(correct, active.length)}% accuracy)`;
  if (maxSeqLen > 0) line += `, max sequence length ${maxSeqLen}`;
  if (avgRt > 0) line += `, avg response time ${(avgRt / 1000).toFixed(1)}s`;
  return line + '.';
}

function describeLogic(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No questions recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgSec = round1(avg(active.map(t => t.response_time_ms)) / 1000);

  let line = `${title}: ${correct}/${active.length} questions answered correctly (${pct(correct, active.length)}% accuracy)`;
  if (avgSec > 0) line += `, avg ${avgSec}s per question`;
  if (active.length < 7) line += ` — only ${active.length}/7 questions attempted`;
  return line + '.';
}

function describeReaction(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No stimuli recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const goCorrect = active.filter(t => (t.stimulus.stimulus_type as string) === 'go' && t.is_correct);
  const avgRt = goCorrect.length > 0 ? Math.round(avg(goCorrect.map(t => t.response_time_ms))) : null;

  const nogoTrials = active.filter(t => (t.stimulus.stimulus_type as string) === 'nogo');
  const falseStarts = nogoTrials.filter(t => !t.is_correct).length;

  let line = `${title}: ${correct}/${active.length} stimuli correct (${pct(correct, active.length)}% accuracy)`;
  if (avgRt !== null) line += `, avg go-reaction ${avgRt}ms`;
  if (nogoTrials.length > 0) {
    const label = falseStarts > nogoTrials.length * 0.5 ? 'high impulsivity'
                : falseStarts > 0 ? 'some impulsivity'
                : 'good impulse control';
    line += `, ${falseStarts}/${nogoTrials.length} stop-signals failed (${label})`;
  }
  return line + '.';
}

function describeStroop(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No trials recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgRt = Math.round(avg(active.filter(t => t.is_correct).map(t => t.response_time_ms)));

  const incongruent = active.filter(t => t.stimulus.congruent === false);
  const congruent   = active.filter(t => t.stimulus.congruent === true);
  let interferenceLine = '';
  if (incongruent.length > 0 && congruent.length > 0) {
    const incRt = Math.round(avg(incongruent.filter(t => t.is_correct).map(t => t.response_time_ms)));
    const conRt = Math.round(avg(congruent.filter(t => t.is_correct).map(t => t.response_time_ms)));
    if (incRt > 0 && conRt > 0) interferenceLine = `, interference cost ${incRt - conRt}ms`;
  }

  return `${title}: ${correct}/${active.length} correct (${pct(correct, active.length)}% accuracy), avg correct RT ${avgRt}ms${interferenceLine}.`;
}

function describeMatrix(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No puzzles recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgRt = Math.round(avg(active.map(t => t.response_time_ms)));

  return `${title}: ${correct}/${active.length} patterns solved correctly (${pct(correct, active.length)}% accuracy), avg ${(avgRt / 1000).toFixed(1)}s per puzzle.`;
}

function describeSpatial(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No rotations recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgRt = Math.round(avg(active.map(t => t.response_time_ms)));

  return `${title}: ${correct}/${active.length} rotations identified correctly (${pct(correct, active.length)}% accuracy), avg ${(avgRt / 1000).toFixed(1)}s per item.`;
}

function describeEstimation(trials: TrialRecord[], title: string): string {
  const active = trials.filter(t => !t.skipped);
  if (active.length === 0) return `${title}: No estimation rounds recorded — game may have been skipped.`;

  const correct = active.filter(t => t.is_correct).length;
  const avgError = round1(avg(active.map(t => t.response_error)));
  const avgRt = Math.round(avg(active.filter(t => t.is_correct).map(t => t.response_time_ms)));

  let line = `${title}: ${correct}/${active.length} estimates within acceptable range (${pct(correct, active.length)}% accuracy), avg error ${avgError}`;
  if (avgRt > 0) line += `, avg decision time ${avgRt}ms`;
  return line + '.';
}

function describeVisualSearch(trials: TrialRecord[], title: string): string {
  if (trials.length === 0) return `${title}: No search rounds recorded — game may have been skipped.`;

  const totalTargets = trials.reduce((s, t) => s + ((t.stimulus.total_targets as number) ?? 0), 0);
  const found        = trials.reduce((s, t) => s + ((t.response.targets_found as number) ?? 0), 0);
  const falseTaps    = trials.reduce((s, t) => s + ((t.response.false_taps as number) ?? 0), 0);
  const hitRate = totalTargets > 0 ? pct(found, totalTargets) : 0;

  let line = `${title}: ${found}/${totalTargets} targets found (${hitRate}% hit rate)`;
  if (falseTaps > 0) line += `, ${falseTaps} false taps`;
  return line + '.';
}

// ── Structured behavior data (typed JSON for LLM prompt) ─────────────────────
export interface GameBehaviorData {
  rule_discovery_game?: {
    correctPredictions: number;
    totalPredictions: number;
    avgTestsUsed: number;
    dominantExplorationPattern?: string;
  };
  planning_game?: {
    completedRounds: number;
    totalRounds: number;
    avgMistakesOnCompleted: number;
  };
  memory_game?: {
    correctRounds: number;
    totalRounds: number;
    maxSequenceLength: number;
    avgResponseTimeSec: number;
  };
  logic_game?: {
    correctAnswers: number;
    totalQuestions: number;
    avgTimePerQuestionSec: number;
  };
  reaction_game?: {
    accuracy: number;
    avgReactionTimeMs: number;
    falseStarts: number;
    totalTrials: number;
  };
  stroop_game?: {
    accuracy: number;
    avgCorrectRtMs: number;
    interferenceCostMs: number;
  };
  matrix_game?: {
    accuracy: number;
    avgRtSec: number;
  };
  spatial_game?: {
    accuracy: number;
    avgRtSec: number;
  };
  estimation_game?: {
    accuracy: number;
    avgError: number;
  };
  visual_search_game?: {
    hitRate: number;
    totalTargets: number;
    targetsFound: number;
    falseTaps: number;
  };
}

// Map a gameResult configId/gameType to one of the ID sets above
function trialsForGame(trials: TrialRecord[], game: GameResult): TrialRecord[] {
  return trials.filter(
    t => t.game_id === game.configId ||
         t.game_id === game.gameType  ||
         RULE_DISCOVERY_IDS.includes(t.game_id) && game.gameType === 'rule_discovery' ||
         PLANNING_IDS.includes(t.game_id)       && game.gameType === 'planning'       ||
         MEMORY_IDS.includes(t.game_id)         && game.gameType === 'memory'         ||
         LOGIC_IDS.includes(t.game_id)          && game.gameType === 'logic'          ||
         REACTION_IDS.includes(t.game_id)       && game.gameType === 'reaction'       ||
         STROOP_IDS.includes(t.game_id)         && game.gameType === 'stroop'         ||
         MATRIX_IDS.includes(t.game_id)         && game.gameType === 'matrix'         ||
         SPATIAL_IDS.includes(t.game_id)        && game.gameType === 'spatial'        ||
         ESTIMATION_IDS.includes(t.game_id)     && game.gameType === 'estimation'     ||
         SEARCH_IDS.includes(t.game_id)         && game.gameType === 'visual_search'
  );
}

export function extractStructuredBehaviorData(
  trials: TrialRecord[],
  gameResults: GameResult[]
): GameBehaviorData {
  const data: GameBehaviorData = {};

  for (const game of gameResults) {
    const gt = trialsForGame(trials, game);

    switch (game.gameType) {
      case 'rule_discovery': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const testsUsed = active.map(t => ((t.response.inputs_tested as unknown[]) ?? []).length);
        const avgTestsUsed = round1(avg(testsUsed));
        const patterns = active.map(t => t.response.exploration_pattern as string).filter(Boolean);
        const patternCounts: Record<string, number> = {};
        for (const p of patterns) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
        const dominantExplorationPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        data.rule_discovery_game = { correctPredictions: correct, totalPredictions: active.length, avgTestsUsed, dominantExplorationPattern };
        break;
      }
      case 'planning': {
        if (gt.length === 0) break;
        const completed = gt.filter(t => t.response.completed === true);
        const avgMistakesOnCompleted = completed.length > 0
          ? round1(avg(completed.map(t => (t.response.mistakes as number) ?? 0)))
          : 0;
        data.planning_game = { completedRounds: completed.length, totalRounds: gt.length, avgMistakesOnCompleted };
        break;
      }
      case 'memory': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const times = active.map(t => t.response_time_ms).filter(t => t > 0);
        const avgResponseTimeSec = times.length > 0 ? round1(avg(times) / 1000) : 0;
        const maxSequenceLength = Math.max(...active.map(t => (t.stimulus.sequence_length as number) ?? 0), 0);
        data.memory_game = { correctRounds: correct, totalRounds: active.length, maxSequenceLength, avgResponseTimeSec };
        break;
      }
      case 'logic': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const avgTimePerQuestionSec = round1(avg(active.map(t => t.response_time_ms)) / 1000);
        data.logic_game = { correctAnswers: correct, totalQuestions: active.length, avgTimePerQuestionSec };
        break;
      }
      case 'reaction': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const goCorrect = active.filter(t => (t.stimulus.stimulus_type as string) === 'go' && t.is_correct);
        const avgReactionTimeMs = goCorrect.length > 0 ? Math.round(avg(goCorrect.map(t => t.response_time_ms))) : 0;
        const nogoTrials = active.filter(t => (t.stimulus.stimulus_type as string) === 'nogo');
        const falseStarts = nogoTrials.filter(t => !t.is_correct).length;
        data.reaction_game = { accuracy: pct(correct, active.length), avgReactionTimeMs, falseStarts, totalTrials: active.length };
        break;
      }
      case 'stroop': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const avgCorrectRtMs = Math.round(avg(active.filter(t => t.is_correct).map(t => t.response_time_ms)));
        const incongruent = active.filter(t => t.stimulus.congruent === false && t.is_correct);
        const congruent   = active.filter(t => t.stimulus.congruent === true  && t.is_correct);
        const interferenceCostMs = (incongruent.length > 0 && congruent.length > 0)
          ? Math.round(avg(incongruent.map(t => t.response_time_ms)) - avg(congruent.map(t => t.response_time_ms)))
          : 0;
        data.stroop_game = { accuracy: pct(correct, active.length), avgCorrectRtMs, interferenceCostMs };
        break;
      }
      case 'matrix': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const avgRtSec = round1(avg(active.map(t => t.response_time_ms)) / 1000);
        data.matrix_game = { accuracy: pct(correct, active.length), avgRtSec };
        break;
      }
      case 'spatial': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const avgRtSec = round1(avg(active.map(t => t.response_time_ms)) / 1000);
        data.spatial_game = { accuracy: pct(correct, active.length), avgRtSec };
        break;
      }
      case 'estimation': {
        const active = gt.filter(t => !t.skipped);
        if (active.length === 0) break;
        const correct = active.filter(t => t.is_correct).length;
        const avgError = round1(avg(active.map(t => t.response_error)));
        data.estimation_game = { accuracy: pct(correct, active.length), avgError };
        break;
      }
      case 'visual_search': {
        if (gt.length === 0) break;
        const totalTargets = gt.reduce((s, t) => s + ((t.stimulus.total_targets as number) ?? 0), 0);
        const targetsFound = gt.reduce((s, t) => s + ((t.response.targets_found as number) ?? 0), 0);
        const falseTaps    = gt.reduce((s, t) => s + ((t.response.false_taps as number) ?? 0), 0);
        data.visual_search_game = { hitRate: pct(targetsFound, totalTargets), totalTargets, targetsFound, falseTaps };
        break;
      }
    }
  }

  return data;
}

// ── Public text summary API ───────────────────────────────────────────────────
export function extractBehavioralSignals(
  trials: TrialRecord[],
  gameResults: GameResult[]
): string {
  if (trials.length === 0) return 'No behavioral trial data was recorded for this session.';

  const lines: string[] = [];

  for (const game of gameResults) {
    const gt = trialsForGame(trials, game);

    switch (game.gameType) {
      case 'rule_discovery':  lines.push(describeRuleDiscovery(gt, game.title)); break;
      case 'planning':        lines.push(describePlanning(gt, game.title));      break;
      case 'memory':          lines.push(describeMemory(gt, game.title));        break;
      case 'logic':           lines.push(describeLogic(gt, game.title));         break;
      case 'reaction':        lines.push(describeReaction(gt, game.title));      break;
      case 'stroop':          lines.push(describeStroop(gt, game.title));        break;
      case 'matrix':          lines.push(describeMatrix(gt, game.title));        break;
      case 'spatial':         lines.push(describeSpatial(gt, game.title));       break;
      case 'estimation':      lines.push(describeEstimation(gt, game.title));    break;
      case 'visual_search':   lines.push(describeVisualSearch(gt, game.title));  break;
      default:
        if (gt.length > 0) lines.push(`${game.title}: ${gt.length} trials recorded.`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No behavioral signals could be extracted.';
}
