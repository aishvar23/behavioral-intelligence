import { calculateTraits, TrialRecord } from './traitEngine';

function makeTrial(gameId: string, overrides: Partial<TrialRecord> = {}): TrialRecord {
  return {
    game_id: gameId,
    game_variant: null,
    trial_index: 0,
    difficulty: 'medium',
    stimulus: {},
    response: {},
    is_correct: true,
    response_error: 0,
    response_time_ms: 1000,
    timeout_extended: false,
    skipped: false,
    ...overrides,
  };
}

describe('calculateTraits', () => {
  // ─── curiosity (rule-discovery game) ─────────────────────────────────────────

  describe('curiosity (black_box game)', () => {
    it('returns 0.5 when no black_box trials', () => {
      const traits = calculateTraits([]);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 0.5 when all black_box trials are skipped', () => {
      const traits = calculateTraits([makeTrial('black_box', { skipped: true })]);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 1.0 when 5 inputs tested', () => {
      // avgTests=5 → clamp(0.2 + (5-1)/4 * 0.8) = 1.0
      const traits = calculateTraits([
        makeTrial('black_box', { response: { inputs_tested: [1, 2, 3, 4, 5] } }),
      ]);
      expect(traits.curiosity).toBe(1.0);
    });

    it('clamps to 1.0 when more than 5 inputs tested', () => {
      // avgTests=8 → clamp(0.2 + 7/4 * 0.8) = clamp(1.6) = 1.0
      const traits = calculateTraits([
        makeTrial('black_box', { response: { inputs_tested: [1, 2, 3, 4, 5, 6, 7, 8] } }),
      ]);
      expect(traits.curiosity).toBe(1.0);
    });

    it('returns 0.2 (minimum) when 1 input tested', () => {
      // avgTests=1 → clamp(0.2 + 0) = 0.2
      const traits = calculateTraits([
        makeTrial('black_box', { response: { inputs_tested: [1] } }),
      ]);
      expect(traits.curiosity).toBeCloseTo(0.2, 5);
    });

    it('scales linearly: 3 inputs tested → 0.6', () => {
      // avgTests=3 → clamp(0.2 + (3-1)/4 * 0.8) = 0.6
      const traits = calculateTraits([
        makeTrial('black_box', { response: { inputs_tested: [1, 2, 3] } }),
      ]);
      expect(traits.curiosity).toBeCloseTo(0.6, 5);
    });

    it('averages inputs_tested across multiple trials', () => {
      // Trial1: 5 inputs, Trial2: 1 input → avgTests=3 → 0.6
      const traits = calculateTraits([
        makeTrial('black_box', { response: { inputs_tested: [1, 2, 3, 4, 5] } }),
        makeTrial('black_box', { response: { inputs_tested: [1] } }),
      ]);
      expect(traits.curiosity).toBeCloseTo(0.6, 5);
    });

    it('ignores non-black_box game trials', () => {
      const traits = calculateTraits([makeTrial('logic_deduction')]);
      expect(traits.curiosity).toBe(0.5);
    });
  });

  // ─── persistence (logic / reaction / planning games) ─────────────────────────

  describe('persistence (logic/reaction/planning games)', () => {
    it('returns 0.5 when no logic/reaction/planning trials', () => {
      const traits = calculateTraits([]);
      expect(traits.persistence).toBe(0.5);
    });

    it('returns 1.0 when all 7 logic trials answered correctly', () => {
      // clamp(7/7 * 0.6 + 1.0 * 0.4) = 1.0
      const trials = Array.from({ length: 7 }, () =>
        makeTrial('logic_deduction', { is_correct: true })
      );
      const traits = calculateTraits(trials);
      expect(traits.persistence).toBe(1.0);
    });

    it('scales with number of logic trials attempted', () => {
      // 3/7 completion, all correct → clamp(3/7 * 0.6 + 1.0 * 0.4) ≈ 0.657
      const trials = Array.from({ length: 3 }, () =>
        makeTrial('logic_deduction', { is_correct: true })
      );
      const traits = calculateTraits(trials);
      expect(traits.persistence).toBeCloseTo(3 / 7 * 0.6 + 1.0 * 0.4, 5);
    });

    it('returns 1.0 when all 10 reaction trials answered correctly', () => {
      // clamp(10/10 * 0.6 + 1.0 * 0.4) = 1.0
      const trials = Array.from({ length: 10 }, () =>
        makeTrial('reaction_basic', { is_correct: true })
      );
      const traits = calculateTraits(trials);
      expect(traits.persistence).toBe(1.0);
    });

    it('ignores unrelated game trials for persistence', () => {
      const traits = calculateTraits([makeTrial('dot_estimation', { is_correct: true })]);
      expect(traits.persistence).toBe(0.5);
    });
  });

  // ─── risk_tolerance (reaction inhibition game) ────────────────────────────────

  describe('risk_tolerance (reaction inhibition game)', () => {
    it('returns 0.5 when no reaction trials', () => {
      const traits = calculateTraits([]);
      expect(traits.risk_tolerance).toBe(0.5);
    });

    it('returns 0.5 when reaction trials exist but none are nogo stimuli', () => {
      // nogoTrials.length=0 → risk_tolerance=null → defaults to 0.5
      const traits = calculateTraits([
        makeTrial('reaction_basic', { stimulus: { stimulus_type: 'go' } }),
      ]);
      expect(traits.risk_tolerance).toBe(0.5);
    });

    it('returns 1.0 when all nogo stimuli incorrectly responded to (maximum impulsivity)', () => {
      // all nogo incorrect → impulsivity=1.0 → clamp(0.3 + 0.7) = 1.0
      const traits = calculateTraits([
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: false }),
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: false }),
      ]);
      expect(traits.risk_tolerance).toBe(1.0);
    });

    it('returns 0.3 when all nogo stimuli correctly inhibited (minimum)', () => {
      // all nogo correct → impulsivity=0 → clamp(0.3 + 0) = 0.3
      const traits = calculateTraits([
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: true }),
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: true }),
      ]);
      expect(traits.risk_tolerance).toBeCloseTo(0.3, 5);
    });

    it('scales linearly with nogo error rate', () => {
      // 1 of 2 nogo incorrect → impulsivity=0.5 → clamp(0.3 + 0.35) = 0.65
      const traits = calculateTraits([
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: false }),
        makeTrial('reaction_inhibition', { stimulus: { stimulus_type: 'nogo' }, is_correct: true }),
      ]);
      expect(traits.risk_tolerance).toBeCloseTo(0.65, 5);
    });

    it('ignores non-reaction game trials for risk_tolerance', () => {
      const traits = calculateTraits([
        makeTrial('logic_deduction', { stimulus: { stimulus_type: 'nogo' }, is_correct: false }),
      ]);
      expect(traits.risk_tolerance).toBe(0.5);
    });
  });

  // ─── learning_speed (black_box / memory games) ────────────────────────────────

  describe('learning_speed (black_box / memory games)', () => {
    it('returns 0.5 when no rule-discovery or memory trials', () => {
      const traits = calculateTraits([]);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('returns 0.5 when all black_box trials are skipped', () => {
      const traits = calculateTraits([makeTrial('black_box', { skipped: true })]);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('returns 1.0 when correct trial with 1 input tested', () => {
      // acc=1.0, avgTests=1 → efficiency=clamp(1-(1-1)/5)=1.0 → clamp(1.0*0.6 + 1.0*0.4)=1.0
      const traits = calculateTraits([
        makeTrial('black_box', { is_correct: true, response: { inputs_tested: [1] } }),
      ]);
      expect(traits.learning_speed).toBe(1.0);
    });

    it('returns 0.6 when correct trial with 6 inputs tested (zero efficiency)', () => {
      // acc=1.0, avgTests=6 → efficiency=clamp(1-5/5)=0 → clamp(1.0*0.6 + 0*0.4)=0.6
      const traits = calculateTraits([
        makeTrial('black_box', { is_correct: true, response: { inputs_tested: [1, 2, 3, 4, 5, 6] } }),
      ]);
      expect(traits.learning_speed).toBeCloseTo(0.6, 5);
    });

    it('returns 0.4 when wrong trial with only 1 input tested', () => {
      // acc=0, efficiency=1.0 → clamp(0*0.6 + 1.0*0.4)=0.4
      const traits = calculateTraits([
        makeTrial('black_box', { is_correct: false, response: { inputs_tested: [1] } }),
      ]);
      expect(traits.learning_speed).toBeCloseTo(0.4, 5);
    });

    it('averages learning across multiple trials', () => {
      // T1: correct 1 test, T2: wrong 6 tests → acc=0.5, avgTests=3.5
      // efficiency=clamp(1-2.5/5)=0.5 → clamp(0.5*0.6 + 0.5*0.4)=0.5
      const traits = calculateTraits([
        makeTrial('black_box', { is_correct: true, response: { inputs_tested: [1] } }),
        makeTrial('black_box', { is_correct: false, response: { inputs_tested: [1, 2, 3, 4, 5, 6] } }),
      ]);
      expect(traits.learning_speed).toBeCloseTo(0.5, 5);
    });

    it('ignores non-black_box/memory game trials for learning_speed', () => {
      const traits = calculateTraits([
        makeTrial('logic_deduction', { is_correct: true, response: { inputs_tested: [1] } }),
      ]);
      expect(traits.learning_speed).toBe(0.5);
    });
  });
});
