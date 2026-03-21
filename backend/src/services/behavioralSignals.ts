/**
 * Behavioral Signals Extractor
 * Converts raw DB events into human-readable signal strings for the LLM prompt.
 * Each game type produces a 1-2 line summary of observed behaviors.
 */

interface GameEvent {
  game_id: string;
  event_type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface GameResult {
  configId: string;
  gameType: string;
  title: string;
}

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Memory ────────────────────────────────────────────────────────────────────
function describeMemory(events: GameEvent[], title: string): string {
  const rounds = events.filter(e => e.event_type === 'round_complete');
  if (rounds.length === 0) return `${title}: No rounds recorded — game may have been skipped.`;

  const correctRounds = rounds.filter(e => e.data.correct === true).length;
  const accuracy = Math.round((correctRounds / rounds.length) * 100);
  const times = rounds
    .map(e => e.data.responseTime as number)
    .filter(t => typeof t === 'number' && t > 0);
  const avgMs = times.length > 0 ? Math.round(avg(times)) : null;

  const lastRound = rounds[rounds.length - 1];
  const maxSeqLen = lastRound.data.sequenceLength as number ?? rounds.length + 3;

  let line = `${title}: ${correctRounds}/${rounds.length} rounds recalled correctly (${accuracy}% accuracy), max sequence length reached: ${maxSeqLen}`;
  if (avgMs !== null) line += `, avg response time ${(avgMs / 1000).toFixed(1)}s`;
  return line + '.';
}

// ── Logic / Deduction ─────────────────────────────────────────────────────────
function describeLogic(events: GameEvent[], title: string): string {
  const answers = events.filter(e => e.event_type === 'question_answer');
  if (answers.length === 0) return `${title}: No answers recorded — game may have been skipped.`;

  const correct = answers.filter(e => e.data.correct === true).length;
  const accuracy = Math.round((correct / answers.length) * 100);
  const times = answers
    .map(e => e.data.timeSpent as number)
    .filter(t => typeof t === 'number' && t > 0);
  const avgSec = times.length > 0 ? round1(avg(times)) : null;

  let line = `${title}: ${correct}/${answers.length} questions answered correctly (${accuracy}% accuracy)`;
  if (avgSec !== null) line += `, avg ${avgSec}s per question`;
  if (answers.length < 7) line += ` — only ${answers.length}/7 questions attempted`;
  return line + '.';
}

// ── Reaction / Inhibition ─────────────────────────────────────────────────────
function describeReaction(events: GameEvent[], title: string): string {
  const responses = events.filter(e => e.event_type === 'stimulus_response');
  if (responses.length === 0) return `${title}: No responses recorded — game may have been skipped.`;

  const correct = responses.filter(e => e.data.correct === true).length;
  const accuracy = Math.round((correct / responses.length) * 100);

  const reactionTimes = responses
    .filter(e => e.data.correct === true)
    .map(e => e.data.reactionTime as number)
    .filter(t => typeof t === 'number' && t > 0);
  const avgMs = reactionTimes.length > 0 ? Math.round(avg(reactionTimes)) : null;

  // Impulse control: nogo trials where the user incorrectly responded
  const nogoTrials = responses.filter(e => e.data.stimulusType === 'nogo');
  const falseStarts = nogoTrials.filter(e => e.data.responded === true).length;

  let line = `${title}: ${correct}/${responses.length} rounds correct (${accuracy}% accuracy)`;
  if (avgMs !== null) line += `, avg reaction time ${avgMs}ms`;
  if (nogoTrials.length > 0) {
    const impulseLabel = falseStarts > nogoTrials.length * 0.5 ? 'high impulsivity' : falseStarts > 0 ? 'some impulsivity' : 'good impulse control';
    line += `, ${falseStarts}/${nogoTrials.length} stop-signals failed (${impulseLabel})`;
  }
  return line + '.';
}

// ── Structured behavior data (typed JSON for LLM prompt) ─────────────────────
export interface GameBehaviorData {
  rule_discovery_game?: {
    correctPredictions: number;
    totalPredictions: number;
    avgTestsUsed: number;
  };
  planning_game?: {
    completedRounds: number;
    totalRounds: number;
    totalMistakes: number;
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
}

export function extractStructuredBehaviorData(
  events: GameEvent[],
  gameResults: GameResult[]
): GameBehaviorData {
  const data: GameBehaviorData = {};

  for (const game of gameResults) {
    const gameEvents = events.filter(e => e.game_id === game.configId || e.game_id === game.gameType);

    switch (game.gameType) {
      case 'rule_discovery': {
        const predictions = gameEvents.filter(e => e.event_type === 'prediction_submitted' && !e.data.timedOut);
        const correctPredictions = predictions.filter(e => e.data.correct).length;
        const testsUsed = predictions.map(e => (e.data.testsUsed as number) ?? 6);
        const avgTestsUsed = testsUsed.length > 0 ? round1(avg(testsUsed)) : 0;
        data.rule_discovery_game = {
          correctPredictions,
          totalPredictions: predictions.length,
          avgTestsUsed,
        };
        break;
      }
      case 'planning': {
        const completions = gameEvents.filter(e => e.event_type === 'round_complete');
        const completedRounds = completions.filter(e => e.data.completed).length;
        const totalMistakes = completions.reduce((sum, e) => sum + ((e.data.mistakes as number) ?? 0), 0);
        data.planning_game = {
          completedRounds,
          totalRounds: completions.length,
          totalMistakes,
        };
        break;
      }
      case 'memory': {
        const rounds = gameEvents.filter(e => e.event_type === 'round_complete');
        if (rounds.length === 0) break;

        const correctRounds = rounds.filter(e => e.data.correct === true).length;
        const times = rounds
          .map(e => e.data.responseTime as number)
          .filter(t => typeof t === 'number' && t > 0);
        const avgResponseTimeSec = times.length > 0 ? round1(avg(times) / 1000) : 0;
        const lastRound = rounds[rounds.length - 1];
        const maxSequenceLength = (lastRound.data.sequenceLength as number) ?? rounds.length + 3;

        data.memory_game = { correctRounds, totalRounds: rounds.length, maxSequenceLength, avgResponseTimeSec };
        break;
      }
      case 'logic': {
        const answers = gameEvents.filter(e => e.event_type === 'question_answer');
        if (answers.length === 0) break;

        const correct = answers.filter(e => e.data.correct === true).length;
        const times = answers
          .map(e => e.data.timeSpent as number)
          .filter(t => typeof t === 'number' && t > 0);
        const avgTimePerQuestionSec = times.length > 0 ? round1(avg(times)) : 0;

        data.logic_game = { correctAnswers: correct, totalQuestions: answers.length, avgTimePerQuestionSec };
        break;
      }
      case 'reaction': {
        const responses = gameEvents.filter(e => e.event_type === 'stimulus_response');
        if (responses.length === 0) break;

        const correct = responses.filter(e => e.data.correct === true).length;
        const reactionTimes = responses
          .filter(e => e.data.correct === true)
          .map(e => e.data.reactionTime as number)
          .filter(t => typeof t === 'number' && t > 0);
        const avgReactionTimeMs = reactionTimes.length > 0 ? Math.round(avg(reactionTimes)) : 0;
        const nogoTrials = responses.filter(e => e.data.stimulusType === 'nogo');
        const falseStarts = nogoTrials.filter(e => e.data.responded === true).length;

        data.reaction_game = {
          accuracy: Math.round((correct / responses.length) * 100),
          avgReactionTimeMs,
          falseStarts,
          totalTrials: responses.length,
        };
        break;
      }
    }
  }

  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function extractBehavioralSignals(
  events: GameEvent[],
  gameResults: GameResult[]
): string {
  if (events.length === 0) return 'No behavioral event data was recorded for this session.';

  const lines: string[] = [];

  for (const game of gameResults) {
    const gameEvents = events.filter(e => e.game_id === game.configId || e.game_id === game.gameType);

    switch (game.gameType) {
      case 'memory':
        lines.push(describeMemory(gameEvents, game.title));
        break;
      case 'logic':
        lines.push(describeLogic(gameEvents, game.title));
        break;
      case 'reaction':
        lines.push(describeReaction(gameEvents, game.title));
        break;
      default:
        if (gameEvents.length > 0) {
          lines.push(`${game.title}: ${gameEvents.length} events recorded.`);
        }
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No behavioral signals could be extracted.';
}
