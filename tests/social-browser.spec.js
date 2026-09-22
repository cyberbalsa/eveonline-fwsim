import {test, expect} from '@playwright/test';

const KEY = 'eve-war-council-campaign-v1';
const stateOf = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, KEY);
async function enlist(page) {
  await page.goto('./');
  await page.locator('#start-campaign').click();
  await expect(page.locator('#app')).toBeVisible();
}
async function open(page, view) { await page.locator(`#neocom [data-view="${view}"]`).click(); }
async function close(page) { await page.getByRole('button',{name:'Close window',exact:true}).click(); }
async function importPayload(page, payload) {
  await page.locator('#import-file').setInputFiles({name:'campaign.json',mimeType:'application/json',buffer:Buffer.from(payload)});
  await expect(page.locator('#status-message')).toContainText('Campaign imported and saved');
}

test('pilot requests, protected rest, policies and fictional officers persist and affect participation',async({page}) => {
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  await enlist(page); const initial = await stateOf(page);
  await expect(page.locator('#briefing-summary')).toContainText('An affordable fleet');
  await open(page,'overview');
  await expect(page.locator('[data-cohort]')).toHaveCount(6);
  await page.locator('[data-action="peopleRespond"][data-choice-id="promise"]').click();
  await expect(page.locator('.people-requests')).toContainText('Promise outstanding');
  expect((await stateOf(page)).people.requests[0].status).toBe('promised');
  await page.locator('[data-cohort="support"] [data-action="peopleRest"]').click();
  let state = await stateOf(page);
  expect(state.people.cohorts.find(cohort => cohort.id === 'support').restRemaining).toBe(2);
  expect(state.fleets.filter(fleet => fleet.ownerId === 'player').map(fleet => fleet.ships)).toEqual(initial.fleets.filter(fleet => fleet.ownerId === 'player').map(fleet => fleet.ships));
  await expect(page.locator('[data-cohort="support"] [data-action="peopleRest"]')).toBeDisabled();
  await page.locator('summary').filter({hasText:'Corporation policies'}).click();
  await page.locator('[data-policy-form="replacements"] select').selectOption('full');
  await page.locator('[data-policy-form="replacements"] button').click();
  expect((await stateOf(page)).people.policies.replacements).toBe('full');
  await expect(page.locator('[data-policy-form="replacements"] button')).toBeDisabled();
  await page.locator('summary').filter({hasText:'Officer bench'}).click();
  await expect(page.locator('[data-officer="fc"]')).toContainText('Fictional officer');
  await page.locator('[data-officer="fc"] button').click();
  state = await stateOf(page);
  expect(state.people.officers.find(officer => officer.id === 'fc')).toMatchObject({level:1,trainingUntil:3});
  expect(state.player.wallet).toBe(initial.player.wallet - 18_000_000);
  await close(page); await page.reload(); await page.locator('#resume-campaign').click();
  expect(await stateOf(page)).toEqual(state); expect(errors).toEqual([]);
});

test('counteroffers reserve no cash until accepted, treaty cancellation records a consequence, and favors settle',async({page}) => {
  await enlist(page); const initial=await stateOf(page), ally=initial.allies[0];
  await open(page,'council');
  const row = page.locator('.diplomacy-row').filter({has:page.locator(`[data-ally-form="${ally.id}"]`)});
  await row.locator('summary').filter({hasText:'Negotiate an agreement'}).click();
  const form = page.locator(`[data-negotiation-form="${ally.id}"]`);
  await form.locator('[name="agreement"]').selectOption('access');
  await form.locator('[name="offerISK"]').fill('0');
  await form.locator('button[type="submit"]').click();
  let state=await stateOf(page), relation=state.diplomacy.organizations[ally.id];
  expect(state.player.wallet).toBe(initial.player.wallet); expect(relation.pending.requiredISK).toBe(15_000_000);
  await expect(row.getByRole('region',{name:'Counteroffer'})).toBeVisible();
  await close(page); await expect(page.locator('#briefing-summary')).toContainText('counteroffer');
  await open(page,'council'); await row.locator('[data-action="diplomacyAccept"]').click();
  state=await stateOf(page); relation=state.diplomacy.organizations[ally.id];
  expect(state.player.wallet).toBe(initial.player.wallet-15_000_000);
  expect(relation.pending).toBeNull(); expect(relation.agreements[0].type).toBe('access');
  await row.locator('summary').filter({hasText:'Relationships & commitments'}).click();
  await row.locator('[data-action="diplomacyAid"]').click();
  expect((await stateOf(page)).diplomacy.organizations[ally.id].favors).toBe(1);
  await row.locator('[data-action="diplomacyCallFavor"]').click();
  state=await stateOf(page); expect(state.diplomacy.organizations[ally.id].favors).toBe(0);
  expect(state.player.wallet).toBe(initial.player.wallet-15_000_000);
  const beforeTrust=state.actors.find(actor=>actor.id===ally.id).trust;
  await row.locator('[data-action="diplomacyRenounce"]').click();
  state=await stateOf(page); relation=state.diplomacy.organizations[ally.id];
  expect(relation.agreements).toHaveLength(0); expect(relation.grievance).toBe(15);
  expect(state.actors.find(actor=>actor.id===ally.id).trust).toBe(beforeTrust-8);
  await expect(row).toContainText('No active treaty obligations');
});

test('named saves load from enlistment, preserve the replaced campaign, reject corrupt slots and delete independently',async({page}) => {
  await enlist(page); const initial=await stateOf(page);
  await page.locator('#save-game').click();
  await page.locator('#save-slot-form [name="name"]').fill('Before deployment');
  await page.locator('#save-slot-form button').click();
  await expect(page.locator('[data-save-slot]')).toHaveCount(1);
  await close(page); await page.locator('#end-turn').click(); const later=await stateOf(page);
  await page.reload(); await page.getByRole('button',{name:'Saved campaigns & recovery'}).click();
  await page.getByRole('button',{name:'Load Before deployment',exact:true}).click();
  expect(await stateOf(page)).toEqual(initial);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(`${key}-backup`)).state,KEY)).toEqual(later);
  await page.locator('#save-game').click(); await page.getByRole('button',{name:'Load recovery copy',exact:true}).click();
  expect(await stateOf(page)).toEqual(later);
  await page.locator('#save-game').click();
  await page.evaluate(key=>{const slots=JSON.parse(localStorage.getItem(`${key}-slots`));slots[0].campaign='invalid';localStorage.setItem(`${key}-slots`,JSON.stringify(slots));},KEY);
  await page.getByRole('button',{name:'Load Before deployment',exact:true}).click();
  await expect(page.locator('#status-message')).toContainText('Saved campaign action failed');
  expect(await stateOf(page)).toEqual(later);
  await page.getByRole('button',{name:'Delete Before deployment',exact:true}).click();
  await expect(page.locator('[data-save-slot]')).toHaveCount(0); expect(await stateOf(page)).toEqual(later);
});

test('replacement aborts when its recovery copy cannot be stored',async({page}) => {
  await enlist(page); const initial=await stateOf(page);
  const payload=await page.evaluate(key=>localStorage.getItem(key),KEY);
  await page.locator('#end-turn').click(); const later=await stateOf(page);
  await page.evaluate(key=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,value){if(k===`${key}-backup`)throw new DOMException('Storage full','QuotaExceededError');return write.call(this,k,value);};},KEY);
  await page.locator('#import-file').setInputFiles({name:'earlier.json',mimeType:'application/json',buffer:Buffer.from(payload)});
  await expect(page.locator('#status-message')).toContainText('Import rejected: Storage full');
  expect(await stateOf(page)).toEqual(later); expect(later.turn).toBe(initial.turn+1);
});

test('journal search reaches older pages, sandbox keeps its report and detailed windows fit a phone',async({page}) => {
  await enlist(page);
  const payload=await page.evaluate(async()=>{
    const engine=await import('./engine.js'), snapshot=await fetch('./data/warzone-snapshot.json').then(response=>response.json());
    const state=engine.createCampaign(snapshot,{faction:'caldari',seed:'browser-social',maxTurns:8});
    while(!state.result)engine.advanceTurn(state);
    for(let index=0;index<75;index++)state.log.unshift({id:`fixture-${index}`,turn:state.turn,type:'briefing',title:index===0?'A needle in old history':`Campaign entry ${index}`,text:'Retained journal entry.'});
    return engine.exportCampaign(state);
  });
  await importPayload(page,payload); const finished=await stateOf(page);
  await page.getByRole('button',{name:'Continue in sandbox',exact:true}).click();
  const sandbox=await stateOf(page); expect(sandbox.sandbox).toBe(true); expect(sandbox.result).toBeNull();
  expect(sandbox.campaignReport.title).toBe(finished.result.title); expect(sandbox.log.length).toBe(finished.log.length+1);
  await expect(page.locator('#campaign-date')).toContainText('SANDBOX');
  await open(page,'log'); await expect(page.locator('#log-entries .event-row')).toHaveCount(50);
  await page.locator('#log-search').fill('needle'); await expect(page.locator('#log-entries .event-row')).toHaveCount(1);
  await expect(page.locator('#log-entries')).toContainText('A needle in old history');
  await page.locator('#log-search').fill(''); await page.locator('[data-action="journal-next"]').click();
  await expect(page.locator('.journal-pagination')).toContainText('Page 2');
  await close(page); await page.setViewportSize({width:390,height:844});
  for(const view of ['overview','council']) {
    await open(page,view); await page.locator('.modal-body details').evaluateAll(details=>details.forEach(detail=>detail.open=true));
    expect(await page.locator('.modal-body').evaluate(node=>node.scrollWidth>node.clientWidth+1),view).toBe(false);
    await close(page);
  }
  await page.locator('#save-game').click(); await expect(page.getByRole('button',{name:'Read campaign report'})).toBeVisible();
  expect(await page.locator('.modal-body').evaluate(node=>node.scrollWidth>node.clientWidth+1)).toBe(false);
  await page.getByRole('button',{name:'Read campaign report'}).click(); await expect(page.locator('.result-heading')).toHaveText(finished.result.title);
});

test('command buttons remain reachable after resizing and navigating every command window',async({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await enlist(page);
  let watch = 0;
  for(const [width,height] of [[1280,720],[760,844],[320,667]]) {
    await page.setViewportSize({width,height});
    const reachable = () => page.evaluate(() => ['#issue-order','#end-turn'].every(selector => {
      const element = document.querySelector(selector), rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0
        && rect.right <= innerWidth && rect.bottom <= innerHeight
        && element.contains(document.elementFromPoint(rect.x + rect.width/2,rect.y + rect.height/2));
    }));
    // Dynamic viewport units update on the browser's next layout frame.
    await expect.poll(reachable).toBe(true);
    for(const view of ['overview','industry','council','doctrines','log','manual','saves']) {
      if(view === 'saves')await page.locator('#save-game').click(); else await open(page,view);
      await page.locator('.modal-body details').evaluateAll(details=>details.forEach(detail=>detail.open=true));
      expect(await page.locator('.modal-body').evaluate(node=>node.scrollWidth>node.clientWidth+1),`${width}px ${view}`).toBe(false);
      await close(page);
    }
    await expect.poll(reachable).toBe(true);
    await page.locator('#issue-order').click(); await page.locator('#end-turn').click();
    expect((await stateOf(page)).turn).toBe(++watch);
    await expect.poll(reachable).toBe(true);
  }
});
