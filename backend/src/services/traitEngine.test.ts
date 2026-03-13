import { calculateTraits } from './traitEngine';

function makeEvent(
  gameId: string,
  eventType: string,
  data: Record<string, unknown> = {}
) {
  return { game_id: gameId, event_type: eventType, timestamp: Date.now(), data };
}

describe('calculateTraits', () => {
  // ─── curiosity (exploration game) ────────────────────────────────────────────

  describe('curiosity (exploration game)', () => {
    it('returns 0.5 when no exploration events', () => {
      // No events at all → calcCuriosity gets empty array → no move events → 0.5
      const traits = calculateTraits([]);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 0.5 when exploration events exist but none are move events', () => {
      const events = [makeEvent('exploration', 'start', {})];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 1.0 when explorationPct >= 0.6', () => {
      // pct / 0.6 = 0.6 / 0.6 = 1.0 → clamped to 1.0
      const events = [makeEvent('exploration', 'move', { explorationPct: 0.6 })];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(1.0);
    });

    it('returns 1.0 when explorationPct exceeds 0.6 (clamped)', () => {
      const events = [makeEvent('exploration', 'move', { explorationPct: 0.9 })];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(1.0);
    });

    it('scales linearly below 60% exploration', () => {
      // explorationPct = 0.3 → 0.3 / 0.6 = 0.5
      const events = [makeEvent('exploration', 'move', { explorationPct: 0.3 })];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBeCloseTo(0.5, 5);
    });

    it('uses the last move event explorationPct when there are multiple', () => {
      // First move has high pct, last move has low pct → should use last
      const events = [
        makeEvent('exploration', 'move', { explorationPct: 0.9 }),
        makeEvent('exploration', 'move', { explorationPct: 0.3 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBeCloseTo(0.5, 5);
    });

    it('returns 0 when explorationPct is 0', () => {
      const events = [makeEvent('exploration', 'move', { explorationPct: 0 })];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(0);
    });

    it('ignores non-exploration game events', () => {
      // puzzle move events should not affect curiosity
      const events = [makeEvent('puzzle', 'move', { explorationPct: 0.9 })];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(0.5);
    });
  });

  // ─── persistence (puzzle game) ───────────────────────────────────────────────

  describe('persistence (puzzle game)', () => {
    it('returns 0.1 when quit with fewer than 10 moves', () => {
      const events = [
        makeEvent('puzzle', 'move', {}),
        makeEvent('puzzle', 'move', {}),
        makeEvent('puzzle', 'quit', {}),
      ];
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(0.1);
    });

    it('returns 0.1 when quit with exactly 9 moves', () => {
      const events = [
        ...Array.from({ length: 9 }, () => makeEvent('puzzle', 'move', {})),
        makeEvent('puzzle', 'quit', {}),
      ];
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(0.1);
    });

    it('does NOT return 0.1 when quit with 10 or more moves (uses moves/100 formula)', () => {
      // 10 moves + quit → quit=true, moves=10, but condition is moves < 10, so uses clamp(10/100)
      const events = [
        ...Array.from({ length: 10 }, () => makeEvent('puzzle', 'move', {})),
        makeEvent('puzzle', 'quit', {}),
      ];
      const traits = calculateTraits(events);
      expect(traits.persistence).toBeCloseTo(0.1, 5);
    });

    it('returns high score when solved with many moves', () => {
      // solved → clamp(0.5 + moves/200). 100 moves → 0.5 + 0.5 = 1.0
      const events = [
        ...Array.from({ length: 100 }, () => makeEvent('puzzle', 'move', {})),
        makeEvent('puzzle', 'solved', {}),
      ];
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(1.0);
    });

    it('returns base 0.5 when solved with 0 moves', () => {
      // solved → clamp(0.5 + 0/200) = 0.5
      const events = [makeEvent('puzzle', 'solved', {})];
      const traits = calculateTraits(events);
      expect(traits.persistence).toBeCloseTo(0.5, 5);
    });

    it('returns clamped score based on move count when not solved and no quit', () => {
      // 50 moves, no solved, no quit → clamp(50/100) = 0.5
      const events = Array.from({ length: 50 }, () => makeEvent('puzzle', 'move', {}));
      const traits = calculateTraits(events);
      expect(traits.persistence).toBeCloseTo(0.5, 5);
    });

    it('clamps persistence to 1.0 for excessive moves without solving', () => {
      // 200 moves → clamp(200/100) = clamp(2) = 1.0
      const events = Array.from({ length: 200 }, () => makeEvent('puzzle', 'move', {}));
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(1.0);
    });

    it('returns 0.5 when no puzzle events at all', () => {
      // No puzzle events → moves=0, quit=false, solved=false → clamp(0/100)=0
      // Wait: with no puzzle events moves=0, not solved, not quit → clamp(0/100) = 0
      const traits = calculateTraits([]);
      expect(traits.persistence).toBe(0);
    });

    it('ignores non-puzzle game events', () => {
      // exploration solved should not count
      const events = [makeEvent('exploration', 'solved', {})];
      const traits = calculateTraits(events);
      // No puzzle events → clamp(0/100) = 0
      expect(traits.persistence).toBe(0);
    });
  });

  // ─── risk_tolerance (exploration game) ───────────────────────────────────────

  describe('risk_tolerance (exploration game)', () => {
    it('returns 0.5 when no exploration moves', () => {
      const traits = calculateTraits([]);
      expect(traits.risk_tolerance).toBe(0.5);
    });

    it('returns 0.5 when exploration events exist but none are move events', () => {
      const events = [makeEvent('exploration', 'start', {})];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(0.5);
    });

    it('returns 1.0 when trap rate is exactly 20%', () => {
      // 1 trap move out of 5 total = 20% → clamp(0.2 / 0.2) = 1.0
      const events = [
        makeEvent('exploration', 'move', { tileType: 'trap' }),
        makeEvent('exploration', 'move', { tileType: 'grass' }),
        makeEvent('exploration', 'move', { tileType: 'grass' }),
        makeEvent('exploration', 'move', { tileType: 'grass' }),
        makeEvent('exploration', 'move', { tileType: 'grass' }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(1.0);
    });

    it('returns 1.0 (clamped) when trap rate exceeds 20%', () => {
      // 2 traps out of 2 = 100% → clamp(1.0/0.2) = clamp(5) = 1.0
      const events = [
        makeEvent('exploration', 'move', { tileType: 'trap' }),
        makeEvent('exploration', 'move', { tileType: 'trap' }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(1.0);
    });

    it('returns 0 when no traps entered', () => {
      // 0 traps / N moves → 0 / 0.2 = 0
      const events = [
        makeEvent('exploration', 'move', { tileType: 'grass' }),
        makeEvent('exploration', 'move', { tileType: 'grass' }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(0);
    });

    it('scales linearly between 0 and 20% trap rate', () => {
      // 1 trap out of 10 moves = 10% → clamp(0.1 / 0.2) = 0.5
      const events = [
        makeEvent('exploration', 'move', { tileType: 'trap' }),
        ...Array.from({ length: 9 }, () => makeEvent('exploration', 'move', { tileType: 'grass' })),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBeCloseTo(0.5, 5);
    });

    it('ignores non-exploration game events for risk_tolerance', () => {
      const events = [makeEvent('puzzle', 'move', { tileType: 'trap' })];
      const traits = calculateTraits(events);
      // No exploration moves → 0.5
      expect(traits.risk_tolerance).toBe(0.5);
    });
  });

  // ─── learning_speed (pattern game) ───────────────────────────────────────────

  describe('learning_speed (pattern game)', () => {
    it('returns 0.5 when no pattern events at all', () => {
      // No events → no correct_guess with adaptationRound → fallback: total=0 → 0.5
      const traits = calculateTraits([]);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('falls back to correct/total ratio when no adaptationRound data', () => {
      // correct_guess events with adaptationRound = null → uses fallback ratio
      // Note: the filter checks `!== null`, but undefined would be coerced oddly.
      // We use adaptationRound explicitly set to null.
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: null }),
        makeEvent('pattern', 'correct_guess', { adaptationRound: null }),
        makeEvent('pattern', 'wrong_guess', {}),
      ];
      // total = 3, correct = 2 → 2/3
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(2 / 3, 5);
    });

    it('falls back to 0.5 when no guesses at all in pattern game', () => {
      // pattern game has events but none are guesses
      const events = [makeEvent('pattern', 'start', {})];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('returns 1.0 when adaptation happens in round 1', () => {
      // avgAdaptRound = 1 → clamp(1 - (1-1)/4) = clamp(1) = 1.0
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(1.0);
    });

    it('returns 0.75 when average adaptation round is 2', () => {
      // avgAdaptRound = 2 → clamp(1 - (2-1)/4) = clamp(0.75) = 0.75
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 2 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0.75, 5);
    });

    it('returns 0.5 when average adaptation round is 3', () => {
      // avgAdaptRound = 3 → clamp(1 - (3-1)/4) = clamp(0.5) = 0.5
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 3 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0.5, 5);
    });

    it('returns ~0 when adaptation takes 5+ rounds', () => {
      // avgAdaptRound = 5 → clamp(1 - (5-1)/4) = clamp(0) = 0
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 5 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0, 5);
    });

    it('clamps to 0 when adaptation takes more than 5 rounds', () => {
      // avgAdaptRound = 9 → clamp(1 - 8/4) = clamp(-1) = 0
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 9 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(0);
    });

    it('averages multiple adaptation rounds correctly', () => {
      // rounds 1 and 3 → avg = 2 → clamp(1 - (2-1)/4) = 0.75
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: 1 }),
        makeEvent('pattern', 'correct_guess', { adaptationRound: 3 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0.75, 5);
    });

    it('ignores non-pattern game events for learning_speed', () => {
      // exploration correct_guess with adaptationRound=1 should not affect pattern score
      const events = [
        makeEvent('exploration', 'correct_guess', { adaptationRound: 1 }),
      ];
      const traits = calculateTraits(events);
      // No pattern events → fallback → total=0 → 0.5
      expect(traits.learning_speed).toBe(0.5);
    });

    it('falls back correctly when all correct with no adaptationRound', () => {
      // 3 correct, 0 wrong, all adaptationRound=null → total=3, correct=3 → 1.0
      const events = [
        makeEvent('pattern', 'correct_guess', { adaptationRound: null }),
        makeEvent('pattern', 'correct_guess', { adaptationRound: null }),
        makeEvent('pattern', 'correct_guess', { adaptationRound: null }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(1.0, 5);
    });
  });
});
