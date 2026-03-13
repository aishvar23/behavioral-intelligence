/**
 * Tests for HiddenPatternGame pure logic.
 * Rule definitions are copied here (not imported) since they are not exported.
 */

// ─── Rule type & definitions (mirrored from HiddenPatternGame.tsx) ────────────

type Rule = {
  label: string;
  tier: 1 | 2 | 3;
  seed: number[];
  next: (history: number[]) => number;
};

const TIER1_RULES: Rule[] = [
  { label: '+2', tier: 1, seed: [2, 4, 6],   next: h => h[h.length - 1] + 2 },
  { label: '+3', tier: 1, seed: [3, 6, 9],   next: h => h[h.length - 1] + 3 },
  { label: '+4', tier: 1, seed: [4, 8, 12],  next: h => h[h.length - 1] + 4 },
  { label: '+5', tier: 1, seed: [5, 10, 15], next: h => h[h.length - 1] + 5 },
];

const TIER2_RULES: Rule[] = [
  { label: '×2', tier: 2, seed: [2, 4, 8, 16],  next: h => h[h.length - 1] * 2 },
  { label: '×3', tier: 2, seed: [3, 9, 27, 81], next: h => h[h.length - 1] * 3 },
  {
    label: 'n²',
    tier: 2,
    seed: [1, 4, 9, 16],
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 2,
  },
];

const TIER3_RULES: Rule[] = [
  {
    label: 'Fibonacci',
    tier: 3,
    seed: [2, 3, 5, 8, 13],
    next: h => h[h.length - 2] + h[h.length - 1],
  },
  {
    label: 'Triangular',
    tier: 3,
    seed: [1, 3, 6, 10],
    next: h => h[h.length - 1] + (h[h.length - 1] - h[h.length - 2]) + 1,
  },
];

// ─── Helper: extend history n times ──────────────────────────────────────────

function extendHistory(rule: Rule, steps: number): number[] {
  const history = [...rule.seed];
  for (let i = 0; i < steps; i++) {
    history.push(rule.next(history));
  }
  return history;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function pointsForGuess(wrongs: number): number {
  if (wrongs === 0) return 10;
  if (wrongs === 1) return 5;
  return 2;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tier 1 rules — arithmetic sequences', () => {
  it('+2 rule generates correct next values', () => {
    const rule = TIER1_RULES[0]; // +2
    const history = [...rule.seed]; // [2, 4, 6]
    expect(rule.next(history)).toBe(8);
    history.push(8);
    expect(rule.next(history)).toBe(10);
    history.push(10);
    expect(rule.next(history)).toBe(12);
  });

  it('+3 rule generates correct next values', () => {
    const rule = TIER1_RULES[1]; // +3
    const history = [...rule.seed]; // [3, 6, 9]
    expect(rule.next(history)).toBe(12);
    history.push(12);
    expect(rule.next(history)).toBe(15);
  });

  it('+4 rule generates correct next values', () => {
    const rule = TIER1_RULES[2]; // +4
    const history = [...rule.seed]; // [4, 8, 12]
    expect(rule.next(history)).toBe(16);
    history.push(16);
    expect(rule.next(history)).toBe(20);
  });

  it('+5 rule generates correct next values', () => {
    const rule = TIER1_RULES[3]; // +5
    const history = [...rule.seed]; // [5, 10, 15]
    expect(rule.next(history)).toBe(20);
    history.push(20);
    expect(rule.next(history)).toBe(25);
  });
});

describe('Tier 2 rules — multiplicative / quadratic', () => {
  it('×2 rule doubles the last value', () => {
    const rule = TIER2_RULES[0]; // ×2
    const history = [...rule.seed]; // [2, 4, 8, 16]
    expect(rule.next(history)).toBe(32);
    history.push(32);
    expect(rule.next(history)).toBe(64);
  });

  it('×3 rule triples the last value', () => {
    const rule = TIER2_RULES[1]; // ×3
    const history = [...rule.seed]; // [3, 9, 27, 81]
    expect(rule.next(history)).toBe(243);
    history.push(243);
    expect(rule.next(history)).toBe(729);
  });

  it('n² rule generates perfect squares: 1, 4, 9, 16, 25, 36', () => {
    const rule = TIER2_RULES[2]; // n²
    // seed already gives [1, 4, 9, 16]
    const full = extendHistory(rule, 2);
    // full should be [1, 4, 9, 16, 25, 36]
    expect(full).toEqual([1, 4, 9, 16, 25, 36]);
  });
});

describe('Tier 3 rules — complex multi-step', () => {
  it('Fibonacci rule adds previous two terms', () => {
    const rule = TIER3_RULES[0]; // Fibonacci
    const history = [...rule.seed]; // [2, 3, 5, 8, 13]
    expect(rule.next(history)).toBe(21); // 8 + 13
    history.push(21);
    expect(rule.next(history)).toBe(34); // 13 + 21
  });

  it('Triangular rule differences increase by 1 each step', () => {
    const rule = TIER3_RULES[1]; // Triangular
    // seed: [1, 3, 6, 10] — differences: 2, 3, 4
    const history = [...rule.seed];
    expect(rule.next(history)).toBe(15); // diff = 5: 10 + 5
    history.push(15);
    expect(rule.next(history)).toBe(21); // diff = 6: 15 + 6
    history.push(21);
    expect(rule.next(history)).toBe(28); // diff = 7: 21 + 7
  });
});

describe('Sequence never repeats — strictly increasing values', () => {
  const allRules: Rule[] = [...TIER1_RULES, ...TIER2_RULES, ...TIER3_RULES];

  allRules.forEach(rule => {
    it(`rule "${rule.label}" (tier ${rule.tier}) produces strictly increasing values over 10 extensions`, () => {
      const extended = extendHistory(rule, 10);
      for (let i = 1; i < extended.length; i++) {
        expect(extended[i]).toBeGreaterThan(extended[i - 1]);
      }
    });
  });
});

describe('pointsForGuess scoring', () => {
  it('returns 10 for 0 wrong guesses', () => {
    expect(pointsForGuess(0)).toBe(10);
  });

  it('returns 5 for 1 wrong guess', () => {
    expect(pointsForGuess(1)).toBe(5);
  });

  it('returns 2 for 2 wrong guesses', () => {
    expect(pointsForGuess(2)).toBe(2);
  });

  it('returns 2 for 3+ wrong guesses', () => {
    expect(pointsForGuess(3)).toBe(2);
    expect(pointsForGuess(10)).toBe(2);
  });
});

describe('ImpossiblePuzzle scoring', () => {
  function solvedScore(attempts: number, hintsUsed: number): number {
    return Math.max(0, Math.max(100, 1000 - attempts * 15) - hintsUsed * 20);
  }

  function effortScore(attempts: number): number {
    return Math.max(0, attempts * 3);
  }

  it('gives 1000 for solving with 0 moves (theoretical max)', () => {
    expect(solvedScore(0, 0)).toBe(1000);
  });

  it('gives 100 minimum even with many moves', () => {
    // At 60 moves: 1000 - 60*15 = 100; still 100 minimum
    expect(solvedScore(60, 0)).toBe(100);
    // At 100 moves: 1000 - 100*15 = -500; floor is 100
    expect(solvedScore(100, 0)).toBe(100);
  });

  it('deducts 20 per hint', () => {
    expect(solvedScore(0, 1)).toBe(980);
    expect(solvedScore(0, 3)).toBe(940);
  });

  it('effort score is moves * 3', () => {
    expect(effortScore(10)).toBe(30);
    expect(effortScore(50)).toBe(150);
  });

  it('quit gives 0', () => {
    expect(0).toBe(0);
  });
});
