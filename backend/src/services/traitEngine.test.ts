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

  describe('curiosity (black_box game)', () => {
    it('returns 0.5 when no black_box events', () => {
      const traits = calculateTraits([]);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 0.5 when black_box events exist but no prediction_submitted', () => {
      // No rounds → rounds=0 → returns 0.5
      const events = [makeEvent('black_box', 'input_tested', {})];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(0.5);
    });

    it('returns 1.0 when 5+ tests per round', () => {
      // avgTestsPerRound=5 → clamp(0.2 + (5-1)/4 * 0.8) = clamp(1.0) = 1.0
      const events = [
        ...Array.from({ length: 5 }, () => makeEvent('black_box', 'input_tested', {})),
        makeEvent('black_box', 'prediction_submitted', { round: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(1.0);
    });

    it('clamps to 1.0 when more than 5 tests per round', () => {
      // avgTestsPerRound=8 → clamp(0.2 + (8-1)/4 * 0.8) = clamp(1.6) = 1.0
      const events = [
        ...Array.from({ length: 8 }, () => makeEvent('black_box', 'input_tested', {})),
        makeEvent('black_box', 'prediction_submitted', { round: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(1.0);
    });

    it('returns 0.2 (minimum) when 1 test per round', () => {
      // avgTestsPerRound=1 → clamp(0.2 + 0) = 0.2
      const events = [
        makeEvent('black_box', 'input_tested', {}),
        makeEvent('black_box', 'prediction_submitted', { round: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBeCloseTo(0.2, 5);
    });

    it('scales linearly: 3 tests per round → 0.6', () => {
      // avgTestsPerRound=3 → clamp(0.2 + (3-1)/4 * 0.8) = clamp(0.6) = 0.6
      const events = [
        ...Array.from({ length: 3 }, () => makeEvent('black_box', 'input_tested', {})),
        makeEvent('black_box', 'prediction_submitted', { round: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBeCloseTo(0.6, 5);
    });

    it('averages tests across multiple rounds', () => {
      // Round 1: 5 tests, Round 2: 1 test → avg=3 → 0.6
      const events = [
        ...Array.from({ length: 5 }, () => makeEvent('black_box', 'input_tested', {})),
        makeEvent('black_box', 'prediction_submitted', { round: 1 }),
        makeEvent('black_box', 'input_tested', {}),
        makeEvent('black_box', 'prediction_submitted', { round: 2 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBeCloseTo(0.6, 5);
    });

    it('ignores non-black_box game events', () => {
      const events = [makeEvent('logic_deduction', 'input_tested', {})];
      const traits = calculateTraits(events);
      expect(traits.curiosity).toBe(0.5);
    });
  });

  // ─── persistence (logic / reaction / planning games) ─────────────────────────

  describe('persistence (logic/reaction/planning games)', () => {
    it('returns 0.5 when no logic/reaction/planning events', () => {
      const traits = calculateTraits([]);
      expect(traits.persistence).toBe(0.5);
    });

    it('returns 1.0 when all 7 logic questions answered correctly', () => {
      // clamp(7/7 * 0.6 + 1.0 * 0.4) = 1.0
      const events = Array.from({ length: 7 }, () =>
        makeEvent('logic_deduction', 'question_answer', { correct: true })
      );
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(1.0);
    });

    it('scales with number of logic answers attempted', () => {
      // 3 correct out of 3, but only 3/7 completion → clamp(3/7 * 0.6 + 1.0 * 0.4) ≈ 0.657
      const events = Array.from({ length: 3 }, () =>
        makeEvent('logic_deduction', 'question_answer', { correct: true })
      );
      const traits = calculateTraits(events);
      expect(traits.persistence).toBeCloseTo(3 / 7 * 0.6 + 1.0 * 0.4, 5);
    });

    it('returns 1.0 when all 10 reaction stimuli answered correctly', () => {
      // clamp(10/10 * 0.6 + 1.0 * 0.4) = 1.0
      const events = Array.from({ length: 10 }, () =>
        makeEvent('reaction_basic', 'stimulus_response', { correct: true })
      );
      const traits = calculateTraits(events);
      expect(traits.persistence).toBe(1.0);
    });

    it('ignores unrelated game events for persistence', () => {
      const events = [makeEvent('dot_estimation', 'group_selected', { correct: true })];
      const traits = calculateTraits(events);
      // No logic/reaction/planning → persistence defaults to 0.5
      expect(traits.persistence).toBe(0.5);
    });
  });

  // ─── risk_tolerance (reaction inhibition game) ────────────────────────────────

  describe('risk_tolerance (reaction inhibition game)', () => {
    it('returns 0.5 when no reaction events', () => {
      const traits = calculateTraits([]);
      expect(traits.risk_tolerance).toBe(0.5);
    });

    it('returns 0.4 when reaction events exist but none are nogo stimuli', () => {
      // calcRiskFromReaction: nogoEvents=0 → returns 0.4
      const events = [makeEvent('reaction_basic', 'stimulus_response', { stimulusType: 'go', responded: true })];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBeCloseTo(0.4, 5);
    });

    it('returns 1.0 when all nogo stimuli are responded to (maximum impulsivity)', () => {
      // impulsivity=1.0 → clamp(0.3 + 0.7) = 1.0
      const events = [
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: true }),
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: true }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(1.0);
    });

    it('returns 0.3 when no nogo stimuli are responded to (minimum)', () => {
      // impulsivity=0 → clamp(0.3 + 0) = 0.3
      const events = [
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: false }),
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: false }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBeCloseTo(0.3, 5);
    });

    it('scales linearly with nogo response rate', () => {
      // 1 of 2 nogo responded → impulsivity=0.5 → clamp(0.3 + 0.35) = 0.65
      const events = [
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: true }),
        makeEvent('reaction_inhibition', 'stimulus_response', { stimulusType: 'nogo', responded: false }),
      ];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBeCloseTo(0.65, 5);
    });

    it('ignores non-reaction game events for risk_tolerance', () => {
      const events = [makeEvent('logic_deduction', 'stimulus_response', { stimulusType: 'nogo', responded: true })];
      const traits = calculateTraits(events);
      expect(traits.risk_tolerance).toBe(0.5);
    });
  });

  // ─── learning_speed (black_box / memory games) ────────────────────────────────

  describe('learning_speed (black_box / memory games)', () => {
    it('returns 0.5 when no rule-discovery or memory events', () => {
      const traits = calculateTraits([]);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('returns 0.5 when black_box events exist but no prediction_submitted', () => {
      const events = [makeEvent('black_box', 'input_tested', {})];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('returns 1.0 when correct prediction with 1 test used', () => {
      // accuracy=1.0, avgTests=1 → efficiencyScore=clamp(1-(1-1)/5)=1.0
      // clamp(1.0*0.6 + 1.0*0.4) = 1.0
      const events = [
        makeEvent('black_box', 'prediction_submitted', { correct: true, testsUsed: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(1.0);
    });

    it('returns 0.6 when correct prediction but used 6 tests (max tests = no efficiency)', () => {
      // accuracy=1.0, efficiencyScore=clamp(1-(6-1)/5)=0 → clamp(1.0*0.6 + 0*0.4) = 0.6
      const events = [
        makeEvent('black_box', 'prediction_submitted', { correct: true, testsUsed: 6 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0.6, 5);
    });

    it('returns 0.4 when wrong prediction but only 1 test used', () => {
      // accuracy=0, efficiencyScore=1.0 → clamp(0*0.6 + 1.0*0.4) = 0.4
      const events = [
        makeEvent('black_box', 'prediction_submitted', { correct: false, testsUsed: 1 }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBeCloseTo(0.4, 5);
    });

    it('skips timedOut predictions', () => {
      // only timed-out prediction → no valid predictions → returns 0.5
      const events = [
        makeEvent('black_box', 'prediction_submitted', { correct: true, testsUsed: 1, timedOut: true }),
      ];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(0.5);
    });

    it('averages learning across multiple predictions', () => {
      // P1: correct, 1 test → score 1.0; P2: wrong, 6 tests → score 0.0
      // average = 0.5
      const events = [
        makeEvent('black_box', 'prediction_submitted', { correct: true, testsUsed: 1 }),
        makeEvent('black_box', 'prediction_submitted', { correct: false, testsUsed: 6 }),
      ];
      const traits = calculateTraits(events);
      // accuracy=0.5, avgTests=3.5, efficiencyScore=clamp(1-2.5/5)=0.5 → clamp(0.5*0.6+0.5*0.4)=0.5
      expect(traits.learning_speed).toBeCloseTo(0.5, 5);
    });

    it('ignores non-black_box/memory game events for learning_speed', () => {
      const events = [makeEvent('logic_deduction', 'prediction_submitted', { correct: true, testsUsed: 1 })];
      const traits = calculateTraits(events);
      expect(traits.learning_speed).toBe(0.5);
    });
  });
});
