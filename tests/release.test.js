import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCampaign, advanceTurn, continueSandbox, exportCampaign, importCampaign, validateCampaign, getCombatForecast, getVisibleFleets } from '../engine.js';

const snapshot = JSON.parse(readFileSync(new URL('../data/warzone-snapshot.json', import.meta.url)));
const make = options => createCampaign(snapshot, { seed: 'release-compatibility', ...options });
const checksum = payload => {
  let value = 2166136261;
  for (const character of payload) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0).toString(16);
};

test('published version-one saves migrate without changing fleets, funds, geography or the current watch', () => {
  const state = make();
  advanceTurn(state);
  for (const key of ['schemaVersion', 'people', 'diplomacy', 'sandbox', 'campaignReport']) delete state[key];
  const legacy = JSON.stringify({ format: 'new-eden-war-council', version: 1, checksum: checksum(JSON.stringify(state)), state });
  const restored = importCampaign(legacy, snapshot);
  for (const key of ['fleets', 'player', 'systems', 'objective', 'turn', 'actors', 'log']) assert.deepEqual(restored[key], state[key], `migration must preserve ${key}`);
  assert.equal(restored.schemaVersion, 2);
  assert(restored.people && restored.diplomacy);
  assert.deepEqual(importCampaign(exportCampaign(restored), snapshot), restored);
  advanceTurn(restored);
  assert.equal(restored.turn, state.turn + 1);
});

test('current saves cannot silently reset social consequences by deleting their new state', () => {
  for (const key of ['people', 'diplomacy']) {
    const state = make(); delete state[key];
    assert.throws(() => validateCampaign(state));
  }
  const state = make(); delete state.schemaVersion;
  assert.throws(() => validateCampaign(state), /legacy/);
});

test('sandbox preserves the original result and keeps resolving after the mandate deadline', () => {
  const state = make({ maxTurns: 8 });
  const before = exportCampaign(state);
  assert.throws(() => continueSandbox(state), /Finish/);
  assert.equal(exportCampaign(state), before);
  while (!state.result) advanceTurn(state);
  const result = structuredClone(state.result), wallet = state.player.wallet, fleets = structuredClone(state.fleets);
  continueSandbox(state);
  assert.equal(state.result, null);
  assert.deepEqual(state.campaignReport, { ...result, turn: 8 });
  assert.equal(state.player.wallet, wallet); assert.deepEqual(state.fleets, fleets);
  for (let watch = 0; watch < 12; watch++) advanceTurn(state);
  assert.equal(state.turn, 20); assert.equal(state.maxTurns, 8); assert.equal(state.result, null);
  assert.deepEqual(state.campaignReport, { ...result, turn: 8 });
  assert.deepEqual(importCampaign(exportCampaign(state), snapshot), state);
});

test('combat estimates cannot reveal hidden fleets or private hostile orders', () => {
  const state = make(), own = state.fleets.find(fleet => fleet.ownerId === 'player');
  const visible = new Set(getVisibleFleets(state).map(fleet => fleet.id));
  const hidden = state.fleets.find(fleet => !visible.has(fleet.id));
  assert(hidden);
  const unknown = getCombatForecast(state, own.id, hidden.systemId);
  assert.equal(unknown.assessment, 'Unscouted target'); assert.equal(unknown.confidence, 'Low');
  hidden.ships = 25; hidden.readiness = 100; hidden.stance = 'commit'; hidden.order.type = 'patrol';
  assert.deepEqual(getCombatForecast(state, own.id, hidden.systemId), unknown);
  hidden.systemId = own.systemId;
  const observed = getCombatForecast(state, own.id, own.systemId);
  hidden.order = { type: 'rest', targetId: own.systemId }; hidden.activeShips = 0;
  assert.deepEqual(getCombatForecast(state, own.id, own.systemId), observed);
  assert(observed.reasons.some(reason => reason.includes('unknown')));
});
