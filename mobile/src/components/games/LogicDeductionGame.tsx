import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logEvent } from '../../services/api';

type Variant = 'deduction' | 'patterns' | 'verbal' | 'debugging' | 'systems' | 'boolean' | 'priority' | 'clinical' | 'medical_ethics' | 'financial_analysis' | 'risk_assessment' | 'legal_reasoning' | 'pedagogy' | 'behavioral_judgment' | 'engineering_analysis' | 'scientific_method' | 'creative_judgment';

interface Question {
  prompt: string;
  options: string[];
  answer: number; // index of correct option
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: { variant: Variant };
}

const QUESTIONS: Record<Variant, Question[]> = {
  deduction: [
    { prompt: 'All Zorbs are Blips. All Blips are Glinks. Sam is a Zorb. Therefore:', options: ['Sam is a Glink', 'Sam may be a Glink', 'Sam is not a Glink', 'Cannot determine'], answer: 0 },
    { prompt: 'If it rains, the game is cancelled. The game was NOT cancelled. Therefore:', options: ['It did not rain', 'It definitely rained', 'The game was postponed', 'Cannot determine'], answer: 0 },
    { prompt: 'All members scored over 50. Alex scored 45. Therefore:', options: ['Alex is not a member', 'Alex needs to improve', 'Alex is a new member', 'Cannot determine'], answer: 0 },
    { prompt: 'X > Y and Y > Z. Therefore:', options: ['X > Z', 'Z > X', 'X = Z', 'Cannot determine'], answer: 0 },
    { prompt: 'Every red button triggers an alarm. No alarm was triggered. Therefore:', options: ['No red button was pressed', 'A red button was pressed', 'The alarms are broken', 'Nothing can be concluded'], answer: 0 },
    { prompt: 'Some doctors are runners. Some runners are fast. Therefore:', options: ['No firm conclusion about doctors and speed', 'Some doctors are fast', 'All doctors are fast', 'No doctors are fast'], answer: 0 },
    { prompt: 'P → Q. Q is false. Therefore:', options: ['P must be false', 'P must be true', 'P may be true or false', 'Q causes P'], answer: 0 },
    { prompt: 'Only verified users can post. A post was made. Therefore:', options: ['The poster is a verified user', 'The poster may be verified', 'The post is invalid', 'The system has a flaw'], answer: 0 },
    { prompt: 'No flights depart in fog. There is fog now. Therefore:', options: ['No flight will depart', 'Some flights may depart', 'Flights are delayed', 'The fog will clear'], answer: 0 },
    { prompt: 'All A students pass the exam. Ben passed. Therefore:', options: ['Ben may or may not be an A student', 'Ben is an A student', 'Ben is the top student', 'Ben will always pass'], answer: 0 },
  ],
  patterns: [
    { prompt: 'What comes next?  2, 4, 8, 16, __', options: ['32', '24', '20', '28'], answer: 0 },
    { prompt: 'What comes next?  1, 4, 9, 16, __', options: ['25', '20', '24', '21'], answer: 0 },
    { prompt: 'What comes next?  1, 1, 2, 3, 5, 8, __', options: ['13', '11', '10', '14'], answer: 0 },
    { prompt: 'What comes next?  100, 50, 25, 12.5, __', options: ['6.25', '5', '10', '8'], answer: 0 },
    { prompt: 'What comes next?  2, 3, 5, 8, 12, __', options: ['17', '16', '15', '18'], answer: 0 },
    { prompt: 'What comes next?  81, 27, 9, 3, __', options: ['1', '0', '2', '3'], answer: 0 },
    { prompt: 'What comes next?  2, 6, 12, 20, 30, __', options: ['42', '40', '36', '44'], answer: 0 },
    { prompt: 'What is the missing number?  3, 7, __, 15, 19', options: ['11', '10', '12', '13'], answer: 0 },
    { prompt: 'What comes next?  1, 8, 27, 64, __', options: ['125', '100', '81', '144'], answer: 0 },
    { prompt: 'What comes next?  5, 10, 20, 40, __', options: ['80', '60', '70', '90'], answer: 0 },
  ],
  verbal: [
    { prompt: 'Book is to Library as Painting is to __', options: ['Museum', 'Artist', 'Canvas', 'Gallery'], answer: 0 },
    { prompt: 'Doctor is to Hospital as Teacher is to __', options: ['School', 'Library', 'Student', 'Book'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Carrot', 'Apple', 'Orange', 'Banana'], answer: 0 },
    { prompt: 'Cold is to Hot as Dark is to __', options: ['Light', 'Bright', 'Sun', 'Day'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Keyboard', 'Hammer', 'Wrench', 'Screwdriver'], answer: 0 },
    { prompt: 'Bird is to Nest as Human is to __', options: ['House', 'City', 'Bed', 'Office'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Television', 'Piano', 'Guitar', 'Violin'], answer: 0 },
    { prompt: 'Clock is to Time as Thermometer is to __', options: ['Temperature', 'Heat', 'Weather', 'Degrees'], answer: 0 },
    { prompt: 'Eye is to See as Ear is to __', options: ['Hear', 'Sound', 'Listen', 'Music'], answer: 0 },
    { prompt: 'Odd one out:', options: ['Pyramid', 'Circle', 'Square', 'Triangle'], answer: 0 },
  ],
  debugging: [
    { prompt: 'A for loop runs from i=0 to i<=10. How many times does it execute?', options: ['11', '10', '9', '12'], answer: 0 },
    { prompt: 'An array has 5 elements. What is the valid index range?', options: ['0 to 4', '1 to 5', '0 to 5', '1 to 4'], answer: 0 },
    { prompt: 'A function fails only on the 100th call. Most likely cause?', options: ['A race condition or state accumulation', 'A syntax error', 'A compiler bug', 'An off-by-one error'], answer: 0 },
    { prompt: 'Code works in dev but fails in production. Most likely cause?', options: ['Different environment variables or config', 'The code has syntax errors', 'The server is too fast', 'Tests were not run'], answer: 0 },
    { prompt: 'After adding feature X, unrelated feature Y breaks. This suggests:', options: ['A shared dependency between X and Y', 'Feature Y was always broken', 'The deployment failed', 'The tests are wrong'], answer: 0 },
    { prompt: 'API returns 200 OK but data is wrong. The bug is most likely in:', options: ['The business logic or data layer', 'The HTTP headers', 'The network routing', 'The DNS configuration'], answer: 0 },
    { prompt: 'A recursive function never returns. The most likely missing element is:', options: ['A base case', 'A return type', 'A loop variable', 'A parameter'], answer: 0 },
    { prompt: 'Memory usage grows every hour with no new users. This indicates:', options: ['A memory leak', 'High CPU usage', 'A network issue', 'A caching problem'], answer: 0 },
    { prompt: 'A variable declared inside a loop — what happens each iteration?', options: ['It is re-initialised fresh', 'It retains its previous value', 'It causes a compile error', 'It is shared globally'], answer: 0 },
    { prompt: 'An app crashes only on Android, not iOS. You should first check:', options: ['Platform-specific code and API differences', 'The server logs', 'The database schema', 'The CSS styling'], answer: 0 },
  ],
  systems: [
    { prompt: 'A microservice failure brings down the whole app. Best architectural fix?', options: ['Circuit breakers and fallback responses', 'Faster servers', 'More microservices', 'Better logging'], answer: 0 },
    { prompt: 'A cache cuts DB queries by 80% but users see stale data. The trade-off is:', options: ['Speed vs. data freshness', 'Cost vs. reliability', 'Security vs. performance', 'Latency vs. bandwidth'], answer: 0 },
    { prompt: 'As user count grows 10×, the bottleneck will be the component that:', options: ['Cannot scale horizontally', 'Runs the fastest queries', 'Has the most code', 'Uses the least memory'], answer: 0 },
    { prompt: 'Two services write to the same table with no coordination. This risks:', options: ['Data corruption or race conditions', 'Faster writes', 'Better throughput', 'Simpler architecture'], answer: 0 },
    { prompt: 'You add an external API call to every page load. This creates:', options: ['A hard dependency — external failure breaks your app', 'Faster pages', 'Lower server costs', 'Better SEO'], answer: 0 },
    { prompt: 'Logging every event in real-time slows the main app. Best fix:', options: ['Log asynchronously via a queue', 'Remove all logging', 'Log to the same database', 'Add more CPU'], answer: 0 },
    { prompt: 'A monolith is split into 50 microservices. The new primary challenge is:', options: ['Service communication complexity', 'Simpler deployments', 'Less code to maintain', 'Faster development'], answer: 0 },
    { prompt: 'Deployments fail during peak traffic. Root cause is most likely:', options: ['No zero-downtime deployment strategy', 'Slow developer internet', 'Wrong timezone', 'Compiler errors'], answer: 0 },
    { prompt: 'Which principle says each component should fail without cascading?', options: ['Fault isolation / bulkhead pattern', 'DRY (Don\'t Repeat Yourself)', 'SOLID principles', 'Agile methodology'], answer: 0 },
    { prompt: 'A single database handles all reads and writes at scale. First optimisation?', options: ['Read replicas to offload read queries', 'Delete old data', 'Upgrade the database version', 'Add more indexes to every table'], answer: 0 },
  ],
  boolean: [
    { prompt: 'NOT (A AND B) equals:', options: ['NOT A OR NOT B', 'NOT A AND NOT B', 'A OR B', 'NOT A AND B'], answer: 0 },
    { prompt: 'if (age >= 18 AND hasID == true) — age is 16. Result?', options: ['Access denied regardless of ID', 'Access allowed with ID', 'Depends on other conditions', 'Age check is skipped'], answer: 0 },
    { prompt: 'A OR (B AND C) — if A is true, the result is:', options: ['Always true', 'Depends on B and C', 'Always false', 'Undefined'], answer: 0 },
    { prompt: 'if (isAdmin || canEdit) — a non-admin with edit rights gets:', options: ['Access', 'Blocked', 'Admin rights', 'An error'], answer: 0 },
    { prompt: 'XOR (Exclusive OR) is true when:', options: ['Inputs differ — one true, one false', 'Both inputs are true', 'Both inputs are false', 'At least one is true'], answer: 0 },
    { prompt: '!(true && false) evaluates to:', options: ['true', 'false', 'null', 'error'], answer: 0 },
    { prompt: 'Short-circuit evaluation means:', options: ['The second condition is skipped when the first decides the result', 'Both conditions always evaluate', 'Only the last condition matters', 'Conditions run in reverse'], answer: 0 },
    { prompt: 'A AND B is true only when:', options: ['Both A and B are true', 'At least one is true', 'Only A is true', 'Only B is true'], answer: 0 },
    { prompt: 'p → q (if p then q). p is false. The implication is:', options: ['True regardless of q', 'False regardless of q', 'Undefined', 'Only true if q is also false'], answer: 0 },
    { prompt: 'if (x != null && x.value > 0) — why check x != null first?', options: ['To prevent a crash when accessing x.value on null', 'null is always greater than 0', 'Both sides always evaluate', 'x.value defaults to 0'], answer: 0 },
  ],
  priority: [
    { prompt: 'A critical security vulnerability is found. A promised feature is due tomorrow. You:', options: ['Patch the vulnerability first', 'Deliver the feature first', 'Do both simultaneously', 'Escalate next week'], answer: 0 },
    { prompt: 'Fix a bug affecting 500 users, add a nice-to-have feature, or refactor old code — best order?', options: ['Bug fix → refactor → feature', 'Feature → bug fix → refactor', 'Refactor → bug fix → feature', 'All at once'], answer: 0 },
    { prompt: 'Halfway through a sprint, requirements change significantly. Best response?', options: ['Discuss impact with team, adjust scope', 'Ignore the change and deliver as planned', 'Restart from scratch', 'Accept all changes without adjusting deadline'], answer: 0 },
    { prompt: 'A quick hack fixes the bug today; a proper fix takes 3 days. Production is affected. You:', options: ['Quick fix now, proper fix tracked as a ticket', 'Wait 3 days for the proper fix only', 'Do nothing until told', 'Roll back the whole release'], answer: 0 },
    { prompt: 'Two engineers disagree on architecture. Who decides?', options: ['Discuss trade-offs, decide based on requirements', 'Most senior person always decides', 'Flip a coin', 'Escalate immediately to management'], answer: 0 },
    { prompt: 'You must estimate a task you have never done before. Best approach?', options: ['Break into sub-tasks and estimate each', 'Refuse to estimate', 'Say 1 week for everything', 'Copy someone else\'s estimate'], answer: 0 },
    { prompt: 'A code review reveals a colleague\'s PR has a subtle bug. You:', options: ['Comment clearly on the PR with an explanation', 'Merge it and fix later', 'Reject without explanation', 'Rewrite their code yourself'], answer: 0 },
    { prompt: 'A feature works 99% of the time. The 1% failure causes data loss. Ship it?', options: ['No — data loss is never acceptable, fix first', 'Yes — 99% is good enough', 'Yes — users can recover manually', 'Yes — log it and fix next sprint'], answer: 0 },
    { prompt: 'Technical debt is accumulating fast. Best approach?', options: ['Allocate regular refactoring time each sprint', 'Ignore it until the system breaks', 'Rewrite everything at once', 'Only add features, never refactor'], answer: 0 },
    { prompt: 'A stakeholder requests a feature with no specification. Your first step?', options: ['Clarify requirements and expected outcomes', 'Start coding immediately', 'Decline the request', 'Copy a competitor\'s implementation'], answer: 0 },
  ],
  clinical: [
    { prompt: 'A patient has fever, stiff neck, and sensitivity to light. Most urgent concern?', options: ['Bacterial meningitis', 'Common migraine', 'Viral flu', 'Dehydration'], answer: 0 },
    { prompt: 'A drug has a narrow therapeutic index. This means:', options: ['The effective dose is close to the toxic dose', 'The drug works for a narrow group of patients', 'It must be taken in small amounts', 'It has few side effects'], answer: 0 },
    { prompt: 'A patient\'s symptoms worsen after treatment. First step?', options: ['Reassess the diagnosis', 'Increase the dose', 'Stop all treatment', 'Refer immediately'], answer: 0 },
    { prompt: 'Two patients have the same symptoms but different responses to the same drug. Most likely reason?', options: ['Genetic or metabolic differences', 'Different room temperatures', 'One patient is older', 'The drug batch was faulty'], answer: 0 },
    { prompt: 'A child presents with a rash that started on the face and moved downward. This pattern suggests:', options: ['A systemic viral illness like measles', 'A local allergic reaction', 'A fungal infection', 'Heat rash'], answer: 0 },
    { prompt: 'Post-surgical patient develops sudden shortness of breath and leg swelling. Priority concern?', options: ['Pulmonary embolism', 'Anxiety attack', 'Fluid overload', 'Asthma flare'], answer: 0 },
    { prompt: 'A patient reports taking herb supplements. Before prescribing, you should check:', options: ['Potential drug-herb interactions', 'The cost of the herbs', 'Whether the patient believes in medicine', 'The herb\'s country of origin'], answer: 0 },
    { prompt: 'Blood pressure is 160/100 on three separate visits. This is classified as:', options: ['Hypertension requiring treatment', 'Normal variation', 'White coat syndrome', 'A one-time measurement error'], answer: 0 },
    { prompt: 'An elderly patient is confused and has a UTI. The confusion is most likely:', options: ['Delirium triggered by infection', 'Alzheimer\'s onset', 'Drug side effect', 'Sleep deprivation'], answer: 0 },
    { prompt: 'A test has 95% sensitivity. A negative result means:', options: ['It is very unlikely the disease is present', 'The disease is definitely absent', 'The test was inaccurate', 'A second test is required'], answer: 0 },
  ],
  medical_ethics: [
    { prompt: 'A patient refuses a life-saving treatment. You should:', options: ['Respect their informed decision if they have capacity', 'Proceed without consent', 'Seek a court order immediately', 'Involve family to override them'], answer: 0 },
    { prompt: 'A colleague is impaired at work and poses risk to patients. You should:', options: ['Report through the appropriate professional channel', 'Cover for them this once', 'Confront them publicly', 'Do nothing — it\'s not your responsibility'], answer: 0 },
    { prompt: 'A terminally ill patient asks you to hasten death. Best response?', options: ['Discuss palliative options and legal limits clearly', 'Immediately comply', 'Refuse to discuss it', 'Discharge the patient'], answer: 0 },
    { prompt: 'A minor requests confidential treatment without parental consent. You should:', options: ['Assess maturity and legal guidelines for the jurisdiction', 'Always inform parents', 'Always keep it secret', 'Refuse treatment'], answer: 0 },
    { prompt: 'Limited ICU beds, two equally critical patients. The ethical framework that guides allocation is:', options: ['Utilitarian and fairness principles', 'First come first served only', 'Whichever patient is younger', 'Whichever patient can pay'], answer: 0 },
    { prompt: 'A patient\'s family asks you not to tell the patient their terminal diagnosis. You should:', options: ['Assess patient\'s right to know and discuss with family', 'Always follow family wishes', 'Always tell the patient immediately', 'Discharge to avoid the conflict'], answer: 0 },
    { prompt: 'A patient gives consent but clearly does not understand the procedure. Valid consent requires:', options: ['Capacity, information, and voluntariness', 'A signature only', 'Family approval', 'Written form only'], answer: 0 },
    { prompt: 'A pharmaceutical company offers you a trip to sponsor your research. You should:', options: ['Disclose the conflict of interest and evaluate independently', 'Accept — it\'s standard practice', 'Reject all future collaboration', 'Let a colleague handle it'], answer: 0 },
    { prompt: 'You make a medical error that causes minor harm. Best action?', options: ['Disclose to the patient, document, and report', 'Keep it private to avoid liability', 'Tell only close colleagues', 'Wait to see if symptoms appear'], answer: 0 },
    { prompt: 'Resource-limited setting: who gets priority for a scarce vaccine?', options: ['Those who will benefit most and spread risk to others', 'Wealthiest patients', 'Youngest patients only', 'Whoever asks first'], answer: 0 },
  ],
  financial_analysis: [
    { prompt: 'A stock P/E ratio is 50, while the industry average is 20. This suggests:', options: ['The stock may be overvalued or high growth expected', 'The stock is definitely a good buy', 'The company has low earnings', 'The industry is declining'], answer: 0 },
    { prompt: 'Compound interest on £1000 at 10% for 2 years gives:', options: ['£1210', '£1200', '£1100', '£1020'], answer: 0 },
    { prompt: 'A company has high revenue but negative cash flow. This most likely means:', options: ['Cash is tied up in receivables or investment', 'The company is profitable', 'Revenue figures are wrong', 'The company has no expenses'], answer: 0 },
    { prompt: 'Diversification in a portfolio reduces:', options: ['Unsystematic (specific) risk', 'Systematic (market) risk', 'Inflation risk', 'Currency risk'], answer: 0 },
    { prompt: 'The yield curve inverts. Historically this signals:', options: ['A potential recession ahead', 'Strong economic growth', 'Rising inflation', 'Central bank rate cuts'], answer: 0 },
    { prompt: 'Project A: £50k profit, 2 years. Project B: £50k profit, 5 years. Assuming equal risk:', options: ['Project A is better due to time value of money', 'Project B is better — same profit', 'They are equal', 'Project B has lower risk'], answer: 0 },
    { prompt: 'Beta of 1.5 means the stock:', options: ['Moves 1.5× the market — higher risk and return potential', 'Has 50% more earnings than the market', 'Is 50% more volatile than a bond', 'Tracks the market exactly'], answer: 0 },
    { prompt: 'A company\'s debt-to-equity ratio increases sharply. This may indicate:', options: ['Increased financial risk and leverage', 'Better profitability', 'Reduced operating costs', 'Higher dividends ahead'], answer: 0 },
    { prompt: 'NPV of a project is negative. You should:', options: ['Reject the project — it destroys value', 'Accept if IRR is positive', 'Accept if payback period is short', 'Always accept if cash flow exists'], answer: 0 },
    { prompt: 'Inflation rises faster than wages. Real purchasing power:', options: ['Falls — people can buy less', 'Rises — prices are higher', 'Stays the same', 'Depends on the tax rate'], answer: 0 },
  ],
  risk_assessment: [
    { prompt: 'An event has 10% probability of causing £1M loss. Expected loss is:', options: ['£100,000', '£10,000', '£1,000,000', '£90,000'], answer: 0 },
    { prompt: 'Two independent risks each have 20% probability. Probability both occur:', options: ['4%', '40%', '20%', '36%'], answer: 0 },
    { prompt: 'A system has three components. If any one fails, the system fails. All have 90% reliability. System reliability is:', options: ['72.9%', '90%', '27%', '97%'], answer: 0 },
    { prompt: 'High impact, low probability risk — appropriate response?', options: ['Accept with contingency plan or insure', 'Ignore — it\'s unlikely', 'Treat it as the top priority', 'Eliminate the entire project'], answer: 0 },
    { prompt: 'A medical test shows 99% accuracy. In a population where 1% has the disease, a positive test more likely means:', options: ['The person probably doesn\'t have the disease (base rate effect)', 'The person definitely has the disease', 'The test is unreliable', '50/50 chance'], answer: 0 },
    { prompt: 'Risk mitigation reduces the probability of a risk. Risk transfer shifts:', options: ['The financial consequence to another party', 'The probability to zero', 'The cause of the risk', 'The timeline of the risk'], answer: 0 },
    { prompt: 'A business has one client generating 90% of revenue. Primary risk is:', options: ['Concentration risk — single point of failure', 'Revenue risk — too much income', 'Operational risk', 'Regulatory risk'], answer: 0 },
    { prompt: 'Residual risk is:', options: ['Risk remaining after controls are applied', 'The original risk before assessment', 'Risk that cannot be measured', 'Accepted risk only'], answer: 0 },
    { prompt: 'Which risk management strategy accepts a risk and prepares for its consequences?', options: ['Risk acceptance / contingency planning', 'Risk avoidance', 'Risk transfer', 'Risk elimination'], answer: 0 },
    { prompt: 'A coin is flipped 10 times and lands heads each time. Probability of heads on flip 11:', options: ['50% — each flip is independent', 'Less than 50% — due for tails', 'More than 50% — on a streak', '0% — statistically impossible'], answer: 0 },
  ],
  legal_reasoning: [
    { prompt: 'A contract requires both offer and acceptance. An offer is made but not accepted. The contract is:', options: ['Not formed — no binding agreement', 'Valid — offer alone suffices', 'Voidable by either party', 'Automatically accepted after 30 days'], answer: 0 },
    { prompt: 'Precedent (stare decisis) means courts:', options: ['Follow rulings from higher courts in similar cases', 'Create new laws independently', 'Ignore prior decisions', 'Only apply written statutes'], answer: 0 },
    { prompt: 'Beyond reasonable doubt is the standard in:', options: ['Criminal trials', 'Civil disputes', 'Contract negotiations', 'Regulatory hearings'], answer: 0 },
    { prompt: 'A witness testifies to something they heard someone else say in court. This is generally:', options: ['Hearsay and may be inadmissible', 'Always admissible', 'Direct evidence', 'The strongest form of evidence'], answer: 0 },
    { prompt: 'Mens rea in criminal law refers to:', options: ['The mental intent to commit a crime', 'The physical act of the crime', 'The victim\'s role', 'The punishment phase'], answer: 0 },
    { prompt: 'A party breaches a contract. The innocent party can claim damages that:', options: ['Put them in the position they would have been in if performed', 'Punish the breaching party', 'Always equal the contract value', 'Cover only out-of-pocket costs'], answer: 0 },
    { prompt: 'Duty of care in negligence requires showing:', options: ['A foreseeable relationship where one owes care to another', 'Any harm was caused', 'An intentional act', 'A written agreement'], answer: 0 },
    { prompt: 'In statutory interpretation, courts first look at:', options: ['The plain meaning of the words in the statute', 'Legislative history', 'Similar foreign laws', 'The judge\'s personal view'], answer: 0 },
    { prompt: 'An injunction is a court order that:', options: ['Compels or prevents a specific action', 'Awards financial damages', 'Ends a criminal prosecution', 'Transfers property rights'], answer: 0 },
    { prompt: 'Double jeopardy protects an accused from:', options: ['Being tried twice for the same offence after acquittal', 'Being charged with multiple crimes at once', 'Self-incrimination', 'Unreasonable search'], answer: 0 },
  ],
  pedagogy: [
    { prompt: 'A student consistently fails tests but participates well in class. Best first step?', options: ['Investigate whether tests reflect their actual understanding', 'Label them a poor student', 'Exclude them from further tests', 'Focus only on test preparation'], answer: 0 },
    { prompt: 'Formative assessment is primarily used to:', options: ['Monitor learning and adjust teaching', 'Grade students at year end', 'Compare students to each other', 'Measure school performance'], answer: 0 },
    { prompt: 'A student with a learning difficulty needs support. Best approach?', options: ['Universal Design for Learning with tailored scaffolding', 'Separate them from the class', 'Reduce their workload permanently', 'Assign extra homework'], answer: 0 },
    { prompt: 'Bloom\'s Taxonomy places which skill at the highest level?', options: ['Creating and evaluating', 'Remembering and recalling', 'Understanding', 'Applying'], answer: 0 },
    { prompt: 'A class is disengaged during a lesson. Best immediate response?', options: ['Change the activity format and check for understanding', 'Continue — distractions are normal', 'Punish the class', 'End the lesson early'], answer: 0 },
    { prompt: 'Spaced repetition improves long-term retention because:', options: ['Revisiting content across time strengthens memory consolidation', 'Cramming is more efficient', 'It reduces the total study time', 'It tests students more frequently'], answer: 0 },
    { prompt: 'A parent disagrees with your grading of their child. You should:', options: ['Explain your criteria clearly with evidence', 'Change the grade to avoid conflict', 'Refuse to discuss it', 'Escalate to the principal immediately'], answer: 0 },
    { prompt: 'Differentiated instruction means:', options: ['Adapting content, process, or product to individual learner needs', 'Teaching different subjects simultaneously', 'Using different teachers for different students', 'Grouping all advanced students together'], answer: 0 },
    { prompt: 'Zone of Proximal Development (Vygotsky) refers to:', options: ['Tasks a learner can do with guidance but not yet independently', 'Work that is too easy', 'The learner\'s maximum potential', 'Work outside the curriculum'], answer: 0 },
    { prompt: 'A student plagiarises an assignment. Best response?', options: ['Discuss academic integrity, assign a consequence, and resubmit', 'Fail the student for the whole course immediately', 'Ignore it — it was minor', 'Only warn verbally with no record'], answer: 0 },
  ],
  behavioral_judgment: [
    { prompt: 'A client discloses intent to harm a specific person. You must:', options: ['Breach confidentiality to protect the third party', 'Keep it confidential — therapy is private', 'End the session immediately', 'Report only after the harm occurs'], answer: 0 },
    { prompt: 'Cognitive dissonance occurs when:', options: ['A person holds conflicting beliefs and experiences discomfort', 'A person has consistent beliefs', 'A person forgets prior experiences', 'A person learns quickly'], answer: 0 },
    { prompt: 'A client makes slow progress in therapy. Most appropriate response?', options: ['Re-evaluate the treatment approach with the client', 'Conclude therapy is ineffective and discharge', 'Increase session frequency immediately', 'Change diagnosis'], answer: 0 },
    { prompt: 'Confirmation bias means people tend to:', options: ['Seek information that confirms their existing beliefs', 'Change their mind when shown evidence', 'Prefer complex explanations', 'Remember negative events more clearly'], answer: 0 },
    { prompt: 'An employee is consistently late but performs well. The manager should:', options: ['Have a private conversation to understand the cause', 'Publicly reprimand them', 'Immediately place them on a performance plan', 'Ignore it since performance is good'], answer: 0 },
    { prompt: 'Fundamental attribution error is when we:', options: ['Over-attribute others\' behaviour to character, not circumstance', 'Blame ourselves for others\' actions', 'Assume everyone behaves like us', 'Underestimate our own abilities'], answer: 0 },
    { prompt: 'A group always agrees with the leader without questioning. This is called:', options: ['Groupthink', 'Conformity bias', 'Social loafing', 'Authority bias'], answer: 0 },
    { prompt: 'A person avoids going to a doctor because they fear bad news. This is:', options: ['Avoidance coping — harmful in the long term', 'Effective stress management', 'Rational risk assessment', 'Normal behaviour with no impact'], answer: 0 },
    { prompt: 'Intrinsic motivation is driven by:', options: ['Personal interest and satisfaction', 'External rewards and praise', 'Fear of punishment', 'Social pressure'], answer: 0 },
    { prompt: 'A client from a different culture has different norms around eye contact. You should:', options: ['Adapt your expectations to their cultural context', 'Insist on standard eye contact', 'Document it as a social deficit', 'End the session'], answer: 0 },
  ],
  engineering_analysis: [
    { prompt: 'A bridge design shows excessive deflection under load. Most likely issue?', options: ['Insufficient material stiffness or cross-section', 'Too many support points', 'The load calculations are wrong', 'The bridge is too short'], answer: 0 },
    { prompt: 'A pipe carrying fluid suddenly narrows. What happens to flow velocity?', options: ['It increases — conservation of mass', 'It decreases', 'It stays the same', 'It reverses'], answer: 0 },
    { prompt: 'A metal rod expands when heated. To accommodate this in design, engineers use:', options: ['Expansion joints or gaps', 'Stronger bolts', 'Thicker material', 'Cooling systems only'], answer: 0 },
    { prompt: 'Factor of safety of 3 means the design can handle:', options: ['3× the expected maximum load', 'The load with 3% margin', '3 times the material cost', 'Failure at 1/3 of the design load'], answer: 0 },
    { prompt: 'A motor runs at 80% efficiency. If input power is 100W, useful output is:', options: ['80W', '20W', '100W', '120W'], answer: 0 },
    { prompt: 'Stress concentration is highest:', options: ['At sharp corners or sudden geometry changes', 'At the centre of a uniform cross-section', 'At low-stress regions', 'At the point of maximum length'], answer: 0 },
    { prompt: 'A component fails after many cycles at loads below its static strength. This is:', options: ['Fatigue failure', 'Brittle fracture', 'Creep', 'Corrosion failure'], answer: 0 },
    { prompt: 'A beam fixed at both ends versus simply supported — under the same load, the fixed beam:', options: ['Deflects less — end fixity adds stiffness', 'Deflects more', 'Deflects the same', 'Fails at lower loads'], answer: 0 },
    { prompt: 'Redundancy in structural design means:', options: ['Multiple load paths so one failure doesn\'t collapse the system', 'Using excess materials', 'Over-engineering every component', 'Designing for zero failure probability'], answer: 0 },
    { prompt: 'A pressure vessel is rated at 10 bar but a weld is showing cracks. Priority action?', options: ['Take it out of service and inspect', 'Monitor from a distance', 'Reduce pressure by 10% and continue', 'Repair while in service'], answer: 0 },
  ],
  scientific_method: [
    { prompt: 'A study shows correlation between ice cream sales and drowning deaths. This means:', options: ['A confounding variable (summer) explains both', 'Ice cream causes drowning', 'Drowning causes ice cream sales', 'The data is fabricated'], answer: 0 },
    { prompt: 'A p-value of 0.03 means:', options: ['If the null hypothesis is true, this result occurs 3% of the time by chance', 'There is a 97% chance the hypothesis is correct', 'The effect size is meaningful', 'The study is 97% accurate'], answer: 0 },
    { prompt: 'A double-blind trial means:', options: ['Neither participants nor researchers know who receives treatment', 'Only participants are unaware', 'Only researchers are unaware', 'The data is collected twice'], answer: 0 },
    { prompt: 'A study has high internal validity but low external validity. This means:', options: ['Results are accurate within the study but may not generalise broadly', 'The study is not valid', 'Results generalise well but the study is internally flawed', 'Both the design and generalisability are strong'], answer: 0 },
    { prompt: 'Control group in an experiment is used to:', options: ['Provide a baseline without the variable being tested', 'Test the opposite hypothesis', 'Double the sample size', 'Test multiple variables simultaneously'], answer: 0 },
    { prompt: 'Replication in science is important because:', options: ['It confirms results are reliable and not due to chance', 'It proves the original researcher was wrong', 'It is required by law', 'It generates more data regardless of outcome'], answer: 0 },
    { prompt: 'A sample size of 10 shows strong results. Before concluding:', options: ['Check whether the sample is large enough to be statistically reliable', 'Publish immediately', 'Assume results are definitive', 'Expand to 100 participants to confirm the same result'], answer: 0 },
    { prompt: 'Peer review in research serves to:', options: ['Evaluate quality and validity before publication', 'Guarantee the research is correct', 'Decide on funding allocation', 'Replace the editorial process'], answer: 0 },
    { prompt: 'An outlier in data should be:', options: ['Investigated for cause before deciding to include or exclude', 'Always removed', 'Always kept', 'Averaged with adjacent values'], answer: 0 },
    { prompt: 'Type I error in hypothesis testing is:', options: ['Rejecting a true null hypothesis (false positive)', 'Accepting a false null hypothesis', 'A calculation mistake', 'A sampling error'], answer: 0 },
  ],
  creative_judgment: [
    { prompt: 'A client dislikes your creative concept but cannot articulate why. Best response?', options: ['Ask open questions to uncover their underlying concerns', 'Defend your concept with evidence', 'Immediately redesign everything', 'Present three alternatives without discussion'], answer: 0 },
    { prompt: 'A design must work for colorblind users. The most important consideration is:', options: ['Using contrast and shape — not colour alone — to convey meaning', 'Using only black and white', 'Adding a colour-blind mode as an afterthought', 'Asking colourblind users to adjust their device settings'], answer: 0 },
    { prompt: 'A headline must convey urgency and trust simultaneously. The tension here is:', options: ['Emotional impact vs. credibility — both are valid goals', 'Click-bait vs. no engagement', 'Long vs. short copy', 'Colour vs. typography'], answer: 0 },
    { prompt: 'A story structure that builds tension before resolution follows:', options: ['The narrative arc: setup, conflict, climax, resolution', 'A list format', 'Reverse chronological order', 'A data-first approach'], answer: 0 },
    { prompt: 'A user interface is beautiful but users cannot find key features. The priority issue is:', options: ['Usability over aesthetics — form follows function', 'Aesthetics — users adapt over time', 'Adding a tutorial', 'Simplifying the colour palette'], answer: 0 },
    { prompt: 'A brand\'s visual identity is inconsistent across channels. This primarily damages:', options: ['Brand recognition and trust', 'SEO ranking', 'Customer service quality', 'Product pricing'], answer: 0 },
    { prompt: 'When editing a 10-minute video down to 3 minutes, you should cut:', options: ['Any content that doesn\'t serve the core message', 'The beginning — start in the middle', 'All pauses and silences regardless of context', 'The ending — leave viewers wanting more'], answer: 0 },
    { prompt: 'A journalist has a strong story but only one anonymous source. They should:', options: ['Seek corroboration or additional sources before publishing', 'Publish immediately — the story matters', 'Reveal the source to verify', 'Drop the story entirely'], answer: 0 },
    { prompt: 'White space in graphic design primarily serves to:', options: ['Guide the eye and improve readability', 'Fill empty areas with content', 'Make a design look unfinished', 'Reduce printing costs'], answer: 0 },
    { prompt: 'A campaign tests well in focus groups but fails in the market. Most likely reason?', options: ['Focus groups don\'t replicate real buying behaviour', 'The product was poor quality', 'The market research firm was unreliable', 'The campaign ran too long'], answer: 0 },
  ],
};

const QUESTIONS_PER_GAME = 7;
const TIME_PER_QUESTION = 30; // seconds

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

export default function LogicDeductionGame({ sessionId, onComplete, config }: Props) {
  const variant = config.variant ?? 'deduction';
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qStartRef = useRef(0);

  const advance = useCallback((finalScore: number, correct: number) => {
    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'game_complete',
      timestamp: Date.now(),
      data: { score: finalScore, correctCount: correct, totalQuestions: QUESTIONS_PER_GAME },
    }).catch(() => {});
    setPhase('done');
    onComplete(finalScore);
  }, [sessionId, variant, onComplete]);

  function startGame() {
    const pool = [...QUESTIONS[variant]]
      .sort(() => Math.random() - 0.5)
      .slice(0, QUESTIONS_PER_GAME)
      .map(q => {
        // Shuffle options so the correct answer isn't always at index 0
        const correctAnswer = q.options[q.answer];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        return { ...q, options: shuffled, answer: shuffled.indexOf(correctAnswer) };
      });
    setQuestions(pool);
    setCurrentQ(0);
    setScore(0);
    setCorrectCount(0);
    setPhase('playing');
    qStartRef.current = Date.now();
    setTimeLeft(TIME_PER_QUESTION);
  }

  // Countdown timer — visual tick only; game logic timeout handled separately
  useEffect(() => {
    if (phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    // Visual countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    // Actual timeout that triggers game logic
    timeoutRef.current = setTimeout(() => {
      clearInterval(timerRef.current!);
      handleAnswer(-1);
    }, TIME_PER_QUESTION * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, currentQ]);

  function handleAnswer(optionIndex: number) {
    if (phase !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentQ];
    const correct = optionIndex === q.answer;
    const timeSpent = (Date.now() - qStartRef.current) / 1000;
    const timeBonus = correct ? Math.round(Math.max(0, (TIME_PER_QUESTION - timeSpent) / TIME_PER_QUESTION) * 5) : 0;
    const qScore = correct ? 10 + timeBonus : 0;
    const newScore = score + qScore;
    const newCorrect = correctCount + (correct ? 1 : 0);

    setSelected(optionIndex);
    setScore(newScore);
    setCorrectCount(newCorrect);
    setPhase('feedback');

    logEvent({
      sessionId,
      gameId: `logic_${variant}`,
      eventType: 'question_answer',
      timestamp: Date.now(),
      data: { questionIndex: currentQ, correct, timeSpent, score: qScore },
    }).catch(() => {});

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        advance(newScore, newCorrect);
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setPhase('playing');
        qStartRef.current = Date.now();
        setTimeLeft(TIME_PER_QUESTION);
      }
    }, 1000);
  }

  const VARIANT_META: Record<Variant, { title: string; desc: string }> = {
    deduction:            { title: '🔎 Logic Deduction',       desc: 'Each puzzle has one logically correct conclusion. Think carefully.' },
    patterns:             { title: '🔲 Abstract Patterns',     desc: 'Identify the rule and find the missing number.' },
    verbal:               { title: '💬 Word Logic',            desc: 'Word analogies and odd-one-out puzzles.' },
    debugging:            { title: '🐛 Debug Scenarios',       desc: 'Real software debugging scenarios. Identify the root cause.' },
    systems:              { title: '🏗️ Systems Thinking',      desc: 'Architecture and systems decisions. Think about scale and trade-offs.' },
    boolean:              { title: '⚙️ Boolean Logic',         desc: 'Logical conditions and boolean expressions. Think precisely.' },
    priority:             { title: '⚖️ Engineering Decisions', desc: 'Real-world engineering trade-offs. What would you do?' },
    clinical:             { title: '🩺 Clinical Reasoning',    desc: 'Diagnose from symptoms. Medical reasoning under uncertainty.' },
    medical_ethics:       { title: '⚕️ Medical Ethics',        desc: 'Healthcare ethics dilemmas — patient rights and professional duty.' },
    financial_analysis:   { title: '📊 Financial Analysis',   desc: 'Financial ratios, investment trade-offs, and market signals.' },
    risk_assessment:      { title: '🎲 Risk Assessment',       desc: 'Probability reasoning and risk management decisions.' },
    legal_reasoning:      { title: '⚖️ Legal Reasoning',       desc: 'Case analysis, legal principles, and evidence evaluation.' },
    pedagogy:             { title: '📚 Teaching Judgment',     desc: 'Classroom decisions, learning theory, and student support.' },
    behavioral_judgment:  { title: '🧠 Behavioral Insight',   desc: 'Human behaviour, psychology, and social reasoning.' },
    engineering_analysis: { title: '🔧 Engineering Analysis', desc: 'Structural, mechanical, and physical engineering problems.' },
    scientific_method:    { title: '🔬 Scientific Method',     desc: 'Research design, hypothesis testing, and data interpretation.' },
    creative_judgment:    { title: '🎨 Creative Judgment',    desc: 'Creative and editorial decisions — design, narrative, communication.' },
  };
  const { title: gameTitle, desc: gameDesc } = VARIANT_META[variant] ?? VARIANT_META.deduction;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{gameTitle}</Text>
        {phase === 'playing' && (
          <View style={styles.headerRow}>
            <Text style={styles.sub}>Q {currentQ + 1} / {questions.length}  ·  Score: {score}</Text>
            <View style={[styles.timerBadge, timeLeft <= 8 && styles.timerUrgent]}>
              <Text style={[styles.timerText, timeLeft <= 8 && styles.timerTextUrgent]}>{timeLeft}s</Text>
            </View>
          </View>
        )}
      </View>

      {phase === 'intro' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>{gameDesc}</Text>
          <Text style={styles.infoSub}>{QUESTIONS_PER_GAME} questions · {TIME_PER_QUESTION}s per question</Text>
          <TouchableOpacity style={styles.btn} onPress={startGame}>
            <Text style={styles.btnText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {(phase === 'playing' || phase === 'feedback') && questions.length > 0 && (
        <View style={styles.qContainer}>
          <View style={styles.qBox}>
            <Text style={styles.qText}>{questions[currentQ].prompt}</Text>
          </View>
          <View style={styles.options}>
            {questions[currentQ].options.map((opt, i) => {
              const isCorrect = i === questions[currentQ].answer;
              const isSelected = selected === i;
              let bg = '#16213e';
              let border = '#2a2a5e';
              if (phase === 'feedback') {
                if (isCorrect) { bg = '#1a3a1a'; border = '#66bb6a'; }
                else if (isSelected && !isCorrect) { bg = '#3a1a1a'; border = '#ef5350'; }
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => handleAnswer(i)}
                  disabled={phase === 'feedback'}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabel}>{String.fromCharCode(65 + i)}.</Text>
                  <Text style={styles.optionText}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  header: { marginBottom: 16 },
  title: { color: '#e0e0ff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sub: { color: '#9999cc', fontSize: 13 },
  timerBadge: { backgroundColor: '#16213e', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#3a3a6e' },
  timerUrgent: { backgroundColor: '#3a1a1a', borderColor: '#ef5350' },
  timerText: { color: '#9999cc', fontSize: 13, fontWeight: '700' },
  timerTextUrgent: { color: '#ef5350' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  infoText: { color: '#c0c0ee', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  infoSub: { color: '#6666aa', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: '#5c6bc0', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  qContainer: { flex: 1 },
  qBox: { backgroundColor: '#16213e', borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2a2a5e' },
  qText: { color: '#e0e0ff', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1.5, gap: 10 },
  optionLabel: { color: '#5c6bc0', fontSize: 15, fontWeight: '700', width: 24 },
  optionText: { color: '#c0c0ee', fontSize: 15, flex: 1 },
});
