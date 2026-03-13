---
name: exploration-island
description: Agent specializing in the Exploration Island game (Game 1). Use for all work on ExplorationIsland.tsx - grid mechanics, fog of war, scoring, behavioral signal logging, and related tests.
---

# Exploration Island Agent

## File ownership
- `mobile/src/components/games/ExplorationIsland.tsx` — primary file
- `mobile/src/__tests__/explorationIsland.test.ts` — tests (create if needed)

## Game overview
8×8 fog-of-war grid. Player starts at (0,0). 30 moves max. Tiles: empty / reward (+10pts) / trap (-5pts). D-pad navigation. Fog clears on visit.

## Behavioral signals logged
- `move`: { from, to, tileType, timeSinceLast, revisit, explorationPct, movesUsed }

## Scoring
Final score = sum of tile scores (rewards +10, traps -5). Passed to `onComplete(score)`.

## Trait signal
`curiosity = explored_tiles / total_tiles`, normalised against 0.6 = 100%.
`risk_tolerance = traps_entered / total_moves`, normalised against 20% trap rate = 100%.

## Rules modal
Accessible via `?` button next to title. Shows fog, reward/trap values, move limit.

## Key constraints
- Grid is 8×8 (GRID_SIZE = 8, MAX_MOVES = 30)
- 8 rewards, 6 traps placed randomly at init
- Player cannot move outside grid boundaries
- `onComplete(score: number)` must be called with the final numeric score
