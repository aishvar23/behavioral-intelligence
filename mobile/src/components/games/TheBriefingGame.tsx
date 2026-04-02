/**
 * The Briefing — Social Inference (T15)
 *
 * High-Stakes Diplomatic Negotiation metaphor.
 * User reads a scenario transcript and selects the hidden intent of the character.
 * Detects Theory of Mind ability: does the user read between the lines?
 *
 * Metrics:
 *   inferenceAccuracy  — % correct hidden intent identifications (60pts)
 *   cueWeighting       — did user rely on non-verbal over verbal cues (25pts)
 *   biasScore          — avoided projecting own mood as character's intent (15pts)
 *
 * Level progression via config.level (maps to scenario bank):
 *   L1–2 : Clear emotions, all cues visible
 *   L3–4 : Sarcasm/doubt, tonal cue is key
 *   L5–6 : Conflicting verbal vs body/tone
 *   L7–8 : Professional deference & hidden alarm (cockpit formality)
 *   L9   : Multi-step exchanges, rapid inference
 *   L10  : Garbled / [STATIC] partial information
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  context: string;
  character: string;
  statement: string;
  cues: { verbal?: string; tonal?: string; body?: string };
  options: string[];
  correctIndex: number;
  /** Which cue type reveals the truth (non-verbal = tonal/body = better signal) */
  correctCueType: 'verbal' | 'tonal' | 'body';
  /** Option index representing "projection bias" — user projecting own state */
  projectionIndex: number;
  distressLevel: 'low' | 'medium' | 'high';
}

interface BriefingConfig {
  level: number;
  timePerScenarioMs: number;
  scenarioCount: number;
  visibleCues: ('verbal' | 'tonal' | 'body')[];
  noiseLevel: number; // 0=clean 1=partial 2=garbled
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<BriefingConfig>;
}

// ── Scenario Banks ────────────────────────────────────────────────────────────

// Bank 0 — L1–2: Clear emotions, all cues aligned
const BANK_0: Scenario[] = [
  {
    id: 'b0_1', character: 'Captain Chen', distressLevel: 'low',
    context: 'Post-landing debrief. Captain reviewing co-pilot\'s first solo landing.',
    statement: '"That was a textbook approach. Exactly what we want to see."',
    cues: { verbal: 'Explicit praise — "textbook approach"', tonal: 'Warm, steady, unhurried', body: 'Nods twice, arms relaxed, direct eye contact with a slight smile' },
    options: ['Genuinely pleased and proud', 'Sarcastic — the landing had errors', 'Politely concealing concern', 'Just performing routine feedback'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 3,
  },
  {
    id: 'b0_2', character: 'Flight Attendant (Maya)', distressLevel: 'medium',
    context: 'Boarding gate. Discovered incorrect meal count 15 minutes before departure.',
    statement: '"Again? I told you this would happen if we rushed the load."',
    cues: { verbal: 'Direct blame — "Again" and "I told you"', tonal: 'Clipped, sharp, no softening', body: 'Puts down clipboard forcefully, does not look up' },
    options: ['Frustrated and placing blame', 'Trying to solve the problem calmly', 'Nervous about the departure delay', 'Surprised — first time seeing this error'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 2,
  },
  {
    id: 'b0_3', character: 'First Officer (James)', distressLevel: 'medium',
    context: 'Pre-flight briefing. Co-pilot made an error on the departure checklist.',
    statement: '"This needs to be perfect before we push back. Every. Single. Time."',
    cues: { verbal: 'Emphasis on "perfect" and deliberate spacing of "Every. Single. Time."', tonal: 'Low, slow, measured — each word weighted', body: 'Sustained direct eye contact, leaning slightly forward' },
    options: ['Setting firm non-negotiable expectations', 'Panicking about the error', 'Asserting authority over the co-pilot', 'Asking for help to understand the mistake'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b0_4', character: 'ATC Controller', distressLevel: 'medium',
    context: 'ATC communication. Aircraft has misread a holding instruction twice.',
    statement: '"Flight 112, confirm you are holding at Sierra-4. That is the holding point."',
    cues: { verbal: 'Restates instruction with "That is" — emphasising correctness', tonal: 'Formal, clipped, slight pause before restatement', body: '[Radio only — no visual cue]' },
    options: ['Calmly correcting a positional error', 'Alarmed about a potential collision', 'Confused by the aircraft\'s response', 'Irritated after repeated mistakes'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 3,
  },
  {
    id: 'b0_5', character: 'Senior FA Kim', distressLevel: 'low',
    context: 'End of a long sector. Senior attendant checking on a tired junior colleague.',
    statement: '"Hey — how are you holding up back there? Long sector."',
    cues: { verbal: '"Holding up" — implies concern about strain', tonal: 'Soft, unhurried, genuine', body: 'Brief touch on shoulder, tilts head slightly, steady eye contact' },
    options: ['Showing genuine concern', 'Making small talk to pass the time', 'Evaluating the junior\'s performance', 'Uncomfortable — wants to move on quickly'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 2,
  },
  {
    id: 'b0_6', character: 'Captain (PA announcement)', distressLevel: 'low',
    context: 'Mid-flight PA after severe turbulence has passed.',
    statement: '"We\'ve cleared the weather system. Thank you for your patience — it\'s smooth skies ahead."',
    cues: { verbal: '"Smooth skies ahead" — explicit reassurance', tonal: 'Calm, confident, deliberate pacing', body: 'Relaxed posture, unhurried delivery' },
    options: ['Calm and in control', 'Still worried but concealing it', 'Relieved but exhausted', 'Performing confidence for passengers only'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 3,
  },
];

// Bank 1 — L3–4: Sarcasm / doubt (tonal cue is key signal)
const BANK_1: Scenario[] = [
  {
    id: 'b1_1', character: 'Navigator (Paul)', distressLevel: 'medium',
    context: 'Cruise phase. Navigator reviewing captain\'s suggested route change.',
    statement: '"Sure, that route works fine. If you don\'t mind the 40-minute fuel margin."',
    cues: { verbal: 'Says "works fine" but qualifies with the fuel concern', tonal: 'Flat delivery, heavy stress on "if you don\'t mind"', body: 'Brief glance at fuel display, returns to panel without looking up' },
    options: ['Sarcastic — route is unacceptable', 'Genuinely approving the route', 'Uncertain, asking for confirmation', 'Deferring to authority despite concern'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b1_2', character: 'Co-pilot (Sara)', distressLevel: 'medium',
    context: 'Pre-approach briefing. Captain asked if co-pilot is ready for a difficult approach.',
    statement: '"I\'m ready. Absolutely." [3-second pause] "Let\'s do it."',
    cues: { verbal: 'Says "absolutely ready"', tonal: 'Faster-than-normal delivery of first two sentences, then the pause breaks the rhythm', body: 'Shifts in seat, adjusts headset unnecessarily before speaking' },
    options: ['Masking anxiety — not fully ready', 'Fully confident and prepared', 'Trying to assert competence under observation', 'Irritated about being questioned'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b1_3', character: 'FA (Marc)', distressLevel: 'low',
    context: 'Post-incident review. Colleague handled a difficult passenger dispute by escalating.',
    statement: '"Oh, that was a bold choice. Really. Bold."',
    cues: { verbal: '"Bold" used twice — unusual repetition signals evaluation', tonal: 'Slow, drawn-out, exaggerated stress on "Really. Bold." — descending intonation', body: 'Raises eyebrows, looks away quickly after speaking' },
    options: ['Sarcastic — choice was poor', 'Genuinely impressed', 'Envious of the colleague', 'Deflecting attention from their own mistake'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b1_4', character: 'Captain', distressLevel: 'high',
    context: 'ATC has issued a reroute through a mountain corridor in deteriorating weather.',
    statement: '"We\'ve been rerouted through the mountain corridor. The weather there is... manageable."',
    cues: { verbal: '"Manageable" — vague qualifier after ellipsis', tonal: 'Brief hesitation before "manageable", trailing intonation that doesn\'t resolve', body: 'Quick second glance at weather radar before delivering the final word' },
    options: ['Concealing concern about weather risk', 'Neutral — genuinely manageable conditions', 'Excited about the new routing challenge', 'Frustrated about the delay the reroute causes'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b1_5', character: 'Engineer (Dev)', distressLevel: 'medium',
    context: 'Pre-departure check. Asked if a flagged sensor has been resolved.',
    statement: '"The sensor is showing green now." [glances at clipboard] "It\'s cleared."',
    cues: { verbal: 'States clearance confidently', tonal: 'Slightly rushed ending — sentence completes too quickly', body: 'Glances at clipboard rather than the sensor panel when saying "cleared"' },
    options: ['Not fully confident — possibly cleared on paper only', 'Confident the sensor fault is fixed', 'Nervous about the inspection pressure', 'Hiding a known fault intentionally'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 3,
  },
  {
    id: 'b1_6', character: 'Dr. Reeves (Medical Officer)', distressLevel: 'medium',
    context: 'Pre-flight medical clearance check after pilot\'s recent illness.',
    statement: '"You look well. Ready to fly?" [tilts head, makes note on clipboard before reply]',
    cues: { verbal: '"You look well" — statement of appearance only', tonal: 'Rising intonation on "Ready to fly?" — more question than confirmation', body: 'Makes note before hearing the response — assessment is still in progress' },
    options: ['Doubting pilot readiness — still assessing', 'Confirming the pilot is fully cleared', 'Making routine pre-flight small talk', 'Checking for a specific unreported symptom'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
];

// Bank 2 — L5–6: Conflicting verbal vs body (verbal says fine, non-verbal says otherwise)
const BANK_2: Scenario[] = [
  {
    id: 'b2_1', character: 'Co-pilot (Yuki)', distressLevel: 'high',
    context: 'High-traffic descent phase. Captain asks if co-pilot is managing workload.',
    statement: '"I\'m fine, no issue here." [quiet voice, 1.5-second pause before responding, rigid posture, eyes fixed on panel]',
    cues: { verbal: 'Says "fine, no issue"', tonal: 'Quiet, clipped — significantly shorter than normal responses', body: 'No eye contact, unusually rigid posture, eyes don\'t leave panel' },
    options: ['Concealing stress — non-verbal cues contradict the words', 'Genuinely fine — direct and clear statement', 'Annoyed at being interrupted during a critical phase', 'Fully focused — in a high-performance flow state'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 3,
  },
  {
    id: 'b2_2', character: 'First Officer (Remy)', distressLevel: 'high',
    context: 'Unfamiliar airport, non-standard approach. Co-pilot asked if they know this procedure.',
    statement: '"I\'ve done this approach a hundred times. I\'ve got it." [checks approach plate twice during the statement]',
    cues: { verbal: '"A hundred times" — confident exaggeration', tonal: 'Slightly elevated pitch on "I\'ve got it"', body: 'References approach plate during the sentence — visual check contradicts the verbal confidence' },
    options: ['Over-reassuring — anxiety masked by bravado', 'Genuinely experienced and calm', 'Showing off expertise to the captain', 'Testing whether the captain will challenge them'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
  {
    id: 'b2_3', character: 'FA (Priya)', distressLevel: 'medium',
    context: 'Post-boarding briefing. FA describes a difficult passenger in row 14.',
    statement: '"He\'s just a bit... spirited." [smiles but shoulders are raised, stands back from the galley door]',
    cues: { verbal: '"Spirited" — diplomatic understatement', tonal: 'Pauses before the adjective, choosing words carefully', body: 'Smile doesn\'t reach eyes; defensive posture — shoulders raised, distance increased' },
    options: ['Frustrated but maintaining professionalism', 'Genuinely amused by an eccentric passenger', 'Unbothered — "spirited" passengers are routine', 'Afraid of the passenger but unwilling to say so'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 2,
  },
  {
    id: 'b2_4', character: 'Captain', distressLevel: 'high',
    context: 'Minor systems fault detected. Captain makes PA announcement to passengers.',
    statement: '"Minor technical matter — nothing that affects safety. We\'ll be underway shortly." [fourth trip to cockpit in 8 minutes, speaking 20% faster than normal]',
    cues: { verbal: '"Nothing that affects safety" — explicit reassurance', tonal: 'Slightly elevated speaking rate — 20% faster than baseline', body: 'Repeated cockpit visits during announcement — physical behaviour contradicts verbal calm' },
    options: ['Managing a real issue while minimising passenger concern', 'Genuinely not worried — fully routine delay', 'Embarrassed by the technical fault', 'Covering up a fault the airline doesn\'t want disclosed'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
  {
    id: 'b2_5', character: 'Systems Engineer (Li)', distressLevel: 'high',
    context: 'Pre-departure final systems check. Captain asks about hydraulics status.',
    statement: '"All systems nominal." [eyes return to hydraulics display twice in 10 seconds after speaking]',
    cues: { verbal: '"Nominal" — standard status confirmation', tonal: 'Flat, rehearsed delivery', body: 'Repeated involuntary glances back at the hydraulics display — gaze reveals unresolved uncertainty' },
    options: ['Verbally confirmed but non-verbally uncertain about hydraulics', 'Routine check — genuinely all clear', 'Distracted by an unrelated system concern', 'Attempting to rush the departure'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
  {
    id: 'b2_6', character: 'Co-pilot (Ana)', distressLevel: 'medium',
    context: 'Simulator debrief. Instructor asks if Ana understood the feedback.',
    statement: '"Yes, completely. I know exactly what to work on." [nods firmly but then flicks to the wrong page of notes]',
    cues: { verbal: '"Completely" and "exactly" — strong confidence markers', tonal: 'Steady and decisive', body: 'Confident nod immediately followed by navigating to the wrong page — indicates incomplete understanding' },
    options: ['Partially understood — verbal confidence exceeds actual clarity', 'Fully understood — direct, honest response', 'Frustrated with the feedback quality', 'Covering uncertainty to avoid looking unprepared'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 3,
  },
];

// Bank 3 — L7–8: Professional deference & hidden alarm (cockpit register)
const BANK_3: Scenario[] = [
  {
    id: 'b3_1', character: 'First Officer (Ken)', distressLevel: 'high',
    context: 'Cruise. FO notices an unusual engine parameter. Captain is occupied.',
    statement: '"Captain, when you have a moment — EGT on engine two is reading slightly outside the normal band."',
    cues: { verbal: '"Slightly outside the normal band" — formal downgrading of the anomaly', tonal: '"When you have a moment" — but spoken with a steadiness that signals urgency without breaking protocol', body: 'Hand is already on the engine monitoring panel before speaking' },
    options: ['Using professional deference to signal concern without creating panic', 'Genuinely unconcerned — monitoring a minor fluctuation', 'Unsure if the reading matters — seeking guidance', 'Testing the captain\'s attentiveness during quiet phase'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 2,
  },
  {
    id: 'b3_2', character: 'Captain (on ATC frequency)', distressLevel: 'high',
    context: 'Approach. ATC has issued an instruction the captain believes conflicts with TCAS.',
    statement: '"Centre, Flight 447, we are following TCAS Resolution Advisory. Descending."',
    cues: { verbal: '"Following TCAS RA" — specific regulatory language invoking pilot authority', tonal: 'Clipped, deliberate, no softening — complete sentences with no filler words', body: '[Radio only — but transmission is unusually compact, no small talk]' },
    options: ['Asserting pilot authority to override ATC under a safety rule', 'Confirming compliance with ATC instruction', 'Confused about the conflicting instructions', 'Requesting ATC to clarify the resolution advisory'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 2,
  },
  {
    id: 'b3_3', character: 'Purser (Anna)', distressLevel: 'high',
    context: 'Inflight. Purser contacts captain using the formal interphone protocol (normally only used in emergencies).',
    statement: '"Captain, this is the purser. We have a situation in economy that may require your guidance."',
    cues: { verbal: '"Situation" and "may require your guidance" — formal but downplayed language', tonal: 'Professional register maintained but cadence is slightly faster than normal purser calls', body: '[Interphone only — but she used the formal call protocol rather than the routine button]' },
    options: ['Signalling urgency within professional constraints', 'Routine update — nothing outside normal operations', 'Uncertain about protocol — chose formal call by mistake', 'Escalating a minor passenger complaint unnecessarily'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 1,
  },
  {
    id: 'b3_4', character: 'Co-pilot (Tariq)', distressLevel: 'high',
    context: 'Instrument approach in IMC. Co-pilot disagrees with captain\'s decision to continue.',
    statement: '"Captain, the weather is at minimums. Just confirming you\'re comfortable proceeding?"',
    cues: { verbal: '"Just confirming" — softens the challenge; "comfortable" — invites a self-assessment', tonal: 'Measured and non-confrontational — deliberate avoidance of direct challenge language', body: 'Has already pulled up the go-around checklist on the screen before asking' },
    options: ['Professionally challenging the decision while maintaining deference', 'Seeking genuine reassurance before proceeding', 'Unsure of the weather minimums — asking for clarification', 'Deferring entirely to the captain\'s judgement'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 3,
  },
  {
    id: 'b3_5', character: 'Lead ATC Controller', distressLevel: 'high',
    context: 'Heavy traffic. Controller issues a short silence after an aircraft\'s readback, then responds.',
    statement: '[2-second pause] "Flight 880 — that readback is... correct. Continue approach."',
    cues: { verbal: '"That readback is... correct" — unusual confirmation with ellipsis; normally just "correct"', tonal: 'The 2-second pause before responding breaks the expected rhythm; trailing intonation on "correct"', body: '[Radio only — the pause itself is the cue]' },
    options: ['Uncertain about the readback but proceeding cautiously', 'Standard confirmation — no concern', 'Distracted — pause was unrelated to this aircraft', 'Testing the pilot with an ambiguous response'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 2,
  },
  {
    id: 'b3_6', character: 'Captain (intercom to ground crew)', distressLevel: 'medium',
    context: 'Ground crew has loaded incorrect freight. Captain is informed 5 minutes before push-back.',
    statement: '"Thank you for the update. Let\'s get the right documentation before we proceed."',
    cues: { verbal: '"Let\'s get the right documentation" — redirects to process rather than blame', tonal: 'Even, measured — no raised pitch, but each syllable carries deliberate weight', body: 'Has already picked up the loadsheet during the sentence — action precedes resolution' },
    options: ['Firmly halting departure while maintaining professionalism', 'Genuinely not concerned — trusts ground crew to resolve it quickly', 'Deferring the problem to the ground supervisor', 'Uncertain about the legal implications of proceeding'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
];

// Bank 4 — L9: Multi-step exchanges, user tracks context across turns
const BANK_4: Scenario[] = [
  {
    id: 'b4_1', character: 'Co-pilot (Sven) + Captain', distressLevel: 'high',
    context: 'Cruise. Exchange over 3 transmissions about an ACARS alert.',
    statement: 'Sven: "Captain, got an ACARS alert — fuel imbalance." Captain: "How much?" Sven: "Four hundred kilograms. Fuel cross-feed is nominal." Captain: "Keep monitoring." Sven: [10-second pause] "...Still nominal."',
    cues: { verbal: 'Four exchange turns — "keep monitoring" is an instruction, not a plan', tonal: 'The 10-second pause before "still nominal" is anomalous', body: 'Sven has not offered a corrective action, only status reports' },
    options: ['Sven is uncertain about the cause and hoping it self-corrects', 'Both crew are following standard monitoring protocol correctly', 'Sven already knows the cause but needs the captain to ask', 'The captain dismissed the alert too quickly'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b4_2', character: 'FA (Bilal) + Purser', distressLevel: 'high',
    context: 'In-flight. Three-part exchange about a passenger.',
    statement: 'Purser: "Bilal, 22A needs water again." Bilal: "Third time." Purser: "Just get it." Bilal: "Done." [makes eye contact with purser and holds it for two seconds before turning]',
    cues: { verbal: '"Third time" — tracks pattern, not just the current request', tonal: '"Just get it" from purser is dismissive — shuts down Bilal\'s signal', body: 'Prolonged eye contact with the purser before turning — attempting to transmit concern non-verbally after verbal path is closed' },
    options: ['Bilal suspects a medical issue and is trying to flag it after being dismissed', 'Bilal is frustrated about being given repetitive tasks', 'Passenger is anxious and Bilal is annoyed about it', 'Purser suspects nothing — Bilal is just noting frequency'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 2,
  },
  {
    id: 'b4_3', character: 'Captain + FO (Nadia)', distressLevel: 'high',
    context: 'Descent briefing. Short three-line exchange.',
    statement: 'Captain: "Nadia, you have control for the approach." Nadia: "Understood, I have control." Captain: "Just call out if the wind comes up." Nadia: "Of course." [selects autoland on the MCP before the captain looks away]',
    cues: { verbal: 'Verbal acceptance is clean and formal', tonal: '"Just call out if the wind comes up" — captain is flagging concern subtly, not ordering', body: 'Nadia selects autoland immediately after receiving control — before conditions require it — indicating she anticipated needing it' },
    options: ['Nadia is less confident than her acceptance suggests — pre-empting difficulty', 'Nadia is fully confident and autoland is standard practice', 'Nadia misunderstood the captain\'s wind concern as an instruction', 'Captain is testing Nadia\'s decision-making on approach'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 1,
  },
  {
    id: 'b4_4', character: 'ATC + Captain', distressLevel: 'high',
    context: 'High workload sector. Four-line ATC exchange.',
    statement: 'ATC: "Delta 7, descend FL240." Captain: "Descend FL240, Delta 7." ATC: "Delta 7, correction, FL260." Captain: [3s pause] "FL260, Delta 7. Confirm that is the assigned level?" ATC: "Affirmative, FL260."',
    cues: { verbal: 'Captain explicitly requests confirmation — unusual for a simple correction', tonal: '3-second pause before the readback — longer than standard; "Confirm that is assigned level" is not standard phraseology', body: '[Radio only]' },
    options: ['Captain suspects the correction is an ATC error, not just a routine update', 'Captain is confused and checking their own understanding', 'Captain is following standard read-back protocol', 'ATC made an error and the captain is politely flagging it'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 2,
  },
  {
    id: 'b4_5', character: 'Purser + Senior FA', distressLevel: 'medium',
    context: 'Mid-flight. Brief exchange after a difficult passenger interaction.',
    statement: 'Purser: "How was row 7?" FA: "Handled." Purser: "Good." FA: "Yep." [FA turns away before the purser finishes speaking]',
    cues: { verbal: '"Handled" and "Yep" — both minimal, closed responses', tonal: 'Flat, no elaboration — atypical for this FA who normally debrefs incidents', body: 'FA turns before the purser finishes — breaks the conversation before it can continue' },
    options: ['FA is uncomfortable about how the interaction went and closing it down', 'FA handled it well and is ready to move on', 'FA is tired and giving efficient update only', 'Purser and FA have a tense relationship — this is routine'],
    correctIndex: 0, correctCueType: 'body', projectionIndex: 2,
  },
];

// Bank 5 — L10: Garbled / [STATIC] / partial — simulates distorted audio
const BANK_5: Scenario[] = [
  {
    id: 'b5_1', character: 'Co-pilot [partial transmission]', distressLevel: 'high',
    context: 'ATC radio with partial dropout. Reconstructing intent from fragments.',
    statement: '"Centre, [STATIC] 449, we have [STATIC] on the [STATIC]... request immediate [STATIC] to [STATIC]." [tone: urgent, faster-than-normal cadence between dropouts]',
    cues: { verbal: '"Request immediate [STATIC]" — only "immediate" and "request" survive intact', tonal: 'Cadence between dropouts is accelerated — urgency audible despite gaps', body: '[Audio only — no visual]' },
    options: ['Declaring or approaching an emergency — requesting priority handling', 'Routine position report with poor transmission quality', 'Requesting a routine frequency change', 'Requesting descent for passenger comfort'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b5_2', character: 'Captain [cockpit intercom, background noise]', distressLevel: 'high',
    context: 'Intercom conversation with purser during turbulence. Heavy background noise.',
    statement: '"Anna, we [STATIC]... probably another [STATIC] minutes... seat belt sign [STATIC] not... [STATIC]... just heads up." [tone: measured despite noise]',
    cues: { verbal: '"Seat belt sign" and "not" near each other — possible sign is NOT going off yet', tonal: 'Deliberate spacing between fragments — captain is choosing words under pressure', body: '[Intercom only]' },
    options: ['Warning purser that turbulence will continue — seat belt sign staying on', 'Telling purser the seat belt sign is coming off soon', 'Requesting purser to check passenger status', 'Informing purser of a systems fault'],
    correctIndex: 0, correctCueType: 'tonal', projectionIndex: 1,
  },
  {
    id: 'b5_3', character: 'Multiple crew [overlapping]', distressLevel: 'high',
    context: 'Cockpit during a system alert. Two voices overlapping — identify the PRIMARY concern.',
    statement: 'Voice A: "—hydraulics are [STATIC]—" / Voice B: "—I see it, checklist is—" / Voice A: "—left system pressure—" / Voice B: "—already on step [STATIC]—"',
    cues: { verbal: '"Hydraulics", "left system pressure" from Voice A — specific system named', tonal: 'Voice A is interrupting — initiating rather than responding', body: '[Audio only — overlapping channels]' },
    options: ['Hydraulic system fault — left system pressure is the active issue', 'General checklist review — no primary fault identified', 'Electrical fault — hydraulics mentioned as secondary effect', 'Crew practicing an emergency procedure, not a real fault'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 3,
  },
  {
    id: 'b5_4', character: 'FA (distorted cabin PA)', distressLevel: 'high',
    context: 'Cabin PA with partial audio. Identifying passenger-facing intent from fragments.',
    statement: '"Ladies and gentlemen, [STATIC]... for your [STATIC]... we ask that you remain [STATIC]... at this time. [STATIC] should be brief." [tone: controlled, no tremor]',
    cues: { verbal: '"Remain [STATIC] at this time" — restraint instruction; "should be brief" — duration qualifier', tonal: 'No tremor or pitch elevation despite gaps — controlled delivery under pressure', body: '[Audio only — PA system]' },
    options: ['Instructing passengers to stay seated — managing an onboard event', 'Routine announcement about turbulence ahead', 'Announcing a passenger medical situation', 'Introducing a change of destination'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 1,
  },
  {
    id: 'b5_5', character: 'FO + ATC [rapid exchange, noise floor]', distressLevel: 'high',
    context: 'Final approach, competing transmissions. Reconstructing the operative instruction.',
    statement: 'ATC: "[STATIC] 881 [STATIC] go-around [STATIC] traffic—" / FO: "[STATIC] going around [STATIC] 881—" / ATC: "[STATIC] confirm [STATIC] understand [STATIC]"',
    cues: { verbal: '"Go-around" appears in both transmissions — command and readback both present', tonal: 'FO\'s fragment begins with "[STATIC] going around" — action verb before confirmation', body: '[Audio only]' },
    options: ['Go-around was commanded and is being executed — traffic conflict', 'ATC issued a hold short instruction that was misread as go-around', 'Routine approach check-in with radio interference', 'Go-around was suggested but not confirmed — crews are clarifying'],
    correctIndex: 0, correctCueType: 'verbal', projectionIndex: 3,
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

const DEFAULT_CONFIG: BriefingConfig = {
  level: 1, timePerScenarioMs: 20000, scenarioCount: 4,
  visibleCues: ['verbal', 'tonal', 'body'], noiseLevel: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

export default function TheBriefingGame({ sessionId, onComplete, config }: Props) {
  const cfg: BriefingConfig = { ...DEFAULT_CONFIG, ...config };

  const bankIndex = getBankIndex(cfg.level);
  const selectedScenariosRef = useRef<Scenario[]>(
    shuffle(SCENARIO_BANKS[bankIndex]).slice(0, Math.min(cfg.scenarioCount, SCENARIO_BANKS[bankIndex].length))
  );

  const [phase, setPhase]                     = useState<Phase>('intro');
  const [scenarioIdx, setScenarioIdx]         = useState(0);
  const [chosenIdx, setChosenIdx]             = useState<number | null>(null);
  const [timerPct, setTimerPct]               = useState(1);
  const [displayScore, setDisplayScore]       = useState(0);

  // Metric refs
  const scenarioStartRef    = useRef(0);
  const correctRef          = useRef(0);
  const nonVerbalCorrectRef = useRef(0); // correct answers where cue was tonal or body
  const projectionRef       = useRef(0); // chose the projection bias option
  const totalAnsweredRef    = useRef(0);
  const timerInterval       = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenarios = selectedScenariosRef.current;
  const scenario  = scenarios[scenarioIdx];

  function clearTimer() {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }
  }

  function startScenarioTimer() {
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
    // Timeout = incorrect (no answer given)
    totalAnsweredRef.current += 1;
    setChosenIdx(-1); // sentinel for timeout
    setPhase('feedback');
  }

  const handleAnswer = useCallback((optionIdx: number) => {
    if (phase !== 'playing') return;
    clearTimer();
    const sc = scenarios[scenarioIdx];
    const correct = optionIdx === sc.correctIndex;
    const isProjection = optionIdx === sc.projectionIndex;

    totalAnsweredRef.current += 1;
    if (correct) {
      correctRef.current += 1;
      if (sc.correctCueType === 'tonal' || sc.correctCueType === 'body') {
        nonVerbalCorrectRef.current += 1;
      }
    }
    if (isProjection) projectionRef.current += 1;

    setChosenIdx(optionIdx);
    setPhase('feedback');
  }, [phase, scenarioIdx, scenarios]);

  function advance() {
    const next = scenarioIdx + 1;
    if (next >= scenarios.length) {
      finishGame();
    } else {
      setScenarioIdx(next);
      setChosenIdx(null);
      setPhase('playing');
    }
  }

  const finishGame = useCallback(() => {
    clearTimer();
    const total = totalAnsweredRef.current;
    if (total === 0) { onComplete(0); return; }

    const inferenceAcc    = correctRef.current / total;
    const nonVerbalWeight = correctRef.current > 0
      ? nonVerbalCorrectRef.current / correctRef.current
      : 0;
    const biasAvoidance   = 1 - projectionRef.current / total;

    const score = Math.min(100, Math.round(
      inferenceAcc * 60 +
      nonVerbalWeight * 25 +
      biasAvoidance * 15
    ));
    setDisplayScore(score);
    onComplete(score);
  }, [onComplete]);

  // Start timer when phase changes to playing
  useEffect(() => {
    if (phase === 'playing') {
      scenarioStartRef.current = Date.now();
      startScenarioTimer();
    }
    return clearTimer;
  }, [phase, scenarioIdx]);

  useEffect(() => () => clearTimer(), []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🎭</Text>
        <Text style={styles.title}>The Briefing</Text>
        <Text style={styles.subtitle}>High-Stakes Diplomatic Negotiation</Text>
        <Text style={styles.desc}>
          Read each crew transcript carefully.{'\n'}
          Select the most likely{' '}
          <Text style={styles.accent}>hidden intent</Text> — not just what the words say.{'\n\n'}
          Watch the tone, the pauses, and what isn't said.
        </Text>
        <View style={styles.metaRow}>
          <MetaTag label={`${scenarios.length} Scenarios`} />
          <MetaTag label={`${Math.round(cfg.timePerScenarioMs / 1000)}s Each`} />
          {cfg.noiseLevel > 0 && <MetaTag label="⚡ Signal Noise" color="#f59e0b" />}
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => setPhase('playing')}>
          <Text style={styles.btnText}>Begin Debrief</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🎭</Text>
        <Text style={styles.title}>Debrief Complete</Text>
        <Text style={styles.scoreNum}>{displayScore}</Text>
        <View style={styles.statsRow}>
          <StatBox label="Correct" value={`${correctRef.current}/${totalAnsweredRef.current}`} color="#22c55e" />
          <StatBox label="Non-Verbal" value={`${nonVerbalCorrectRef.current}`} color="#a78bfa" />
          <StatBox label="Bias Avoided" value={`${totalAnsweredRef.current - projectionRef.current}/${totalAnsweredRef.current}`} color="#38bdf8" />
        </View>
      </View>
    );
  }

  // Playing or feedback
  const isCorrect = chosenIdx === scenario?.correctIndex;
  const timedOut  = chosenIdx === -1;

  return (
    <View style={styles.container}>
      {/* Progress + timer */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Scenario {scenarioIdx + 1} / {scenarios.length}</Text>
        <View style={styles.timerBar}>
          <Animated.View style={[styles.timerFill, { width: `${timerPct * 100}%` as any,
            backgroundColor: timerPct > 0.5 ? '#7c3aed' : timerPct > 0.25 ? '#f59e0b' : '#ef4444' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Context */}
        <View style={styles.contextBox}>
          <Text style={styles.contextLabel}>SITUATION</Text>
          <Text style={styles.contextText}>{scenario.context}</Text>
        </View>

        {/* Character + statement */}
        <View style={styles.statementBox}>
          <Text style={styles.charName}>{scenario.character}</Text>
          <Text style={styles.statement}>{scenario.statement}</Text>
        </View>

        {/* Cue cards */}
        {cfg.visibleCues.length > 0 && (
          <View style={styles.cueSection}>
            <Text style={styles.cueLabel}>SIGNAL CHANNELS</Text>
            <View style={styles.cueRow}>
              {cfg.visibleCues.includes('verbal') && scenario.cues.verbal && (
                <CueCard label="Verbal" icon="💬" text={scenario.cues.verbal} />
              )}
              {cfg.visibleCues.includes('tonal') && scenario.cues.tonal && (
                <CueCard label="Tone" icon="🎙" text={scenario.cues.tonal} />
              )}
              {cfg.visibleCues.includes('body') && scenario.cues.body && (
                <CueCard label="Body" icon="👁" text={scenario.cues.body} />
              )}
            </View>
          </View>
        )}

        {/* Question */}
        <Text style={styles.question}>What is this person's hidden intent?</Text>

        {/* Options */}
        <View style={styles.optionsCol}>
          {scenario.options.map((opt, i) => {
            let btnStyle = styles.optionBtn;
            let textStyle = styles.optionText;
            if (phase === 'feedback' && chosenIdx !== null && !timedOut) {
              if (i === scenario.correctIndex) {
                btnStyle = { ...styles.optionBtn, ...styles.optionCorrect };
                textStyle = { ...styles.optionText, color: '#fff' };
              } else if (i === chosenIdx && chosenIdx !== scenario.correctIndex) {
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
                <Text style={textStyle}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feedback */}
        {phase === 'feedback' && (
          <View style={styles.feedbackBox}>
            {timedOut ? (
              <Text style={styles.feedbackTimeout}>Time expired — the signal went dark</Text>
            ) : (
              <Text style={[styles.feedbackResult, { color: isCorrect ? '#22c55e' : '#ef4444' }]}>
                {isCorrect ? '✓ Correct read' : '✗ Signal misread'}
              </Text>
            )}
            <Text style={styles.feedbackCue}>
              Key cue: <Text style={styles.accent}>{scenario.correctCueType.toUpperCase()}</Text>
            </Text>
            <TouchableOpacity style={styles.nextBtn} onPress={advance}>
              <Text style={styles.nextBtnText}>
                {scenarioIdx + 1 < scenarios.length ? 'Next Scenario →' : 'End Debrief →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CueCard({ label, icon, text }: { label: string; icon: string; text: string }) {
  return (
    <View style={styles.cueCard}>
      <Text style={styles.cueCardLabel}>{icon} {label}</Text>
      <Text style={styles.cueCardText}>{text}</Text>
    </View>
  );
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
  container: { flex: 1, backgroundColor: '#0d0c1a' },
  center:    { flex: 1, backgroundColor: '#0d0c1a', alignItems: 'center', justifyContent: 'center', padding: 24 },

  icon:     { fontSize: 48, marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: '800', color: '#e0e0ff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#7c3aed', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  desc:     { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  accent:   { color: '#a78bfa', fontWeight: '700' },

  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  metaTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  metaTagText: { fontSize: 12, fontWeight: '600' },

  btn:     { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  scoreNum: { fontSize: 72, fontWeight: '800', color: '#a78bfa', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statBox:  { alignItems: 'center', backgroundColor: '#1a1830', borderRadius: 10, padding: 14, minWidth: 80 },
  statValue:{ fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel:{ fontSize: 10, color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' },

  header: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    backgroundColor: '#111025', borderBottomWidth: 1, borderBottomColor: '#1e1d35',
  },
  headerText: { fontSize: 11, color: '#7c3aed', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  timerBar:   { height: 4, backgroundColor: '#1e1d35', borderRadius: 2, overflow: 'hidden' },
  timerFill:  { height: 4, borderRadius: 2 },

  scroll: { padding: 16, paddingBottom: 40 },

  contextBox: {
    backgroundColor: '#13122a', borderRadius: 10, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#7c3aed',
  },
  contextLabel: { fontSize: 10, color: '#7c3aed', fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  contextText:  { fontSize: 13, color: '#9ca3af', lineHeight: 19 },

  statementBox: {
    backgroundColor: '#1a1830', borderRadius: 12, padding: 16, marginBottom: 14,
  },
  charName:  { fontSize: 12, color: '#a78bfa', fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  statement: { fontSize: 16, color: '#e0e0ff', lineHeight: 24, fontStyle: 'italic' },

  cueSection: { marginBottom: 16 },
  cueLabel:   { fontSize: 10, color: '#6b7280', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  cueRow:     { gap: 8 },
  cueCard: {
    backgroundColor: '#13122a', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#2d2b50', marginBottom: 4,
  },
  cueCardLabel: { fontSize: 11, color: '#7c3aed', fontWeight: '700', marginBottom: 3 },
  cueCardText:  { fontSize: 12, color: '#9ca3af', lineHeight: 17 },

  question: { fontSize: 14, color: '#e0e0ff', fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  optionsCol: { gap: 10, marginBottom: 16 },
  optionBtn: {
    backgroundColor: '#1a1830', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#2d2b50',
  },
  optionCorrect: { backgroundColor: '#166534', borderColor: '#22c55e' },
  optionWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  optionText: { fontSize: 14, color: '#d1d5db', lineHeight: 20 },

  feedbackBox: { backgroundColor: '#13122a', borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 },
  feedbackResult: { fontSize: 16, fontWeight: '700' },
  feedbackTimeout: { fontSize: 14, color: '#f59e0b', fontWeight: '600' },
  feedbackCue:  { fontSize: 12, color: '#9ca3af' },
  nextBtn:      { backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 28, marginTop: 4 },
  nextBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
