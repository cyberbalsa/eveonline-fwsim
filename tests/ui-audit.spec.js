import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const storageKey = 'eve-war-council-campaign-v1';
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, storageKey);
async function start(page, faction = 'caldari') {
  await page.goto('./');
  // Faction radios are presented as full artwork labels; click the visible
  // card as a player does, rather than the intentionally covered radio.
  await page.locator(`label.faction-${faction}`).click();
  await expect(page.locator(`input[name="faction"][value="${faction}"]`)).toBeChecked();
  await page.locator('#commander-name').fill('Audit Commander');
  await page.locator('#corporation-name').fill('Independent Audit Wing');
  await page.locator('#start-campaign').click();
  await expect(page.locator('#campaign-date')).toContainText('WATCH 0 / 120');
}
async function open(page, view) {
  await page.locator(`#neocom [data-view="${view}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function close(page) {
  await page.getByRole('button', { name: 'Close window', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });

test('industry orders consume quoted resources, deliver on schedule, and fitting consumes physical reserves', async ({ page }) => {
  await start(page);
  const initial = await saved(page);
  await open(page, 'industry');
  await page.locator('#production-form [name="doctrineId"]').selectOption('rifter');
  await page.locator('#production-form [name="count"]').fill('3');
  await expect(page.locator('#production-quote')).toContainText('6 industry kits');
  await expect(page.locator('#production-quote')).toContainText('2 watches');
  await page.locator('#production-form button[type="submit"]').click();
  let state = await saved(page);
  expect(state.player.wallet).toBe(initial.player.wallet - 3_840_000);
  expect(state.player.materials).toBe(initial.player.materials - 6);
  expect(state.player.hangar.rifter).toBe(initial.player.hangar.rifter);
  expect(state.jobs.filter(job => job.ownerId === 'player')).toHaveLength(1);
  await page.locator('#materials-form [name="count"]').fill('4');
  await page.locator('#materials-form button[type="submit"]').click();
  await page.locator('#cashout-form [name="amount"]').fill('1000');
  await page.locator('#cashout-form button[type="submit"]').click();
  state = await saved(page);
  expect(state.player.lp).toBe(initial.player.lp - 1000);
  expect(state.player.wallet).toBe(initial.player.wallet - 3_840_000 - 4_000_000 + 900_000);
  await close(page);
  await page.locator('#end-turn').click();
  state = await saved(page);
  expect(state.player.materials).toBe(initial.player.materials - 6 + 4);
  expect(state.player.hangar.rifter).toBe(initial.player.hangar.rifter);
  await page.locator('#end-turn').click();
  state = await saved(page);
  expect(state.player.hangar.rifter).toBe(initial.player.hangar.rifter + 3);
  await open(page, 'industry');
  await page.locator('#form-fleet-form [name="name"]').fill('Reserve Audit Wing');
  await page.locator('#form-fleet-form [name="count"]').fill('3');
  await page.locator('#form-fleet-form button[type="submit"]').click();
  await close(page);
  await page.locator('#fleets-list button').filter({ hasText: 'Reserve Audit Wing' }).click();
  await open(page, 'doctrines');
  await expect(page.locator('#refit-form')).toBeVisible();
  await page.locator('#refit-form [name="doctrineId"]').selectOption('catalyst');
  await page.locator('#refit-form [name="count"]').fill('3');
  await page.locator('#refit-form button[type="submit"]').click();
  await page.locator('#reinforce-form [name="count"]').fill('2');
  await page.locator('#reinforce-form button[type="submit"]').click();
  state = await saved(page);
  const formation = state.fleets.find(fleet => fleet.name === 'Reserve Audit Wing');
  expect(formation.doctrineId).toBe('catalyst'); expect(formation.ships).toBe(5);
  expect(state.player.hangar.rifter).toBe(initial.player.hangar.rifter + 3);
  expect(state.player.hangar.catalyst).toBe(initial.player.hangar.catalyst - 5);
  await close(page);
  await expect(page.locator('#fleet-panel')).toContainText('Catalyst');
  await expect(page.locator('#selected-ship-label')).toContainText('CATALYST');
});

test('the council funds an independent allied commitment and enforces its cooldown', async ({ page }) => {
  await start(page, 'gallente');
  const initial = await saved(page), ally = initial.allies[0];
  await open(page, 'council');
  await expect(page.locator('.diplomacy-row')).toHaveCount(initial.allies.length);
  const form = page.locator(`[data-ally-form="${ally.id}"]`);
  await form.locator('[name="mission"]').selectOption('patrol');
  await form.locator('[name="targetId"]').selectOption(String(initial.player.stagingId));
  await form.locator('button[type="submit"]').click();
  const state = await saved(page), funded = state.actors.find(actor => actor.id === ally.id);
  expect(state.player.wallet).toBe(initial.player.wallet - 35_000_000);
  expect(funded.wallet).toBe(initial.actors.find(actor => actor.id === ally.id).wallet + 35_000_000);
  expect(funded.commitment).toMatchObject({ mission: 'patrol', targetId: initial.player.stagingId, remainingTurns: 8 });
  await expect(page.locator(`[data-ally-form="${ally.id}"] button[type="submit"]`)).toBeDisabled();
  await expect(page.locator('.diplomacy-row').filter({ hasText: ally.name })).toContainText('Combat patrol');
});

test('map search, zoom, layers, and fleet commands work without advancing until end watch', async ({ page }) => {
  await start(page);
  const initial = await saved(page), formation = initial.fleets.find(fleet => fleet.ownerId === 'player');
  await page.locator('#map-search').fill('Fliet');
  await expect(page.locator('#system-panel .system-title')).toHaveText('Fliet');
  const svg = page.locator('#map-container svg');
  const before = await svg.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  expect(await svg.getAttribute('viewBox')).not.toBe(before);
  await page.getByRole('button', { name: 'Fit the full warzone', exact: true }).click();
  await expect(svg).toHaveAttribute('viewBox', '0 0 1640 1260');
  await page.locator('#map-layer').selectOption('frontline');
  expect(await page.locator('.map-system.layer-muted').count()).toBeGreaterThan(0);
  await page.locator('#map-layer').selectOption('supply');
  expect(await page.locator('.map-gate.supply-gate').count()).toBeGreaterThan(0);
  await page.locator('#map-search').fill('');
  const targetId = initial.systems[formation.systemId].neighbors[0];
  await page.locator('#map-search').fill(initial.systems[targetId].name);
  await page.locator('#order-type').selectOption('move');
  await page.locator('#order-stance').selectOption('evade');
  await page.locator('#issue-order').click();
  let state = await saved(page);
  const issued = state.fleets.find(fleet => fleet.id === formation.id);
  expect(state.turn).toBe(0); expect(issued.systemId).toBe(formation.systemId);
  expect(issued.order).toEqual({ type: 'move', targetId }); expect(issued.stance).toBe('evade');
  await expect(page.locator('.fleet-route')).toHaveCount(1);
  await page.locator('#end-turn').click();
  state = await saved(page);
  expect(state.turn).toBe(1);
  await expect(page.locator('#campaign-date')).toContainText('WATCH 1 / 120');
  const moved = state.fleets.find(fleet => fleet.id === formation.id);
  expect(moved.systemId).toBe(targetId);
});

test('autosave resumes and export/import restores the chosen watch while corrupt files preserve the current campaign', async ({ page }) => {
  await start(page);
  await page.locator('#end-turn').click();
  const watchOne = await saved(page);
  const downloading = page.waitForEvent('download');
  await page.locator('#export-game').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('eve-war-council-watch-1.json');
  const bytes = await readFile(await download.path());
  const exported = JSON.parse(bytes);
  expect(exported.state).toEqual(watchOne);
  await page.reload();
  await page.locator('#resume-campaign').click();
  await expect(page.locator('#campaign-date')).toContainText('WATCH 1 / 120');
  expect(await saved(page)).toEqual(watchOne);
  await page.locator('#end-turn').click();
  expect((await saved(page)).turn).toBe(2);
  await page.locator('#import-file').setInputFiles({ name: 'watch-one.json', mimeType: 'application/json', buffer: bytes });
  await expect(page.locator('#status-message')).toContainText('Campaign imported and saved');
  expect(await saved(page)).toEqual(watchOne);
  exported.state.player.wallet += 1;
  await page.locator('#import-file').setInputFiles({ name: 'damaged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('#status-message')).toContainText('Import rejected');
  expect(await saved(page)).toEqual(watchOne);
});

test('unscouted hostile fleets stay absent from map tokens and selected-system intelligence', async ({ page }) => {
  await start(page);
  const state = await saved(page), seen = new Set();
  for (const fleet of state.fleets.filter(fleet => fleet.faction === state.faction && fleet.ships > 0)) {
    seen.add(fleet.systemId);
    for (const neighbor of state.systems[fleet.systemId].neighbors) seen.add(neighbor);
  }
  seen.add(state.player.stagingId);
  for (const neighbor of state.systems[state.player.stagingId].neighbors) seen.add(neighbor);
  const hidden = state.fleets.filter(fleet => fleet.faction !== state.faction && !seen.has(fleet.systemId));
  expect(hidden.length).toBeGreaterThan(0);
  for (const fleet of hidden) await expect(page.locator(`[data-map-fleet="${fleet.id}"]`)).toHaveCount(0);
  const selected = hidden[0];
  await page.locator('#map-search').fill(state.systems[selected.systemId].name);
  await expect(page.locator('#system-panel .system-title')).toHaveText(state.systems[selected.systemId].name);
  await expect(page.locator('#system-panel')).toContainText('No reported formations');
  await expect(page.locator('#system-panel')).not.toContainText(selected.name);
  // Public geography remains available even when the local enemy force is hidden.
  await expect(page.locator('#system-panel')).toContainText('Contested');
  await expect(page.locator('#system-panel')).toContainText('STARGATES');
});
