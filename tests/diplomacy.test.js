import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaign, performAction, getActionQuote, exportCampaign, importCampaign, advanceTurn, validateCampaign, findRoute, getReadiness } from '../engine.js';
import { initializeDiplomacy, validateDiplomacy, getDiplomacyReport, getDiplomacyQuote, settleDiplomacy, canRequestSupport, recordJointOperation, getDiplomacyPlanningBias, applyDiplomacyAction } from '../diplomacy.js';
import { DOCTRINES } from '../rules.js';

const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
const make = options => createCampaign(snapshot, { seed: 'political-memory', ...options });
const ally = (state, id) => state.actors.find(a => id ? a.id === id : a.faction === state.faction);
const record = (state, id) => state.diplomacy.organizations[id || ally(state).id];
const operation = state => ({ type: 'diplomacyPropose', allyId: ally(state).id, agreement: 'joint', targetId: state.objective.targetIds[0], mission: 'offensive' });
const finances = state => state.player.wallet + state.actors.reduce((sum, a) => sum + a.wallet, 0) + Object.values(state.diplomacy.organizations).flatMap(r => r.agreements).reduce((sum, p) => sum + p.escrow, 0);
const context = {
  log(state, type, title, text) { state.log.unshift({ id: `event-${state.nextId++}`, turn: state.turn, type, title, text }); state.log.length = Math.min(state.log.length, 180); },
  spend(a, isk, reason, turn) { assert(a.wallet >= isk); a.wallet -= isk; a.ledger.unshift({ turn, isk: -isk, reason }); },
  income(a, isk, reason, turn) { a.wallet += isk; a.ledger.unshift({ turn, isk, reason }); },
  findRoute, getReadiness,
  orderError() { return null; }
};
function settle(state, watches = 1) { for (let i = 0; i < watches; i++) { state.turn++; settleDiplomacy(state, context); } }

test('legacy initialization preserves every military and financial field and reports authored priorities', () => {
  for (const faction of ['caldari', 'gallente']) {
    const state = make({ faction }); delete state.diplomacy; const before = JSON.stringify(state);
    initializeDiplomacy(state); const diplomatic = state.diplomacy; delete state.diplomacy;
    assert.equal(JSON.stringify(state), before); state.diplomacy = diplomatic;
    initializeDiplomacy(state); assert.equal(state.diplomacy, diplomatic); assert.equal(validateDiplomacy(state), true);
    const report = getDiplomacyReport(state);
    assert.match(report.notice, /authored scenario behavior/); assert.equal(report.organizations.length, state.actors.length);
    assert(report.organizations.every(a => a.priority.description && !Object.hasOwn(a, 'wallet') && !Object.hasOwn(a, 'fleets')));
  }
});

test('negotiation counteroffers reserve no ISK and acceptance transfers the exact service contribution', () => {
  const state = make(), id = ally(state).id, original = finances(state), cash = state.player.wallet, allyCash = ally(state, id).wallet;
  const action = { type: 'diplomacyPropose', allyId: id, agreement: 'access', offerISK: 1_000_000 };
  assert.equal(getActionQuote(state, action).requiredISK, 15_000_000);
  performAction(state, action); assert.equal(state.player.wallet, cash); assert.equal(ally(state, id).wallet, allyCash);
  assert.equal(record(state, id).pending.requiredISK, 15_000_000); assert.equal(record(state, id).agreements.length, 0);
  performAction(state, { type: 'diplomacyAccept', allyId: id });
  assert.equal(state.player.wallet, cash - 15_000_000); assert.equal(ally(state, id).wallet, allyCash + 15_000_000);
  assert.equal(record(state, id).pending, null); assert.equal(record(state, id).agreements[0].type, 'access'); assert.equal(finances(state), original);
  assert.equal(getDiplomacyQuote(state, action).allowed, false);
});

test('capacity refusals and reasoned declines do not charge money or punish trust', () => {
  const state = make(), id = ally(state).id, cash = finances(state), trust = ally(state, id).trust;
  ally(state, id).fatigue = 90;
  performAction(state, { ...operation(state), offerISK: 100_000_000 });
  assert.equal(record(state, id).pending, null); assert.equal(ally(state, id).commitment, null); assert.equal(finances(state), cash);
  assert.equal(ally(state, id).trust, trust); assert.match(record(state, id).lastResponse, /recovery/);
  ally(state, id).fatigue = 10;
  performAction(state, { ...operation(state), offerISK: 0 });
  assert(record(state, id).pending); performAction(state, { type: 'diplomacyDecline', allyId: id });
  assert.equal(record(state, id).pending, null); assert.equal(ally(state, id).trust, trust); assert.equal(finances(state), cash);
});

test('unaffordable or stale counteroffer acceptance fails atomically and unattended offers expire', () => {
  const state = make(), id = ally(state).id;
  performAction(state, { ...operation(state), offerISK: 0 }); state.player.wallet = 0;
  let before = exportCampaign(state); assert.throws(() => performAction(state, { type: 'diplomacyAccept', allyId: id }), /Insufficient/); assert.equal(exportCampaign(state), before);
  state.player.wallet = 500_000_000; ally(state, id).fatigue = 65;
  before = exportCampaign(state); assert.throws(() => performAction(state, { type: 'diplomacyAccept', allyId: id }), /counteroffer/); assert.equal(exportCampaign(state), before);
  const trust = ally(state, id).trust, cash = finances(state); settle(state, 3);
  assert.equal(record(state, id).pending, null); assert.equal(ally(state, id).trust, trust); assert.equal(finances(state), cash); assert.equal(validateDiplomacy(state), true);
});

test('aid, finite reciprocal favors and operating reserves conserve actual corporation cash', () => {
  const state = make(), id = ally(state).id, cash = finances(state), playerCash = state.player.wallet;
  performAction(state, { type: 'diplomacyAid', allyId: id }); assert.equal(record(state, id).favors, 1); assert.equal(state.player.wallet, playerCash - 20_000_000); assert.equal(finances(state), cash);
  let before = exportCampaign(state); assert.throws(() => performAction(state, { type: 'diplomacyAid', allyId: id }), /Recent aid/); assert.equal(exportCampaign(state), before);
  const originalCash = ally(state, id).wallet; ally(state, id).wallet = 99_000_000;
  before = exportCampaign(state); assert.throws(() => performAction(state, { type: 'diplomacyCallFavor', allyId: id }), /operating reserve/); assert.equal(exportCampaign(state), before);
  ally(state, id).wallet = originalCash;
  performAction(state, { type: 'diplomacyCallFavor', allyId: id }); assert.equal(record(state, id).favors, 0); assert.equal(state.player.wallet, playerCash); assert.equal(finances(state), cash);
});

test('replacement escrow settles actual destroyed hull costs once and refunds the unused ceiling', () => {
  const state = make(), id = ally(state).id, original = finances(state), cash = state.player.wallet, allyCash = ally(state, id).wallet;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'srp' });
  assert.equal(finances(state), original); assert.equal(state.player.wallet, cash - 40_000_000); assert.equal(ally(state, id).wallet, allyCash);
  const fleet = state.fleets.find(f => f.ownerId === id), lost = 2, claim = DOCTRINES.find(d => d.id === fleet.doctrineId).cost * lost * 0.5;
  fleet.ships -= lost; fleet.lifetimeLosses += lost; ally(state, id).lifetimeLosses += lost; const survivors = fleet.ships;
  settle(state); assert.equal(ally(state, id).wallet, allyCash + claim); assert.equal(record(state, id).agreements[0].escrow, 40_000_000 - claim); assert.equal(fleet.ships, survivors); assert.equal(finances(state), original);
  settleDiplomacy(state, context); assert.equal(ally(state, id).wallet, allyCash + claim);
  settle(state, 7); assert.equal(record(state, id).agreements.length, 0); assert.equal(state.player.wallet, cash - claim); assert.equal(finances(state), original); assert.equal(validateDiplomacy(state), true);
});

test('replacement support stops at the funded ceiling and never creates unpaid debt or free hulls', () => {
  const state = make(), id = ally(state).id, cash = finances(state), allyCash = ally(state, id).wallet;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'srp' });
  const fleet = state.fleets.find(f => f.ownerId === id && f.doctrineId === 'caracal'); const lost = fleet.ships;
  fleet.lifetimeLosses += lost; fleet.ships = 0; ally(state, id).lifetimeLosses += lost;
  settle(state); assert.equal(ally(state, id).wallet, allyCash + 40_000_000); assert.equal(finances(state), cash); assert.equal(record(state, id).agreements.length, 0); assert.equal(fleet.ships, 0);
  settle(state); assert.equal(ally(state, id).wallet, allyCash + 40_000_000);
});

test('defensive compact triggers a bounded independent response without spawning ships or extra payments', () => {
  const state = make(), id = ally(state).id, target = state.systems[ally(state, id).stagingId]; target.vp = 0;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'defense', targetId: target.id });
  const cash = finances(state), inventory = state.fleets.map(f => [f.id, f.ships]);
  settle(state); assert.equal(ally(state, id).commitment, null);
  state.systems[target.id].vp = target.threshold * 0.3; settle(state);
  assert.deepEqual(ally(state, id).commitment, { targetId: target.id, mission: 'defensive', remainingTurns: 8, fulfilledWatches: 0 });
  assert.equal(record(state, id).agreements[0].triggered, true); assert.equal(finances(state), cash); assert.deepEqual(state.fleets.map(f => [f.id, f.ships]), inventory);
  ally(state, id).commitment = null; ally(state, id).cooldown = 0; settle(state);
  assert.equal(ally(state, id).commitment, null, 'The paid compact includes only one response');
});

test('workshop access benefits only resting fleets physically present and ends when staging becomes hostile', () => {
  const state = make(), id = ally(state).id, baseId = ally(state, id).stagingId;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'access' });
  const own = state.fleets.filter(f => f.ownerId === 'player'), otherId = Number(Object.keys(state.systems).find(key => Number(key) !== baseId));
  for (const f of own) { f.readiness = 40; f.systemId = baseId; f.order = { type: 'rest', targetId: baseId }; }
  own[1].systemId = otherId; own[1].order.targetId = otherId; own[2].order = { type: 'patrol', targetId: baseId };
  settle(state); assert.equal(own[0].readiness, 48); assert.equal(own[1].readiness, 40); assert.equal(own[2].readiness, 40);
  state.systems[baseId].occupier = state.faction === 'caldari' ? 'gallente' : 'caldari'; settle(state);
  assert.equal(own[0].readiness, 48); assert.equal(record(state, id).agreements.length, 0); assert.equal(own[0].systemId, baseId);
});

test('repeated favoritism causes a visible coalition split and reconciliation restores cooperation', () => {
  const state = make(), favoredId = ally(state).id, rivalId = state.diplomacy.rivalries.find(p => p.actorIds.includes(favoredId)).actorIds.find(id => id !== favoredId);
  for (let i = 0; i < 11; i++) recordJointOperation(state, favoredId, 'agreed');
  assert.equal(record(state, rivalId).grievance, 77); assert.equal(getDiplomacyReport(state).organizations.find(a => a.id === rivalId).rivalry.tension, 100);
  const ships = state.fleets.filter(f => f.ownerId === rivalId).map(f => f.ships), cash = ally(state, rivalId).wallet;
  settle(state); assert.equal(record(state, rivalId).status, 'member'); settle(state); assert.equal(record(state, rivalId).status, 'withdrawn');
  assert.equal(canRequestSupport(state, rivalId).allowed, false); assert.equal(ally(state, rivalId).faction, state.faction); assert.equal(ally(state, rivalId).wallet, cash); assert.deepEqual(state.fleets.filter(f => f.ownerId === rivalId).map(f => f.ships), ships);
  assert.throws(() => applyDiplomacyAction(state, { type: 'diplomacyReconcile', allyId: rivalId }, context), /two watches/);
  settle(state, 2); applyDiplomacyAction(state, { type: 'diplomacyReconcile', allyId: rivalId }, context);
  assert.equal(record(state, rivalId).status, 'member'); assert.equal(record(state, rivalId).grievance, 47); assert.equal(canRequestSupport(state, rivalId).allowed, true);
  assert(record(state, rivalId).memories.some(m => m.event === 'withdrawn')); assert(record(state, rivalId).memories.some(m => m.event === 'reconciled')); assert.equal(validateDiplomacy(state), true);
});

test('mediation reduces both organizations’ concrete scheduling disputes and cannot be spammed', () => {
  const state = make(), id = ally(state).id;
  for (let i = 0; i < 4; i++) recordJointOperation(state, id, 'agreed');
  const pair = state.diplomacy.rivalries.find(p => p.actorIds.includes(id)), rivalId = pair.actorIds.find(a => a !== id), tension = pair.tension, grief = record(state, rivalId).grievance, wallet = state.player.wallet;
  performAction(state, { type: 'diplomacyMediate', allyId: id });
  assert.equal(state.diplomacy.rivalries.find(p => p.actorIds.includes(id)).tension, tension - 35); assert.equal(record(state, rivalId).grievance, grief - 10); assert.equal(state.player.wallet, wallet - 10_000_000);
  const before = exportCampaign(state); assert.throws(() => performAction(state, { type: 'diplomacyMediate', allyId: rivalId }), /time to work/); assert.equal(exportCampaign(state), before);
});

test('early cancellation returns unused escrow, preserves paid fees, and records the broken promise', () => {
  const state = make(), id = ally(state).id, cash = state.player.wallet;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'srp' });
  performAction(state, { type: 'diplomacyRenounce', allyId: id, agreementId: record(state, id).agreements[0].id });
  assert.equal(state.player.wallet, cash); assert.equal(record(state, id).grievance, 15); assert.equal(ally(state, id).trust, 52);
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'access' });
  const afterFee = state.player.wallet;
  performAction(state, { type: 'diplomacyRenounce', allyId: id, agreementId: record(state, id).agreements[0].id });
  assert.equal(state.player.wallet, afterFee); assert.equal(record(state, id).grievance, 30); assert.equal(ally(state, id).trust, 44);
});

test('planner priorities depend only on public geography, own resources and scenario history', () => {
  const state = make(), id = ally(state).id, target = state.objective.targetIds[0];
  const before = getDiplomacyPlanningBias(state, id, 'offensive', target), changed = structuredClone(state);
  for (const a of changed.actors.filter(a => a.id !== id)) { a.wallet = 1; a.hangar.caracal = 300; }
  for (const f of changed.fleets.filter(f => f.ownerId !== id)) { f.ships = 20; f.systemId = target; f.order = { type: 'hub', targetId: target }; }
  assert.equal(getDiplomacyPlanningBias(changed, id, 'offensive', target), before);
  assert.notEqual(getDiplomacyPlanningBias(state, id, 'defensive', ally(state, id).stagingId), before);
});

test('active negotiations and escrow persist through save/load with deterministic watch resolution', () => {
  const state = make(), id = ally(state).id;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'srp' });
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'access', offerISK: 0 });
  const loaded = importCampaign(exportCampaign(state), snapshot); assert.deepEqual(loaded, state);
  for (let watch = 0; watch < 4; watch++) { advanceTurn(state); advanceTurn(loaded); assert.deepEqual(loaded, state); }
  assert.equal(validateCampaign(state), true);
});

test('validation rejects corrupt counteroffers, escrow, priorities and settlement clocks; memories remain bounded', () => {
  const state = make(), id = ally(state).id;
  performAction(state, { type: 'diplomacyPropose', allyId: id, agreement: 'srp' });
  for (const mutate of [s => { record(s, id).agreements[0].escrow++; }, s => { record(s, id).priorityId = 'invented'; }, s => { s.diplomacy.lastSettledTurn++; }, s => { record(s, id).agreements[0].expiresTurn += 1; }, s => { record(s, id).favors = 4; }]) {
    const broken = structuredClone(state); mutate(broken); assert.throws(() => validateDiplomacy(broken));
  }
  for (let i = 0; i < 100; i++) recordJointOperation(state, id, 'fulfilled');
  assert.equal(record(state, id).memories.length, 16); assert.equal(record(state, id).favors, 3); assert.equal(validateDiplomacy(state), true);
  const late = make(); late.turn = 999_000; late.diplomacy.lastSettledTurn = late.turn; assert.equal(validateDiplomacy(late), true);
  late.diplomacy.lastSettledTurn--; assert.throws(() => validateDiplomacy(late), /settlement/);
  late.diplomacy.lastSettledTurn--; assert.throws(() => settleDiplomacy(late, context), /sequence/);
});

test('public diplomacy action entrypoint also respects a completed campaign', () => {
  const state = make(); state.result = { type: 'partial', title: 'Complete', text: 'Complete', score: 50 };
  assert.throws(() => applyDiplomacyAction(state, { type: 'diplomacyAid', allyId: ally(state).id }, context), /campaign has ended/);
});

test('legacy operation funding honors negotiated recovery premiums, counteroffers and deployment range', () => {
  const state = make(), id = ally(state).id, action = { type: 'allyRequest', allyId: id, targetId: state.objective.targetIds[0], mission: 'offensive' };
  ally(state, id).fatigue = 65;
  const quote = getActionQuote(state, action), negotiated = getDiplomacyQuote(state, { ...action, type: 'diplomacyPropose', agreement: 'joint' });
  assert.equal(quote.requiredISK, negotiated.requiredISK); assert(quote.requiredISK >= 45_000_000);
  const cash = state.player.wallet; performAction(state, action); assert.equal(state.player.wallet, cash - quote.requiredISK);
  const pending = make(), pendingId = ally(pending).id;
  performAction(pending, { ...operation(pending), offerISK: 0 });
  let before = exportCampaign(pending); assert.throws(() => performAction(pending, { ...action, allyId: pendingId }), /counteroffer/); assert.equal(exportCampaign(pending), before);
  const remote = make(), far = Object.values(remote.systems).filter(s => s.occupier !== remote.faction).sort((a, b) => findRoute(remote, ally(remote).stagingId, b.id).length - findRoute(remote, ally(remote).stagingId, a.id).length)[0];
  assert(findRoute(remote, ally(remote).stagingId, far.id).length > 13, 'The warzone contains an impractically distant operation');
  const farAction = { ...action, allyId: ally(remote).id, targetId: far.id };
  assert.equal(getActionQuote(remote, farAction).allowed, false); before = exportCampaign(remote);
  assert.throws(() => performAction(remote, farAction), /too distant/); assert.equal(exportCampaign(remote), before);
});
