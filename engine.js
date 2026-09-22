import { DOCTRINES, STANCES, ORDER_TYPES, RULES, NPC_ORGANIZATIONS } from './rules.js';
import { initializePeople, validatePeople, getPeopleAttendanceModifier, applyPeopleAction, settlePeople } from './people.js';
import { initializeDiplomacy, validateDiplomacy, applyDiplomacyAction, settleDiplomacy, getDiplomacyQuote, getDiplomacyPlanningBias, canRequestSupport, recordJointOperation } from './diplomacy.js';
export { DOCTRINES, STANCES, ORDER_TYPES, RULES, NPC_ORGANIZATIONS } from './rules.js';

const FACTIONS = ['caldari', 'gallente'];
const CAMPAIGN_SCHEMA = 2;
const MAX_SANDBOX_WATCH = 1_000_000;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const other = faction => faction === 'caldari' ? 'gallente' : 'caldari';
const copy = value => JSON.parse(JSON.stringify(value));
const assert = (condition, text) => { if (!condition) throw new Error(text); };
const count = (n, label = 'Count', max = RULES.maxPurchaseCount) => { assert(Number.isInteger(n) && n > 0 && n <= max, `${label} must be a whole number from 1 to ${max}.`); return n; };
const values = state => Object.values(state.systems);
const ownFleets = (state, ownerId = 'player') => state.fleets.filter(f => f.ownerId === ownerId);
const actor = (state, ownerId = 'player') => ownerId === 'player' ? state.player : state.actors.find(a => a.id === ownerId);
const actorFaction = (state, ownerId) => ownerId === 'player' ? state.faction : actor(state, ownerId).faction;
function hash(text) { let n = 2166136261; for (const c of String(text)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
// Stateless keyed rolls are independent of fleet/actor iteration order. Planners never read these rolls.
const roll = (state, ...key) => hash([state.seed, state.turn, ...key].join('|')) / 4294967296;
const nextId = (state, prefix) => `${prefix}-${state.nextId++}`;
function log(state, type, title, text) { state.log.unshift({ id: nextId(state, 'event'), turn: state.turn, type, title, text }); state.log.length = Math.min(state.log.length, 2000); }
export function getDoctrine(id) { const d = DOCTRINES.find(d => d.id === id); assert(d, `Unknown doctrine: ${id}.`); return d; }
export function getSystem(state, id) { return state.systems[String(id)] || null; }
export function getNeighbors(state, id) { return (getSystem(state, id)?.neighbors || []).map(id => getSystem(state, id)); }
export function getOperationalState(state, id) {
  const system = getSystem(state, id); if (!system) return null;
  if (getNeighbors(state, id).some(s => s.occupier !== system.occupier)) return 'frontline';
  if (getNeighbors(state, id).some(s => getNeighbors(state, s.id).some(n => n.occupier !== s.occupier))) return 'command';
  return 'rearguard';
}
export function findRoute(state, originId, targetId) {
  originId = Number(originId); targetId = Number(targetId);
  if (!getSystem(state, originId) || !getSystem(state, targetId)) return null;
  const queue = [originId], previous = new Map([[originId, null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; if (id === targetId) { const route = []; for (let p = id; p !== null; p = previous.get(p)) route.unshift(p); return route; }
    for (const n of getSystem(state, id).neighbors) if (!previous.has(n)) { previous.set(n, id); queue.push(n); }
  }
  return null;
}
function availablePilots(state, ownerId = 'player') {
  const a = actor(state, ownerId);
  const participation = clamp(0.55 + a.morale * 0.005 - a.fatigue * 0.004 + (a.upgrades?.command || 0) * 0.04, 0.25, 1);
  const eligible = ownerId === 'player' && state.people ? state.people.cohorts.filter(cohort => cohort.restRemaining === 0).reduce((sum, cohort) => sum + cohort.count, 0) : a.pilots;
  return Math.min(eligible, a.pilots, Math.floor(a.pilots * participation * getPeopleAttendanceModifier(state, ownerId)));
}
export function getReadiness(state, ownerId = 'player') {
  const a = actor(state, ownerId); const fleets = ownFleets(state, ownerId);
  const fieldedShips = fleets.reduce((n, f) => n + f.ships, 0), reserveShips = Object.values(a.hangar).reduce((n, c) => n + c, 0);
  const ready = availablePilots(state, ownerId);
  const materialScore = Math.min(100, (fieldedShips + reserveShips * 0.45) / 0.6);
  const score = Math.round(clamp(materialScore * 0.4 + a.morale * 0.25 + (100 - a.fatigue) * 0.2 + a.trust * 0.15));
  return { score, availablePilots: ready, assignedPilots: fieldedShips, freePilots: Math.max(0, ready - fieldedShips), fieldedShips, reserveShips, morale: a.morale, fatigue: a.fatigue, trust: a.trust };
}
function visibleFleetIds(state, ownerId) {
  const faction = actorFaction(state, ownerId), seenSystems = new Set();
  const scoutingFleets = state.fleets.filter(f => f.faction === faction && f.ships > 0);
  for (const f of scoutingFleets) { seenSystems.add(f.systemId); for (const n of getNeighbors(state, f.systemId)) seenSystems.add(n.id); }
  const base = getSystem(state, actor(state, ownerId).stagingId); if (base) { seenSystems.add(base.id); base.neighbors.forEach(id => seenSystems.add(id)); }
  return new Set(state.fleets.filter(f => f.faction === faction || seenSystems.has(f.systemId)).map(f => f.id));
}
export function getVisibleFleets(state) {
  const ids = visibleFleetIds(state, 'player');
  return state.fleets.filter(f => ids.has(f.id)).map(f => {
    const visible = copy(f);
    if (f.ownerId !== 'player') for (const key of ['order', 'lastMission', 'lastAction', 'operationDone', 'activeShips', 'turnOriginId', 'movedHops']) delete visible[key];
    return visible;
  });
}
export function getActorObservation(state, ownerId = 'player') {
  const a = actor(state, ownerId); assert(a, 'Unknown corporation.');
  const ids = visibleFleetIds(state, ownerId), faction = actorFaction(state, ownerId);
  return { turn: state.turn, faction, ownerId, self: copy(a), systems: values(state).map(s => ({ id: s.id, name: s.name, occupier: s.occupier, vp: s.vp, threshold: s.threshold, hubPending: copy(s.hubPending), neighbors: [...s.neighbors], advantage: { ...s.advantage } })), fleets: state.fleets.filter(f => ids.has(f.id)).map(f => ({ id: f.id, ownerId: f.ownerId, faction: f.faction, systemId: f.systemId, doctrineId: f.doctrineId, ships: f.ships, readiness: f.readiness, ...(f.ownerId === ownerId ? { order: copy(f.order), stance: f.stance } : {}) })) };
}
function emptyHangar() { return Object.fromEntries(DOCTRINES.map(d => [d.id, 0])); }
function newFleet(state, ownerId, doctrineId, ships, systemId, name) {
  const fleet = { id: nextId(state, 'fleet'), name, ownerId, faction: actorFaction(state, ownerId), doctrineId, ships, systemId, stance: 'skirmish', order: { type: 'rest', targetId: systemId }, readiness: 90, fatigue: 0, damage: 0, lifetimeLosses: 0, lastAction: 'Standing by', lastMission: null };
  state.fleets.push(fleet); return fleet;
}
function friendlyBase(state, faction, preferredName) {
  const preferred = values(state).find(s => s.name === preferredName && s.occupier === faction);
  if (preferred) return preferred;
  return values(state).filter(s => s.occupier === faction).sort((a, b) => Number(getOperationalState(state, b.id) === 'frontline') - Number(getOperationalState(state, a.id) === 'frontline') || b.npcStationCount - a.npcStationCount || a.id - b.id)[0];
}
export function createCampaign(snapshot, options = {}) {
  assert(snapshot && Array.isArray(snapshot.systems) && Array.isArray(snapshot.edges), 'A warzone snapshot is required.');
  const faction = options.faction || 'caldari'; assert(FACTIONS.includes(faction), 'Choose Caldari or Gallente.');
  const maxTurns = options.maxTurns ?? RULES.maxTurns; assert(Number.isInteger(maxTurns) && maxTurns >= 8 && maxTurns <= 500, 'Campaign length must be 8–500 watches.');
  const state = { version: RULES.version, scenarioId: snapshot.scenarioId, seed: String(options.seed ?? 'war-council-1'), turn: 0, maxTurns, faction, nextId: 1, systems: {}, edges: copy(snapshot.edges), player: null, fleets: [], actors: [], allies: [], jobs: [], shipments: [], log: [], objective: null, result: null, lastTurn: { battles: [], captures: [], deliveries: [], losses: 0, income: 0, lp: 0 }, modelNotice: RULES.modelNotice };
  for (const s of snapshot.systems) state.systems[s.id] = { ...copy(s), occupier: s.occupierFactionId === 500001 ? 'caldari' : 'gallente', vp: Math.min(s.victoryPoints, s.victoryPointsThreshold), threshold: s.victoryPointsThreshold, advantage: { caldari: 0, gallente: 0 }, hubPending: null, hubDamage: 0, capturedTurn: null, activity: [] };
  const candidates = values(state).filter(s => s.occupier === faction && getOperationalState(state, s.id) === 'frontline');
  candidates.sort((a, b) => getNeighbors(state, b.id).filter(n => n.occupier !== faction).length - getNeighbors(state, a.id).filter(n => n.occupier !== faction).length || b.npcStationCount - a.npcStationCount || a.id - b.id);
  const staging = candidates[0] || friendlyBase(state, faction);
  state.player = { commanderName: String(options.commanderName || 'Fleet Commander').trim().slice(0, 60), corporationName: String(options.corporationName || 'New Eden Expeditionary').trim().slice(0, 80), wallet: RULES.initialWallet, lp: RULES.initialLP, materials: RULES.initialMaterials, morale: 76, fatigue: 12, trust: 65, pilots: RULES.initialPilots, stagingId: staging.id, hangar: { rifter: 14, catalyst: 14, caracal: 6, drake: 2, dominix: 0 }, upgrades: { industry: 0, logistics: 0, command: 0 }, cashoutUsed: 0, festivalCooldown: 0, resting: false, lifetimeLosses: 0, totalLP: 0, ledger: [] };
  for (const [doctrineId, ships, name] of [['rifter', 8, 'Recon Wing'], ['catalyst', 10, 'Strike Wing'], ['caracal', 6, 'Mainline Fleet']]) newFleet(state, 'player', doctrineId, ships, staging.id, name);
  for (const [i, org] of NPC_ORGANIZATIONS.entries()) {
    const base = friendlyBase(state, org.faction, org.homeName);
    const a = { ...org, wallet: 520_000_000, lp: 40_000, materials: 80, morale: 74, fatigue: 10, trust: 60, pilots: 65, stagingId: base.id, hangar: { rifter: 12, catalyst: 16, caracal: 4, drake: 0, dominix: 0 }, upgrades: { industry: 1, logistics: 0, command: 0 }, cashoutUsed: 0, festivalCooldown: 0, resting: false, lifetimeLosses: 0, totalLP: 0, ledger: [], cooldown: 0, commitment: null, fleetIds: [] };
    state.actors.push(a);
    const first = newFleet(state, org.id, i % 2 ? 'rifter' : 'catalyst', 12, base.id, `${org.ticker} Vanguard`);
    const second = newFleet(state, org.id, 'caracal', 7, base.id, `${org.ticker} Mainline`);
    a.fleetIds = [first.id, second.id];
  }
  state.schemaVersion = CAMPAIGN_SCHEMA; state.sandbox = false; state.campaignReport = null;
  syncAllies(state);
  const targets = values(state).filter(s => s.occupier !== faction && getOperationalState(state, s.id) === 'frontline').sort((a, b) => findRoute(state, staging.id, a.id).length - findRoute(state, staging.id, b.id).length || b.vp / b.threshold - a.vp / a.threshold || a.id - b.id).slice(0, 2);
  state.objective = { title: 'Secure the bridgehead', description: `Capture ${targets.map(s => s.name).join(' and ')}, then hold both for ${RULES.holdTurns} watches with readiness of at least ${RULES.mandateReadiness}.`, targetIds: targets.map(s => s.id), holdProgress: 0, requiredHoldTurns: RULES.holdTurns, minimumReadiness: RULES.mandateReadiness, initialFriendlyCount: values(state).filter(s => s.occupier === faction).length };
  initializePeople(state); initializeDiplomacy(state);
  log(state, 'briefing', 'The war council is yours', `${state.player.corporationName} stages in ${staging.name}. Your fleets, reserves and NPC strengths are an authored scenario; the opening map comes from 22 September 2026. Complete sites, defeat vulnerable hubs, then wait for the next scheduled downtime to transfer ownership.`);
  validateCampaign(state); return state;
}
function syncAllies(state) { state.allies = state.actors.filter(a => a.faction === state.faction).map(a => ({ id: a.id, corporationId: a.corporationId, name: a.name, ticker: a.ticker, faction: a.faction, allianceId: a.allianceId, allianceName: a.allianceName, trust: a.trust, cooldown: a.cooldown, commitment: copy(a.commitment), fleetIds: [...a.fleetIds] })); }
function mustActive(state) { assert(!state.result, 'This campaign has ended. Start a new campaign to issue orders.'); }
function fleetById(state, id, ownerId = 'player') { const f = state.fleets.find(f => f.id === id); assert(f && f.ownerId === ownerId, 'Select one of your own fleets.'); return f; }
function orderError(state, fleet, order) {
  if (!order || !ORDER_TYPES.includes(order.type)) return 'Unknown fleet order.';
  if (order.stance !== undefined && !STANCES.includes(order.stance)) return 'Unknown engagement stance.';
  const target = getSystem(state, order.targetId ?? fleet.systemId); if (!target) return 'Select a system in this warzone.';
  if (!findRoute(state, fleet.systemId, target.id)) return 'No gate route to that system.';
  if (fleet.ships <= 0 && order.type !== 'rest' && order.type !== 'move') return 'This formation has no ships. Return to staging and reinforce it.';
  if (['offensive', 'hub'].includes(order.type) && target.occupier === fleet.faction) return 'Offensive operations require enemy occupancy.';
  if (order.type === 'defensive' && target.occupier !== fleet.faction) return 'Defensive sites require friendly occupancy.';
  if (order.type === 'defensive' && target.vp <= 0) return 'This friendly system is stable; there is no defensive pressure to remove.';
  if (order.type === 'hub' && (target.vp < target.threshold || target.hubPending)) return 'The infrastructure hub must be vulnerable and not already defeated.';
  if (order.type === 'escort' && target.occupier !== fleet.faction) return 'Choose friendly space for a supply escort.';
  return null;
}
export function queueOrder(state, fleetId, order) {
  mustActive(state); const fleet = fleetById(state, fleetId); const error = orderError(state, fleet, order); assert(!error, error);
  fleet.order = { type: order.type, targetId: Number(order.targetId ?? fleet.systemId) }; if (order.stance) fleet.stance = order.stance;
  if (order.type !== 'rest') state.player.resting = false;
  fleet.lastAction = `Ordered: ${order.type}`; return state;
}
export function getActionQuote(state, action) {
  if (action.type?.startsWith('diplomacy')) return getDiplomacyQuote(state, action, simulationContext());
  const a = state.player; const d = action.doctrineId ? getDoctrine(action.doctrineId) : null;
  switch (action.type) {
    case 'procure': return { isk: d.cost * action.count, turns: Math.max(1, RULES.procurementTurns - Math.floor(a.upgrades.logistics / 2)), materials: 0 };
    case 'manufacture': return { isk: Math.round(d.cost * 0.32) * action.count, materials: d.materials * action.count, turns: Math.max(1, d.buildTurns - a.upgrades.industry) };
    case 'buyMaterials': return { isk: action.count * RULES.materialCost, turns: RULES.materialDeliveryTurns, materials: 0 };
    case 'cashout': return { isk: -action.amount * RULES.cashoutRate, lp: action.amount, turns: 0, remainingLP: Math.max(0, RULES.cashoutCap - a.cashoutUsed) };
    case 'training': return { isk: RULES.trainingCost, turns: RULES.trainingTurns };
    case 'upgrade': return { isk: RULES.upgradeBaseCosts[action.upgrade] * ((a.upgrades[action.upgrade] || 0) + 1), turns: 0 };
    case 'festival': return { isk: RULES.festivalCost, turns: 0 };
    case 'allyRequest': return getDiplomacyQuote(state, { ...action, type: 'diplomacyPropose', agreement: 'joint', offerISK: undefined });
    case 'setStaging': return { isk: RULES.relocationCost, turns: relocationTurns(state, a.stagingId, action.systemId) };
    default: return { isk: 0, turns: 0 };
  }
}
function spend(a, isk, reason, turn) { assert(Number.isFinite(isk) && isk >= 0 && a.wallet >= isk, 'Insufficient corporation ISK.'); a.wallet -= isk; a.ledger.unshift({ turn, isk: -isk, reason }); a.ledger.length = Math.min(a.ledger.length, 80); }
function income(a, isk, reason, turn) { a.wallet += isk; a.ledger.unshift({ turn, isk, reason }); a.ledger.length = Math.min(a.ledger.length, 80); }
function simulationContext() { return { log, spend, income, findRoute, orderError, getReadiness }; }
export function performAction(state, action) {
  mustActive(state); assert(action && typeof action.type === 'string', 'Choose a corporation action.');
  // Apply on a draft so failed compound actions cannot charge money, consume stock or reserve pilots.
  const draft = copy(state); applyAction(draft, action, 'player'); validateCampaign(draft); Object.assign(state, draft); return state;
}
function applyAction(state, action, ownerId) {
  const a = actor(state, ownerId), isPlayer = ownerId === 'player', faction = actorFaction(state, ownerId);
  if (isPlayer && (applyPeopleAction(state, action, simulationContext()) || applyDiplomacyAction(state, action, simulationContext()))) { syncAllies(state); return; }
  const announce = (title, text) => { if (isPlayer) log(state, 'management', title, text); };
  switch (action.type) {
    case 'procure': case 'manufacture': {
      const d = getDoctrine(action.doctrineId), n = count(action.count);
      const q = action.type === 'procure' ? { isk: d.cost * n, turns: Math.max(1, RULES.procurementTurns - Math.floor(a.upgrades.logistics / 2)), materials: 0 } : { isk: Math.round(d.cost * 0.32) * n, turns: Math.max(1, d.buildTurns - a.upgrades.industry), materials: d.materials * n };
      assert(getSystem(state, a.stagingId).occupier === faction, 'Staging is occupied by the enemy. Establish a friendly staging system first.');
      if (action.type === 'manufacture') { assert(state.jobs.filter(j => j.ownerId === ownerId && j.type === 'manufacture').length < 2 + a.upgrades.industry, 'All manufacturing slots are busy.'); assert(a.materials >= q.materials, 'Insufficient industry materials.'); }
      spend(a, q.isk, `${action.type}: ${n} ${d.hull}`, state.turn); a.materials -= q.materials;
      if (action.type === 'procure') state.shipments.push({ id: nextId(state, 'shipment'), ownerId, doctrineId: d.id, count: n, materials: 0, remainingTurns: q.turns, systemId: a.stagingId, status: 'in-transit', delayedTurns: 0 });
      else state.jobs.push({ id: nextId(state, 'job'), ownerId, type: 'manufacture', doctrineId: d.id, count: n, remainingTurns: q.turns, systemId: a.stagingId });
      announce(action.type === 'procure' ? 'Replacement ships contracted' : 'Production started', `${n} ${d.hull} hulls will reach ${getSystem(state, a.stagingId).name} in ${q.turns} watches. Ship prices and industry kits are game abstractions.`); break;
    }
    case 'buyMaterials': { const n = count(action.count, 'Material kits', 250); spend(a, n * RULES.materialCost, 'Industry material contract', state.turn); state.shipments.push({ id: nextId(state, 'shipment'), ownerId, count: 0, materials: n, remainingTurns: 1, systemId: a.stagingId, status: 'in-transit', delayedTurns: 0 }); announce('Materials contracted', `${n} industry kits arrive next watch.`); break; }
    case 'formFleet': { const d = getDoctrine(action.doctrineId), n = count(action.count); assert(n >= RULES.minFleetShips, `Form a fleet with at least ${RULES.minFleetShips} hulls.`); assert(ownFleets(state, ownerId).length < 8, 'The corporation can coordinate at most eight formations.'); assert(a.hangar[d.id] >= n, 'Not enough fitted ships at staging.'); assert(getReadiness(state, ownerId).freePilots >= n, 'Not enough available unassigned pilots. Rest or train your roster.'); assert(getSystem(state, a.stagingId).occupier === faction, 'Staging must be friendly.'); a.hangar[d.id] -= n; const fleet = newFleet(state, ownerId, d.id, n, a.stagingId, String(action.name || `${d.hull} Wing`).trim().slice(0, 70)); announce('Fleet formed', `${fleet.name}: ${n} ${d.hull} hulls assigned at staging.`); break; }
    case 'reship': case 'reinforce': {
      const f = fleetById(state, action.fleetId, ownerId); assert(f.systemId === a.stagingId && getSystem(state, f.systemId).occupier === faction, 'Return this formation to friendly staging before assigning ships.');
      const d = getDoctrine(action.doctrineId || f.doctrineId), n = count(action.count), total = action.type === 'reinforce' ? f.ships + n : n;
      assert(total <= RULES.maxFleetShips, `A formation can field at most ${RULES.maxFleetShips} ships.`);
      const returned = action.type === 'reship' && d.id === f.doctrineId ? f.ships : 0;
      assert(a.hangar[d.id] + returned >= (action.type === 'reinforce' ? n : total), 'Not enough fitted ships in the staging hangar.');
      assert(total - f.ships <= getReadiness(state, ownerId).freePilots, 'Not enough available unassigned pilots.');
      if (action.type === 'reship') { a.hangar[f.doctrineId] += f.ships; a.hangar[d.id] -= n; } else { assert(d.id === f.doctrineId, 'Reinforcements must match the existing doctrine.'); a.hangar[d.id] -= n; }
      f.doctrineId = d.id; f.ships = total; f.order = { type: 'rest', targetId: f.systemId }; announce('Fleet resupplied', `${f.name} now fields ${total} ${d.hull} hulls. Surviving refitted hulls return to the hangar; destroyed ships remain destroyed.`); break;
    }
    case 'cashout': { const n = count(action.amount, 'LP conversion', RULES.cashoutCap); assert(n <= a.lp, 'Insufficient corporation LP.'); assert(n + a.cashoutUsed <= RULES.cashoutCap, `The LP broker can settle ${RULES.cashoutCap - a.cashoutUsed} more LP this watch.`); a.lp -= n; a.cashoutUsed += n; income(a, n * RULES.cashoutRate, 'LP broker settlement (net adapted conversion)', state.turn); announce('LP broker settled', `${n.toLocaleString('en-US')} LP converted into ${(n * RULES.cashoutRate / 1e6).toFixed(1)}M ISK at the scenario net rate. Limited to 100,000 LP each watch.`); break; }
    case 'training': { assert(!state.jobs.some(j => j.ownerId === ownerId && j.type === 'training'), 'A pilot training course is already running.'); assert(a.pilots + RULES.trainingPilots <= RULES.maxPilots, 'The corporation roster is at its campaign capacity.'); spend(a, RULES.trainingCost, 'Pilot training', state.turn); state.jobs.push({ id: nextId(state, 'job'), ownerId, type: 'training', count: RULES.trainingPilots, remainingTurns: RULES.trainingTurns, systemId: a.stagingId }); announce('New pilot course opened', 'Ten additional pilots become available after three watches. Pilots are retained through ship losses.'); break; }
    case 'upgrade': { const key = action.upgrade; assert(Object.hasOwn(RULES.upgradeBaseCosts, key), 'Unknown institution upgrade.'); assert(a.upgrades[key] < RULES.maxUpgradeLevel, 'This institution is fully developed.'); spend(a, RULES.upgradeBaseCosts[key] * (a.upgrades[key] + 1), `${key} institution`, state.turn); a.upgrades[key]++; announce('Institution developed', `${key[0].toUpperCase() + key.slice(1)} is now level ${a.upgrades[key]}. Industry improves production and income; logistics improves freight and readiness; command improves participation.`); break; }
    case 'festival': { assert(a.festivalCooldown === 0, 'Your next community night is still on cooldown.'); spend(a, RULES.festivalCost, 'Community fleet night', state.turn); a.morale = clamp(a.morale + 8); a.fatigue = clamp(a.fatigue - 8); a.festivalCooldown = RULES.festivalCooldown; announce('Community night funded', 'Morale improves and fatigue eases. This supplements, but cannot replace, regular rest.'); break; }
    case 'rest': { a.resting = true; for (const f of ownFleets(state, ownerId)) f.order = { type: 'rest', targetId: f.systemId }; announce('Stand-down ordered', 'The corporation rests this watch. Deployed survivors regain readiness; hull losses require replacements.'); break; }
    case 'allyRequest': {
      assert(isPlayer, 'Only the player issues coalition requests.'); const ally = state.actors.find(a => a.id === action.allyId && a.faction === state.faction); assert(ally, 'Choose an allied corporation.'); assert(ally.cooldown === 0, 'This ally is still committed to its previous operation.'); assert(ally.trust >= 35, 'This ally needs at least 35 trust to accept an operation.');
      const support = canRequestSupport(state, ally.id); assert(support.allowed, support.reason);
      const mission = action.mission || 'offensive'; assert(['offensive', 'defensive', 'patrol', 'advantage', 'hub'].includes(mission), 'Choose a military support mission.');
      const usable = ownFleets(state, ally.id).find(f => f.ships >= 3); assert(usable, 'This ally has no deployable formation and must rebuild.'); const error = orderError(state, usable, { type: mission, targetId: action.targetId }); assert(!error, error);
      assert(!state.diplomacy.organizations[ally.id].pending, 'Accept or decline this ally’s counteroffer before requesting another operation.');
      const quote = getActionQuote(state, action); assert(quote.allowed, quote.reason);
      spend(a, quote.requiredISK, `Joint operation: ${ally.name}`, state.turn); income(ally, quote.requiredISK, 'Player-funded joint operation', state.turn); ally.commitment = { targetId: Number(action.targetId), mission, remainingTurns: RULES.allyRequestTurns, fulfilledWatches: 0 }; ally.cooldown = RULES.allyRequestCooldown; a.trust = clamp(a.trust + 2); recordJointOperation(state, ally.id, 'agreed', simulationContext()); announce('Joint operation agreed', `${ally.name} accepts ${mission} support in ${getSystem(state, action.targetId).name} for eight watches. It retains its ships, pilots and tactical withdrawal decisions.`); break;
    }
    case 'setStaging': {
      const destination = getSystem(state, action.systemId); assert(destination && destination.occupier === faction, 'Choose a friendly staging system.'); assert(destination.id !== a.stagingId, 'The corporation is already staged there.');
      relocateStaging(state, ownerId, destination.id);
      announce('Staging relocation underway', `Reserve hulls, materials and unfinished production travel to ${destination.name}; incoming contracts are rerouted. Fleets make their own gate journey, and reserves remain unavailable until delivered.`); break;
    }
    default: throw new Error(`Unknown corporation action: ${action.type}.`);
  }
  syncAllies(state);
}
function relocationTurns(state, originId, targetId) {
  const route = findRoute(state, originId, targetId);
  assert(route, 'Choose a reachable staging destination.');
  return Math.max(RULES.relocationMinimumTurns, Math.ceil((route.length - 1) / RULES.relocationGatesPerTurn));
}
function relocateStaging(state, ownerId, targetId) {
  const a = actor(state, ownerId), originId = a.stagingId;
  const duration = relocationTurns(state, originId, targetId);
  spend(a, RULES.relocationCost, 'Staging relocation freight', state.turn);
  // Existing contracts take the original route plus the new leg. Cargo never changes a corporation's base by itself.
  for (const shipment of state.shipments.filter(s => s.ownerId === ownerId)) {
    shipment.remainingTurns += relocationTurns(state, shipment.systemId, targetId);
    shipment.systemId = targetId; shipment.delayedTurns = 0; shipment.status = 'diverting';
  }
  for (const job of state.jobs.filter(j => j.ownerId === ownerId && j.type === 'manufacture')) {
    job.remainingTurns += duration;
    job.evacuationRemainingTurns = (job.evacuationRemainingTurns || 0) + duration;
    job.destinationId = targetId; job.status = 'evacuating';
  }
  state.shipments.push({ id: nextId(state, 'shipment'), ownerId, count: 0, materials: a.materials, hangar: { ...a.hangar }, remainingTurns: duration, originId, systemId: targetId, status: 'in-transit', delayedTurns: 0 });
  a.stagingId = targetId; a.stagingBlockedTurns = 0; a.hangar = emptyHangar(); a.materials = 0;
}
function recoverBlockedStaging(state) {
  for (const ownerId of ['player', ...state.actors.map(a => a.id)].sort()) {
    const a = actor(state, ownerId), faction = actorFaction(state, ownerId);
    if (getSystem(state, a.stagingId).occupier === faction) { a.stagingBlockedTurns = 0; continue; }
    a.stagingBlockedTurns = (a.stagingBlockedTurns || 0) + 1;
    if (a.stagingBlockedTurns < RULES.emergencyEvacuationDelay || a.wallet < RULES.relocationCost) continue;
    const destination = values(state).filter(s => s.occupier === faction).sort((x, y) => findRoute(state, a.stagingId, x.id).length - findRoute(state, a.stagingId, y.id).length || x.id - y.id)[0];
    if (!destination) continue;
    relocateStaging(state, ownerId, destination.id);
    if (ownerId === 'player') log(state, 'logistics', 'Emergency evacuation underway', `After six watches of hostile occupancy, neutral freight evacuates reserves and unfinished production to ${destination.name}. The 10M ISK relocation fee is charged; ships and materials remain unavailable until their actual freight arrives. This is a compressed recovery mechanic.`);
  }
}
function npcPlanning(state) {
  // Every planner sees the same start-of-watch observations. No private opposing orders or future rolls.
  const observations = new Map(state.actors.map(a => [a.id, getActorObservation(state, a.id)]));
  const plans = [];
  for (const a of [...state.actors].sort((a, b) => a.id.localeCompare(b.id))) {
    const obs = observations.get(a.id), fleets = ownFleets(state, a.id);
    if (a.lp >= 20_000 && a.cashoutUsed < RULES.cashoutCap) applyAction(state, { type: 'cashout', amount: Math.min(a.lp, RULES.cashoutCap - a.cashoutUsed) }, a.id);
    const friendly = obs.systems.filter(s => s.occupier === a.faction);
    if (getSystem(state, a.stagingId).occupier !== a.faction && friendly.length && a.wallet >= RULES.relocationCost) {
      const near = friendly.sort((x, y) => findRoute(state, a.stagingId, x.id).length - findRoute(state, a.stagingId, y.id).length || x.id - y.id)[0];
      applyAction(state, { type: 'setStaging', systemId: near.id }, a.id);
    }
    if (a.wallet >= RULES.festivalCost && a.festivalCooldown === 0 && (a.morale < 45 || a.fatigue > 68)) applyAction(state, { type: 'festival' }, a.id);
    for (const f of fleets) {
      if (f.systemId === a.stagingId && f.ships < 12 && getSystem(state, a.stagingId).occupier === a.faction) {
        const n = Math.min(12 - f.ships, a.hangar[f.doctrineId], getReadiness(state, a.id).freePilots);
        if (n > 0) applyAction(state, { type: 'reinforce', fleetId: f.id, count: n }, a.id);
        else if (f.ships === 0 && a.hangar.catalyst >= 6 && getReadiness(state, a.id).freePilots >= 6) applyAction(state, { type: 'reship', fleetId: f.id, doctrineId: 'catalyst', count: 6 }, a.id);
      }
      if (f.ships < 5 && f.systemId !== a.stagingId) { plans.push([f, { type: 'move', targetId: a.stagingId }, 'evade']); continue; }
      if (f.ships === 0) { plans.push([f, { type: 'rest', targetId: f.systemId }, 'evade']); continue; }
      if (f.readiness < 38 || a.fatigue > 70) { plans.push([f, { type: 'rest', targetId: f.systemId }, 'evade']); continue; }
      if (a.commitment && a.commitment.remainingTurns > 0) {
        let mission = a.commitment.mission; const s = getSystem(state, a.commitment.targetId);
        if (mission === 'offensive' && s.occupier !== a.faction && s.vp >= s.threshold && !s.hubPending) mission = 'hub';
        if (s.occupier === a.faction && ['hub', 'offensive'].includes(mission)) mission = s.vp > 0 ? 'defensive' : 'patrol';
        const order = { type: mission, targetId: s.id };
        if (!orderError(state, f, order)) { plans.push([f, order, mission === 'hub' ? 'hold' : 'skirmish']); continue; }
      }
      const scored = [];
      for (const s of obs.systems) {
        const hops = findRoute(state, f.systemId, s.id).length - 1; if (hops > 9) continue;
        const frontier = s.neighbors.some(id => getSystem(state, id).occupier !== s.occupier);
        const enemies = obs.fleets.filter(e => e.faction !== a.faction && e.systemId === s.id).reduce((sum, e) => sum + e.ships * getDoctrine(e.doctrineId).power, 0);
        const friends = obs.fleets.filter(e => e.faction === a.faction && e.systemId === s.id).reduce((sum, e) => sum + e.ships * getDoctrine(e.doctrineId).power, 0);
        const power = f.ships * getDoctrine(f.doctrineId).power;
        let mission, score;
        if (s.occupier !== a.faction && !s.hubPending) { mission = s.vp >= s.threshold ? 'hub' : 'offensive'; score = 24 + (frontier ? 16 : -15) + s.vp / s.threshold * 30 - hops * 6; }
        else if (s.occupier === a.faction && s.vp > 0 && !s.hubPending) { mission = 'defensive'; score = 14 + s.vp / s.threshold * 55 - hops * 6; }
        else continue;
        if (enemies > power + friends * 0.8) score -= (enemies - power - friends * 0.8) * 1.6;
        // Fixed organizational preferences vary spatial priorities without reading hidden data.
        score += (hash(`${a.id}:${s.id}`) % 9) - 4;
        score += getDiplomacyPlanningBias(state, a.id, mission, s.id);
        if (f.order?.targetId === s.id && f.order.type === mission) score += 6;
        scored.push({ mission, id: s.id, score });
      }
      scored.sort((x, y) => y.score - x.score || x.id - y.id);
      const best = scored[0];
      if (best && best.score > 0) plans.push([f, { type: best.mission, targetId: best.id }, best.mission === 'hub' ? 'hold' : 'skirmish']);
      else plans.push([f, { type: 'rest', targetId: f.systemId }, 'evade']);
    }
    const needs = fleets.find(f => a.hangar[f.doctrineId] < 5);
    if (needs && !state.shipments.some(s => s.ownerId === a.id) && getSystem(state, a.stagingId).occupier === a.faction) {
      const d = getDoctrine(needs.doctrineId), n = Math.min(8, Math.floor(a.wallet / d.cost));
      if (n >= 3) applyAction(state, { type: 'procure', doctrineId: d.id, count: n }, a.id);
      else if (a.wallet >= getDoctrine('catalyst').cost * 6 && a.hangar.catalyst < 6) applyAction(state, { type: 'procure', doctrineId: 'catalyst', count: 6 }, a.id);
    }
  }
  for (const [f, order, stance] of plans) { f.order = order; f.stance = stance; }
}
function allocateAttendance(state) {
  for (const ownerId of ['player', ...state.actors.map(a => a.id)].sort()) {
    const a = actor(state, ownerId), fleets = ownFleets(state, ownerId).sort((x, y) => x.id.localeCompare(y.id));
    const demand = fleets.reduce((n, f) => n + (f.order.type === 'rest' ? 0 : f.ships), 0);
    const supply = availablePilots(state, ownerId), ratio = demand ? Math.min(1, supply / demand) : 1;
    let used = 0;
    for (const f of fleets) { f.activeShips = f.order.type === 'rest' ? 0 : Math.floor(f.ships * ratio); used += f.activeShips; }
    for (const f of fleets) if (used < supply && f.order.type !== 'rest' && f.activeShips < f.ships) { f.activeShips++; used++; }
  }
}
function moveFleets(state) {
  for (const f of [...state.fleets].sort((a, b) => a.id.localeCompare(b.id))) {
    f.turnOriginId = f.systemId; f.movedHops = 0; f.engaged = false; f.withdrawn = false; f.operationDone = false;
    const order = f.order;
    if (order.type === 'rest') { f.lastAction = 'Resting'; continue; }
    if (f.ships > 0 && f.activeShips === 0) { f.lastAction = 'Awaiting available pilots; the formation stays in place this watch.'; continue; }
    const error = orderError(state, f, order);
    if (error) { f.order = { type: 'rest', targetId: f.systemId }; f.lastAction = error; f.activeShips = 0; continue; }
    if (f.systemId !== order.targetId) {
      const route = findRoute(state, f.systemId, order.targetId);
      const hops = Math.min(route.length - 1, f.ships === 0 ? 2 : getDoctrine(f.doctrineId).speed);
      f.systemId = route[hops]; f.movedHops = hops;
      f.lastAction = `Travelled ${hops} gate${hops === 1 ? '' : 's'} to ${getSystem(state, f.systemId).name}`;
    }
    if (f.systemId === order.targetId && order.type === 'move') { f.order = { type: 'rest', targetId: f.systemId }; f.lastAction = 'Arrived; awaiting orders'; }
  }
}
function retreatDestination(state, fleet) {
  const neighbors = getNeighbors(state, fleet.systemId);
  if (fleet.turnOriginId !== fleet.systemId && neighbors.some(s => s.id === fleet.turnOriginId)) return fleet.turnOriginId;
  const friendly = neighbors.filter(s => s.occupier === fleet.faction).sort((a, b) => a.id - b.id);
  if (friendly.length) return friendly[0].id;
  const route = findRoute(state, fleet.systemId, actor(state, fleet.ownerId).stagingId); return route?.[1] ?? null;
}
function battlePower(f) {
  const d = getDoctrine(f.doctrineId);
  return (f.activeShips ?? f.ships) * d.power * (0.45 + f.readiness / 180) * (1 - f.damage * 0.003);
}
function resolveBattles(state) {
  const visibleBefore = visibleFleetIds(state, 'player');
  for (const s of values(state).sort((a, b) => a.id - b.id)) {
    let local = state.fleets.filter(f => f.systemId === s.id && f.ships > 0 && f.activeShips > 0);
    if (!FACTIONS.every(faction => local.some(f => f.faction === faction))) continue;
    const initialPower = Object.fromEntries(FACTIONS.map(side => [side, local.filter(f => f.faction === side).reduce((p, f) => p + battlePower(f), 0)]));
    // Stances control whether contact is accepted. Fast evasive wings can preserve ships and cede site time.
    for (const f of local) {
      const ratio = initialPower[other(f.faction)] / Math.max(1, initialPower[f.faction]);
      const wantsOut = f.stance === 'evade' || (f.stance === 'skirmish' && ratio > 1.65);
      const fallback = retreatDestination(state, f);
      if (wantsOut && fallback !== null && roll(state, 'disengage', s.id, f.id) < (getDoctrine(f.doctrineId).speed === 2 ? 0.93 : 0.75)) {
        f.systemId = fallback; f.withdrawn = true; f.lastAction = `Withdrew from ${s.name}; ships preserved, site time lost`; f.order = { type: 'rest', targetId: fallback };
      }
    }
    local = local.filter(f => !f.withdrawn);
    if (!FACTIONS.every(faction => local.some(f => f.faction === faction))) continue;
    // A system can contain fleets at different sites. Patrol/hold makes contact more likely; no automatic kill-to-capture.
    const contact = local.some(f => ['hold', 'commit'].includes(f.stance) || ['patrol', 'hub'].includes(f.order.type)) ? 1 : 0.7;
    if (roll(state, 'contact', s.id) > contact) continue;
    const powers = Object.fromEntries(FACTIONS.map(side => [side, local.filter(f => f.faction === side).reduce((p, f) => p + battlePower(f), 0)]));
    const losses = { caldari: 0, gallente: 0 }, updates = [];
    for (const f of local) {
      const opposition = powers[other(f.faction)], friendly = Math.max(1, powers[f.faction]);
      const exposure = f.stance === 'commit' ? 1.22 : f.stance === 'hold' ? 1.08 : f.stance === 'evade' ? 0.48 : 0.78;
      const damage = clamp(0.11 * Math.pow(opposition / friendly, 0.7) * exposure * (0.8 + roll(state, 'attrition', s.id, f.id) * 0.4), 0.02, 0.52);
      const expectedLoss = Math.min(f.activeShips, f.ships) * damage;
      const destroyed = Math.min(f.activeShips, Math.floor(expectedLoss) + Number(roll(state, 'loss-round', s.id, f.id) < expectedLoss % 1));
      updates.push({ f, destroyed, ratio: opposition / friendly }); losses[f.faction] += destroyed;
    }
    for (const { f, destroyed, ratio } of updates) {
      f.ships -= destroyed; f.activeShips = Math.max(0, f.activeShips - destroyed); f.lifetimeLosses += destroyed; f.readiness = clamp(f.readiness - 9 - destroyed * 1.2); f.damage = clamp(f.damage + 12); f.engaged = true;
      const a = actor(state, f.ownerId); a.lifetimeLosses += destroyed; a.morale = clamp(a.morale - destroyed * 0.25 + (ratio < 1 ? 1.2 : 0));
      if (f.ownerId === 'player') state.lastTurn.losses += destroyed;
      if ((ratio > (f.stance === 'commit' ? 3 : f.stance === 'hold' ? 2.2 : 1.2) || f.ships < 3) && retreatDestination(state, f) !== null) { f.systemId = retreatDestination(state, f); f.withdrawn = true; f.order = { type: 'rest', targetId: f.systemId }; }
      f.lastAction = `${destroyed} hull${destroyed === 1 ? '' : 's'} lost at ${s.name}${f.withdrawn ? '; formation withdrew' : '; holding the field'}`;
    }
    const report = { systemId: s.id, systemName: s.name, losses, fleets: local.map(f => f.id), text: `${s.name}: Caldari lost ${losses.caldari} hulls; Gallente lost ${losses.gallente}. Doctrine, attendance, readiness and engagement stance shaped the exchange. Capturing sites remains a separate operation.` };
    if (local.some(f => f.ownerId === 'player' || visibleBefore.has(f.id))) { state.lastTurn.battles.push(report); log(state, 'battle', `Contact in ${s.name}`, report.text); }
    s.activity.unshift({ turn: state.turn, type: 'battle' }); s.activity.length = Math.min(8, s.activity.length);
  }
}
function siteProfile(doctrine) {
  if (['Frigate', 'Destroyer'].includes(doctrine.class)) return { name: 'small and open sites', capacity: 1 };
  if (doctrine.class === 'Cruiser') return { name: 'medium and open sites', capacity: 0.95 };
  if (doctrine.class === 'Battlecruiser') return { name: 'large and open sites', capacity: 0.85 };
  return { name: 'open sites only', capacity: 0.7 };
}
function resolveOperations(state) {
  const changes = new Map(values(state).map(s => [s.id, { offense: 0, defense: 0, hub: 0, advantage: { caldari: 0, gallente: 0 }, rewards: [] }]));
  for (const f of [...state.fleets].sort((a, b) => a.id.localeCompare(b.id))) {
    if (f.withdrawn || f.order.type === 'rest' || f.ships === 0 || f.activeShips === 0 || f.systemId !== f.order.targetId) continue;
    const s = getSystem(state, f.systemId), a = actor(state, f.ownerId), d = getDoctrine(f.doctrineId), change = changes.get(s.id);
    const error = orderError(state, f, f.order); if (error) { f.lastAction = error; continue; }
    const travelFraction = f.movedHops ? 0.55 : 1;
    const contested = state.fleets.some(e => e.systemId === s.id && e.faction !== f.faction && !e.withdrawn && e.activeShips > 0);
    const time = travelFraction * (f.engaged ? 0.35 : contested ? 0.55 : 1) * (f.stance === 'evade' ? 0.65 : 1);
    const effort = f.activeShips * (0.4 + f.readiness / 160) * time;
    if (['offensive', 'defensive'].includes(f.order.type)) {
      const profile = siteProfile(d), advantage = clamp(1 + (s.advantage[f.faction] - s.advantage[other(f.faction)]) * 0.005, 0.65, 1.35);
      const vp = Math.round(effort * d.plexRate * profile.capacity * advantage);
      if (f.order.type === 'offensive' && !s.hubPending) change.offense += vp;
      else if (f.order.type === 'defensive' && !s.hubPending) change.defense += vp;
      const operational = getOperationalState(state, s.id), lpMultiplier = operational === 'frontline' ? 1.5 : operational === 'command' ? 1 : 0.01;
      const payout = Math.round(vp * 1.8 * lpMultiplier * (f.order.type === 'defensive' ? Math.min(1, s.vp / s.threshold) * 0.6 : 1));
      change.rewards.push({ f, a, payout, requestedVP: vp, kind: f.order.type, profile: profile.name });
      f.operationDone = true;
    } else if (f.order.type === 'advantage') {
      change.advantage[f.faction] += Math.min(12, effort * 0.8); f.lastAction = `Supply caches and propaganda: advantage in ${s.name}`; f.operationDone = true;
    } else if (f.order.type === 'hub') {
      const hubDamage = effort * d.power * 0.75; change.hub += hubDamage; f.lastAction = `Hub assault: ${Math.round(hubDamage)} infrastructure damage`; f.operationDone = true;
    } else if (f.order.type === 'patrol') { f.lastAction = `Patrolling gates in ${s.name}; contact and supply protection`; f.operationDone = true; }
    else if (f.order.type === 'escort') { f.lastAction = `Escorting regional supply arrivals in ${s.name}`; f.operationDone = true; }
    if (f.operationDone && f.lastMission !== f.order.type) a.morale = clamp(a.morale + 0.35);
    if (f.operationDone) f.lastMission = f.order.type;
  }
  for (const s of values(state).sort((a, b) => a.id - b.id)) {
    const change = changes.get(s.id), oldVP = s.vp;
    if (!s.hubPending) {
      s.vp = clamp(s.vp + change.offense - change.defense, 0, s.threshold);
      if (s.vp < s.threshold) s.hubDamage = 0;
      else s.hubDamage += change.hub;
      if (s.hubDamage >= RULES.hubStrength) {
        s.hubPending = { faction: other(s.occupier), transferTurn: (Math.floor(state.turn / RULES.downtimeEveryTurns) + 1) * RULES.downtimeEveryTurns };
        log(state, 'territory', `Hub defeated in ${s.name}`, `The system remains ${s.occupier === 'caldari' ? 'Caldari' : 'Gallente'} occupied until scheduled downtime at watch ${s.hubPending.transferTurn}.`);
      } else if (oldVP < s.threshold && s.vp >= s.threshold) log(state, 'territory', `${s.name} is vulnerable`, 'Capture pressure has reached the threshold. A separate infrastructure hub assault is now required.');
    }
    for (const faction of FACTIONS) s.advantage[faction] = clamp(s.advantage[faction] * 0.97 + change.advantage[faction], 0, 60);
    for (const reward of change.rewards) {
      // LP is bounded by actual remaining eligible work; piling onto stable/vulnerable systems is not a cash fountain.
      const available = reward.kind === 'offensive' ? Math.max(0, s.threshold - oldVP + change.defense) : Math.max(0, oldVP + change.offense);
      const total = reward.kind === 'offensive' ? change.offense : change.defense;
      const fraction = total > 0 ? Math.min(1, available / total) : 0;
      const payout = Math.round(reward.payout * fraction); reward.a.lp += payout; reward.a.totalLP += payout;
      if (reward.f.ownerId === 'player') state.lastTurn.lp += payout;
      reward.f.lastAction = `${reward.kind === 'offensive' ? 'Offensive' : 'Defensive'} ${reward.profile}: ${Math.round(reward.requestedVP * fraction)} VP, ${payout.toLocaleString('en-US')} LP`;
    }
  }
}
function resolveSupplies(state) {
  const pendingJobs = [];
  for (const job of state.jobs) {
    const a = actor(state, job.ownerId); job.remainingTurns--;
    if (job.evacuationRemainingTurns > 0) {
      job.evacuationRemainingTurns--;
      if (job.evacuationRemainingTurns === 0) { job.systemId = job.destinationId; delete job.destinationId; delete job.evacuationRemainingTurns; job.status = 'manufacturing'; }
    }
    if (job.remainingTurns > 0) { pendingJobs.push(job); continue; }
    if (getSystem(state, job.systemId).occupier !== actorFaction(state, job.ownerId) && job.type !== 'training') { job.remainingTurns = 1; pendingJobs.push(job); continue; }
    if (job.type === 'training') { a.pilots += job.count; a.morale = clamp(a.morale + 2); }
    else if (job.systemId === a.stagingId) a.hangar[job.doctrineId] += job.count;
    else {
      state.shipments.push({ id: nextId(state, 'shipment'), ownerId: job.ownerId, doctrineId: job.doctrineId, count: job.count, materials: 0, remainingTurns: relocationTurns(state, job.systemId, a.stagingId), originId: job.systemId, systemId: a.stagingId, status: 'in-transit', delayedTurns: 0, createdTurn: state.turn });
    }
    if (job.ownerId === 'player') { const text = job.type === 'training' ? `${job.count} additional pilots completed training.` : `${job.count} ${getDoctrine(job.doctrineId).hull} hulls completed manufacturing.`; state.lastTurn.deliveries.push(text); log(state, 'industry', 'Industry completion', text); }
  }
  state.jobs = pendingJobs;
  const pendingShipments = [];
  for (const shipment of state.shipments) {
    const a = actor(state, shipment.ownerId), faction = actorFaction(state, shipment.ownerId);
    if (shipment.createdTurn === state.turn) { pendingShipments.push(shipment); continue; }
    shipment.remainingTurns--;
    if (shipment.remainingTurns > 0) { pendingShipments.push(shipment); continue; }
    const system = getSystem(state, shipment.systemId);
    if (system.occupier !== faction) {
      shipment.delayedTurns++; shipment.remainingTurns = 1; shipment.status = 'blocked';
      pendingShipments.push(shipment); continue;
    }
    const hostile = state.fleets.filter(f => f.faction !== faction && f.systemId === system.id && f.ships > 0 && ['patrol', 'offensive'].includes(f.order.type)).reduce((n, f) => n + battlePower(f), 0);
    const escort = state.fleets.filter(f => f.faction === faction && f.systemId === system.id && f.ships > 0).reduce((n, f) => n + battlePower(f) * (f.order.type === 'escort' ? 2 : 1), 0);
    const lossChance = hostile > 0 ? clamp((hostile - escort * 0.7) / (hostile + escort + 10) * 0.45 - a.upgrades.logistics * 0.06, 0, 0.45) : 0;
    if (roll(state, 'freight', shipment.id) < lossChance) {
      if (shipment.ownerId === 'player') log(state, 'loss', 'Freight intercepted', `Hostile gate activity destroyed an incoming shipment at ${system.name}. Local patrols, escorts and logistics training reduce interception risk.`);
      continue;
    }
    if (shipment.systemId !== a.stagingId) { shipment.remainingTurns = relocationTurns(state, shipment.systemId, a.stagingId); shipment.systemId = a.stagingId; shipment.status = 'diverting'; pendingShipments.push(shipment); continue; }
    if (shipment.doctrineId) a.hangar[shipment.doctrineId] += shipment.count;
    if (shipment.hangar) for (const d of DOCTRINES) a.hangar[d.id] += shipment.hangar[d.id];
    a.materials += shipment.materials || 0;
    if (shipment.ownerId === 'player') { const text = `${shipment.doctrineId ? `${shipment.count} ${getDoctrine(shipment.doctrineId).hull} hulls` : shipment.hangar ? 'Relocated reserves and materials' : `${shipment.materials} industry kits`} delivered at ${system.name}.`; state.lastTurn.deliveries.push(text); log(state, 'logistics', 'Supply arrived', text); }
  }
  state.shipments = pendingShipments;
  recoverBlockedStaging(state);
}
function downtime(state) {
  for (const s of values(state).sort((a, b) => a.id - b.id)) if (s.hubPending && s.hubPending.transferTurn <= state.turn) {
    const previous = s.occupier; s.occupier = s.hubPending.faction; s.vp = 0; s.hubDamage = 0; s.hubPending = null; s.capturedTurn = state.turn; s.advantage = { caldari: 0, gallente: 0 };
    const report = { systemId: s.id, name: s.name, previous, faction: s.occupier }; state.lastTurn.captures.push(report);
    log(state, 'capture', `${s.name} changes hands`, `Scheduled downtime transfers occupancy to ${s.occupier === 'caldari' ? 'Caldari State' : 'Gallente Federation'}. Capture pressure resets and the gate-connected front changes.`);
    for (const a of [state.player, ...state.actors]) { const faction = a === state.player ? state.faction : a.faction; a.morale = clamp(a.morale + (faction === s.occupier ? 2 : -1)); }
  }
}
function settleParticipation(state) {
  for (const ownerId of ['player', ...state.actors.map(a => a.id)].sort()) {
    const a = actor(state, ownerId), fleets = ownFleets(state, ownerId);
    const active = fleets.filter(f => f.order.type !== 'rest' && !f.withdrawn && f.ships > 0 && f.activeShips > 0);
    const proportion = active.length / Math.max(1, fleets.length);
    a.fatigue = clamp(a.fatigue + proportion * 7 - (1 - proportion) * 10 - (a.resting && proportion === 0 ? 4 : 0));
    a.morale = clamp(a.morale + (proportion === 0 ? 0.7 : a.fatigue > 65 ? -1.6 : 0.05));
    a.resting = false; a.cashoutUsed = 0; a.festivalCooldown = Math.max(0, a.festivalCooldown - 1);
    const isk = RULES.baseIndustryIncome + a.upgrades.industry * RULES.industryIncomePerLevel;
    income(a, isk, 'Background industrial contracts (external income)', state.turn);
    if (ownerId === 'player') state.lastTurn.income += isk;
    for (const f of fleets) {
      if (f.order.type === 'rest' || f.withdrawn || f.activeShips === 0) { f.readiness = clamp(f.readiness + 16 + a.upgrades.logistics * 2); f.damage = clamp(f.damage - 20); f.fatigue = clamp(f.fatigue - 18); }
      else { f.readiness = clamp(f.readiness - 3 - (f.engaged ? 2 : 0) + a.upgrades.logistics); f.fatigue = clamp(f.fatigue + 8); }
      // Attendance is a per-watch reservation, not extra ships or permanently lost people.
      delete f.turnOriginId; delete f.movedHops;
    }
    if (ownerId !== 'player') {
      a.cooldown = Math.max(0, a.cooldown - 1);
      if (a.commitment) {
        if (fleets.some(f => f.systemId === a.commitment.targetId && f.operationDone && !f.withdrawn)) a.commitment.fulfilledWatches++;
        a.commitment.remainingTurns--;
        if (a.commitment.remainingTurns <= 0) {
          const honored = a.commitment.fulfilledWatches > 0; a.trust = clamp(a.trust + (honored ? 7 : -5));
          if (a.faction === state.faction) recordJointOperation(state, a.id, honored ? 'fulfilled' : 'failed', simulationContext());
          if (a.faction === state.faction) { state.player.trust = clamp(state.player.trust + (honored ? 3 : -2)); log(state, 'council', `${a.name}: operation ${honored ? 'completed' : 'ended'}`, honored ? 'The ally reached its objective and supported the operation. Fulfilled agreements improve future coalition readiness.' : 'Travel, losses or changes in the front prevented effective support. Its finite resources and tactical judgment constrained the operation.'); }
          a.commitment = null;
        }
      }
    }
  }
}
function settleObjective(state) {
  const mandate = state.objective, readiness = getReadiness(state).score;
  const held = mandate.targetIds.filter(id => getSystem(state, id).occupier === state.faction).length;
  if (held === mandate.targetIds.length && readiness >= mandate.minimumReadiness && getReadiness(state).fieldedShips >= 6) mandate.holdProgress = Math.min(mandate.requiredHoldTurns, mandate.holdProgress + 1);
  else mandate.holdProgress = 0;
  if (state.sandbox) return;
  const initialTargets = mandate.targetIds.map(id => getSystem(state, id));
  const territory = initialTargets.reduce((n, s) => n + (s.occupier === state.faction ? 1 : s.hubPending?.faction === state.faction ? 0.9 : s.vp / s.threshold * 0.65), 0) / mandate.targetIds.length;
  const score = Math.round(territory * 50 + readiness * 0.25 + state.player.trust * 0.25);
  if (mandate.holdProgress >= mandate.requiredHoldTurns) state.result = { type: 'victory', title: 'Mandate secured', text: 'Your corporation and coalition captured the named bridgehead, held it through four watches and retained a viable force. The campaign is complete.', score };
  else if (state.turn >= state.maxTurns) {
    const sustainableSuccess = score >= 65 && readiness >= mandate.minimumReadiness && getReadiness(state).fieldedShips >= 6;
    state.result = { type: sustainableSuccess ? 'victory' : score >= 35 ? 'partial' : 'defeat', title: sustainableSuccess ? 'Strategic success' : score >= 35 ? 'An unfinished campaign' : 'Mandate unfulfilled', text: `The ${state.maxTurns}-watch campaign has ended. Assessment: ${Math.round(territory * 100)}% territorial objective progress (50% weight), ${readiness}% readiness (25%), ${Math.round(state.player.trust)}% coalition trust (25%). Score: ${score}/100.${getReadiness(state).fieldedShips < 6 ? ' Fewer than six fielded ships remain; the coalition needs a recovery effort before this can count as full strategic success.' : ''}`, score };
  }
  if (state.result) log(state, 'result', state.result.title, state.result.text);
}
export function advanceTurn(state) {
  mustActive(state); validateCampaign(state);
  assert(state.turn < MAX_SANDBOX_WATCH, 'This campaign has reached its maximum supported watch. Export it and start a new campaign.');
  const draft = copy(state); draft.turn++;
  draft.lastTurn = { battles: [], captures: [], deliveries: [], losses: 0, income: 0, lp: 0 };
  downtime(draft); npcPlanning(draft); allocateAttendance(draft); moveFleets(draft); resolveBattles(draft); resolveOperations(draft); resolveSupplies(draft); settleParticipation(draft); settlePeople(draft, simulationContext()); settleDiplomacy(draft, simulationContext()); syncAllies(draft); settleObjective(draft); validateCampaign(draft);
  Object.assign(state, draft); return state;
}
export function continueSandbox(state) {
  validateCampaign(state);
  assert(state.result && !state.sandbox, 'Finish the campaign before continuing in sandbox mode.');
  const draft = copy(state);
  draft.campaignReport = { ...copy(draft.result), turn: draft.turn };
  draft.sandbox = true; draft.result = null;
  log(draft, 'briefing', 'Sandbox command continues', 'Your campaign report is preserved. Fleets, politics, industry and the watch calendar continue without another mandate deadline.');
  validateCampaign(draft); Object.assign(state, draft); return state;
}

/** An estimate from the player's scouting picture, never private enemy orders or future rolls. */
export function getCombatForecast(state, fleetId, targetId) {
  const selected = fleetById(state, fleetId), target = getSystem(state, targetId);
  assert(target, 'Select a warzone system for the forecast.');
  const route = findRoute(state, selected.systemId, target.id);
  const hops = route.length - 1, turns = Math.ceil(hops / getDoctrine(selected.doctrineId).speed);
  const friendly = state.fleets.filter(f => f.faction === state.faction && f.ships > 0);
  const scouted = friendly.some(f => f.systemId === target.id || getSystem(state, f.systemId).neighbors.includes(target.id))
    || state.player.stagingId === target.id || getSystem(state, state.player.stagingId).neighbors.includes(target.id);
  const reasons = [turns ? `${turns} travel watch${turns === 1 ? '' : 'es'}; the situation can change before arrival.` : 'The selected formation is already on station.'];
  const readiness = getReadiness(state), own = ownFleets(state).filter(f => f.order.type !== 'rest' || f.id === selected.id);
  const demand = own.reduce((n, f) => n + f.ships, 0);
  const active = Math.min(selected.ships, Math.floor(selected.ships * Math.min(1, readiness.availablePilots / Math.max(1, demand))));
  reasons.push(`${active} of ${selected.ships} hulls have estimated pilot coverage; fleet readiness is ${Math.round(selected.readiness)}%.`);
  if (!selected.ships || active === 0) return { assessment: 'Formation unavailable', confidence: 'High', reasons: [...reasons, 'Assign replacement ships and restore pilot attendance before committing.'] };
  if (!scouted) return { assessment: 'Unscouted target', confidence: 'Low', reasons: [...reasons, 'No friendly scouting coverage. Send a scout before estimating enemy strength.'] };
  const observed = getVisibleFleets(state).filter(f => f.systemId === target.id && f.ships > 0 && f.id !== selected.id);
  const estimate = f => f.ships * getDoctrine(f.doctrineId).power * (0.45 + f.readiness / 180);
  const opposition = observed.filter(f => f.faction !== state.faction).reduce((n, f) => n + estimate(f), 0);
  const localSupport = observed.filter(f => f.faction === state.faction).reduce((n, f) => n + estimate(f), 0);
  const availablePower = estimate({ ...selected, ships: active }) * (1 - selected.damage * 0.003) + localSupport * 0.5;
  const assessment = opposition === 0 ? 'No hostiles reported' : availablePower >= opposition * 1.35 ? 'Favorable on current reports' : availablePower >= opposition * 0.8 ? 'Contested engagement' : 'Outmatched on current reports';
  reasons.push(opposition ? 'Comparison uses observed hull classes and readiness; enemy attendance and intentions are unknown.' : 'Scouts currently report no hostile formations here. Reinforcements may still arrive.');
  if (localSupport) reasons.push('Allied formations are nearby; their support is discounted because their orders are independent.');
  if (selected.stance === 'evade') reasons.push('Evade stance prioritizes escape and can give up objective time.');
  reasons.push('This estimate predicts neither a guaranteed result nor an exact loss count.');
  return { assessment, confidence: turns ? 'Low' : 'Medium', reasons };
}
function finite(n, name, min = 0, max = 1e15, integer = false) { assert(typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)), `Invalid ${name}.`); }
function safeObject(value, depth = 0) {
  assert(depth <= 30, 'Save structure is too deeply nested.');
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { assert(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe save property.'); safeObject(item, depth + 1); }
}
export function validateCampaign(state) {
  assert(state && typeof state === 'object' && state.version === RULES.version, 'Unsupported campaign version.'); safeObject(state);
  assert(state.schemaVersion === undefined || state.schemaVersion === CAMPAIGN_SCHEMA, 'Unsupported campaign schema.');
  assert(FACTIONS.includes(state.faction), 'Invalid campaign faction.'); assert(typeof state.seed === 'string' && state.seed.length <= 500, 'Invalid campaign seed.');
  finite(state.turn, 'watch', 0, MAX_SANDBOX_WATCH, true); finite(state.maxTurns, 'campaign length', 8, 500, true); assert(state.sandbox === true || state.turn <= state.maxTurns, 'Watch exceeds campaign length.'); finite(state.nextId, 'event sequence', 1, 1e8, true);
  assert(state.systems && typeof state.systems === 'object' && !Array.isArray(state.systems) && values(state).length > 0 && values(state).length <= 200, 'Invalid warzone systems.');
  assert(Array.isArray(state.edges) && state.edges.length < 1000, 'Invalid gate graph.');
  const edges = new Set();
  for (const edge of state.edges) { assert(Array.isArray(edge) && edge.length === 2 && getSystem(state, edge[0]) && getSystem(state, edge[1]) && edge[0] !== edge[1], 'Invalid stargate endpoint.'); const key = [...edge].sort((a, b) => a - b).join(':'); assert(!edges.has(key), 'Duplicate stargate.'); edges.add(key); }
  for (const [key, s] of Object.entries(state.systems)) {
    assert(String(s.id) === key && Number.isInteger(s.id) && typeof s.name === 'string', 'Invalid system identity.'); assert(FACTIONS.includes(s.occupier), 'Invalid occupier.'); finite(s.threshold, 'capture threshold', 1, 1e9); finite(s.vp, 'capture pressure', 0, s.threshold); finite(s.hubDamage, 'hub damage', 0, 1e6);
    assert(s.advantage && typeof s.advantage === 'object', 'Invalid advantage.'); FACTIONS.forEach(f => finite(s.advantage[f], 'advantage', 0, 60));
    assert(Array.isArray(s.neighbors) && new Set(s.neighbors).size === s.neighbors.length, 'Invalid neighbor list.');
    for (const id of s.neighbors) assert(getSystem(state, id)?.neighbors.includes(s.id) && edges.has([s.id, id].sort((a, b) => a - b).join(':')), 'Asymmetric or invented gate adjacency.');
    if (s.hubPending) { assert(s.vp === s.threshold && s.hubPending.faction === other(s.occupier), 'Invalid pending transfer.'); finite(s.hubPending.transferTurn, 'transfer watch', state.turn + 1, MAX_SANDBOX_WATCH + 4, true); assert(s.hubPending.transferTurn % RULES.downtimeEveryTurns === 0 && s.hubDamage >= RULES.hubStrength, 'Transfer must follow hub defeat at a scheduled downtime.'); }
  }
  for (const edge of state.edges) assert(getSystem(state, edge[0]).neighbors.includes(edge[1]), 'Missing source stargate adjacency.');
  assert(Array.isArray(state.actors) && state.actors.length === NPC_ORGANIZATIONS.length, 'Invalid corporation roster.');
  assert(new Set(state.actors.map(a => a.id)).size === state.actors.length, 'Duplicate corporation.');
  for (const a of state.actors) { const source = NPC_ORGANIZATIONS.find(n => n.id === a.id); assert(source && ['faction', 'name', 'corporationId', 'allianceId', 'allianceName', 'ticker'].every(key => a[key] === source[key]), 'Corporation identity does not match the scenario.'); }
  assert(state.player && typeof state.player.commanderName === 'string' && state.player.commanderName.length <= 60 && typeof state.player.corporationName === 'string' && state.player.corporationName.length <= 80, 'Invalid commander identity.');
  for (const a of [state.player, ...state.actors]) {
    if (a.stagingBlockedTurns !== undefined) finite(a.stagingBlockedTurns, 'staging blockade', 0, MAX_SANDBOX_WATCH, true);
    finite(a.wallet, 'wallet'); finite(a.lp, 'LP', 0, 1e12, true); finite(a.materials, 'industry kits', 0, 1e7, true); finite(a.pilots, 'pilot roster', 0, RULES.maxPilots, true); finite(a.cashoutUsed, 'LP broker volume', 0, RULES.cashoutCap, true); finite(a.festivalCooldown, 'community cooldown', 0, RULES.festivalCooldown, true);
    for (const key of ['morale', 'fatigue', 'trust']) finite(a[key], key, 0, 100);
    assert(getSystem(state, a.stagingId), 'Invalid staging system.'); assert(a.hangar && Object.keys(a.hangar).length === DOCTRINES.length, 'Invalid hangar.'); for (const d of DOCTRINES) finite(a.hangar[d.id], `${d.hull} stock`, 0, 1e6, true);
    assert(a.upgrades && Object.keys(a.upgrades).length === 3, 'Invalid institution registry.'); for (const key of Object.keys(RULES.upgradeBaseCosts)) finite(a.upgrades[key], `${key} level`, 0, RULES.maxUpgradeLevel, true);
    if (a !== state.player) {
      finite(a.cooldown, 'ally cooldown', 0, RULES.allyRequestCooldown, true);
      if (a.commitment) { assert(getSystem(state, a.commitment.targetId) && ['offensive', 'defensive', 'patrol', 'advantage', 'hub'].includes(a.commitment.mission), 'Invalid coalition agreement.'); finite(a.commitment.remainingTurns, 'commitment duration', 1, RULES.allyRequestTurns, true); finite(a.commitment.fulfilledWatches, 'fulfilled commitment watches', 0, RULES.allyRequestTurns, true); }
    }
  }
  assert(Array.isArray(state.fleets) && state.fleets.length <= 100, 'Invalid fleet roster.'); const ids = new Set();
  for (const f of state.fleets) {
    assert(typeof f.id === 'string' && !ids.has(f.id), 'Duplicate or invalid fleet ID.'); ids.add(f.id);
    assert(actor(state, f.ownerId) && f.faction === actorFaction(state, f.ownerId), 'Fleet ownership mismatch.'); getDoctrine(f.doctrineId); finite(f.ships, 'fleet hulls', 0, RULES.maxFleetShips, true); assert(getSystem(state, f.systemId), 'Fleet outside the warzone.'); assert(STANCES.includes(f.stance), 'Invalid fleet stance.'); assert(f.order && ORDER_TYPES.includes(f.order.type) && getSystem(state, f.order.targetId), 'Invalid fleet order.'); assert(typeof f.name === 'string' && f.name.length <= 100, 'Invalid fleet name.'); finite(f.readiness, 'fleet readiness', 0, 100); finite(f.damage, 'survivor damage', 0, 100); finite(f.lifetimeLosses, 'fleet losses', 0, 1e9, true);
  }
  for (const ownerId of ['player', ...state.actors.map(a => a.id)]) assert(ownFleets(state, ownerId).reduce((n, f) => n + f.ships, 0) <= actor(state, ownerId).pilots, 'More fleet hulls assigned than roster pilots.');
  assert(Array.isArray(state.jobs) && Array.isArray(state.shipments) && state.jobs.length <= 100 && state.shipments.length <= 500, 'Invalid logistics queue.');
  for (const entry of [...state.jobs, ...state.shipments]) {
    assert(typeof entry.id === 'string' && !ids.has(entry.id), 'Duplicate logistics ID.'); ids.add(entry.id); assert(actor(state, entry.ownerId) && getSystem(state, entry.systemId), 'Invalid logistics ownership or destination.'); finite(entry.remainingTurns, 'delivery time', 1, 100, true); finite(entry.count, 'cargo count', 0, 1e6, true);
    if (entry.doctrineId) getDoctrine(entry.doctrineId);
    if (entry.materials !== undefined) finite(entry.materials, 'cargo materials', 0, 1e7, true);
    if (entry.hangar) { assert(Object.keys(entry.hangar).length === DOCTRINES.length, 'Invalid relocated hangar.'); for (const d of DOCTRINES) finite(entry.hangar[d.id], 'relocated ship count', 0, 1e6, true); }
  }
  for (const j of state.jobs) { if (j.evacuationRemainingTurns !== undefined) { finite(j.evacuationRemainingTurns, 'factory evacuation time', 1, j.remainingTurns, true); assert(getSystem(state, j.destinationId), 'Invalid factory evacuation destination.'); } assert(['manufacture', 'training'].includes(j.type), 'Invalid industry job.'); assert(j.count > 0 && (j.type !== 'manufacture' || j.doctrineId), 'Invalid production output.'); }
  assert(state.objective && Array.isArray(state.objective.targetIds) && state.objective.targetIds.length === 2 && new Set(state.objective.targetIds).size === 2 && state.objective.targetIds.every(id => getSystem(state, id)), 'Invalid mandate.'); finite(state.objective.holdProgress, 'mandate holding period', 0, RULES.holdTurns, true); assert(state.objective.requiredHoldTurns === RULES.holdTurns && state.objective.minimumReadiness === RULES.mandateReadiness, 'Invalid mandate rules.');
  assert(Array.isArray(state.log) && state.log.length <= 2000, 'Invalid campaign log.');
  for (const entry of state.log) { assert(typeof entry.id === 'string' && typeof entry.type === 'string' && typeof entry.title === 'string' && entry.title.length <= 250 && typeof entry.text === 'string' && entry.text.length <= 4000, 'Invalid campaign report.'); finite(entry.turn, 'report watch', 0, state.turn, true); }
  assert(state.lastTurn && ['battles', 'captures', 'deliveries'].every(key => Array.isArray(state.lastTurn[key]) && state.lastTurn[key].length <= 200), 'Invalid last-watch report.');
  for (const key of ['losses', 'income', 'lp']) finite(state.lastTurn[key], 'last-watch accounting', 0, 1e15, true);
  for (const delivery of state.lastTurn.deliveries) assert(typeof delivery === 'string' && delivery.length <= 1000, 'Invalid delivery report.');
  for (const battle of state.lastTurn.battles) assert(getSystem(state, battle.systemId) && typeof battle.text === 'string' && battle.losses && FACTIONS.every(key => Number.isInteger(battle.losses[key]) && battle.losses[key] >= 0) && Array.isArray(battle.fleets), 'Invalid battle report.');
  for (const capture of state.lastTurn.captures) assert(getSystem(state, capture.systemId) && FACTIONS.includes(capture.faction) && FACTIONS.includes(capture.previous), 'Invalid capture report.');
  if (state.result) { assert(['victory', 'partial', 'defeat'].includes(state.result.type) && typeof state.result.title === 'string' && typeof state.result.text === 'string', 'Invalid campaign result.'); finite(state.result.score, 'campaign score', 0, 100, true); }
  if (state.schemaVersion === CAMPAIGN_SCHEMA) {
    assert(typeof state.sandbox === 'boolean', 'Invalid sandbox mode.');
    if (state.sandbox) {
      assert(!state.result && state.campaignReport && ['victory', 'partial', 'defeat'].includes(state.campaignReport.type), 'Sandbox requires a preserved campaign report.');
      assert(typeof state.campaignReport.title === 'string' && state.campaignReport.title.length <= 250 && typeof state.campaignReport.text === 'string' && state.campaignReport.text.length <= 4000, 'Invalid archived campaign report.');
      finite(state.campaignReport.turn, 'campaign report watch', 0, Math.min(state.turn, state.maxTurns), true); finite(state.campaignReport.score, 'archived campaign score', 0, 100, true);
    } else assert(state.campaignReport === null, 'Only sandbox campaigns have an archived result.');
    validatePeople(state); validateDiplomacy(state);
  } else assert(state.people === undefined && state.diplomacy === undefined && !state.sandbox && !state.campaignReport, 'Invalid legacy campaign extensions.');
  return true;
}
export function exportCampaign(state) { validateCampaign(state); const payload = JSON.stringify(state); return JSON.stringify({ format: 'new-eden-war-council', version: RULES.version, checksum: hash(payload).toString(16), state }, null, 2); }
export function importCampaign(text, snapshot) {
  assert(typeof text === 'string' && text.length <= 5_000_000, 'Save file is missing or too large.');
  let envelope; try { envelope = JSON.parse(text); } catch { throw new Error('This is not a readable JSON campaign save.'); }
  safeObject(envelope); assert(envelope.format === 'new-eden-war-council' && envelope.version === RULES.version && envelope.state, 'Unsupported save format.');
  assert(envelope.checksum === hash(JSON.stringify(envelope.state)).toString(16), 'The save checksum does not match; the file was modified or damaged.');
  const state = envelope.state; validateCampaign(state);
  assert(snapshot && state.scenarioId === snapshot.scenarioId && Object.keys(state.systems).length === snapshot.systems.length, 'This save uses a different warzone scenario.');
  assert(JSON.stringify(state.edges) === JSON.stringify(snapshot.edges), 'Saved gates do not match the source warzone.');
  for (const source of snapshot.systems) {
    const saved = getSystem(state, source.id); assert(saved, 'A source warzone system is missing.');
    for (const key of ['id', 'name', 'neighbors', 'position2D', 'position3D', 'constellationId', 'constellation', 'regionId', 'region', 'securityStatus', 'npcStationCount', 'originalFactionId', 'occupierFactionId', 'victoryPoints', 'victoryPointsThreshold']) assert(JSON.stringify(saved[key]) === JSON.stringify(source[key]), `Source geography or opening data was modified: ${source.name}.`);
    assert(saved.threshold === source.victoryPointsThreshold, 'Capture thresholds do not match the source snapshot.');
  }
  if (state.schemaVersion === undefined) {
    state.schemaVersion = CAMPAIGN_SCHEMA; state.sandbox = false; state.campaignReport = null;
    initializePeople(state); initializeDiplomacy(state);
  }
  syncAllies(state); validateCampaign(state); return state;
}
