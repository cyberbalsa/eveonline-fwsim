import {test,expect} from '@playwright/test';
const KEY='eve-war-council-campaign-v1';
const read = page => page.evaluate(key=>JSON.parse(localStorage.getItem(key)).state,KEY);
async function enlist(page,faction='caldari') {
  await page.goto('./'); await page.locator(`.faction-option:has(input[value="${faction}"])`).click();
  await page.locator('#commander-name').fill('Test Commander'); await page.locator('#corporation-name').fill('Test Fleet');
  await page.locator('#start-campaign').click(); await expect(page.locator('#app')).toBeVisible();
}
test('enlist, order a real gate route, resolve a watch, save and resume the same campaign',async({page,baseURL})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const remote=[];page.on('request',r=>{if(!r.url().startsWith(baseURL)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))remote.push(r.url())});
  const failed=[];page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
  page.on('requestfailed',r=>failed.push(`${r.failure()?.errorText} ${r.url()}`));
  await enlist(page); const initial=await read(page); const target=initial.objective.targetIds[0];
  await page.locator('#briefing-summary [data-system]').first().click();
  await page.locator('#order-type').selectOption('offensive');await page.locator('#order-stance').selectOption('evade');
  await page.locator('#issue-order').click(); const queued=await read(page);
  const f=queued.fleets.find(f=>f.ownerId==='player');expect(f.order).toEqual({type:'offensive',targetId:target});expect(f.stance).toBe('evade');expect(queued.turn).toBe(0);
  await page.locator('#end-turn').click();await expect(page.locator('#campaign-date')).toContainText('WATCH 1 /');
  const after=await read(page);expect(after.turn).toBe(1);expect(after.fleets.find(v=>v.id===f.id).systemId).toBe(target);
  await page.reload();await expect(page.locator('#resume-campaign')).toBeVisible();await page.locator('#resume-campaign').click();
  expect(await read(page)).toEqual(after);await expect(page.locator('#campaign-date')).toContainText('WATCH 1 /');
  expect(errors).toEqual([]);expect(remote).toEqual([]);expect(failed).toEqual([]);
});
test('keyboard map selection, exact system search, modal focus trap and portable save validation',async({page})=>{
  await enlist(page,'gallente');const before=await read(page);
  await page.locator('#map-search').fill('Tama');await expect(page.locator('#system-panel h2')).toHaveText('Tama');
  await page.locator('#map-search').fill('');await page.locator('#map-fit').click();
  const target=page.locator(`[data-system-id="${before.objective.targetIds[0]}"]`);await target.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#system-panel h2')).toHaveText(before.systems[before.objective.targetIds[0]].name);
  await page.locator('#neocom [data-view="manual"]').click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');expect(await page.locator('#modal-root').evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#neocom [data-view="manual"]')).toBeFocused();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-game').click();const d=await downloadPromise;expect(d.suggestedFilename()).toMatch(/watch-0.json/);
  await page.locator('#import-file').setInputFiles({name:'corrupt.json',mimeType:'application/json',buffer:Buffer.from('{"format":"new-eden-war-council","version":1,"checksum":"bad","state":{}}')});
  await expect(page.locator('#status-message')).toContainText('Import rejected');expect(await read(page)).toEqual(before);
  const file=await d.path();await page.locator('#end-turn').click();await page.locator('#import-file').setInputFiles(file);
  await expect(page.locator('#status-message')).toContainText('Campaign imported');expect(await read(page)).toEqual(before);
});
test('phone controls remain reachable and all command windows fit the screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await enlist(page);
  for(const selector of ['#issue-order','#end-turn']) {
    const b=await page.locator(selector).boundingBox();expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(844);expect(b.x+b.width).toBeLessThanOrEqual(390);
  }
  await page.locator('[data-mobile-panel="fleets"]').click();await expect(page.locator('#fleets-list')).toBeVisible();
  await page.locator('[data-mobile-panel="system"]').click();await expect(page.locator('#system-panel')).toBeVisible();
  await page.locator('[data-mobile-panel="map"]').click();await expect(page.locator('#map-container')).toBeVisible();
  for(const view of ['overview','industry','council','doctrines','log','manual']) {
    await page.locator(`#neocom [data-view="${view}"]`).click();await expect(page.getByRole('dialog')).toBeVisible();
    const overflow=await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(overflow,view).toBeFalsy();
    await page.locator('[data-close]').click();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
