---
name: impossible-puzzle
description: Agent specializing in the Impossible Puzzle game (Game 3). Use for all work on ImpossiblePuzzle.tsx - tile sliding, hints, scoring, and related tests.
---

# Impossible Puzzle Agent

## File ownership
- `mobile/src/components/games/ImpossiblePuzzle.tsx` — primary file
- `mobile/src/__tests__/impossiblePuzzle.test.ts` — tests (create if needed)

## Game overview
3×3 sliding tile puzzle. Tiles 1–8 + blank space. Tap an adjacent tile to slide it. Goal: arrange 1–8 in order.

## Win condition
`isSolved`: tiles match `[1, 2, 3, 4, 5, 6, 7, 8, 0]`

## Scoring
- Solved: `Math.max(0, Math.max(100, 1000 - attempts * 15) - hintsUsed * 20)`
  - ~67 moves = 0 bonus, always minimum 100 if solved
- Not solved (MAX_MOVES = 50 reached): `attempts * 3`
- Quit: `0`

## Hints
3 hints available. Each highlights a misplaced tile (yellow border). Using a hint deducts 20 from final score.

## Behavioral signals logged
- `move`: { tileValue, pauseMs, totalPauseMs, attemptNumber }
- `solved`: { timeMs, totalAttempts, hintRequests, pauseMs }
- `max_moves_reached`: { timeMs, totalAttempts, hintRequests, pauseMs }
- `quit`: { timeMs, attempts, hintRequests, pauseMs }
- `hint_request`: { hintsUsed, attempts }

## Constraints
- Puzzle is always solvable (parity check + swap if needed)
- MAX_MOVES = 50
- `onComplete(score: number)` called with final numeric score
