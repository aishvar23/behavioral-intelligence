/**
 * Trait Talk — Conflict Logic
 *
 * Validates pairs of trait scores against each other to detect psychological
 * inconsistencies that suggest the user gamed specific games, or reveals
 * a genuine cognitive archetype pattern.
 *
 * Returns flags (archetype modifiers) and a clean/flagged label per rule.
 */

export interface TraitScoreMap {
  [traitId: string]: number; // 0–100 per trait
}

export interface TraitTalkFlag {
  rule: string;           // e.g. "Risk vs. Logic"
  flag: string;           // e.g. "Impulsive Gambler"
  description: string;    // human-readable explanation
  traitA: string;         // first trait ID involved
  traitB: string;         // second trait ID involved
  severity: 'info' | 'warning' | 'caution';
}

export interface TraitTalkResult {
  flags: TraitTalkFlag[];
  archetypeModifiers: string[];     // short labels to show on Archetype Card
  validationPassed: boolean;        // true if no warning-level flags
}

// ── Conflict Rules ────────────────────────────────────────────────────────────

type ConflictRule = {
  name: string;
  traitA: string;
  traitB: string;
  check: (scoreA: number, scoreB: number) => TraitTalkFlag | null;
};

const CONFLICT_RULES: ConflictRule[] = [
  // Risk vs. Logic — high risk-taking without logic support = impulsive
  {
    name: 'Risk vs. Logic',
    traitA: 'T13', traitB: 'T11',
    check(risk, logic) {
      // Convert 0-100 to "steps" (0-10 scale) for the "2 steps higher" rule
      const riskStep  = risk  / 10;
      const logicStep = logic / 10;
      if (riskStep - logicStep > 2) {
        return {
          rule: 'Risk vs. Logic', flag: 'Impulsive Gambler',
          description: `Risk Management score (${Math.round(risk)}) is significantly higher than Deductive Logic (${Math.round(logic)}), suggesting decisions made before sufficient data is gathered.`,
          traitA: 'T13', traitB: 'T11', severity: 'warning',
        };
      }
      return null;
    },
  },

  // Speed vs. Accuracy — fast but imprecise = overclocked
  {
    name: 'Speed vs. Accuracy',
    traitA: 'T21', traitB: 'T01',
    check(speed, triage) {
      if (speed >= 75 && triage < 85) {
        return {
          rule: 'Speed vs. Accuracy', flag: 'Overclocked',
          description: `Processing Speed is high (${Math.round(speed)}) but Triage accuracy is below 85% (${Math.round(triage)}), indicating speed prioritised over correctness.`,
          traitA: 'T21', traitB: 'T01', severity: 'warning',
        };
      }
      return null;
    },
  },

  // Panic vs. Priority — stress degrades triage accuracy = stress-fragile
  // Spec: if high-priority accuracy drops >10% in Level 9 Meltdown vs earlier levels
  // We approximate via scores: if Triage avg drops significantly below Panic Management level
  {
    name: 'Panic vs. Priority',
    traitA: 'T04', traitB: 'T01',
    check(panic, triage) {
      // Stress-Fragile: if panic management is low AND triage is low, OR
      // if triage score drops well below panic score (indicating fair-weather triage only)
      const stressFragile  = panic < 50 && triage < 70;
      const fairWeather    = triage >= 70 && panic < triage - 15; // triage looks good but stress collapses it
      if (stressFragile || fairWeather) {
        const label = fairWeather ? 'Fair-Weather Triage' : 'Stress-Fragile';
        return {
          rule: 'Panic vs. Priority', flag: label,
          description: fairWeather
            ? `Triage score is solid (${Math.round(triage)}) but Panic Management is significantly lower (${Math.round(panic)}), suggesting priority accuracy will degrade during the Meltdown phase when conditions deteriorate.`
            : `Both Panic Management (${Math.round(panic)}) and Triage (${Math.round(triage)}) are low, indicating accuracy collapses under high-speed chaos conditions — a Stress-Fragile profile.`,
          traitA: 'T04', traitB: 'T01', severity: 'warning',
        };
      }
      return null;
    },
  },

  // Social vs. Empathy — high social inference with low empathy = social analyst
  {
    name: 'Social vs. Empathy',
    traitA: 'T15', traitB: 'T16',
    check(social, empathy) {
      if (social >= 70 && empathy < 50) {
        return {
          rule: 'Social vs. Empathy', flag: 'Social Analyst',
          description: `High Social Inference (${Math.round(social)}) combined with lower Affective Empathy (${Math.round(empathy)}) indicates a cognitive, analytical approach to social reading rather than an emotional one.`,
          traitA: 'T15', traitB: 'T16', severity: 'info',
        };
      }
      return null;
    },
  },

  // Memory vs. Systems — recall without connection = short-term thinker
  {
    name: 'Memory vs. Systems',
    traitA: 'T06', traitB: 'T12',
    check(memory, systems) {
      if (memory >= 70 && systems < 50) {
        return {
          rule: 'Memory vs. Systems', flag: 'Short-Term Thinker',
          description: `Working Memory is strong (${Math.round(memory)}) but Systems Thinking is low (${Math.round(systems)}), suggesting items can be recalled but not connected into dependency maps.`,
          traitA: 'T06', traitB: 'T12', severity: 'caution',
        };
      }
      return null;
    },
  },

  // Vigilance vs. Endurance — detection drops over time = sprint detector
  {
    name: 'Vigilance vs. Endurance',
    traitA: 'T19', traitB: 'T20',
    check(anomaly, sustained) {
      if (anomaly >= 70 && sustained < 55) {
        return {
          rule: 'Vigilance vs. Endurance', flag: 'Sprint Detector',
          description: `Anomaly Detection score is solid (${Math.round(anomaly)}) but Sustained Attention is low (${Math.round(sustained)}), suggesting detection degrades significantly over extended tasks.`,
          traitA: 'T19', traitB: 'T20', severity: 'caution',
        };
      }
      return null;
    },
  },

  // Creativity vs. Rules — many ideas but low logic = chaotic creative
  {
    name: 'Creativity vs. Rules',
    traitA: 'T23', traitB: 'T11',
    check(fluency, logic) {
      if (fluency >= 70 && logic < 50) {
        return {
          rule: 'Creativity vs. Rules', flag: 'Chaotic Creative',
          description: `Ideational Fluency is high (${Math.round(fluency)}) but Deductive Logic is low (${Math.round(logic)}), suggesting ideas are generated rapidly but often violate logical constraints.`,
          traitA: 'T23', traitB: 'T11', severity: 'caution',
        };
      }
      return null;
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function runTraitTalk(scores: TraitScoreMap): TraitTalkResult {
  const flags: TraitTalkFlag[] = [];

  for (const rule of CONFLICT_RULES) {
    const scoreA = scores[rule.traitA];
    const scoreB = scores[rule.traitB];
    // Only run the rule if both traits were assessed
    if (scoreA === undefined || scoreB === undefined) continue;
    const flag = rule.check(scoreA, scoreB);
    if (flag) flags.push(flag);
  }

  const archetypeModifiers = flags.map(f => f.flag);
  const validationPassed   = !flags.some(f => f.severity === 'warning');

  return { flags, archetypeModifiers, validationPassed };
}
