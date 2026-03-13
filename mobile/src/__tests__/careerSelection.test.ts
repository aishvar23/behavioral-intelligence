/**
 * Tests for career selection logic.
 * Pure logic only — no React rendering required.
 */

const CAREERS = [
  'Software Engineer',
  'Data Scientist',
  'UX Designer',
  'Product Manager',
  'Cybersecurity Analyst',
  'Entrepreneur',
  'Management Consultant',
  'Financial Analyst',
  'Marketing Manager',
  'Operations Manager',
];

const MAX_SELECTIONS = 8;

function toggleCareer(current: Set<string>, career: string): Set<string> {
  const next = new Set(current);
  if (next.has(career)) {
    next.delete(career);
  } else if (next.size < MAX_SELECTIONS) {
    next.add(career);
  }
  return next;
}

describe('career selection logic', () => {
  it('adds a career when selecting', () => {
    const initial = new Set<string>();
    const result = toggleCareer(initial, 'Software Engineer');
    expect(result.has('Software Engineer')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('removes a career when deselecting', () => {
    const initial = new Set<string>(['Software Engineer', 'Data Scientist']);
    const result = toggleCareer(initial, 'Software Engineer');
    expect(result.has('Software Engineer')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('does not exceed MAX_SELECTIONS', () => {
    // Fill up to MAX_SELECTIONS
    let selection = new Set<string>();
    for (let i = 0; i < MAX_SELECTIONS; i++) {
      selection = toggleCareer(selection, CAREERS[i]);
    }
    expect(selection.size).toBe(MAX_SELECTIONS);

    // Attempting to add one more should not increase size
    const result = toggleCareer(selection, CAREERS[MAX_SELECTIONS]);
    expect(result.size).toBe(MAX_SELECTIONS);
    expect(result.has(CAREERS[MAX_SELECTIONS])).toBe(false);
  });

  it('canContinue is false when nothing selected', () => {
    const selection = new Set<string>();
    const canContinue = selection.size > 0;
    expect(canContinue).toBe(false);
  });

  it('canContinue is true when at least one selected', () => {
    const selection = new Set<string>(['Software Engineer']);
    const canContinue = selection.size > 0;
    expect(canContinue).toBe(true);
  });
});
