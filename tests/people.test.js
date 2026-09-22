import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializePeople, validatePeople, getPeopleReport, getPeopleAttendanceModifier, applyPeopleAction, settlePeople } from '../people.js';
import { createCampaign, performAction, advanceTurn, getReadiness, queueOrder, exportCampaign, importCampaign } from '../engine.js';

const context = {
  spend(actor, amount, reason, turn) { assert(amount >= 0 && amount <= actor.wallet); actor.wallet -= amount; actor.ledger.unshift({ turn, isk: -amount, reason }); },
  income(actor, amount, reason, turn) { actor.wallet += amount; actor.ledger.unshift({ turn, isk: amount, reason }); },
  log(state, type, title, text) { state.log.unshift({ turn: state.turn, type, title, text }); state.log.length = Math.min(180, state.log.length); }
};
function make() {
  const state = { turn: 0, result: null, player: { pilots: 80, wallet: 850_000_000, morale: 76, fatigue: 12, upgrades: { command: 0 }, lifetimeLosses: 0, totalLP: 0, ledger: [] }, fleets: [
    { id: 'scouts', ownerId: 'player', ships: 8, doctrineId: 'rifter', order: { type: 'rest' }, readiness: 60 },
    { id: 'strike', ownerId: 'player', ships: 10, doctrineId: 'catalyst', order: { type: 'rest' }, readiness: 60 },
    { id: 'main', ownerId: 'player', ships: 6, doctrineId: 'caracal', order: { type: 'rest' }, readiness: 60 }
  ], jobs: [], shipments: [], lastTurn: { deliveries: [] }, log: [] };
  initializePeople(state); return state;
}
const clone = state => JSON.parse(JSON.stringify(state));
const person = (state, id) => state.people.cohorts.find(c => c.id === id);
const action = (state, value) => applyPeopleAction(state, value, context);
function tick(state) { state.turn++; settlePeople(state, context); assert.equal(validatePeople(state), true); }
function active(state, type = 'offensive') { for (const f of state.fleets) { f.order.type = type; f.activeShips = f.ships; f.operationDone = true; } }

test('legacy initialization has differentiated cohorts, fictional officers and stable default turnout', () => {
  const state = make(), report = getPeopleReport(state);
  assert.equal(validatePeople(state), true); assert.equal(report.cohorts.length, 6);
  assert.equal(report.cohorts.reduce((sum, c) => sum + c.count, 0), 80);
  assert.equal(new Set(report.cohorts.map(c => c.preference)).size, 6);
  assert(report.notice.includes('fictional')); assert(report.officers.every(o => o.description.includes('Fictional officer')));
  assert(getPeopleAttendanceModifier(state) >= 1 && getPeopleAttendanceModifier(state) <= 1.12);
  assert.equal(getPeopleAttendanceModifier(state, 'ally'), 1);
  const before = JSON.stringify(state); initializePeople(state); assert.equal(JSON.stringify(state), before);
  const malformed = { ...state, people: null }; initializePeople(malformed); assert.throws(() => validatePeople(malformed));
});

test('cohort preferences distinguish a cheap objective from a close fight and heavy doctrines', () => {
  const cheap = make(), heavy = make(); active(cheap); active(heavy);
  for (const f of heavy.fleets) f.doctrineId = 'dominix';
  tick(cheap); tick(heavy);
  assert(person(cheap, 'new').enjoyment > person(heavy, 'new').enjoyment);
  assert(person(cheap, 'veterans').enjoyment > person(cheap, 'hunters').enjoyment);
  const closeFight = make(); active(closeFight); closeFight.fleets[0].engaged = true; closeFight.player.lifetimeLosses = 2; tick(closeFight);
  assert(person(closeFight, 'hunters').enjoyment > person(cheap, 'hunters').enjoyment, 'an interesting small loss can beat a dull uncontested win');
});

test('call-up policy increases immediate turnout but repeated demand costs fatigue and trust', () => {
  const optional = make(), mandatory = make(); active(optional); active(mandatory);
  action(optional, { type: 'peoplePolicy', policy: 'attendance', value: 'optional' });
  action(mandatory, { type: 'peoplePolicy', policy: 'attendance', value: 'mandatory' });
  assert(getPeopleAttendanceModifier(mandatory) > getPeopleAttendanceModifier(optional));
  for (let i = 0; i < 6; i++) { tick(optional); tick(mandatory); }
  assert(person(mandatory, 'veterans').fatigue > person(optional, 'veterans').fatigue);
  assert(person(mandatory, 'veterans').trust < person(optional, 'veterans').trust);
});

test('protected rest reduces turnout and restores one cohort without changing physical inventory', () => {
  const state = make(); active(state); const c = person(state, 'support'); c.fatigue = 80;
  const initial = getPeopleAttendanceModifier(state), hulls = state.fleets.map(f => f.ships);
  action(state, { type: 'peopleRest', cohortId: 'support' });
  assert(getPeopleAttendanceModifier(state) < initial); assert.equal(getPeopleReport(state).cohorts.find(c => c.id === 'support').readyEstimate, 0);
  tick(state); assert.equal(c.restRemaining, 1); assert(c.fatigue < 80); tick(state);
  assert.equal(c.restRemaining, 0); assert.deepEqual(state.fleets.map(f => f.ships), hulls); assert.equal(state.player.pilots, 80);
});

test('recognition spends actual ISK, remembers support work and cannot be spammed', () => {
  const state = make(), wallet = state.player.wallet, trust = person(state, 'support').trust;
  action(state, { type: 'peopleRecognize', cohortId: 'support' });
  assert.equal(state.player.wallet, wallet - 4_000_000); assert(person(state, 'support').trust > trust);
  assert(state.people.memories[0].text.includes('Support volunteers'));
  const before = JSON.stringify(state); assert.throws(() => action(state, { type: 'peopleRecognize', cohortId: 'support' }), /recently/); assert.equal(JSON.stringify(state), before);
});

test('officer development completes after three watches and yields concrete workload benefits', () => {
  const trained = make(), baseline = make(); active(trained); active(baseline);
  action(trained, { type: 'peopleTrainOfficer', officerId: 'fc' });
  const fc = trained.people.officers.find(o => o.id === 'fc'); assert.equal(fc.level, 1); assert.equal(trained.player.wallet, 832_000_000);
  for (let i = 0; i < 2; i++) { tick(trained); tick(baseline); assert.equal(fc.level, 1); }
  tick(trained); tick(baseline); assert.equal(fc.level, 2); assert.equal(fc.trainingUntil, 0);
  assert(person(trained, 'veterans').fatigue < person(baseline, 'veterans').fatigue);
  assert(getPeopleAttendanceModifier(trained) > getPeopleAttendanceModifier(baseline));
});

test('logistics officers improve recovery without reconstructing ships or minting pilots', () => {
  const state = make(); action(state, { type: 'peopleTrainOfficer', officerId: 'logistics' });
  const ships = state.fleets.map(f => f.ships); tick(state); tick(state); tick(state);
  assert(state.fleets.every(f => f.readiness > 60)); assert.deepEqual(state.fleets.map(f => f.ships), ships); assert.equal(state.player.pilots, 80);
});

test('accessible-sortie promises resolve only from completed eligible work before the deadline', () => {
  const kept = make(); const request = kept.people.requests[0];
  action(kept, { type: 'peopleRespond', requestId: request.id, choiceId: 'promise' });
  assert.equal(getPeopleReport(kept).requests[0].choices.length, 0);
  active(kept, 'move'); tick(kept); assert.equal(kept.people.requests.length, 1, 'travel alone does not fulfill a sortie');
  active(kept, 'patrol'); tick(kept); assert.equal(kept.people.requests.length, 0);
  assert(kept.people.memories.some(m => m.title === 'Accessible sortie promise kept'));
  const broken = make(), declined = make();
  action(broken, { type: 'peopleRespond', requestId: broken.people.requests[0].id, choiceId: 'promise' });
  action(declined, { type: 'peopleRespond', requestId: declined.people.requests[0].id, choiceId: 'decline' });
  for (let i = 0; i < 3; i++) { tick(broken); tick(declined); }
  assert(broken.people.memories.some(m => m.title === 'A pilot promise was broken'));
  assert(person(broken, 'new').trust < person(declined, 'new').trust);
});

test('ignored requests expire with memories and disputes offer distinct consequences', () => {
  const state = make(); for (let i = 0; i < 6; i++) tick(state);
  assert(state.people.memories.some(m => m.title === 'A roster request went unanswered'));
  const request = state.people.requests.find(r => r.kind === 'credit'); assert(request);
  const shared = clone(state), dismissed = clone(state), rewarded = clone(state);
  action(shared, { type: 'peopleRespond', requestId: request.id, choiceId: 'share' });
  action(dismissed, { type: 'peopleRespond', requestId: request.id, choiceId: 'dismiss' });
  action(rewarded, { type: 'peopleRespond', requestId: request.id, choiceId: 'reward' });
  assert(person(shared, 'support').trust > person(dismissed, 'support').trust);
  assert(person(dismissed, 'veterans').enjoyment > person(shared, 'veterans').enjoyment);
  assert.equal(rewarded.player.wallet, state.player.wallet - 10_000_000);
});

test('a new-pilot promise remains outstanding during protected rest even if other pilots run cheap fleets', () => {
  const state = make(); active(state, 'patrol');
  action(state, { type: 'peopleRespond', requestId: state.people.requests[0].id, choiceId: 'promise' });
  action(state, { type: 'peopleRest', cohortId: 'new' });
  tick(state); tick(state);
  assert.equal(state.people.requests.length, 1, 'the protected-rest watches cannot fulfill the new-pilot promise');
  tick(state); assert.equal(state.people.requests.length, 0);
  assert(state.people.memories.some(m => m.title === 'Accessible sortie promise kept'));
});

test('loss assistance is bounded by cash and watch ceiling and never creates replacement hulls', () => {
  const state = make(); action(state, { type: 'peoplePolicy', policy: 'replacements', value: 'full' });
  state.player.lifetimeLosses = 12; state.player.wallet = 7_000_000; const ships = state.fleets.map(f => f.ships);
  tick(state); assert.equal(state.player.wallet, 0); assert.equal(state.people.replacementSpent, 7_000_000);
  assert(state.people.memories.some(m => m.title === 'Replacement assistance underfunded')); assert.deepEqual(state.fleets.map(f => f.ships), ships);
  state.player.wallet = 50_000_000; state.player.lifetimeLosses += 12; tick(state);
  assert.equal(state.player.wallet, 26_000_000); assert.equal(state.people.replacementSpent, 31_000_000);
  const before = JSON.stringify(state); settlePeople(state, context); assert.equal(JSON.stringify(state), before, 'duplicate settlement cannot pay twice');
});

test('retention removes only unassigned dissatisfied volunteers and recruitment preserves total cohort counts', () => {
  const state = make(); active(state);
  for (const c of state.people.cohorts) { c.enjoyment = 0; c.trust = 0; c.fatigue = 100; c.neglectedWatches = 8; }
  for (let i = 0; i < 3; i++) tick(state);
  assert(state.player.pilots < 80); assert.equal(state.people.departed, 6); assert.equal(state.fleets.reduce((sum, f) => sum + f.ships, 0), 24);
  const remaining = state.player.pilots;
  state.fleets[0].ships += remaining - 24;
  for (let i = 0; i < 6; i++) tick(state);
  assert.equal(state.player.pilots, remaining, 'assigned physical hulls bound voluntary departures');
  state.player.pilots += 10; tick(state);
  assert.equal(state.people.cohorts.reduce((sum, c) => sum + c.count, 0), state.player.pilots);
});

test('failed social actions validate first and leave state byte-for-byte unchanged', () => {
  for (const invalid of [
    { type: 'peoplePolicy', policy: 'attendance', value: 'always' },
    { type: 'peopleRecognize', cohortId: 'outsiders' },
    { type: 'peopleRest', cohortId: 'outsiders' },
    { type: 'peopleTrainOfficer', officerId: 'outsiders' },
    { type: 'peopleRespond', requestId: 'people-request-1', choiceId: 'invent' },
    { type: 'peopleRespond', requestId: 'people-request-999', choiceId: 'fund' }
  ]) { const state = make(), before = JSON.stringify(state); assert.throws(() => action(state, invalid)); assert.equal(JSON.stringify(state), before); }
  const poor = make(); poor.player.wallet = 0; const before = JSON.stringify(poor);
  for (const invalid of [{ type: 'peopleRecognize', cohortId: 'support' }, { type: 'peopleTrainOfficer', officerId: 'fc' }, { type: 'peopleRespond', requestId: 'people-request-1', choiceId: 'fund' }]) { assert.throws(() => action(poor, invalid), /ISK/); assert.equal(JSON.stringify(poor), before); }
  assert.equal(action(poor, { type: 'procure' }), false); assert.equal(JSON.stringify(poor), before);
});

test('social saves reject malformed identities, policies, numbers, schedules and unbounded collections', () => {
  const corruptions = [
    s => { s.people.cohorts[0].fatigue = NaN; },
    s => { s.people.cohorts[0].count++; },
    s => { s.people.cohorts[0].id = 'real-pilot'; },
    s => { s.people.cohorts[0].name = 'unsourced identity'; },
    s => { s.people.officers[0].level = 8; },
    s => { s.people.officers[0].trainingUntil = 0.5; },
    s => { s.people.policies.attendance = 'coerced'; },
    s => { s.people.requests[0].dueTurn = 900; },
    s => { s.people.requests[0].kind = 'constructor'; },
    s => { s.people.requests[0].id = 'people-request-999'; },
    s => { s.people.lastSettledTurn = -1; },
    s => { s.player.lifetimeLosses = 1; },
    s => { s.player.totalLP = 1; },
    s => { s.people.memories = Array(41).fill({ turn: 0, title: 'x', text: 'y', tone: 'neutral' }); },
    s => { s.people.nextRequestId = Infinity; }
  ];
  for (const corrupt of corruptions) { const state = make(); corrupt(state); assert.throws(() => validatePeople(state)); }
});

test('save round trips preserve deterministic pending promises, role training and bounded history', () => {
  const original = make(); active(original);
  action(original, { type: 'peopleRespond', requestId: original.people.requests[0].id, choiceId: 'promise' });
  action(original, { type: 'peopleTrainOfficer', officerId: 'mentor' });
  action(original, { type: 'peopleRest', cohortId: 'support' });
  const restored = clone(original);
  for (let i = 0; i < 120; i++) { tick(original); tick(restored); }
  assert.deepEqual(restored, original); assert(original.people.memories.length <= 40); assert(original.people.requests.length <= 3);
  assert(original.player.pilots >= original.fleets.reduce((sum, f) => sum + f.ships, 0));
  const report = getPeopleReport(original); report.cohorts[0].trust = -100; report.memories.length = 0; assert.equal(validatePeople(original), true, 'report is a detached view');
});

test('engine integration honors protected rest and persists a real operation promise through export and import', () => {
  const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
  const state = createCampaign(snapshot, { seed: 'people-integration' });
  for (const c of state.people.cohorts) performAction(state, { type: 'peopleRest', cohortId: c.id });
  assert.equal(getReadiness(state).availablePilots, 0);
  const hulls = state.fleets.filter(f => f.ownerId === 'player').map(f => f.ships);
  advanceTurn(state); advanceTurn(state);
  assert(getReadiness(state).availablePilots > 0);
  assert.deepEqual(state.fleets.filter(f => f.ownerId === 'player').map(f => f.ships), hulls);
  performAction(state, { type: 'peopleRespond', requestId: state.people.requests[0].id, choiceId: 'promise' });
  const restored = importCampaign(exportCampaign(state), snapshot);
  for (const branch of [state, restored]) {
    for (const actor of branch.actors) { actor.wallet = 0; actor.lp = 0; actor.pilots = 0; for (const key of Object.keys(actor.hangar)) actor.hangar[key] = 0; }
    for (const fleet of branch.fleets.filter(f => f.ownerId !== 'player')) fleet.ships = 0;
    const fleet = branch.fleets.find(f => f.ownerId === 'player' && f.doctrineId === 'rifter');
    queueOrder(branch, fleet.id, { type: 'patrol', targetId: fleet.systemId });
    advanceTurn(branch);
    assert(branch.people.memories.some(m => m.title === 'Accessible sortie promise kept'));
  }
  assert.equal(exportCampaign(restored), exportCampaign(state));
});

test('zero attendance prevents unmanned hull movement and cannot overcount a remaining small cohort', () => {
  const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
  const state = createCampaign(snapshot, { seed: 'people-attendance-review' });
  const ready = getReadiness(state).availablePilots;
  const reported = getPeopleReport(state).cohorts.reduce((sum, c) => sum + c.readyEstimate, 0);
  assert(reported <= ready && ready - reported < state.people.cohorts.length, 'cohort estimates include corporation-wide availability');
  for (const c of state.people.cohorts) if (c.id !== 'income') performAction(state, { type: 'peopleRest', cohortId: c.id });
  const remaining = person(state, 'income'); remaining.enjoyment = 100; remaining.trust = 100; remaining.fatigue = 0;
  state.player.morale = 100; state.player.fatigue = 0;
  assert(getReadiness(state).availablePilots <= remaining.count, 'positive willingness cannot invent non-resting people');
  performAction(state, { type: 'peopleRest', cohortId: 'income' });
  const fleet = state.fleets.find(f => f.ownerId === 'player'), origin = fleet.systemId;
  queueOrder(state, fleet.id, { type: 'move', targetId: state.systems[origin].neighbors[0] });
  advanceTurn(state);
  assert.equal(state.fleets.find(f => f.id === fleet.id).systemId, origin, 'unmanned ships stay in place');
  assert.equal(state.player.fatigue, 0, 'resting pilots do not accrue corporation workload from unfulfilled move orders');
});

test('social requests remain valid beyond the original campaign horizon and closed campaigns reject actions atomically', () => {
  const sandbox = make(); sandbox.turn = 5_999; sandbox.people.lastSettledTurn = 5_999; sandbox.people.requests = []; sandbox.people.nextRequestId = 1_001;
  tick(sandbox); assert.equal(sandbox.people.requests[0].id, 'people-request-1001');
  const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
  const state = createCampaign(snapshot, { maxTurns: 8 });
  while (!state.result) advanceTurn(state);
  const before = exportCampaign(state);
  assert.throws(() => performAction(state, { type: 'peopleRecognize', cohortId: 'support' }), /ended/);
  assert.throws(() => performAction(state, { type: 'diplomacyAid', allyId: state.allies[0].id }), /ended/);
  assert.equal(exportCampaign(state), before);
});
