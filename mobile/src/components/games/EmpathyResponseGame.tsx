/**
 * Empathy Response Game — Affective Empathy (T16)
 *
 * Emergency Response Coordinator metaphor.
 * User chooses responses to crew members in emotional distress.
 * Measures resonance, distress tolerance, and mission/emotion balance.
 *
 * Metrics:
 *   supportAccuracy     — % of responses that de-escalate (50pts)
 *   contagionPenalty    — RT slowdown on distress vs neutral scenarios (30pts)
 *   boundariesScore     — avoids over-apologetic / mission-abandoning responses (20pts)
 *
 * Level 10 (dualGame=true):
 *   Bottom 25% of screen: TheReactorGame in compact mode runs concurrently.
 *   Gatekeeper: if reactor miss rate exceeds 0.5 during any answer → score capped at 40.
 *   Degradation: accuracy drop vs config.baselineAccuracy → up to 20pt penalty.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import TheReactorGame from './TheReactorGame';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

type ResponseType = 'balance' | 'support' | 'mission' | 'apologetic' | 'avoidant';

interface EmpathyOption {
  text: string;
  type: ResponseType;
  deEscalates: boolean;
  /** true = over-apologetic or abandons mission — boundary violation */
  boundaryViolation: boolean;
}

interface EmpathyScenario {
  id: string;
  context: string;
  character: string;
  distressStatement: string;
  distressLevel: 'neutral' | 'low' | 'medium' | 'high' | 'extreme';
  options: EmpathyOption[];
}

interface EmpathyConfig {
  level: number;
  scenarioCount: number;
  timePerScenarioMs: number;
  dualGame: boolean;
  baselineAccuracy: number;
  reactorConfig?: Record<string, unknown>;
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<EmpathyConfig>;
}

// ── Scenario Banks ────────────────────────────────────────────────────────────

// Bank 0 — L1–2: Mild disappointment, warm responses needed
const BANK_0: EmpathyScenario[] = [
  {
    id: 'e0_1', character: 'Co-pilot (Lena)', distressLevel: 'low',
    context: 'Post-flight debrief. Lena miscalculated the descent profile and the captain caught it.',
    distressStatement: '"I ran the numbers twice. I don\'t understand how I got that wrong."',
    options: [
      { text: 'It happens to everyone — let\'s review the calculation together and find where it went off.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'Don\'t worry about it, these things happen. Not a big deal.', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: 'We\'ll go over it in the report. Good to catch it early.', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: 'The formula can be tricky. I\'ve made the same mistake. Want to walk through it?', type: 'balance', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e0_2', character: 'New FA (Tom)', distressLevel: 'low',
    context: 'Tom forgot a passenger\'s meal preference that he had noted earlier. Passenger complained.',
    distressStatement: '"I had it written down. I just... blanked. The passenger was really unhappy."',
    options: [
      { text: 'That\'s okay — note it again and make sure the next interaction is spot on.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'Don\'t let it get to you. Passengers complain about everything.', type: 'avoidant', deEscalates: false, boundaryViolation: false },
      { text: 'I\'m so sorry — I should have double-checked your notes with you before the service.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'It\'s a stressful sector. Take 2 minutes, reset, and you\'ll be fine.', type: 'support', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e0_3', character: 'Navigator (Priya)', distressLevel: 'low',
    context: 'Priya\'s optimised routing was overridden by dispatch for commercial reasons. She\'s deflated.',
    distressStatement: '"I spent an hour on that route. They didn\'t even look at the fuel savings."',
    options: [
      { text: 'That\'s frustrating. Document the savings — it builds the case for next time.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'Dispatch always does this. Not worth the effort.', type: 'avoidant', deEscalates: false, boundaryViolation: false },
      { text: 'You\'re right and they were wrong. I\'ll raise it with management.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'The work wasn\'t wasted — your data is still solid evidence for the argument.', type: 'support', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e0_4', character: 'Co-pilot (Sam)', distressLevel: 'neutral',
    context: 'Routine flight. Sam is quiet and seems flat compared to his usual energy.',
    distressStatement: '"Yeah, I\'m fine. Just a bit tired."',
    options: [
      { text: 'OK. Let me know if you need me to take more of the load this sector.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'You sure? You seem off. Do you need a break?', type: 'support', deEscalates: true, boundaryViolation: false },
      { text: 'Get some water and keep your eyes on the instruments.', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: 'I was tired too until I had a coffee. You should get one.', type: 'avoidant', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e0_5', character: 'Senior FA (Rita)', distressLevel: 'low',
    context: 'Rita\'s team failed a service standard check during the flight. She knows it.',
    distressStatement: '"I know the score wasn\'t good. I\'ll brief the team properly next time."',
    options: [
      { text: 'That\'s the right approach. What support do you need from me to make the brief effective?', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'Don\'t be too hard on yourself — the check conditions were unusual.', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: 'Good. Document the specific gaps so the brief is targeted.', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: 'It\'s fine — these checks are rarely accurate anyway.', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
];

// Bank 1 — L3–4: User-caused stress — avoid becoming apologetic
const BANK_1: EmpathyScenario[] = [
  {
    id: 'e1_1', character: 'Co-pilot (Yuki)', distressLevel: 'medium',
    context: 'You issued a frequency change too quickly. Yuki misread it and was corrected by ATC.',
    distressStatement: '"That call was unclear. I looked like an idiot on the radio."',
    options: [
      { text: 'Fair — I\'ll slow down the callouts. Let\'s log it and adjust the handover protocol.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'I\'m sorry, that was completely my fault. I should have been clearer.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'ATC corrections are normal. It won\'t go on record.', type: 'avoidant', deEscalates: false, boundaryViolation: false },
      { text: 'That\'s something we should both improve — better call discipline from me, readback confirmation from you.', type: 'balance', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e1_2', character: 'Navigator (Paul)', distressLevel: 'medium',
    context: 'Your route preference was chosen over Paul\'s, and it resulted in a longer sector.',
    distressStatement: '"My figures were right. We\'re sitting in 40 extra minutes because of the routing call."',
    options: [
      { text: 'The data supports that read. I\'ll account for that in the next routing decision.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'You\'re absolutely right and I was wrong. I apologise for overriding you.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'Weather forecasts are probabilistic. Mine was reasonable at the time.', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: 'Let\'s debrief this properly after landing — I want your analysis on file.', type: 'balance', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e1_3', character: 'FA (Bilal)', distressLevel: 'medium',
    context: 'You approved a seating change that caused Bilal an extra 20 minutes of work mid-service.',
    distressStatement: '"I had the cart mid-aisle. This completely broke the service sequence."',
    options: [
      { text: 'Noted — I should have flagged the timing with you before approving it. That\'s on me.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'I\'m really sorry — I had no idea it would affect your cart position like that.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'The passenger had a medical reason. Service disruption was the right trade-off.', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: 'It worked out fine in the end, didn\'t it?', type: 'avoidant', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e1_4', character: 'Co-pilot (Remy)', distressLevel: 'high',
    context: 'Your deviation from the checklist order confused Remy during a time-critical phase.',
    distressStatement: '"I didn\'t know where we were on the list. I nearly called the wrong step."',
    options: [
      { text: 'That was not okay from me. Checklist discipline is non-negotiable — I got that wrong.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'I\'m so sorry — I completely understand why that was stressful. I\'ll never do that again.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'If ever the sequence breaks, call a freeze and reset. That\'s what the procedure is for.', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: 'You should have spoken up at the time — that\'s what CRM is for.', type: 'mission', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e1_5', character: 'Purser (Anna)', distressLevel: 'medium',
    context: 'Your delayed PA announcement caused Anna to start the boarding process early by mistake.',
    distressStatement: '"I had to stop the entire forward cabin. In front of everyone."',
    options: [
      { text: 'I should have called you before the PA was delayed. That\'s a coordination failure on my part.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'I\'m really sorry — I had no idea you\'d started. I feel terrible about it.', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: 'The protocol is to wait for the PA confirmation — that\'s worth a quick team reminder.', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: 'These miscommunications happen — passengers don\'t remember them two minutes later.', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
];

// Bank 2 — L5–6: Mission vs face-saving trade-off
const BANK_2: EmpathyScenario[] = [
  {
    id: 'e2_1', character: 'Co-pilot (Nadia)', distressLevel: 'medium',
    context: 'Nadia made an error on the fuel calculation. Correcting it publicly will embarrass her in the debrief.',
    distressStatement: '"I\'ll fix it in the notes after — no need to raise it now."',
    options: [
      { text: 'We need to correct it before we debrief. I\'ll frame it as a joint review so it\'s not one-sided.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'OK, if you think it\'s minor, we can discuss offline.', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: 'It goes in the debrief now — the accuracy of that log matters more than the discomfort.', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: 'Your call — you know the system better than I do.', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e2_2', character: 'Senior FA (Kim)', distressLevel: 'medium',
    context: 'Kim gave incorrect safety information to a passenger. Correcting it now means admitting the error in the cabin.',
    distressStatement: '"Can we just let it go? The passenger is calm now. I\'ll handle it quietly."',
    options: [
      { text: 'The information was safety-critical. We need to correct it — I\'ll back you up when you do.', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: 'If the passenger is calm and the flight is ending, we can debrief this on the ground.', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: 'You need to correct it now. Would you like me to come with you?', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'It\'s your call — you were the one who spoke to the passenger.', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e2_3', character: 'Engineer (Dev)', distressLevel: 'medium',
    context: 'Dev flagged a fault 3 hours late. Logging the accurate time means the log shows his delay.',
    distressStatement: '"If I log it at the actual time, it\'s going to look bad for me. Can we round it?',
    options: [
      { text: 'I understand the position, but the log has to be accurate. Let\'s document the actual timeline and your reasons for the delay.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'The log has to be exact. That\'s not negotiable.', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: 'I can see why that feels risky. Let me see if there\'s a note field where context can be added.', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: 'I\'d rather not know about this. Talk to the chief engineer.', type: 'avoidant', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e2_4', character: 'Co-pilot (Sara)', distressLevel: 'high',
    context: 'Sara needs to be told she failed the approach — saying it clearly means a difficult conversation.',
    distressStatement: '"How did that go? I thought it was okay — a bit rough on the flare maybe."',
    options: [
      { text: '"The flare was outside parameters. I\'m going to mark it in the assessment. Let\'s walk through what happened together."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"It was fine. The flare happens — don\'t worry about the mark."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"It didn\'t meet the standard. I\'ll document it accurately."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"Let\'s discuss it with the chief instructor first before I file anything."', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e2_5', character: 'Navigator (Tariq)', distressLevel: 'medium',
    context: 'Tariq\'s routing error added cost. He\'s asking you to soften the report language.',
    distressStatement: '"Could you write \'non-optimal routing\' rather than \'error\'? It\'s the same thing."',
    options: [
      { text: '"I\'ll write what the data supports. If you want to add context about the conditions, I\'ll include that too."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Sure, the language is a formality — non-optimal covers it."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"The report uses the classification system. An error is an error by definition."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"Talk to the safety officer — I\'m not in a position to change the taxonomy."', type: 'avoidant', deEscalates: false, boundaryViolation: false },
    ],
  },
];

// Bank 3 — L7–8: High-intensity (irate passenger / panicked navigator)
const BANK_3: EmpathyScenario[] = [
  {
    id: 'e3_1', character: 'Panicked Navigator (Yuki)', distressLevel: 'high',
    context: 'ACARS alert. Yuki raises her voice for the first time in the flight.',
    distressStatement: '"The fuel readout is wrong — something is wrong. I don\'t know what to do."',
    options: [
      { text: '"Stay with me. Read me the exact numbers. I\'m pulling up the alternate data right now."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"It\'s okay, calm down — tell me what you\'re seeing when you\'re ready."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"Cross-check manual now. I\'ll hold current heading. Call it step by step."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"I\'ve got it from here. You take a second."', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e3_2', character: 'Irate Passenger (row 22)', distressLevel: 'high',
    context: 'Passenger stood up during turbulence, was told to sit, and is now confrontational with a FA.',
    distressStatement: 'Passenger: "Don\'t tell me what to do. I know my rights. Get me your manager."',
    options: [
      { text: '"I am the senior crew on this cabin. For your safety and everyone else\'s, I need you seated now. I\'ll be happy to discuss this further once we\'re through the turbulence."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"I completely understand your frustration and I apologise for how that was delivered. Let me get the purser."', type: 'apologetic', deEscalates: false, boundaryViolation: true },
      { text: '"Under aviation law, crew safety instructions are mandatory. Please sit down immediately."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"Of course — the purser will be with you as soon as we\'re out of turbulence. For now, please take your seat."', type: 'balance', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e3_3', character: 'Co-pilot (Remy)', distressLevel: 'extreme',
    context: 'Descending through IMC. Remy\'s voice is elevated and he is beginning to miss callouts.',
    distressStatement: '"I\'ve lost situational awareness — I don\'t know where we are on the approach."',
    options: [
      { text: '"I have control. You\'re on instruments — call altitude and speed only. Ignore everything else."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"It\'s okay, breathe — you have control, just focus on the altimeter."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"Go around now. I\'ll take the radio. We reset at the hold."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"I\'ve got SA — talk me through what you\'re reading and I\'ll fill the gaps."', type: 'balance', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e3_4', character: 'Engineer (Li)', distressLevel: 'extreme',
    context: 'Ground pre-departure. Engineer discovers a fault not on the manifest. Shift supervisor is watching.',
    distressStatement: '"If I log this now the flight is delayed. My supervisor is already angry about last week."',
    options: [
      { text: '"The fault goes in the log. I\'ll speak to your supervisor directly — this is about airworthiness, not performance."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"I understand the pressure you\'re under. But we both know what happens if this goes unreported."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Don\'t worry about the supervisor — I\'ll cover for you."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"That\'s for you and your supervisor to resolve. I\'m signing off when the log is accurate."', type: 'mission', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e3_5', character: 'Junior FA (Tom)', distressLevel: 'high',
    context: 'Tom froze during a passenger medical event. He\'s shaking after.',
    distressStatement: '"I just stood there. I forgot everything from training. I\'m useless."',
    options: [
      { text: '"You\'re not useless — freezing happens, even to experienced crew. You called for help immediately, which is exactly right. We debrief, we practice, and next time you won\'t freeze."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"I would have done the same thing in your first year. Don\'t be so hard on yourself."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"This goes in the incident log. You\'ll need a simulator refresher on medical procedures."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"The patient is stable, that\'s what matters. You\'ll be okay."', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
];

// Bank 4 — L9: Extreme crisis multi-layer, speed required
const BANK_4: EmpathyScenario[] = [
  {
    id: 'e4_1', character: 'Co-pilot (Ana) — MAYDAY declared', distressLevel: 'extreme',
    context: 'Engine failure on departure. Ana is managing fuel dump. She calls out: voice cracking.',
    distressStatement: '"Engine two is gone and I can\'t — the fuel dump panel is — I can\'t find the switch."',
    options: [
      { text: '"Fuel dump, overhead panel, row three, red cover, left side. Call it when you have it."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"Hey — look at me. Breathe once. Panel, overhead, row three. You\'ve got this."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"I\'ll get it — you take radio."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"It\'s okay, we can skip the dump for now — focus on your instruments."', type: 'support', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e4_2', character: 'Purser (Anna) + cabin crew', distressLevel: 'extreme',
    context: 'Rapid decompression preparation. Anna calls the cockpit: voice high, fast.',
    distressStatement: '"We have a passenger refusing to use the oxygen mask — he\'s pulling other people\'s off. What do I do?"',
    options: [
      { text: '"Restrain if necessary. His mask is secondary — protect the others first. Is he a threat to the cabin?"', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"I understand — just keep the others masked. He\'ll pass out before he\'s a danger."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"I\'ll come back — keep everyone else masked and don\'t engage him physically alone."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"Anna, I need you to stay calm. Just keep talking to him, he\'ll come around."', type: 'support', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e4_3', character: 'Navigator (Sven) — TCAS RA', distressLevel: 'extreme',
    context: 'TCAS RA issued during manual flight. Sven is calling conflicting descent rates.',
    distressStatement: '"The RA says descend but ATC says climb — I\'m calling BOTH. Which one?!"',
    options: [
      { text: '"TCAS. Always TCAS over ATC. Call ATC now — \'TCAS RA, descending.\'"', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"I\'m going with TCAS — you call ATC right now, tell them we\'re following the RA."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Calm down — read me the exact RA advisory first."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"ATC has the full picture — go with ATC."', type: 'mission', deEscalates: false, boundaryViolation: false },
    ],
  },
  {
    id: 'e4_4', character: 'Co-pilot (Yuki) — post-incident', distressLevel: 'high',
    context: 'Just landed safely after a severe incident. Yuki is very quiet for 90 seconds, then:',
    distressStatement: '"I need you to know — I thought we weren\'t going to make it."',
    options: [
      { text: '"So did I for a moment. We made the right calls at the right time. That\'s what the training is for."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Don\'t think about it right now. Let\'s get through the shutdown checklist."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"That was the scariest thing I\'ve ever been through too. You flew it perfectly."', type: 'support', deEscalates: true, boundaryViolation: false },
      { text: '"It\'s normal to feel that way. You\'re safe now."', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
];

// Bank 5 — L10: Mayday scenarios for dual-game mode
const BANK_5: EmpathyScenario[] = [
  {
    id: 'e5_1', character: 'Co-pilot (Ana) — dual engine fail', distressLevel: 'extreme',
    context: 'MAYDAY declared. Ana is managing systems. She suddenly goes silent for 4 seconds mid-checklist.',
    distressStatement: '[Silence. Then:] "...I\'m here. Sorry. I\'m here."',
    options: [
      { text: '"You\'re here. Step 7 — cross-feed valve. Call it."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"What happened? Are you okay? Do you need me to take over?"', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"Good. Step 7. Cross-feed. Don\'t stop."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Take your time — we can pause the checklist."', type: 'avoidant', deEscalates: false, boundaryViolation: true },
    ],
  },
  {
    id: 'e5_2', character: 'Purser (Anna) — cabin fire', distressLevel: 'extreme',
    context: 'Smoke in rear cabin. Anna transmits: voice shaking but controlled.',
    distressStatement: '"We have smoke in row 34. I\'ve deployed the extinguisher. Passengers are panicking."',
    options: [
      { text: '"Confirm fire is out. If yes: smoke procedure, move passengers forward, keep the PA off."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"You\'re doing everything right. Keep going — confirm fire status and I\'ll make the PA."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Stay calm — you\'re trained for this. Keep the passengers seated."', type: 'support', deEscalates: false, boundaryViolation: true },
      { text: '"Diverting to nearest field in 6 minutes. Prepare for expedited landing."', type: 'mission', deEscalates: true, boundaryViolation: false },
    ],
  },
  {
    id: 'e5_3', character: 'Co-pilot (Remy) — hydraulics fail', distressLevel: 'extreme',
    context: 'Landing gear won\'t extend. Remy has been running the checklist for 12 minutes. He pauses.',
    distressStatement: '"I\'ve done everything. It\'s not working. I don\'t have anything else."',
    options: [
      { text: '"Then we land gear-up. Declare emergency, get the cabin prepared, and we brief the approach together."', type: 'mission', deEscalates: true, boundaryViolation: false },
      { text: '"You did everything right. The system failed, not you. Now we prepare for the alternate."', type: 'balance', deEscalates: true, boundaryViolation: false },
      { text: '"Are you sure you\'ve done every step? Go through it one more time."', type: 'mission', deEscalates: false, boundaryViolation: false },
      { text: '"It\'s okay — gear-up landings are survivable. Let\'s just get down safely."', type: 'support', deEscalates: false, boundaryViolation: true },
    ],
  },
];

const SCENARIO_BANKS = [BANK_0, BANK_1, BANK_2, BANK_3, BANK_4, BANK_5];

function getBankIndex(level: number): number {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level <= 6) return 2;
  if (level <= 8) return 3;
  if (level <= 9) return 4;
  return 5;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DEFAULT_CONFIG: EmpathyConfig = {
  level: 1, scenarioCount: 4, timePerScenarioMs: 25000,
  dualGame: false, baselineAccuracy: 0.75,
};

const REACTOR_COMPACT_CONFIG = {
  numBins: 3, fallDurationMs: 2000, distractors: false,
  highPriorityBoost: 0, oscillate: false, meltdown: false,
  totalRods: 20, highRatio: 0.5, distractorRatio: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

interface AnswerRecord {
  scenarioId: string;
  optionType: ResponseType | null; // null = timeout or gatekeeper blocked
  deEscalates: boolean;
  boundaryViolation: boolean;
  rtMs: number;
  distressLevel: string;
  gatekeeperBlocked: boolean;
}

export default function EmpathyResponseGame({ sessionId, onComplete, config }: Props) {
  const cfg: EmpathyConfig = { ...DEFAULT_CONFIG, ...config };
  const isDual = cfg.dualGame && cfg.level >= 10;

  const bankIndex = getBankIndex(cfg.level);
  const selectedScenariosRef = useRef<EmpathyScenario[]>(
    shuffle(SCENARIO_BANKS[bankIndex]).slice(0, Math.min(cfg.scenarioCount, SCENARIO_BANKS[bankIndex].length))
  );

  const [phase, setPhase]           = useState<Phase>('intro');
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [chosenOptIdx, setChosenOptIdx] = useState<number | null>(null);
  const [timerPct, setTimerPct]     = useState(1);
  const [displayScore, setDisplayScore] = useState(0);

  // Reactor state (L10 dual game)
  const reactorMissRateRef    = useRef(0);
  const gatekeeperEverFiredRef = useRef(false);
  const reactorScoreRef       = useRef<number | null>(null);

  // Metric refs
  const scenarioStartRef    = useRef(0);
  const answersRef          = useRef<AnswerRecord[]>([]);
  const timerInterval       = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenarios = selectedScenariosRef.current;
  const scenario  = scenarios[scenarioIdx];

  function clearTimer() {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }
  }

  function startTimer() {
    clearTimer();
    setTimerPct(1);
    const start = Date.now();
    timerInterval.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 1 - elapsed / cfg.timePerScenarioMs);
      setTimerPct(pct);
      if (pct <= 0) {
        clearTimer();
        handleTimeout();
      }
    }, 100);
  }

  function handleTimeout() {
    answersRef.current.push({
      scenarioId: scenario.id,
      optionType: null,
      deEscalates: false,
      boundaryViolation: false,
      rtMs: cfg.timePerScenarioMs,
      distressLevel: scenario.distressLevel,
      gatekeeperBlocked: false,
    });
    setChosenOptIdx(-1);
    setPhase('feedback');
  }

  const handleAnswer = useCallback((optIdx: number) => {
    if (phase !== 'playing') return;
    clearTimer();
    const sc  = scenarios[scenarioIdx];
    const opt = sc.options[optIdx];
    const rtMs = Date.now() - scenarioStartRef.current;

    const blocked = isDual && reactorMissRateRef.current > 0.5;
    if (blocked) gatekeeperEverFiredRef.current = true;

    answersRef.current.push({
      scenarioId: sc.id,
      optionType: opt.type,
      deEscalates: blocked ? false : opt.deEscalates,
      boundaryViolation: blocked ? false : opt.boundaryViolation,
      rtMs,
      distressLevel: sc.distressLevel,
      gatekeeperBlocked: blocked,
    });

    setChosenOptIdx(optIdx);
    setPhase('feedback');
  }, [phase, scenarioIdx, scenarios, isDual]);

  function advance() {
    const next = scenarioIdx + 1;
    if (next >= scenarios.length) {
      finishGame();
    } else {
      setScenarioIdx(next);
      setChosenOptIdx(null);
      setPhase('playing');
    }
  }

  const finishGame = useCallback(() => {
    clearTimer();
    const answers = answersRef.current;
    if (answers.length === 0) { onComplete(0); return; }

    // Support accuracy
    const scored    = answers.filter(a => !a.gatekeeperBlocked);
    const correct   = scored.filter(a => a.deEscalates).length;
    const suppAcc   = scored.length > 0 ? correct / scored.length : 0;

    // Emotional contagion: RT on high/extreme vs neutral/low
    const highRts    = answers.filter(a => a.distressLevel === 'high' || a.distressLevel === 'extreme').map(a => a.rtMs);
    const neutralRts = answers.filter(a => a.distressLevel === 'neutral' || a.distressLevel === 'low').map(a => a.rtMs);
    const avgHigh    = highRts.length    > 0 ? highRts.reduce((a, b) => a + b, 0) / highRts.length       : 0;
    const avgNeutral = neutralRts.length > 0 ? neutralRts.reduce((a, b) => a + b, 0) / neutralRts.length : avgHigh;
    const contagionPenalty = avgNeutral > 0 ? Math.min(1, Math.max(0, (avgHigh - avgNeutral) / avgNeutral)) : 0;

    // Boundaries
    const totalScored  = scored.length;
    const violations   = scored.filter(a => a.boundaryViolation).length;
    const boundScore   = totalScored > 0 ? 1 - violations / totalScored : 1;

    let score = Math.min(100, Math.round(
      suppAcc * 50 +
      (1 - contagionPenalty) * 30 +
      boundScore * 20
    ));

    // L10 gatekeeper cap
    if (isDual && gatekeeperEverFiredRef.current) {
      score = Math.min(score, 40);
    }

    // L10 degradation penalty
    if (isDual && cfg.baselineAccuracy > 0) {
      const degradation = Math.max(0, cfg.baselineAccuracy - suppAcc);
      const penalty     = Math.round(degradation * 20);
      score             = Math.max(0, score - penalty);
    }

    setDisplayScore(score);
    onComplete(score);
  }, [onComplete, isDual, cfg.baselineAccuracy]);

  useEffect(() => {
    if (phase === 'playing') {
      scenarioStartRef.current = Date.now();
      startTimer();
    }
    return clearTimer;
  }, [phase, scenarioIdx]);

  useEffect(() => () => clearTimer(), []);

  // ── Render ────────────────────────────────────────────────────────────────

  const REACTOR_HEIGHT = Math.round(SCREEN_H * 0.22);

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🧭</Text>
        <Text style={styles.title}>The Briefing</Text>
        <Text style={styles.subtitle}>Emergency Response Coordinator</Text>
        <Text style={styles.desc}>
          A crew member is in distress.{'\n'}
          Choose the response that{' '}
          <Text style={styles.accent}>balances mission and emotion</Text>.{'\n\n'}
          Stay steady — don't absorb their panic, and don't ignore it.
        </Text>
        {isDual && (
          <View style={styles.dualWarning}>
            <Text style={styles.dualWarningText}>
              ⚠ LEVEL 10 — MAYDAY PROTOCOL{'\n'}
              The Reactor runs below. Maintain triage while responding.
            </Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <MetaTag label={`${scenarios.length} Scenarios`} />
          <MetaTag label={`${Math.round(cfg.timePerScenarioMs / 1000)}s Each`} />
          {isDual && <MetaTag label="Dual Mode" color="#ef4444" />}
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => setPhase('playing')}>
          <Text style={styles.btnText}>Begin Response</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    const answers    = answersRef.current;
    const scored     = answers.filter(a => !a.gatekeeperBlocked);
    const correct    = scored.filter(a => a.deEscalates).length;
    const violations = scored.filter(a => a.boundaryViolation).length;
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🧭</Text>
        <Text style={styles.title}>Response Complete</Text>
        <Text style={styles.scoreNum}>{displayScore}</Text>
        {isDual && gatekeeperEverFiredRef.current && (
          <Text style={styles.gatekeeperAlert}>⚠ Gatekeeper triggered — score capped at 40</Text>
        )}
        <View style={styles.statsRow}>
          <StatBox label="De-Escalated" value={`${correct}/${scored.length}`} color="#22c55e" />
          <StatBox label="Boundary OK" value={`${scored.length - violations}/${scored.length}`} color="#a78bfa" />
        </View>
      </View>
    );
  }

  const timedOut   = chosenOptIdx === -1;
  const chosenOpt  = (chosenOptIdx !== null && chosenOptIdx >= 0) ? scenario?.options[chosenOptIdx] : null;
  const bestOpt    = scenario?.options.find(o => o.deEscalates && !o.boundaryViolation);

  const empathyContent = (
    <View style={styles.container}>
      {/* Header + timer */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Scenario {scenarioIdx + 1} / {scenarios.length}
          {isDual && <Text style={styles.dualIndicator}>  ◉ DUAL MODE</Text>}
        </Text>
        <View style={styles.timerBar}>
          <View style={[styles.timerFill, { width: `${timerPct * 100}%` as any,
            backgroundColor: timerPct > 0.5 ? '#7c3aed' : timerPct > 0.25 ? '#f59e0b' : '#ef4444' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Distress indicator */}
        <View style={[styles.distressBadge, distressBadgeStyle(scenario.distressLevel)]}>
          <Text style={[styles.distressBadgeText, distressTextStyle(scenario.distressLevel)]}>
            {distressLabel(scenario.distressLevel)}
          </Text>
        </View>

        {/* Context */}
        <View style={styles.contextBox}>
          <Text style={styles.contextLabel}>SITUATION</Text>
          <Text style={styles.contextText}>{scenario.context}</Text>
        </View>

        {/* Character statement */}
        <View style={styles.statementBox}>
          <Text style={styles.charName}>{scenario.character}</Text>
          <Text style={styles.statement}>{scenario.distressStatement}</Text>
        </View>

        {/* Question */}
        <Text style={styles.question}>How do you respond?</Text>

        {/* Options */}
        <View style={styles.optionsCol}>
          {scenario.options.map((opt, i) => {
            let btnStyle = styles.optionBtn;
            let textStyle = styles.optionText;
            if (phase === 'feedback' && chosenOptIdx !== null && !timedOut) {
              if (opt.deEscalates && !opt.boundaryViolation) {
                btnStyle = { ...styles.optionBtn, ...styles.optionBest };
                textStyle = { ...styles.optionText, color: '#fff' };
              } else if (i === chosenOptIdx && (!opt.deEscalates || opt.boundaryViolation)) {
                btnStyle = { ...styles.optionBtn, ...styles.optionWrong };
                textStyle = { ...styles.optionText, color: '#fff' };
              }
            }
            return (
              <TouchableOpacity
                key={i}
                style={btnStyle}
                onPress={() => handleAnswer(i)}
                disabled={phase === 'feedback'}
                activeOpacity={0.75}
              >
                <Text style={textStyle}>{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feedback */}
        {phase === 'feedback' && (
          <View style={styles.feedbackBox}>
            {timedOut ? (
              <Text style={styles.feedbackTimeout}>Response window closed</Text>
            ) : (
              <>
                <Text style={[styles.feedbackResult, {
                  color: (chosenOpt?.deEscalates && !chosenOpt?.boundaryViolation) ? '#22c55e' : '#f59e0b'
                }]}>
                  {(chosenOpt?.deEscalates && !chosenOpt?.boundaryViolation)
                    ? '✓ Effective response'
                    : chosenOpt?.boundaryViolation
                      ? '⚠ Boundary — lost mission focus'
                      : '✗ Did not de-escalate'}
                </Text>
                {bestOpt && bestOpt !== chosenOpt && (
                  <Text style={styles.feedbackBest}>
                    Optimal: <Text style={styles.accent}>{bestOpt.type}</Text> balance
                  </Text>
                )}
              </>
            )}
            <TouchableOpacity style={styles.nextBtn} onPress={advance}>
              <Text style={styles.nextBtnText}>
                {scenarioIdx + 1 < scenarios.length ? 'Next →' : 'End →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );

  if (!isDual) return empathyContent;

  // Level 10 dual-game layout
  return (
    <View style={styles.dualContainer}>
      {/* Empathy panel — top 75% */}
      <View style={{ flex: 3 }}>
        {empathyContent}
      </View>

      {/* Divider */}
      <View style={styles.dualDivider}>
        <Text style={styles.dualDividerText}>◉ REACTOR — MAINTAIN TRIAGE</Text>
      </View>

      {/* Reactor HUD — bottom ~22% */}
      <View style={{ height: REACTOR_HEIGHT, overflow: 'hidden' }}>
        <TheReactorGame
          sessionId={sessionId}
          config={cfg.reactorConfig ?? REACTOR_COMPACT_CONFIG}
          onComplete={(score) => { reactorScoreRef.current = score; }}
          compact
          onMissRateUpdate={(rate) => { reactorMissRateRef.current = rate; }}
        />
      </View>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function distressLabel(level: string): string {
  const map: Record<string, string> = {
    neutral: '○ Neutral', low: '● Low Distress',
    medium: '●● Medium Distress', high: '●●● High Distress', extreme: '⚠ EXTREME',
  };
  return map[level] ?? level;
}

function distressBadgeStyle(level: string): object {
  const colors: Record<string, string> = {
    neutral: '#1a1830', low: '#14532d', medium: '#713f12', high: '#7f1d1d', extreme: '#450a0a',
  };
  return { backgroundColor: colors[level] ?? '#1a1830' };
}

function distressTextStyle(level: string): object {
  const colors: Record<string, string> = {
    neutral: '#6b7280', low: '#4ade80', medium: '#fde047', high: '#f87171', extreme: '#fca5a5',
  };
  return { color: colors[level] ?? '#9ca3af' };
}

function MetaTag({ label, color = '#7c3aed' }: { label: string; color?: string }) {
  return (
    <View style={[styles.metaTag, { borderColor: color }]}>
      <Text style={[styles.metaTagText, { color }]}>{label}</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d0c1a' },
  center:       { flex: 1, backgroundColor: '#0d0c1a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dualContainer:{ flex: 1, backgroundColor: '#0d0c1a' },

  icon:     { fontSize: 48, marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: '800', color: '#e0e0ff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#7c3aed', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  desc:     { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  accent:   { color: '#a78bfa', fontWeight: '700' },

  dualWarning: {
    backgroundColor: '#450a0a', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#ef4444', marginBottom: 16,
  },
  dualWarningText: { color: '#fca5a5', fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  metaTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  metaTagText: { fontSize: 12, fontWeight: '600' },

  btn:     { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  scoreNum: { fontSize: 72, fontWeight: '800', color: '#a78bfa', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statBox:  { alignItems: 'center', backgroundColor: '#1a1830', borderRadius: 10, padding: 14, minWidth: 90 },
  statValue:{ fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel:{ fontSize: 10, color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' },

  gatekeeperAlert: { color: '#ef4444', fontWeight: '700', fontSize: 13, marginBottom: 12, textAlign: 'center' },

  header: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
    backgroundColor: '#111025', borderBottomWidth: 1, borderBottomColor: '#1e1d35',
  },
  headerText:    { fontSize: 11, color: '#7c3aed', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 },
  dualIndicator: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  timerBar:      { height: 4, backgroundColor: '#1e1d35', borderRadius: 2, overflow: 'hidden' },
  timerFill:     { height: 4, borderRadius: 2 },

  scroll: { padding: 14, paddingBottom: 32 },

  distressBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  distressBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  contextBox: {
    backgroundColor: '#13122a', borderRadius: 10, padding: 12, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: '#7c3aed',
  },
  contextLabel: { fontSize: 10, color: '#7c3aed', fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  contextText:  { fontSize: 12, color: '#9ca3af', lineHeight: 18 },

  statementBox: { backgroundColor: '#1a1830', borderRadius: 12, padding: 14, marginBottom: 12 },
  charName:     { fontSize: 12, color: '#a78bfa', fontWeight: '700', letterSpacing: 0.5, marginBottom: 5 },
  statement:    { fontSize: 15, color: '#e0e0ff', lineHeight: 22, fontStyle: 'italic' },

  question: { fontSize: 13, color: '#e0e0ff', fontWeight: '600', marginBottom: 10, textAlign: 'center' },

  optionsCol: { gap: 8, marginBottom: 12 },
  optionBtn:  { backgroundColor: '#1a1830', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2d2b50' },
  optionBest: { backgroundColor: '#166534', borderColor: '#22c55e' },
  optionWrong:{ backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  optionText: { fontSize: 13, color: '#d1d5db', lineHeight: 18 },

  feedbackBox: { backgroundColor: '#13122a', borderRadius: 10, padding: 12, alignItems: 'center', gap: 6 },
  feedbackResult: { fontSize: 15, fontWeight: '700' },
  feedbackTimeout: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  feedbackBest:    { fontSize: 12, color: '#9ca3af' },
  nextBtn:         { backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 24, marginTop: 4 },
  nextBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  dualDivider: {
    height: 24, backgroundColor: '#1a0a0a', borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  dualDividerText: { fontSize: 10, color: '#ef4444', fontWeight: '700', letterSpacing: 1.5 },
});
