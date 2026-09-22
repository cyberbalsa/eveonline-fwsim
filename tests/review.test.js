import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createCampaign, performAction, advanceTurn, queueOrder, getActionQuote,
  getSystem, findRoute, getDoctrine, RULES
} from '../engine.js';

const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
function quietCampaign() {
  const state = createCampaign(snapshot, { seed: 'independent-recovery-review', maxTurns: 120 });
  // Isolate economic/recovery outcomes from adversarial military activity.
  // The actual warzone, ownership rules, timers and resource costs stay intact.
  for (const actor of state.actors) {
    actor.wallet = 0; actor.lp = 0; actor.pilots = 0;
    for (const doctrine of Object.keys(actor.hangar)) actor.hangar[doctrine] = 0;
  }
  for (const fleet of state.fleets.filter(fleet => fleet.ownerId !== 'player')) fleet.ships = 0;
  return state;
}
const own = state => state.fleets.filter(fleet => fleet.ownerId === 'player');
function occupy(state, systemId, faction) {
  const system = getSystem(state, systemId);
  system.occupier = faction; system.vp = 0; system.hubPending = null; system.hubDamage = 0;
}
function inventory(state) {
  const totals = { materials: state.player.materials, ...state.player.hangar };
  for (const fleet of own(state)) totals[fleet.doctrineId] += fleet.ships;
  for (const cargo of state.shipments.filter(cargo => cargo.ownerId === 'player')) {
    totals.materials += cargo.materials || 0;
    if (cargo.doctrineId) totals[cargo.doctrineId] += cargo.count;
    for (const [doctrine, count] of Object.entries(cargo.hangar || {})) totals[doctrine] += count;
  }
  return totals;
}

test('staging relocation quotes the destination travel time it actually schedules', () => {
  const state = quietCampaign();
  const destination = Object.values(state.systems)
    .filter(system => system.occupier === state.faction && system.id !== state.player.stagingId)
    .sort((a, b) => findRoute(state, state.player.stagingId, b.id).length - findRoute(state, state.player.stagingId, a.id).length)[0];
  const action = { type: 'setStaging', systemId: destination.id };
  const quote = getActionQuote(state, action), wallet = state.player.wallet;
  performAction(state, action);
  const freight = state.shipments.find(shipment => shipment.ownerId === 'player' && shipment.hangar);
  assert.ok(freight, 'relocation puts reserves into actual freight');
  assert.equal(wallet - state.player.wallet, quote.isk, 'quoted charge agrees');
  assert.equal(freight.remainingTurns, quote.turns, 'UI must not promise three watches for distant freight');
});

test('canceling a stand-down with active orders cannot retain the rest-only fatigue discount', () => {
  const ordinary = quietCampaign(), canceledRest = quietCampaign();
  performAction(canceledRest, { type: 'rest' });
  for (const state of [ordinary, canceledRest]) {
    for (const fleet of own(state)) queueOrder(state, fleet.id, { type: 'patrol', targetId: fleet.systemId });
    advanceTurn(state);
  }
  assert.deepEqual(own(canceledRest).map(fleet => fleet.order.type), ['patrol', 'patrol', 'patrol']);
  assert.equal(canceledRest.player.fatigue, ordinary.player.fatigue,
    'identical active operations require identical participation fatigue');
});

test('manufacturing cannot remain stranded forever after freight diverts and both bases become friendly', () => {
  const state = quietCampaign(), originalStaging = state.player.stagingId;
  performAction(state, { type: 'manufacture', doctrineId: 'rifter', count: 3 });
  performAction(state, { type: 'procure', doctrineId: 'rifter', count: 3 });
  occupy(state, originalStaging, 'gallente');
  for (let watch = 0; watch < 12; watch++) advanceTurn(state);
  // Regardless of whether recovery diverts the base, evacuates the job, or
  // cancels blocked work, a recaptured source must not leave a permanent lock.
  occupy(state, originalStaging, state.faction);
  for (let watch = 0; watch < 12; watch++) advanceTurn(state);
  assert.equal(state.jobs.filter(job => job.ownerId === 'player').length, 0,
    'paid production must finish or resolve explicitly instead of blocking all future staging moves');
  const destination = Object.values(state.systems).find(system => system.occupier === state.faction && system.id !== state.player.stagingId);
  assert.doesNotThrow(() => performAction(state, { type: 'setStaging', systemId: destination.id }),
    'the recovered corporation can relocate again');
});

test('normal relocation conserves ships and materials while reserves remain unavailable in transit', () => {
  const state = quietCampaign(), before = inventory(state), fleetLocations = own(state).map(fleet => fleet.systemId);
  const destination = Object.values(state.systems).find(system => system.occupier === state.faction && system.id !== state.player.stagingId);
  performAction(state, { type: 'setStaging', systemId: destination.id });
  const freight = state.shipments.find(shipment => shipment.ownerId === 'player' && shipment.hangar);
  const duration = freight.remainingTurns;
  assert.equal(state.player.materials, 0);
  assert.ok(Object.values(state.player.hangar).every(count => count === 0));
  assert.deepEqual(inventory(state), before);
  assert.deepEqual(own(state).map(fleet => fleet.systemId), fleetLocations, 'fleets do not teleport with headquarters');
  for (let watch = 1; watch < duration; watch++) {
    advanceTurn(state);
    assert.deepEqual(inventory(state), before);
    assert.ok(Object.values(state.player.hangar).every(count => count === 0), 'cargo remains unavailable until its due watch');
  }
  advanceTurn(state);
  assert.deepEqual(inventory(state), before);
  assert.equal(state.shipments.filter(shipment => shipment.ownerId === 'player').length, 0);
  assert.ok(Object.values(state.player.hangar).some(count => count > 0));
});

test('a bankrupt corporation with wiped fleets can rebuild at friendly staging through finite passive income', () => {
  const state = quietCampaign();
  state.player.wallet = 0; state.player.lp = 0; state.player.materials = 0;
  for (const doctrine of Object.keys(state.player.hangar)) state.player.hangar[doctrine] = 0;
  for (const fleet of own(state)) fleet.ships = 0;
  const fleetId = own(state)[0].id, requiredShips = RULES.minFleetShips;
  const cost = getDoctrine('rifter').cost * requiredShips;
  const earningWatches = Math.ceil(cost / RULES.baseIndustryIncome);
  for (let watch = 0; watch < earningWatches; watch++) advanceTurn(state);
  assert.equal(state.player.wallet, earningWatches * RULES.baseIndustryIncome);
  performAction(state, { type: 'procure', doctrineId: 'rifter', count: requiredShips });
  const duration = state.shipments.find(shipment => shipment.ownerId === 'player').remainingTurns;
  for (let watch = 0; watch < duration; watch++) advanceTurn(state);
  performAction(state, { type: 'reinforce', fleetId, count: requiredShips });
  assert.equal(own(state).find(fleet => fleet.id === fleetId).ships, requiredShips);
  assert.equal(state.player.hangar.rifter, 0, 'recovery consumes delivered hulls');
  assert.equal(state.turn, earningWatches + duration, 'recovery advances only the explicit simulated watches');
});
