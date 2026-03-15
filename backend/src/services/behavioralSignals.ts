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

// ── Exploration ───────────────────────────────────────────────────────────────
function describeExploration(events: GameEvent[], title: string): string {
  const moves = events.filter(e => e.event_type === 'move');
  if (moves.length === 0) return `${title}: No moves recorded — game may have been skipped.`;

  const lastMove = moves[moves.length - 1];
  const exploredPct = Math.round(((lastMove.data.explorationPct as number) ?? 0) * 100);
  const traps = moves.filter(e => e.data.tileType === 'trap').length;
  const rewards = moves.filter(e => e.data.tileType === 'reward').length;
  const revisits = moves.filter(e => e.data.revisit === true).length;
  const totalMoves = moves[moves.length - 1].data.movesUsed as number ?? moves.length;

  const riskLabel = traps > 6 ? 'very high risk-taking' : traps > 3 ? 'moderate risk-taking' : 'cautious play';
  const explorationLabel = exploredPct >= 50 ? 'thorough explorer' : exploredPct >= 30 ? 'moderate explorer' : 'minimal exploration';

  return `${title}: ${totalMoves}/30 moves used, explored ${exploredPct}% of grid (${explorationLabel}), hit ${traps} trap${traps !== 1 ? 's' : ''} (${riskLabel}), collected ${rewards} reward${rewards !== 1 ? 's' : ''}, ${revisits} tile revisit${revisits !== 1 ? 's' : ''}.`;
}

// ── Pattern Recognition ───────────────────────────────────────────────────────
function describePattern(events: GameEvent[], title: string): string {
  const correct = events.filter(e => e.event_type === 'correct_guess');
  const wrong = events.filter(e => e.event_type === 'wrong_guess');
  const passes = events.filter(e => e.event_type === 'pass');
  const quit = events.some(e => e.event_type === 'quit');

  if (correct.length + wrong.length + passes.length === 0) {
    return `${title}: No answers recorded — game may have been skipped.`;
  }

  const total = correct.length + wrong.length;
  const accuracy = total > 0 ? Math.round((correct.length / total) * 100) : 0;

  const timings = correct
    .map(e => e.data.timeToFirstGuess as number)
    .filter(t => typeof t === 'number' && t > 0);
  const avgTime = timings.length > 0 ? Math.round(avg(timings) / 1000) : null;

  const adaptEvents = correct.filter(e => (e.data.adaptationRound as number | null) !== null);
  const avgAdapt = adaptEvents.length > 0
    ? round1(avg(adaptEvents.map(e => e.data.adaptationRound as number)))
    : null;

  let line = `${title}: ${correct.length}/${correct.length + wrong.length} rounds correct (${accuracy}% accuracy)`;
  if (passes.length > 0) line += `, ${passes.length} pass${passes.length !== 1 ? 'es' : ''} used`;
  if (avgTime !== null) line += `, avg ${avgTime}s to answer`;
  if (avgAdapt !== null) line += `, adapted to rule changes in avg ${avgAdapt} rounds`;
  if (quit) line += ` — quit early`;
  return line + '.';
}

// ── Puzzle ────────────────────────────────────────────────────────────────────
function describePuzzle(events: GameEvent[], title: string): string {
  const moves = events.filter(e => e.event_type === 'move');
  const hints = events.filter(e => e.event_type === 'hint_used');
  const solved = events.some(e => e.event_type === 'solved');
  const quit = events.some(e => e.event_type === 'quit');

  if (moves.length === 0) return `${title}: No moves recorded — game may have been skipped.`;

  const outcomeLabel = solved ? 'solved' : quit ? 'quit without solving' : 'did not complete';
  let line = `${title}: ${moves.length} moves made, ${hints.length} hint${hints.length !== 1 ? 's' : ''} used, ${outcomeLabel}`;

  if (solved && moves.length < 30) line += ` (efficient solution)`;
  else if (solved && moves.length >= 60) line += ` (required many attempts)`;

  return line + '.';
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
  exploration_game?: {
    tilesExplored: number;
    revisitedTiles: number;
    decisionTimeAvg: number;
    trapEncounters: number;
  };
  pattern_game?: {
    attempts: number;
    timeToDetectPattern: number;
    incorrectGuesses: number;
  };
  persistence_puzzle?: {
    totalAttempts: number;
    timeSpentSeconds: number;
    quit: boolean;
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
  const TOTAL_TILES = 64; // 8×8 grid
  const data: GameBehaviorData = {};

  for (const game of gameResults) {
    const gameEvents = events.filter(e => e.game_id === game.configId || e.game_id === game.gameType);

    switch (game.gameType) {
      case 'exploration': {
        const moves = gameEvents.filter(e => e.event_type === 'move');
        if (moves.length === 0) break;

        const lastMove = moves[moves.length - 1];
        const explorationPct = (lastMove.data.explorationPct as number) ?? 0;
        const tilesExplored = Math.round(explorationPct * TOTAL_TILES);
        const revisitedTiles = moves.filter(e => e.data.revisit === true).length;
        const trapEncounters = moves.filter(e => e.data.tileType === 'trap').length;

        const moveTimes = moves.map(e => e.timestamp);
        const gaps = moveTimes.slice(1).map((t, i) => (t - moveTimes[i]) / 1000);
        const decisionTimeAvg = gaps.length > 0 ? round1(avg(gaps)) : 0;

        data.exploration_game = { tilesExplored, revisitedTiles, decisionTimeAvg, trapEncounters };
        break;
      }
      case 'pattern': {
        const correct = gameEvents.filter(e => e.event_type === 'correct_guess');
        const wrong = gameEvents.filter(e => e.event_type === 'wrong_guess');
        const passes = gameEvents.filter(e => e.event_type === 'pass');

        const timings = correct
          .map(e => e.data.timeToFirstGuess as number)
          .filter(t => typeof t === 'number' && t > 0);
        const timeToDetectPattern = timings.length > 0 ? Math.round(avg(timings) / 1000) : 0;

        data.pattern_game = {
          attempts: correct.length + wrong.length + passes.length,
          timeToDetectPattern,
          incorrectGuesses: wrong.length,
        };
        break;
      }
      case 'puzzle': {
        const moves = gameEvents.filter(e => e.event_type === 'move');
        if (moves.length === 0) break;

        const timestamps = gameEvents.map(e => e.timestamp);
        const timeSpentSeconds = timestamps.length > 1
          ? Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000)
          : 0;

        data.persistence_puzzle = {
          totalAttempts: moves.length,
          timeSpentSeconds,
          quit: gameEvents.some(e => e.event_type === 'quit'),
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
      case 'exploration':
        lines.push(describeExploration(gameEvents, game.title));
        break;
      case 'pattern':
        lines.push(describePattern(gameEvents, game.title));
        break;
      case 'puzzle':
        lines.push(describePuzzle(gameEvents, game.title));
        break;
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
