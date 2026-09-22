import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaign, getSystem, getNeighbors, getDoctrine, getOperationalState, getReadiness, getActionQuote, queueOrder, performAction, advanceTurn, validateCampaign, exportCampaign, importCampaign, getActorObservation, getVisibleFleets, findRoute, RULES } from '../engine.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
const make = options => createCampaign(snapshot, { seed: 'test-seed', ...options });
function quiet(state) {
  for (const a of state.actors) { a.wallet = 0; a.lp = 0; a.pilots = 0; for (const key of Object.keys(a.hangar)) a.hangar[key] = 0; }
  for (const f of state.fleets.filter(f => f.ownerId !== 'player')) f.ships = 0;
  return state;
}
function own(state) { return state.fleets.filter(f => f.ownerId === 'player'); }
function inventory(state, doctrineId) {
  return state.player.hangar[doctrineId] + own(state).filter(f => f.doctrineId === doctrineId).reduce((n, f) => n + f.ships, 0) + state.shipments.filter(s => s.ownerId === 'player' && s.doctrineId === doctrineId).reduce((n, s) => n + s.count, 0) + state.jobs.filter(j => j.ownerId === 'player' && j.doctrineId === doctrineId).reduce((n, j) => n + j.count, 0);
}

test('opening state preserves all 90 systems and 110 real undirected gates for both factions', () => {
  for (const faction of ['caldari', 'gallente']) {
    const s = make({ faction }); assert.equal(Object.keys(s.systems).length, 90); assert.equal(s.edges.length, 110);
    for (const source of snapshot.systems) { const system = getSystem(s, source.id); assert.equal(system.name, source.name); assert.deepEqual(system.neighbors, source.neighbors); assert.deepEqual(system.position2D, source.position2D); assert.equal(system.victoryPoints, source.victoryPoints); assert.equal(system.vp, Math.min(source.victoryPoints, source.victoryPointsThreshold)); for (const neighbor of getNeighbors(s, source.id)) assert(neighbor.neighbors.includes(source.id)); }
    assert.equal(own(s).length, 3); assert(getReadiness(s).assignedPilots <= getReadiness(s).availablePilots); assert.equal(s.objective.targetIds.length, 2);
    assert(s.objective.targetIds.every(id => getSystem(s, id).occupier !== faction)); assert(s.objective.targetIds.every(id => findRoute(s, s.player.stagingId, id).length <= 3));
    assert.equal(validateCampaign(s), true);
  }
});

test('capture requires pressure, a separate hub assault and a later scheduled downtime', () => {
  const s = quiet(make()), id = s.objective.targetIds[0], target = getSystem(s, id), initialOccupier = target.occupier;
  target.vp = target.threshold - 1;
  for (const f of own(s)) { f.systemId = id; queueOrder(s, f.id, { type: 'offensive', targetId: id, stance: 'hold' }); }
  advanceTurn(s); assert.equal(target.occupier, initialOccupier); // references to pre-resolution objects remain snapshots
  assert.equal(getSystem(s, id).vp, getSystem(s, id).threshold); assert.equal(getSystem(s, id).hubPending, null);
  for (const f of own(s)) queueOrder(s, f.id, { type: 'hub', targetId: id, stance: 'commit' });
  while (!getSystem(s, id).hubPending && s.turn < 20) advanceTurn(s);
  assert(getSystem(s, id).hubPending, 'hub should fall from sustained legal assault');
  const transferTurn = getSystem(s, id).hubPending.transferTurn; assert(transferTurn > s.turn); assert.equal(transferTurn % RULES.downtimeEveryTurns, 0); assert.equal(getSystem(s, id).occupier, initialOccupier);
  while (s.turn < transferTurn - 1) advanceTurn(s); assert.equal(getSystem(s, id).occupier, initialOccupier);
  advanceTurn(s); assert.equal(getSystem(s, id).occupier, s.faction); assert.equal(getSystem(s, id).vp, 0); assert.equal(getSystem(s, id).hubPending, null);
});

test('offensive and defensive eligibility, arbitrary targets and early hub assaults fail atomically', () => {
  const s = make(), f = own(s)[0], target = s.objective.targetIds[0];
  for (const order of [{ type: 'offensive', targetId: s.player.stagingId }, { type: 'defensive', targetId: target }, { type: 'hub', targetId: target }, { type: 'move', targetId: -1 }, { type: 'offensive', targetId: target, stance: 'berserk' }]) {
    const before = exportCampaign(s); assert.throws(() => queueOrder(s, f.id, order)); assert.equal(exportCampaign(s), before);
  }
  getSystem(s, s.player.stagingId).vp = 0;
  assert.throws(() => queueOrder(s, f.id, { type: 'defensive', targetId: s.player.stagingId }), /stable/);
});

test('procurement reserves ISK now, ships remain unavailable until delivery, and reshipping conserves survivors', () => {
  const s = quiet(make()), initialStock = s.player.hangar.rifter, initialWallet = s.player.wallet;
  performAction(s, { type: 'procure', doctrineId: 'rifter', count: 5 });
  assert.equal(s.player.wallet, initialWallet - 5 * getDoctrine('rifter').cost); assert.equal(s.player.hangar.rifter, initialStock); assert.equal(s.shipments.filter(x => x.ownerId === 'player').length, 1);
  advanceTurn(s); assert.equal(s.player.hangar.rifter, initialStock); advanceTurn(s); assert.equal(s.player.hangar.rifter, initialStock + 5);
  const before = inventory(s, 'rifter'), fleet = own(s).find(f => f.doctrineId === 'rifter');
  performAction(s, { type: 'reinforce', fleetId: fleet.id, count: 4 }); assert.equal(inventory(s, 'rifter'), before);
  performAction(s, { type: 'reship', fleetId: fleet.id, doctrineId: 'catalyst', count: 5 }); assert.equal(inventory(s, 'rifter'), before);
});

test('manufacturing consumes bounded slots, ISK and materials; output cannot be used before completion', () => {
  const s = quiet(make()), quote = getActionQuote(s, { type: 'manufacture', doctrineId: 'catalyst', count: 5 }), stock = s.player.hangar.catalyst, wallet = s.player.wallet, materials = s.player.materials;
  performAction(s, { type: 'manufacture', doctrineId: 'catalyst', count: 5 }); assert.equal(s.player.wallet, wallet - quote.isk); assert.equal(s.player.materials, materials - quote.materials); assert.equal(s.player.hangar.catalyst, stock);
  const bad = exportCampaign(s); assert.throws(() => performAction(s, { type: 'manufacture', doctrineId: 'dominix', count: 25 })); assert.equal(exportCampaign(s), bad);
  for (let i = 1; i < quote.turns; i++) { advanceTurn(s); assert.equal(s.player.hangar.catalyst, stock); }
  advanceTurn(s); assert.equal(s.player.hangar.catalyst, stock + 5);
});

test('LP redemption has finite available LP and per-watch market depth; rejected actions have no effects', () => {
  const s = quiet(make()); s.player.lp = 250_000;
  performAction(s, { type: 'cashout', amount: 60_000 }); performAction(s, { type: 'cashout', amount: 40_000 });
  const before = exportCampaign(s); assert.throws(() => performAction(s, { type: 'cashout', amount: 1 }), /broker/); assert.equal(exportCampaign(s), before);
  advanceTurn(s); performAction(s, { type: 'cashout', amount: 100_000 }); assert.equal(s.player.lp, 50_000);
  const after = exportCampaign(s); assert.throws(() => performAction(s, { type: 'cashout', amount: -10 })); assert.equal(exportCampaign(s), after);
});

test('pilot assignment cannot exceed attendance and ship loss never permanently kills roster pilots or repairs lost hulls', () => {
  const s = quiet(make()), pilots = s.player.pilots;
  s.player.hangar.rifter = 100; performAction(s, { type: 'formFleet', doctrineId: 'rifter', count: 25, name: 'Fourth Wing' });
  const before = exportCampaign(s); assert.throws(() => performAction(s, { type: 'formFleet', doctrineId: 'rifter', count: 25 }), /pilots/); assert.equal(exportCampaign(s), before);
  const f = own(s)[0]; f.ships -= 3; f.lifetimeLosses += 3; f.readiness = 30; f.damage = 80;
  const surviving = f.ships, reserves = s.player.hangar[f.doctrineId]; performAction(s, { type: 'rest' }); advanceTurn(s);
  assert.equal(s.player.pilots, pilots); assert.equal(own(s)[0].ships, surviving); assert.equal(s.player.hangar[f.doctrineId], reserves); assert(own(s)[0].readiness > 30);
  s.player.fatigue = 100; s.player.morale = 10;
  for (const fleet of own(s)) queueOrder(s, fleet.id, { type: 'patrol', targetId: fleet.systemId });
  const attendance = getReadiness(s).availablePilots; advanceTurn(s); assert(own(s).reduce((n, f) => n + f.activeShips, 0) <= attendance);
});

test('fleet travel uses actual gates and fast doctrine travel is capped to two hops per watch', () => {
  const s = quiet(make()), f = own(s)[0];
  const remote = Object.values(s.systems).sort((a, b) => findRoute(s, f.systemId, b.id).length - findRoute(s, f.systemId, a.id).length)[0]; const route = findRoute(s, f.systemId, remote.id);
  queueOrder(s, f.id, { type: 'move', targetId: remote.id, stance: 'evade' }); advanceTurn(s); assert.equal(own(s)[0].systemId, route[2]);
});

test('independent ally support transfers the actual budget and respects cooldown', () => {
  const s = make(), ally = s.allies[0], cash = s.player.wallet, allyCash = s.actors.find(a => a.id === ally.id).wallet;
  performAction(s, { type: 'allyRequest', allyId: ally.id, targetId: s.objective.targetIds[0], mission: 'offensive' });
  assert.equal(s.player.wallet, cash - RULES.allyRequestCost); assert.equal(s.actors.find(a => a.id === ally.id).wallet, allyCash + RULES.allyRequestCost); assert(s.allies[0].commitment);
  const before = exportCampaign(s); assert.throws(() => performAction(s, { type: 'allyRequest', allyId: ally.id, targetId: s.objective.targetIds[0] })); assert.equal(exportCampaign(s), before);
});

test('observations hide unscouted enemies and all other corporations private orders', () => {
  const s = make(), observation = getActorObservation(s);
  assert(observation.fleets.length < s.fleets.length);
  for (const f of observation.fleets.filter(f => f.ownerId !== 'player')) assert.equal(f.order, undefined);
  for (const f of getVisibleFleets(s).filter(f => f.ownerId !== 'player')) assert.equal(f.order, undefined);
  assert.equal(observation.self.wallet, s.player.wallet); assert(!Object.hasOwn(observation, 'actors'));
});

test('save round trip resumes the same seeded branch; tampering and corrupt source geography are rejected', () => {
  const s = make(); for (let i = 0; i < 5; i++) advanceTurn(s);
  const loaded = importCampaign(exportCampaign(s), snapshot); assert.deepEqual(loaded, s); advanceTurn(s); advanceTurn(loaded); assert.deepEqual(loaded, s);
  const tampered = JSON.parse(exportCampaign(s)); tampered.state.player.wallet += 1; assert.throws(() => importCampaign(JSON.stringify(tampered), snapshot), /checksum/);
  const changed = make(); changed.systems[changed.player.stagingId].name = 'Invented System'; assert.throws(() => importCampaign(exportCampaign(changed), snapshot), /modified/);
  const broken = make(); broken.player.hangar.rifter = -5; assert.throws(() => validateCampaign(broken), /stock/);
  const invalidPending = make(); const target = getSystem(invalidPending, invalidPending.objective.targetIds[0]); target.hubPending = { faction: invalidPending.faction, transferTurn: 4 }; assert.throws(() => validateCampaign(invalidPending), /transfer/);
});

test('actor and fleet array order do not change military resolution', () => {
  const one = make(), two = make(); two.actors.reverse(); two.fleets.reverse();
  for (let i = 0; i < 8; i++) { advanceTurn(one); advanceTurn(two); }
  const military = s => ({ systems: Object.values(s.systems).map(x => [x.id, x.occupier, x.vp, x.hubDamage]), fleets: [...s.fleets].sort((a, b) => a.id.localeCompare(b.id)).map(f => [f.id, f.ships, f.systemId, f.readiness]), resources: [...s.actors].sort((a, b) => a.id.localeCompare(b.id)).map(a => [a.id, a.wallet, a.lp, a.hangar]) });
  assert.deepEqual(military(one), military(two));
});

test('full 120-watch campaigns have autonomous pressure, losses, replenishment and a finite ending for both militias', () => {
  for (const faction of ['caldari', 'gallente']) {
    const s = make({ faction, seed: `campaign-${faction}` }); let captures = 0, battles = 0, purchases = 0;
    while (!s.result) { advanceTurn(s); captures += s.lastTurn.captures.length; battles += s.lastTurn.battles.length; purchases += s.actors.reduce((n, a) => n + a.ledger.filter(e => e.turn === s.turn && e.reason.startsWith('procure:')).length, 0); }
    assert(s.turn <= 120); if (s.turn < 120) { assert.equal(s.result.type, 'victory'); assert.equal(s.objective.holdProgress, RULES.holdTurns); } assert(s.result.title); assert(captures > 0, `${faction}: NPCs must capture systems`); assert(battles > 0, `${faction}: NPCs must fight`);
    assert(s.actors.some(a => a.lifetimeLosses > 0)); assert(s.actors.some(a => a.totalLP > 0)); assert(purchases > 0); assert.equal(validateCampaign(s), true);
  }
});

test('holding a bridgehead with a viable fleet completes the published mandate', () => {
  const s = quiet(make());
  for (const id of s.objective.targetIds) { const system = getSystem(s, id); system.occupier = s.faction; system.vp = 0; }
  for (let i = 0; i < RULES.holdTurns - 1; i++) { advanceTurn(s); assert.equal(s.result, null); }
  advanceTurn(s); assert.equal(s.result.type, 'victory'); assert.equal(s.result.title, 'Mandate secured'); assert.equal(s.objective.holdProgress, RULES.holdTurns);
});

test('an empty force can travel home and recover with real reserves, but cannot claim full strategic success', () => {
  const s = quiet(make({ maxTurns: 8 }));
  for (const f of own(s)) { f.ships = 0; f.systemId = s.objective.targetIds[0]; queueOrder(s, f.id, { type: 'move', targetId: s.player.stagingId }); }
  advanceTurn(s); assert(own(s).every(f => f.systemId === s.player.stagingId));
  performAction(s, { type: 'reinforce', fleetId: own(s)[0].id, count: 6 }); assert.equal(own(s)[0].ships, 6); assert.equal(s.player.hangar.rifter, 8);
  for (const f of own(s)) f.ships = 0;
  for (const id of s.objective.targetIds) { const system = getSystem(s, id); system.occupier = s.faction; system.vp = 0; }
  while (!s.result) advanceTurn(s); assert.equal(s.result.type, 'partial'); assert.match(s.result.text, /Fewer than six/);
});

test('rest, training and institutions affect finite attendance, production and supply times', () => {
  const s = quiet(make()), before = getReadiness(s).availablePilots;
  performAction(s, { type: 'upgrade', upgrade: 'command' }); assert(getReadiness(s).availablePilots > before);
  performAction(s, { type: 'upgrade', upgrade: 'industry' }); assert.equal(getActionQuote(s, { type: 'manufacture', doctrineId: 'caracal', count: 1 }).turns, 2);
  performAction(s, { type: 'training' }); const roster = s.player.pilots;
  for (let i = 1; i < RULES.trainingTurns; i++) { advanceTurn(s); assert.equal(s.player.pilots, roster); }
  advanceTurn(s); assert.equal(s.player.pilots, roster + RULES.trainingPilots);
  s.player.fatigue = 75; s.player.morale = 60; const ready = getReadiness(s).availablePilots;
  performAction(s, { type: 'rest' }); advanceTurn(s); assert(s.player.fatigue < 75); assert(getReadiness(s).availablePilots > ready);
});

test('battle losses conserve physical deployed hulls and heavy doctrines only run eligible site classes', () => {
  const s = make({ seed: 'war-council-1' });
  // Force a legal confrontation so accounting coverage does not depend on which
  // objectives each organizational personality happens to choose first.
  const hostile = s.actors.find(actor => actor.faction !== s.faction);
  hostile.commitment = { targetId: s.player.stagingId, mission: 'patrol', remainingTurns: RULES.allyRequestTurns, fulfilledWatches: 0 };
  for (const fleet of s.fleets.filter(fleet => fleet.ownerId === hostile.id)) fleet.systemId = s.player.stagingId;
  for (const fleet of own(s)) queueOrder(s, fleet.id, { type: 'patrol', targetId: s.player.stagingId, stance: 'hold' });
  const initial = s.fleets.reduce((n, f) => n + f.ships, 0) + [s.player, ...s.actors].reduce((n, a) => n + Object.values(a.hangar).reduce((sum, stock) => sum + stock, 0), 0);
  let bought = 0;
  for (let i = 0; i < 20; i++) { advanceTurn(s); bought += s.actors.reduce((n, a) => n + a.ledger.filter(e => e.turn === s.turn && e.reason.startsWith('procure:')).reduce((sum, e) => sum + Number(e.reason.match(/^procure: (\d+)/)[1]), 0), 0); }
  const survivors = s.fleets.reduce((n, f) => n + f.ships, 0) + [s.player, ...s.actors].reduce((n, a) => n + Object.values(a.hangar).reduce((sum, stock) => sum + stock, 0), 0) + s.shipments.reduce((n, cargo) => n + cargo.count + (cargo.hangar ? Object.values(cargo.hangar).reduce((sum, stock) => sum + stock, 0) : 0), 0);
  const losses = s.fleets.reduce((n, f) => n + f.lifetimeLosses, 0);
  assert(losses > 0); assert(survivors + losses <= initial + bought, 'Destroyed hulls or cargo cannot reappear');
  const isolated = quiet(make()), f = own(isolated)[0], id = isolated.objective.targetIds[0];
  f.doctrineId = 'dominix'; f.systemId = id; queueOrder(isolated, f.id, { type: 'offensive', targetId: id }); advanceTurn(isolated);
  assert.match(own(isolated)[0].lastAction, /open sites only/);
});

test('a captured factory evacuates without waiting for a procurement contract and never teleports reserves', () => {
  const s = quiet(make()), originId = s.player.stagingId, originalReserve = { ...s.player.hangar };
  performAction(s, { type: 'manufacture', doctrineId: 'rifter', count: 3 });
  const materialsAfterInvestment = s.player.materials;
  getSystem(s, originId).occupier = 'gallente'; getSystem(s, originId).vp = 0;
  for (let watch = 1; watch < RULES.emergencyEvacuationDelay; watch++) { advanceTurn(s); assert.equal(s.player.stagingId, originId); assert.deepEqual(s.player.hangar, originalReserve); }
  const walletBefore = s.player.wallet; advanceTurn(s);
  assert.notEqual(s.player.stagingId, originId); assert.equal(s.player.wallet, walletBefore - RULES.relocationCost + RULES.baseIndustryIncome);
  assert(Object.values(s.player.hangar).every(n => n === 0)); assert.equal(s.player.materials, 0);
  const cargo = s.shipments.find(shipment => shipment.ownerId === 'player' && shipment.hangar);
  assert.deepEqual(cargo.hangar, originalReserve); assert.equal(cargo.materials, materialsAfterInvestment); assert(cargo.remainingTurns >= RULES.relocationMinimumTurns);
  assert(s.jobs.some(job => job.ownerId === 'player' && job.status === 'evacuating'));
  for (let watch = 0; watch < 12; watch++) advanceTurn(s);
  assert.equal(s.jobs.filter(job => job.ownerId === 'player').length, 0); assert.equal(s.shipments.filter(shipment => shipment.ownerId === 'player').length, 0);
  assert.equal(s.player.hangar.rifter, originalReserve.rifter + 3); assert.equal(s.player.materials, materialsAfterInvestment);
  assert.equal(getSystem(s, originId).occupier, 'gallente', 'recovery does not depend on recapturing the factory');
});

test('manual evacuation can move captured active production and queued procurement with conserved output', () => {
  const s = quiet(make()), originId = s.player.stagingId, initialStock = s.player.hangar.catalyst;
  performAction(s, { type: 'manufacture', doctrineId: 'catalyst', count: 4 }); performAction(s, { type: 'procure', doctrineId: 'catalyst', count: 3 });
  getSystem(s, originId).occupier = 'gallente'; getSystem(s, originId).vp = 0;
  const destination = Object.values(s.systems).find(system => system.occupier === s.faction && system.id !== originId);
  const action = { type: 'setStaging', systemId: destination.id }, duration = getActionQuote(s, action).turns;
  performAction(s, action);
  assert.equal(s.player.hangar.catalyst, 0); assert.equal(s.jobs.find(job => job.ownerId === 'player').remainingTurns, getDoctrine('catalyst').buildTurns + duration);
  const incoming = s.shipments.find(shipment => shipment.ownerId === 'player' && shipment.doctrineId === 'catalyst'); assert(incoming.remainingTurns >= duration + RULES.procurementTurns);
  while (s.jobs.some(job => job.ownerId === 'player') || s.shipments.some(shipment => shipment.ownerId === 'player')) { assert(s.turn < 30, 'evacuated cargo and work must resolve in finite time'); advanceTurn(s); }
  assert.equal(s.player.hangar.catalyst, initialStock + 7); assert.equal(s.player.stagingId, destination.id);
  assert.equal(validateCampaign(importCampaign(exportCampaign(s), snapshot)), true);
});
