/** Authored social simulation. All officers below are fictional scenario characters. */
const NOTICE = 'Cohorts, officers, preferences and disputes are authored simulation. These officers are fictional; their conduct is not attributed to real EVE players.';
const COHORTS = [
  { id: 'new', name: 'New pilots', share: .25, preference: 'Accessible frigates and destroyers, mentoring and affordable losses.' },
  { id: 'hunters', name: 'Small-gang pilots', share: .15, preference: 'Patrols, scouting and close fights; repetitive uncontested objectives become dull.' },
  { id: 'veterans', name: 'Campaign veterans', share: .225, preference: 'Progress toward the mandate and reliable strategic fleets.' },
  { id: 'industry', name: 'Industrialists', share: .125, preference: 'Active production and visible credit for keeping the hangar stocked.' },
  { id: 'support', name: 'Support volunteers', share: .125, preference: 'Escorts, shared organizing work, protected rest and recognition.' },
  { id: 'income', name: 'Income-focused pilots', share: .125, preference: 'Completed sites, affordable doctrines and replacement assistance.' }
];
const OFFICERS = [
  { id: 'fc', name: 'Ari Seln', role: 'Fleet organizer', description: 'Fictional officer: deliberate, goal-focused and protective of volunteer FC time. Training reduces fleet workload and improves turnout.' },
  { id: 'logistics', name: 'Mira Tovan', role: 'Logistics coordinator', description: 'Fictional officer: practical, proud of support work and quick to request fair credit. Training shares support workload and improves resting-fleet readiness.' },
  { id: 'mentor', name: 'Ren Vale', role: 'New-pilot mentor', description: 'Fictional officer: patient and outspoken about accessible ships. Training improves new-pilot enjoyment during affordable operations.' }
];
const POLICIES = [
  { id: 'doctrine', name: 'Doctrine access', options: [
    { id: 'inclusive', name: 'Accessible fleets', description: 'New and income-focused pilots enjoy cheap operations more; veterans lose interest when heavy capabilities go unused.' },
    { id: 'balanced', name: 'Mixed doctrines', description: 'No policy bonus or penalty; each cohort responds to the operations you actually run.' },
    { id: 'elite', name: 'Specialist focus', description: 'Veterans enjoy heavy formations more; newcomers feel excluded by expensive doctrines.' }
  ] },
  { id: 'attendance', name: 'Participation expectations', options: [
    { id: 'optional', name: 'Optional fleets', description: 'Turnout is 6% less certain; active watches build less fatigue and retain trust.' },
    { id: 'scheduled', name: 'Scheduled rotation', description: 'Normal turnout and workload. Rotate fleets or cohorts to preserve participation.' },
    { id: 'mandatory', name: 'Strategic call-ups', description: 'Turnout rises 5%; each active watch adds fatigue and erodes trust.' }
  ] },
  { id: 'replacements', name: 'Loss assistance', options: [
    { id: 'none', name: 'No reimbursement', description: 'No automatic spending; losses reduce personal confidence, especially for new and income-focused pilots.' },
    { id: 'partial', name: 'Partial assistance', description: 'Pay 2M ISK per lost hull, capped at 24M each watch and available cash. Reimbursement creates no replacement ships.' },
    { id: 'full', name: 'Generous assistance', description: 'Pay 4M ISK per lost hull, capped at 24M each watch and available cash. Better financial confidence; more pressure on the corporation wallet.' }
  ] }
];
const REQUESTS = {
  onboarding: { title: 'An affordable fleet for the new pilots', text: 'Ren Vale asks for a meaningful role for new pilots. Fund mentoring now, promise an affordable operation, or explain that the campaign cannot spare the attention.', cohorts: ['new'], choices: [
    { id: 'fund', label: 'Fund mentoring', description: '8M ISK; new-pilot enjoyment +12 and trust +6.', cost: 8_000_000 },
    { id: 'promise', label: 'Promise an accessible sortie', description: 'Complete a non-rest, non-travel Rifter or Catalyst operation within three watches while new pilots are available. Keeping the promise builds trust; breaking it costs more than declining.', cost: 0 },
    { id: 'decline', label: 'Explain the constraints', description: 'No cost. New-pilot trust −3; a reasoned refusal is remembered.', cost: 0 }
  ] },
  rotation: { title: 'The support rota needs relief', text: 'Mira Tovan reports that the same volunteers keep doing the hauling and organizing. Protect a rest period, fund relief, or require another shift.', cohorts: ['support', 'industry'], choices: [
    { id: 'rotate', label: 'Protect two watches of rest', description: 'Support volunteers are unavailable for two watches; fatigue −10 and trust +8.', cost: 0 },
    { id: 'relief', label: 'Fund temporary relief', description: '12M ISK; support fatigue −18 and industrial fatigue −10, without removing volunteers from turnout.', cost: 12_000_000 },
    { id: 'insist', label: 'Require the extra shift', description: 'Veteran enjoyment +4, but support trust −10 and fatigue +8.', cost: 0 }
  ] },
  credit: { title: 'Who gets credit for the operation?', text: 'Mira Tovan and Ari Seln disagree over recognition. Support crews want their contribution acknowledged alongside the combat formations.', cohorts: ['support', 'industry', 'veterans'], choices: [
    { id: 'share', label: 'Share the public credit', description: 'Support and industrial enjoyment +10 and trust +5; veteran enjoyment −3.', cost: 0 },
    { id: 'reward', label: 'Reward every team', description: '10M ISK; each involved cohort gains 8 enjoyment and 4 trust.', cost: 10_000_000 },
    { id: 'dismiss', label: 'Credit the combat teams', description: 'Veteran enjoyment +7; support and industrial trust −8.', cost: 0 }
  ] },
  doctrine: { title: 'The roster disagrees about doctrine', text: 'Ren Vale wants accessible ships; Ari Seln wants a reliable strategic formation. Both can explain their case, but tonight’s emphasis has a cost.', cohorts: ['new', 'veterans'], choices: [
    { id: 'accessible', label: 'Prioritize accessible fleets', description: 'Set accessible doctrine policy; new-pilot trust +8, veteran enjoyment −4.', cost: 0 },
    { id: 'specialist', label: 'Prioritize specialists', description: 'Set specialist policy; veteran trust +8, new-pilot enjoyment −6.', cost: 0 },
    { id: 'mixed', label: 'Fund a mixed program', description: '8M ISK; set mixed doctrines and give both groups +6 enjoyment.', cost: 8_000_000 }
  ] }
};
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const own = state => state.fleets.filter(f => f.ownerId === 'player');
const cohort = (state, id) => state.people.cohorts.find(c => c.id === id);
const officer = (state, id) => state.people.officers.find(o => o.id === id);
const copy = value => JSON.parse(JSON.stringify(value));
const average = (people, key) => people.cohorts.reduce((sum, c) => sum + c.count * c[key], 0) / Math.max(1, people.cohorts.reduce((sum, c) => sum + c.count, 0));
function change(state, id, values) { const c = cohort(state, id); for (const [key, amount] of Object.entries(values)) c[key] = clamp(c[key] + amount); }
function memory(state, title, text, tone, context) {
  state.people.memories.unshift({ turn: state.turn, title, text, tone });
  state.people.memories.length = Math.min(40, state.people.memories.length);
  context?.log?.(state, 'people', title, text);
}
function openRequest(state, kind, context) {
  const p = state.people;
  if (p.requests.some(r => r.kind === kind) || p.requests.length >= 3) return;
  const request = { id: `people-request-${p.nextRequestId++}`, kind, openedTurn: state.turn, dueTurn: state.turn + 4, status: 'pending' };
  p.requests.push(request);
  context?.log?.(state, 'people', REQUESTS[kind].title, `${REQUESTS[kind].text} Respond by watch ${request.dueTurn}.`);
}

export function initializePeople(state) {
  if (state.people !== undefined) return state.people;
  let left = state.player.pilots;
  const cohorts = COHORTS.map((source, i) => {
    const count = i === COHORTS.length - 1 ? left : Math.floor(state.player.pilots * source.share); left -= count;
    return { id: source.id, count, enjoyment: 72, fatigue: 10, trust: 68, workStreak: 0, neglectedWatches: 0, restRemaining: 0, recognitionUntil: 0 };
  });
  state.people = { version: 1, cohorts, officers: OFFICERS.map(o => ({ id: o.id, level: 1, trainingUntil: 0 })), policies: { doctrine: 'balanced', attendance: 'scheduled', replacements: 'none' }, policyChangedTurn: { doctrine: -4, attendance: -4, replacements: -4 }, requests: [], memories: [], nextRequestId: 1, lastSettledTurn: state.turn, lastLifetimeLosses: state.player.lifetimeLosses, lastLP: state.player.totalLP, departed: 0, replacementSpent: 0 };
  openRequest(state, 'onboarding');
  return state.people;
}

function cohortModifier(state, c) {
  if (c.restRemaining) return 0;
  const p = state.people;
  const expectation = p.policies.attendance === 'mandatory' ? .05 : p.policies.attendance === 'optional' ? -.06 : 0;
  return clamp(.772 + c.enjoyment * .0025 + c.trust * .001 - c.fatigue * .002 + expectation + (officer(state, 'fc').level - 1) * .015, .35, 1.12);
}
export function getPeopleAttendanceModifier(state, ownerId = 'player') {
  if (ownerId !== 'player' || !state.people) return 1;
  const total = state.people.cohorts.reduce((sum, c) => sum + c.count, 0);
  if (!total) return 1;
  return clamp(state.people.cohorts.reduce((sum, c) => sum + c.count * cohortModifier(state, c), 0) / total, 0, 1.12);
}

function choicesFor(state, request) {
  if (request.status === 'promised') return [];
  return REQUESTS[request.kind].choices.map(choice => ({ ...choice, disabled: state.player.wallet < choice.cost }));
}
export function getPeopleReport(state) {
  const p = state.people; if (!p) return null;
  // Match the engine's corporation-wide participation estimate before applying
  // this cohort's willingness; the displayed rounded estimates never add people.
  const participation = clamp(.55 + state.player.morale * .005 - state.player.fatigue * .004 + (state.player.upgrades?.command || 0) * .04, .25, 1);
  return {
    notice: NOTICE, attendanceModifier: getPeopleAttendanceModifier(state),
    summary: { enjoyment: Math.round(average(p, 'enjoyment')), fatigue: Math.round(average(p, 'fatigue')), trust: Math.round(average(p, 'trust')), departures: p.departed, replacementSpent: p.replacementSpent },
    cohorts: p.cohorts.map(c => ({ ...copy(c), ...COHORTS.find(source => source.id === c.id), resting: c.restRemaining > 0, readyEstimate: Math.floor(c.count * Math.min(1, participation * cohortModifier(state, c))), recognitionCost: 4_000_000, recognitionCooldown: Math.max(0, c.recognitionUntil - state.turn) })),
    officers: p.officers.map(o => ({ ...copy(o), ...OFFICERS.find(source => source.id === o.id), trainingCost: 18_000_000 * o.level })),
    policies: POLICIES.map(policy => ({ ...copy(policy), value: p.policies[policy.id], cooldown: Math.max(0, p.policyChangedTurn[policy.id] + 2 - state.turn) })),
    requests: p.requests.map(request => ({ ...copy(request), title: REQUESTS[request.kind].title, text: request.status === 'promised' ? 'Promise outstanding: complete a non-rest, non-travel Rifter or Catalyst operation by the deadline with new pilots available rather than on protected rest. The result is checked after each watch.' : REQUESTS[request.kind].text, choices: choicesFor(state, request) })),
    memories: copy(p.memories)
  };
}

export function applyPeopleAction(state, action, context) {
  if (!['peoplePolicy', 'peopleRecognize', 'peopleRest', 'peopleTrainOfficer', 'peopleRespond'].includes(action?.type)) return false;
  assert(state.people, 'Pilot management is not initialized.');
  assert(!state.result, 'This campaign has ended.');
  const p = state.people;
  if (action.type === 'peoplePolicy') {
    const policy = POLICIES.find(item => item.id === action.policy);
    assert(policy && policy.options.some(item => item.id === action.value), 'Choose a valid pilot policy.');
    assert(p.policies[action.policy] !== action.value, 'That pilot policy is already active.');
    assert(state.turn >= p.policyChangedTurn[action.policy] + 2, 'Give this policy two watches before changing it again.');
    p.policies[action.policy] = action.value; p.policyChangedTurn[action.policy] = state.turn;
    memory(state, `${policy.name} changed`, policy.options.find(item => item.id === action.value).description, 'neutral', context);
  } else if (action.type === 'peopleRecognize') {
    const c = cohort(state, action.cohortId);
    assert(c && c.count > 0, 'Choose a populated pilot cohort.');
    assert(c.recognitionUntil <= state.turn, 'This cohort has already been recognized recently.');
    assert(state.player.wallet >= 4_000_000, 'Insufficient corporation ISK.');
    context.spend(state.player, 4_000_000, `Recognition: ${COHORTS.find(s => s.id === c.id).name}`, state.turn);
    change(state, c.id, { enjoyment: 8, trust: 5, fatigue: -3 }); c.neglectedWatches = Math.max(0, c.neglectedWatches - 2); c.recognitionUntil = state.turn + 4;
    memory(state, 'A contribution recognized', `${COHORTS.find(s => s.id === c.id).name} receive public credit and a 4M ISK appreciation grant. Repeated grants require four watches between them.`, 'positive', context);
  } else if (action.type === 'peopleRest') {
    const c = cohort(state, action.cohortId); assert(c && c.count > 0, 'Choose a populated pilot cohort.');
    assert(c.restRemaining === 0, 'This cohort is already on protected rest.');
    c.restRemaining = 2;
    memory(state, 'Protected rest agreed', `${COHORTS.find(s => s.id === c.id).name} sit out the next two watches. Assigned ships remain in their formations; reduced attendance may leave hulls unmanned.`, 'positive', context);
  } else if (action.type === 'peopleTrainOfficer') {
    const o = officer(state, action.officerId); assert(o, 'Choose a scenario officer.');
    assert(o.level < 3, 'This officer program is fully developed.');
    assert(o.trainingUntil === 0, 'This officer program is already training.');
    const cost = 18_000_000 * o.level; assert(state.player.wallet >= cost, 'Insufficient corporation ISK.');
    context.spend(state.player, cost, `Volunteer development: ${OFFICERS.find(s => s.id === o.id).role}`, state.turn);
    o.trainingUntil = state.turn + 3;
    memory(state, 'More volunteers learn the role', `${OFFICERS.find(s => s.id === o.id).name} begins a three-watch program. Benefits apply after completion; this develops organizers without creating pilots or hulls.`, 'positive', context);
  } else {
    const request = p.requests.find(r => r.id === action.requestId);
    assert(request && request.status === 'pending' && state.turn < request.dueTurn, 'That request is no longer awaiting a response.');
    const choice = REQUESTS[request.kind].choices.find(c => c.id === action.choiceId); assert(choice, 'Choose a valid response to this request.');
    assert(state.player.wallet >= choice.cost, 'Insufficient corporation ISK.');
    if (choice.cost) context.spend(state.player, choice.cost, REQUESTS[request.kind].title, state.turn);
    const id = choice.id;
    if (request.kind === 'onboarding') {
      if (id === 'fund') change(state, 'new', { enjoyment: 12, trust: 6 });
      if (id === 'promise') { request.status = 'promised'; request.dueTurn = state.turn + 3; }
      if (id === 'decline') change(state, 'new', { trust: -3 });
    } else if (request.kind === 'rotation') {
      if (id === 'rotate') { cohort(state, 'support').restRemaining = 2; change(state, 'support', { fatigue: -10, trust: 8 }); }
      if (id === 'relief') { change(state, 'support', { fatigue: -18, trust: 5 }); change(state, 'industry', { fatigue: -10, trust: 3 }); }
      if (id === 'insist') { change(state, 'support', { trust: -10, fatigue: 8 }); change(state, 'veterans', { enjoyment: 4 }); }
    } else if (request.kind === 'credit') {
      if (id === 'share') { for (const who of ['support', 'industry']) change(state, who, { enjoyment: 10, trust: 5 }); change(state, 'veterans', { enjoyment: -3 }); }
      if (id === 'reward') for (const who of REQUESTS.credit.cohorts) change(state, who, { enjoyment: 8, trust: 4 });
      if (id === 'dismiss') { change(state, 'veterans', { enjoyment: 7 }); for (const who of ['support', 'industry']) change(state, who, { trust: -8 }); }
    } else if (request.kind === 'doctrine') {
      p.policies.doctrine = id === 'accessible' ? 'inclusive' : id === 'specialist' ? 'elite' : 'balanced'; p.policyChangedTurn.doctrine = state.turn;
      if (id === 'accessible') { change(state, 'new', { trust: 8 }); change(state, 'veterans', { enjoyment: -4 }); }
      if (id === 'specialist') { change(state, 'veterans', { trust: 8 }); change(state, 'new', { enjoyment: -6 }); }
      if (id === 'mixed') for (const who of ['new', 'veterans']) change(state, who, { enjoyment: 6 });
    }
    memory(state, REQUESTS[request.kind].title, `${choice.label}. ${choice.description}`, ['decline', 'insist', 'dismiss'].includes(id) ? 'negative' : id === 'promise' ? 'neutral' : 'positive', context);
    if (request.status !== 'promised') p.requests = p.requests.filter(r => r.id !== request.id);
  }
  return true;
}

export function settlePeople(state, context) {
  const p = state.people; if (!p || p.lastSettledTurn === state.turn) return;
  assert(state.turn === p.lastSettledTurn + 1, 'Pilot management must settle one watch at a time.');
  const roster = p.cohorts.reduce((sum, c) => sum + c.count, 0);
  assert(state.player.pilots >= roster, 'Pilot roster changed outside retention or recruitment.');
  if (state.player.pilots > roster) cohort(state, 'new').count += state.player.pilots - roster;
  for (const o of p.officers) if (o.trainingUntil && o.trainingUntil <= state.turn) {
    o.trainingUntil = 0; o.level++;
    memory(state, 'Volunteer development completed', `${OFFICERS.find(source => source.id === o.id).role} reaches level ${o.level}. The role can now be shared more sustainably.`, 'positive', context);
  }
  const fleets = own(state), active = fleets.filter(f => f.ships > 0 && f.order.type !== 'rest' && !f.withdrawn && (f.activeShips ?? f.ships) > 0);
  const operating = active.filter(f => f.operationDone), affordable = operating.some(f => ['rifter', 'catalyst'].includes(f.doctrineId) && !['rest', 'move'].includes(f.order.type));
  const accessibleParticipation = affordable && cohort(state, 'new').count > 0 && cohort(state, 'new').restRemaining === 0;
  const combat = active.some(f => f.engaged), heavy = active.some(f => ['drake', 'dominix', 'caracal'].includes(f.doctrineId));
  const pressure = active.length / Math.max(1, fleets.length);
  const industry = state.jobs.some(j => j.ownerId === 'player' && j.type === 'manufacture') || state.lastTurn.deliveries.length > 0;
  const logistics = state.shipments.some(s => s.ownerId === 'player') || active.some(f => f.order.type === 'escort');
  const lpEarned = Math.max(0, state.player.totalLP - p.lastLP), losses = Math.max(0, state.player.lifetimeLosses - p.lastLifetimeLosses);
  const rate = p.policies.replacements === 'full' ? 4_000_000 : p.policies.replacements === 'partial' ? 2_000_000 : 0;
  const due = Math.min(24_000_000, losses * rate), paid = Math.min(due, Math.floor(state.player.wallet));
  if (paid) { context.spend(state.player, paid, 'Pilot loss reimbursement (no hulls created)', state.turn); p.replacementSpent += paid; }
  if (losses && rate) memory(state, paid >= due ? 'Replacement assistance settled' : 'Replacement assistance underfunded', `${paid / 1e6}M ISK paid for ${losses} lost hulls under the ${p.policies.replacements} policy. The watch ceiling is 24M ISK. Reimbursement never creates ships.`, paid >= due ? 'positive' : 'negative', context);
  const reimbursed = due > 0 && paid >= due;
  const fcRelief = (officer(state, 'fc').level - 1) * .7, supportRelief = (officer(state, 'logistics').level - 1) * 1.2;
  for (const c of p.cohorts) {
    if (c.restRemaining) { change(state, c.id, { fatigue: -16, enjoyment: 1.5, trust: 1 }); c.restRemaining--; c.workStreak = 0; c.neglectedWatches = Math.max(0, c.neglectedWatches - 1); continue; }
    const support = ['support', 'industry'].includes(c.id), workload = support ? clamp(pressure * .6 + (industry ? .2 : 0) + (logistics ? .25 : 0), 0, 1) : pressure;
    c.workStreak = workload > .4 ? Math.min(500, c.workStreak + 1) : 0;
    let joy = -.15, fatigue = workload * 6 - (1 - workload) * 8 - fcRelief - (support ? supportRelief : 0), trust = 0;
    if (c.id === 'new') joy += affordable ? 1.4 + (officer(state, 'mentor').level - 1) * .7 : heavy && pressure ? -.7 : 0;
    if (c.id === 'hunters') joy += combat ? 2 : active.some(f => f.order.type === 'patrol') ? .7 : operating.length ? -.4 : 0;
    if (c.id === 'veterans') joy += operating.length ? 1.1 : pressure ? -.25 : 0;
    if (c.id === 'industry') joy += industry ? 1 : 0;
    if (c.id === 'support') joy += active.some(f => f.order.type === 'escort' && f.operationDone) ? 1.1 : 0;
    if (c.id === 'income') joy += lpEarned ? 1.5 : pressure ? -.4 : 0;
    if (p.policies.doctrine === 'inclusive' && affordable) joy += ['new', 'income'].includes(c.id) ? 1 : c.id === 'veterans' && !heavy ? -.4 : 0;
    if (p.policies.doctrine === 'elite' && heavy) joy += c.id === 'veterans' ? 1 : c.id === 'new' ? -1.1 : 0;
    if (p.policies.attendance === 'mandatory' && workload > 0) { fatigue += 2; trust -= .7; }
    if (p.policies.attendance === 'optional' && workload > 0) { fatigue -= 1.5; trust += .25; }
    if (losses) { joy += combat && losses <= 3 && c.id === 'hunters' ? 1 : -Math.min(2, losses * .15); if (['new', 'income'].includes(c.id)) { joy += reimbursed ? 1.2 : -.8; trust += reimbursed ? .5 : -.5; } }
    if (support && c.workStreak > 4 && c.recognitionUntil <= state.turn) { joy -= .6; trust -= .35; }
    if (c.fatigue > 70) joy -= .8;
    change(state, c.id, { enjoyment: joy, fatigue, trust });
    const strained = c.enjoyment < 25 || (c.fatigue > 85 && c.trust < 35);
    c.neglectedWatches = strained ? Math.min(500, c.neglectedWatches + 1) : Math.max(0, c.neglectedWatches - 1);
    const assigned = fleets.reduce((sum, f) => sum + f.ships, 0);
    if (c.count && c.neglectedWatches >= 4 && state.turn % 3 === 0 && state.player.pilots > assigned) {
      c.count--; state.player.pilots--; p.departed++;
      memory(state, 'A volunteer steps away', `${COHORTS.find(source => source.id === c.id).name} lose one unassigned volunteer after sustained dissatisfaction. Ship losses do not kill pilots; roster retention is a separate consequence.`, 'negative', context);
    }
  }
  if (supportRelief) for (const f of fleets) if (f.order.type === 'rest' || f.withdrawn) f.readiness = clamp(f.readiness + supportRelief);
  const unresolved = [];
  for (const request of p.requests) {
    if (request.status === 'promised' && accessibleParticipation) {
      change(state, 'new', { enjoyment: 10, trust: 10 });
      memory(state, 'Accessible sortie promise kept', 'A Rifter or Catalyst formation completed meaningful work before the deadline. New pilots remember that leadership made room for them.', 'positive', context);
    } else if (state.turn >= request.dueTurn) {
      for (const who of REQUESTS[request.kind].cohorts) change(state, who, { trust: request.status === 'promised' ? -12 : -5, enjoyment: -4 });
      memory(state, request.status === 'promised' ? 'A pilot promise was broken' : 'A roster request went unanswered', `${REQUESTS[request.kind].title}: the watch ${request.dueTurn} deadline passed. ${request.status === 'promised' ? 'An accepted promise carries a greater trust cost than a reasoned refusal.' : 'The affected volunteers remember being ignored.'}`, 'negative', context);
    } else unresolved.push(request);
  }
  p.requests = unresolved;
  if (state.turn % 6 === 0) openRequest(state, ['credit', 'rotation', 'doctrine', 'onboarding'][Math.floor(state.turn / 6 - 1) % 4], context);
  p.lastLifetimeLosses = state.player.lifetimeLosses; p.lastLP = state.player.totalLP; p.lastSettledTurn = state.turn;
}

const finite = (value, name, min, max, integer = false) => assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)), `Invalid people ${name}.`);
function record(value, keys, name) { assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `Invalid people ${name}.`); }
export function validatePeople(state) {
  const p = state.people;
  record(p, ['version', 'cohorts', 'officers', 'policies', 'policyChangedTurn', 'requests', 'memories', 'nextRequestId', 'lastSettledTurn', 'lastLifetimeLosses', 'lastLP', 'departed', 'replacementSpent'], 'state');
  assert(p.version === 1, 'Unsupported people version.');
  assert(Array.isArray(p.cohorts) && p.cohorts.length === COHORTS.length && new Set(p.cohorts.map(c => c?.id)).size === COHORTS.length, 'Invalid people cohorts.');
  for (const c of p.cohorts) {
    record(c, ['id', 'count', 'enjoyment', 'fatigue', 'trust', 'workStreak', 'neglectedWatches', 'restRemaining', 'recognitionUntil'], 'cohort');
    assert(COHORTS.some(source => source.id === c.id), 'Unknown people cohort.'); finite(c.count, 'cohort population', 0, 160, true);
    for (const key of ['enjoyment', 'fatigue', 'trust']) finite(c[key], key, 0, 100);
    for (const key of ['workStreak', 'neglectedWatches']) finite(c[key], key, 0, 500, true);
    finite(c.restRemaining, 'protected rest', 0, 2, true); finite(c.recognitionUntil, 'recognition cooldown', 0, state.turn + 4, true);
  }
  assert(p.cohorts.reduce((sum, c) => sum + c.count, 0) === state.player.pilots, 'People cohort counts do not match the pilot roster.');
  assert(Array.isArray(p.officers) && p.officers.length === OFFICERS.length && new Set(p.officers.map(o => o?.id)).size === OFFICERS.length, 'Invalid scenario officers.');
  for (const o of p.officers) { record(o, ['id', 'level', 'trainingUntil'], 'officer'); assert(OFFICERS.some(source => source.id === o.id), 'Unknown scenario officer.'); finite(o.level, 'officer level', 1, 3, true); finite(o.trainingUntil, 'officer training', 0, state.turn + 3, true); assert(!o.trainingUntil || (o.level < 3 && o.trainingUntil > state.turn), 'Invalid officer training completion.'); }
  record(p.policies, POLICIES.map(policy => policy.id), 'policies'); record(p.policyChangedTurn, POLICIES.map(policy => policy.id), 'policy history');
  for (const policy of POLICIES) { assert(policy.options.some(option => option.id === p.policies[policy.id]), 'Invalid pilot policy.'); finite(p.policyChangedTurn[policy.id], 'policy change watch', -4, state.turn, true); }
  finite(p.nextRequestId, 'request sequence', 1, 100_000_000, true); assert(p.lastSettledTurn === state.turn, 'People settlement does not match the current watch.');
  finite(p.lastLifetimeLosses, 'recorded losses', 0, state.player.lifetimeLosses, true); finite(p.lastLP, 'recorded LP', 0, state.player.totalLP, true);
  assert(p.lastLifetimeLosses === state.player.lifetimeLosses && p.lastLP === state.player.totalLP, 'People accounting does not match settled losses and LP.');
  finite(p.departed, 'departed pilots', 0, 100_000_000, true); finite(p.replacementSpent, 'replacement spending', 0, 1e15, true);
  assert(Array.isArray(p.requests) && p.requests.length <= 3 && new Set(p.requests.map(r => r?.id)).size === p.requests.length && new Set(p.requests.map(r => r?.kind)).size === p.requests.length, 'Invalid pilot request queue.');
  for (const r of p.requests) {
    record(r, ['id', 'kind', 'openedTurn', 'dueTurn', 'status'], 'request');
    assert(typeof r.id === 'string' && /^people-request-[1-9]\d{0,7}$/.test(r.id) && Number(r.id.slice(15)) < p.nextRequestId && Object.hasOwn(REQUESTS, r.kind), 'Invalid pilot request identity.');
    assert(['pending', 'promised'].includes(r.status) && (r.status !== 'promised' || r.kind === 'onboarding'), 'Invalid pilot promise.');
    finite(r.openedTurn, 'request opening', 0, state.turn, true); finite(r.dueTurn, 'request deadline', state.turn + 1, state.turn + 4, true);
    assert(r.dueTurn >= r.openedTurn + 1 && r.dueTurn <= r.openedTurn + 6, 'Invalid request duration.');
  }
  assert(Array.isArray(p.memories) && p.memories.length <= 40, 'Invalid people memory history.');
  for (const m of p.memories) { record(m, ['turn', 'title', 'text', 'tone'], 'memory'); finite(m.turn, 'memory watch', 0, state.turn, true); assert(typeof m.title === 'string' && m.title.length <= 150 && typeof m.text === 'string' && m.text.length <= 1000 && ['positive', 'neutral', 'negative'].includes(m.tone), 'Invalid people memory.'); }
  return true;
}
