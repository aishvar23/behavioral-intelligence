/**
 * Game Library — G0* Game Definitions
 *
 * Architecture: Game is the primary entity. Each G0* entry owns:
 *   - traitId mapping (1:1 — each game measures exactly one trait)
 *   - gameEngine key (used by LevelGameScreen dispatcher)
 *   - KPIs (game-specific metrics beyond universal targetAccuracy/eliteLatencyMs)
 *   - pilotFloor (profession-specific pass threshold)
 *   - validatedBy (which trait's score cross-validates this game's output)
 *
 * targetAccuracy and eliteLatencyMs are NOT stored here — they are universal
 * standards that live on each LevelConfig in traitCatalog.ts.
 */

export interface GameKPI {
  key: string;
  label: string;
  description: string;
  unit: string;
}

export interface PilotFloor {
  minLevel: number;
  [metric: string]: number | string;
}

export interface GameValidation {
  traitId: string;
  rule: string;
  flagLabel: string;
}

export interface GameDefinition {
  id: string;               // 'G06'
  name: string;             // 'Nav-Link'
  traitId: string;          // 'T12' — the trait this game measures
  gameEngine: string;       // dispatcher key in LevelGameScreen
  description: string;
  scalingAxes: string[];    // human-readable scaling description per axis
  kpis: GameKPI[];
  pilotFloor: PilotFloor;
  validatedBy: GameValidation;
}

export const GAME_LIBRARY: Record<string, GameDefinition> = {

  G06: {
    id: 'G06',
    name: 'Nav-Link',
    traitId: 'T12',
    gameEngine: 'nav_link',
    description: 'Satellite-to-Ground data routing via tap-link. Establish and maintain the optimal data path as nodes orbit, degrade, and brown out.',
    scalingAxes: [
      'Node count: 3 static → 12+ orbiting nodes',
      'Signal Decay: flat → distance-penalised link strength',
      'Bandwidth Caps: unlimited → per-node throughput limits',
      'Station Brown-outs: none → rapid offline/online cycling',
    ],
    kpis: [
      { key: 'pathEfficiency', label: 'Path Efficiency',  description: 'Optimal hops ÷ actual hops used', unit: '%' },
      { key: 'uptimePct',      label: '% Uptime',         description: 'Time with valid Source→Ground path / total time', unit: '%' },
      { key: 'mttrMs',         label: 'MTTR',             description: 'Mean time from brown-out to re-established path', unit: 'ms' },
    ],
    pilotFloor: { minLevel: 9, minUptimePct: 0.95, note: '>95% Uptime under orbital flux' },
    validatedBy: {
      traitId: 'T11',
      rule: 'Low path-efficiency with high completion rate',
      flagLabel: 'Trial-and-Error Router',
    },
  },

  G07: {
    id: 'G07',
    name: 'Signal Sift',
    traitId: 'T19',
    gameEngine: 'signal_sift',
    description: '8-track scrolling bar-waveform monitor. Tap Spikes and Phase-shifts before they scroll off screen.',
    scalingAxes: [
      'Track count: 1 high-contrast track → 8 simultaneous tracks',
      'Visual Snow: clean signal → random noise bars throughout',
      'Phase Shifts: none → timing-based pattern inversions',
      'Contrast: high-contrast spikes → subtle amplitude deviations',
    ],
    kpis: [
      { key: 'hitRate',                  label: 'Hit Rate',                  description: 'Anomalies correctly tapped ÷ total anomalies', unit: '%' },
      { key: 'falseAlarmPct',            label: 'False Alarm %',             description: 'Incorrect taps ÷ total taps', unit: '%' },
      { key: 'peripheralDetectionRate',  label: 'Peripheral Detection',      description: 'Hit rate on tracks 5–8 vs 1–4', unit: '%' },
    ],
    pilotFloor: { minLevel: 10, maxFalseAlarmPct: 0.04, note: '<4% False Alarm Rate at 8-track density' },
    validatedBy: {
      traitId: 'T20',
      rule: 'Hit rate in final 60s significantly below first 60s',
      flagLabel: 'Sprint Detector',
    },
  },

  G08: {
    id: 'G08',
    name: 'Hold-Short',
    traitId: 'T04',
    gameEngine: 'hold_short',
    description: 'Runway intersection controller. Toggle Hold or Proceed for each inbound aircraft — zero collisions, optimal throughput.',
    scalingAxes: [
      'Aircraft count: 2 clear-visibility → 12 simultaneous planes',
      'Mayday Interrupts: none → random emergency aircraft (must always proceed)',
      'Low-Vis Fog: clear → near-zero visibility with proximity-only alerts',
      'Approach speed: slow → rapid multi-plane convergence',
    ],
    kpis: [
      { key: 'safetyViolations',     label: 'Safety Violations',     description: 'Near-miss or collision events', unit: 'count' },
      { key: 'triageAccuracy',       label: 'Triage Accuracy',        description: '% of optimal Hold/Proceed decisions', unit: '%' },
      { key: 'stressRecoveryMs',     label: 'Stress Recovery',        description: 'Latency from Mayday event to restored accuracy', unit: 'ms' },
    ],
    pilotFloor: { minLevel: 9, maxViolations: 0, note: 'Zero collisions; Level 9+ Triage during Fog' },
    validatedBy: {
      traitId: 'T01',
      rule: 'Triage accuracy collapses during Mayday interrupts',
      flagLabel: 'Command Logic Failure',
    },
  },

  G09: {
    id: 'G09',
    name: 'Radar Sweep',
    traitId: 'T06',
    gameEngine: 'radar_sweep',
    description: 'Circular radar display. Contacts blink as the sweep passes each position. Tap them in REVERSE order. Decoys and 90° mental rotation at elite levels.',
    scalingAxes: [
      'Contact count: 3 → 8 items per round',
      'Field width: 180° (half-circle) → 360° (full radar)',
      'Decoy blinks: none → 1-2 false contacts per round',
      'Mental Rotation: none → radar rotates 90° before input phase',
    ],
    kpis: [
      { key: 'maxReverseSpan',        label: 'Max Reverse Span',        description: 'Highest N contacts correctly recalled in full reverse order', unit: 'items' },
      { key: 'spatialErrorDeg',       label: 'Spatial Error Margin',    description: 'Mean angular error (degrees) from correct contact position', unit: '°' },
      { key: 'interferenceResistance', label: 'Interference Resistance', description: 'Accuracy on decoy rounds vs clean rounds', unit: 'delta' },
    ],
    pilotFloor: { minLevel: 8, minReverseSpan: 6, note: '6+ Reverse Span; <15° rotation error at Level 10' },
    validatedBy: {
      traitId: 'T12',
      rule: 'High angular recall but fails mental rotation — Spatial Rotation failure vs Rote Sequence success',
      flagLabel: 'Spatial Rotation Deficit',
    },
  },

  G10: {
    id: 'G10',
    name: 'Vector Flow',
    traitId: 'T21',
    gameEngine: 'vector_flow',
    description: 'Mach-speed classification tunnel. Objects rush toward you — classify Mechanical vs Biological before they pass. Rule-flips swap L/R every 10s.',
    scalingAxes: [
      'Speed: slow approach → Mach-speed (sub-250ms window)',
      'Class count: 2 classes → 4 sub-classes',
      'Tunnel Rotation: static → slowly rotating barrel',
      'Rule Flips: none → L/R swap every 10s',
    ],
    kpis: [
      { key: 'mrt',            label: 'MRT',             description: 'Mean Reaction Time from object appearance to tap', unit: 'ms' },
      { key: 'accuracy',       label: 'Accuracy',        description: '% of correctly classified objects', unit: '%' },
      { key: 'switchingCost',  label: 'Switching Cost',  description: 'RT spike (ms) immediately after a rule flip', unit: 'ms' },
    ],
    pilotFloor: { minLevel: 9, maxMrtMs: 250, minAccuracy: 0.90, note: '<250ms MRT; >90% Accuracy at Mach Speed' },
    validatedBy: {
      traitId: 'T01',
      rule: 'MRT < 250ms but accuracy < 80%',
      flagLabel: 'Overclocked',
    },
  },
};

/** Lookup a game definition by trait ID */
export function getGameByTrait(traitId: string): GameDefinition | undefined {
  return Object.values(GAME_LIBRARY).find(g => g.traitId === traitId);
}
