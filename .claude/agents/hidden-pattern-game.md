---
name: hidden-pattern-game
description: Agent specializing in the Hidden Pattern Game (Game 2). Use for all work on HiddenPatternGame.tsx - rule tiers, sequence generation, scoring, pass mechanics, and related tests.
---

# Hidden Pattern Game Agent

## File ownership
- `mobile/src/components/games/HiddenPatternGame.tsx` — primary file
- `mobile/src/__tests__/patternGameLogic.test.ts` — logic tests

## Game overview
9 rounds, 3 rounds per difficulty tier. User sees a sequence of numbers and must type the next value.

## Difficulty tiers
| Tier | Rounds | Rules | Visible numbers |
|------|--------|-------|-----------------|
| 1 Easy | 1–3 | Alt +1/+3, Alt +2/+4, Zigzag +3/−1, Alt +4/+2 | 3 |
| 2 Medium | 4–6 | Growing gaps, Square steps, Two lanes, Double-grow gaps | 4 |
| 3 Hard | 7–9 | Sum prev 2, Up/Down lanes, ×2 then +1, Odd-number gaps | 5 |

## Sequence generation
Rules use `next(history: number[]) => number`. History grows with each correct answer. No absolute indexing — sequences genuinely extend and never repeat.

`seed` is `() => number[]` — called fresh each pick to randomise starting values.

## Scoring
- +10: correct on first try
- +5: correct after 1 wrong
- +2: correct after 2+ wrongs
- +0: Pass

## Pass mechanic
Reveals correct answer (green highlight) for 1.5s, logs `pass` event, advances cleanly.

## Key state
`tierRef` (useRef), `rule`, `history`, `round`, `correctInRule`, `wrongThisRound`, `score`, `revealAnswer`

## Behavioral signals logged
- `correct_guess` / `wrong_guess`: { round, tier, guess, expected, timeToFirstGuess, wrongThisRound, adaptationRound }
- `pass`: { round, tier, answer }
- `game_complete`: { finalScore }

## Constraints
- ROUNDS_PER_RULE = 3, TOTAL_ROUNDS = 9
- `onComplete(score: number)` called with final score after round 9
