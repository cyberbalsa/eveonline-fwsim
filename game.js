import {createCampaign, getDoctrine, getReadiness, getVisibleFleets, getOperationalState, getCombatForecast, continueSandbox, findRoute, queueOrder, getActionQuote, performAction, advanceTurn, exportCampaign, importCampaign, DOCTRINES, STANCES, ORDER_TYPES, RULES} from './engine.js';
import {createMap} from './map.js';
import {createShipViewer} from './ship-viewer.js';
import {sound, toggleAudio, isMuted} from './audio.js';
import {renderPeople, getCouncilReport, renderPolitics} from './ui-social.js';
import {getPeopleReport} from './people.js';
import {getDiplomacyQuote} from './diplomacy.js';
import {CAMPAIGN_KEY, BACKUP_KEY, readSlots, createSlot, deleteSlot, preserveCurrent} from './save-slots.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact = n => new Intl.NumberFormat('en-US', {notation:'compact',maximumFractionDigits:1}).format(n);
const money = n => `${compact(n)} ISK`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const KEY = CAMPAIGN_KEY;
const labels = {move:'Travel',offensive:'Offensive plexing',defensive:'Defensive plexing',patrol:'Combat patrol',advantage:'Build advantage',hub:'Assault I-Hub',escort:'Supply escort',rest:'Rest & recover'};
const viewNames = {overview:'Corporation',industry:'Industry & wallet',council:'Militia war council',doctrines:'Fleet fitting',log:'Operations journal',manual:'Commander’s handbook',saves:'Saved campaigns'};
let snapshot, identities, state, map, viewer, savedCampaign = null, selectedSystemId, selectedFleetId, openView = null, focusBeforeModal, lastModel = null;
let modalRenderedView = null, journalQuery = '', journalType = '', journalPage = 0;
const JOURNAL_PAGE_SIZE = 50;
const ownFleets = () => state.fleets.filter(f => f.ownerId === 'player');
const sys = id => state.systems[id];
const fleet = () => ownFleets().find(f => f.id === selectedFleetId) || ownFleets()[0];
const options = (items, selected, label = v => cap(v)) => items.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label(v))}</option>`).join('');
const hullOptions = selected => options(DOCTRINES.map(d => d.id),selected,id => getDoctrine(id).hull);
const systemOptions = selected => Object.values(state.systems).sort((a,b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)} · ${cap(s.occupier)}</option>`).join('');
const progress = (n, cls = '') => `<div class="progress"><div class="progress-fill ${cls}" style="width:${Math.max(0,Math.min(100,n))}%"></div></div>`;
const kv = (name,value) => `<div class="kv"><span>${esc(name)}</span><strong>${value}</strong></div>`;
const button = (action,label,attrs = '') => `<button class="button" data-action="${action}" ${attrs}>${label}</button>`;

function toast(message, error = false) {
  const node = document.createElement('div'); node.className = `toast${error ? ' bad' : ''}`; node.textContent = message;
  $('toast-root').append(node); $('status-message').textContent = message;
  setTimeout(() => node.remove(),error ? 9000 : 4500);
}
function save(notify = false) {
  try { const text = exportCampaign(state); localStorage.setItem(KEY,text); savedCampaign = text; if(notify) toast('Campaign saved in this browser.'); return true; }
  catch(e) { toast(`Could not save: ${e.message}. Export your campaign to keep it.`,true); return false; }
}
function backup() { preserveCurrent(localStorage,state ? exportCampaign(state) : undefined); }
function download(filename,text,type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text],{type})); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function updateAudio() { $('audio-toggle').setAttribute('aria-pressed',String(!isMuted())); $('audio-toggle').title = isMuted() ? 'Enable EVE interface audio' : 'Mute EVE interface audio'; $('audio-toggle').textContent = isMuted() ? 'AUDIO OFF' : 'AUDIO ON'; }
function selectSystem(id, focus = false) { selectedSystemId = Number(id); if(focus) map.focus(id); render(); sound(); }
function selectFleet(id) { const f = ownFleets().find(f => f.id === id); if(!f)return; selectedFleetId = f.id; selectedSystemId = f.systemId; render(); sound(); }
function start(campaign) {
  state = campaign; $('setup-screen').hidden = true; $('boot-screen').hidden = true; $('app').hidden = false;
  document.body.dataset.faction = state.faction; document.body.dataset.pane = 'map'; selectedFleetId = ownFleets()[0].id; selectedSystemId = state.player.stagingId;
  if(!map) map = createMap($('map-container'),snapshot,{onSelectSystem:id => selectSystem(id),onSelectFleet:id => selectFleet(id)});
  if(!viewer) { $('ship-preview').replaceChildren(); viewer = createShipViewer($('ship-preview')); }
  viewer.setVisible(true); render(); requestAnimationFrame(() => map.focus(selectedSystemId,700)); const persisted = save();
  if(state.result) showResult();
  return persisted;
}
function setup() {
  closeModal(); $('app').hidden = true; $('setup-screen').hidden = false; viewer?.setVisible(false);
  $('resume-campaign').hidden = !savedCampaign; $('commander-name').focus();
}
function render() {
  const p = state.player, r = getReadiness(state), f = fleet(), s = sys(selectedSystemId);
  const friendly = Object.values(state.systems).filter(s => s.occupier === state.faction).length;
  $('top-faction').textContent = state.faction === 'caldari' ? 'STATE PROTECTORATE' : 'FEDERAL DEFENSE UNION';
  const date = new Date(Date.parse(snapshot.observation.lastModified) + state.turn * RULES.turnHours * 3600000);
  $('campaign-date').textContent = `WATCH ${state.turn}${state.sandbox ? " · SANDBOX" : " / "+state.maxTurns} · ${date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})} ${date.toISOString().slice(11,16)} EVE`;
  $('resource-bar').innerHTML = [
    ['wallet',money(p.wallet),'Corporation wallet'],['contracts',`${compact(p.lp)} LP`,'Militia loyalty'],['local',`${r.availablePilots} / ${p.pilots}`,'Pilots available'],['industry',`${p.materials} kits`,'Industry stock'],['security',`${Math.round(r.score)}%`,'Readiness']
  ].map(([icon,value,label]) => `<div class="resource-stat" title="${label}"><img src="assets/icons/${icon}.png" alt=""><div><strong>${esc(value)}</strong><small>${label}</small></div></div>`).join('');
  $('fleets-list').innerHTML = ownFleets().map(f => `<button class="fleet-row ${f.id === selectedFleetId ? 'selected' : ''}" data-fleet="${esc(f.id)}" aria-pressed="${f.id === selectedFleetId}"><img src="assets/ships/${f.doctrineId}.png" alt=""><span class="fleet-copy"><strong>${esc(f.name)}</strong><small>${getDoctrine(f.doctrineId).hull} · ${esc(sys(f.systemId).name)}</small><small>${labels[f.order.type]}${f.order.targetId !== f.systemId ? ' → '+esc(sys(f.order.targetId).name) : ''}</small></span><span class="fleet-count">${f.ships}</span></button>`).join('');
  $('briefing-summary').innerHTML = `<div class="section-label">${state.sandbox ? 'ARCHIVED MANDATE' : 'MILITIA MANDATE'}</div><strong>${esc(state.objective.title)}</strong><div class="briefing-targets">${state.objective.targetIds.map(id => `<button class="campaign-target ${sys(id).occupier === state.faction ? 'target-held' : ''}" data-system="${id}">${sys(id).occupier === state.faction ? '◆' : '◇'} ${esc(sys(id).name)}</button>`).join('')}</div><p class="mission-text">${state.sandbox ? 'Sandbox command: continue your war effort without a mandate deadline. Your original campaign report is in Saved campaigns.' : `Hold both for ${state.objective.requiredHoldTurns} watches. Keep readiness ≥ ${state.objective.minimumReadiness}% and at least 6 ships.`}</p>${kv('Bridgehead held',`${state.objective.holdProgress} / ${state.objective.requiredHoldTurns} watches`)}${kv('Militia occupancy',`${friendly} / 90 systems`)}${state.turn ? `<p class="mission-text">Last watch: ${state.lastTurn.losses} hulls lost · ${money(state.lastTurn.income)} income · ${compact(state.lastTurn.lp)} LP.</p>` : '<p class="mission-text">Choose a fleet, select a target system, issue orders, then end the watch.</p>'}`;
  renderSystem(s);
  const urgent = getPeopleReport(state).requests.filter(request => ['pending','promised'].includes(request.status)).map(request => ({view:'overview',title:request.title,dueTurn:request.dueTurn,promised:request.status === 'promised'}));
  for(const organization of getCouncilReport(state).organizations) if(organization.pending) urgent.push({view:'council',title:`${organization.name}: counteroffer`,dueTurn:organization.pending.expiresTurn});
  urgent.sort((a,b) => a.dueTurn-b.dueTurn);
  if(urgent.length) $('briefing-summary').insertAdjacentHTML('afterbegin',`<div class="urgent-decisions"><div class="section-label">DECISIONS & PROMISES</div>${urgent.slice(0,3).map(decision => `<button class="briefing-decision" data-view="${decision.view}"><strong>${esc(decision.title)}</strong><span>${decision.promised ? 'Promised by watch' : 'Due watch'} ${decision.dueTurn} →</span></button>`).join('')}</div>`);
  const forecast = getCombatForecast(state,f.id,s.id);
  $('fleet-panel').innerHTML = `<div class="detail-block"><div class="section-label">SELECTED FORMATION</div><strong>${esc(f.name)}</strong>${kv('Doctrine',esc(getDoctrine(f.doctrineId).hull))}${kv('Surviving hulls',String(f.ships))}${kv('Fleet readiness',`${Math.round(f.readiness)}%`)}${progress(f.readiness)}<p class="order-summary">${labels[f.order.type]} · ${esc(sys(f.order.targetId).name)}<br>${cap(f.stance)} stance</p><p class="mission-text">${esc(f.lastAction)}</p><details class="combat-forecast"><summary>Combat forecast · ${esc(forecast.confidence)} confidence</summary><strong>${esc(forecast.assessment)}</strong><ul>${forecast.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul></details><div class="button-row">${button('fit','Fitting')}${button('return','Return to staging')}</div></div>`;
  const modelKey = `${f.doctrineId}-${state.faction}`;
  if(lastModel !== modelKey) { lastModel = modelKey; viewer.setModel(f.doctrineId,state.faction).catch(() => {}); }
  $('selected-ship-label').textContent = `${getDoctrine(f.doctrineId).hull.toUpperCase()} · ${getDoctrine(f.doctrineId).class.toUpperCase()}`;
  const route = findRoute(state,f.systemId,s.id), hops = route ? route.length - 1 : 0;
  const oldType = $('order-type')?.value, oldStance = $('order-stance')?.value;
  $('command-bar').innerHTML = `<div class="order-fields"><div class="route-copy"><strong>${esc(f.name)} → ${esc(s.name)}</strong><br>${hops ? `${hops} gate${hops === 1 ? '' : 's'} · ${Math.ceil(hops/getDoctrine(f.doctrineId).speed)} travel watches` : 'On station'} · ${f.ships} hulls</div><label>Operation<select id="order-type">${options(ORDER_TYPES,oldType || 'patrol',v => labels[v])}</select></label><label>Engagement<select id="order-stance">${options(STANCES,oldStance || f.stance)}</select></label><button class="button primary" id="issue-order" ${state.result ? 'disabled' : ''}>Issue order</button></div>`;
  $('end-turn').disabled = Boolean(state.result); $('end-turn').title = 'Resolve all fleet orders and advance six hours';
  map.render(state,{selectedSystemId,selectedFleetId,layer:$('map-layer').value,query:$('map-search').value,visibleFleets:getVisibleFleets(state)});
  document.title = `${sys(p.stagingId).name} · EVE War Council`;
}
function renderSystem(s) {
  const visible = getVisibleFleets(state).filter(f => f.systemId === s.id && f.ships > 0), percent = s.vp/s.threshold*100;
  const q = s.id !== state.player.stagingId && s.occupier === state.faction ? getActionQuote(state,{type:'setStaging',systemId:s.id}) : null;
  $('system-panel').innerHTML = `<div class="detail-block"><div class="section-label">${esc(s.region)} / ${esc(s.constellation)}</div><h2 class="system-title">${esc(s.name)}</h2><span class="badge faction-${s.occupier}">${cap(s.occupier)} occupancy</span> <span class="badge">· ${getOperationalState(state,s.id)}</span>${kv('Security status',Number(s.securityStatus).toFixed(1))}${kv('Contested',`${percent.toFixed(1)}%`)}${progress(percent,percent >= 100 ? 'warning' : '')}${s.hubPending ? `<div class="inline-notice">Hub defeated. Transfers to ${cap(s.hubPending.faction)} at watch ${s.hubPending.transferTurn}.</div>` : percent >= 100 ? `<div class="inline-notice">Infrastructure hub vulnerable · ${Math.round(s.hubDamage)} / ${RULES.hubStrength} damage.</div>` : ''}${kv('Caldari advantage',`${Math.round(s.advantage.caldari)}%`)}${kv('Gallente advantage',`${Math.round(s.advantage.gallente)}%`)}${s.id === state.player.stagingId ? '<div class="inline-notice">Corporation staging · reserve hangar & industry</div>' : q ? `<button class="button" data-action="stage" title="Reserves and unfinished production travel for ${q.turns} watches">Relocate staging · ${money(q.isk)}</button>` : ''}</div><div class="detail-block"><div class="section-label">OBSERVED FLEETS · ${visible.length}</div>${visible.length ? visible.map(f => `<div class="intel-line"><img src="assets/ships/${f.doctrineId}.png" alt=""><strong class="faction-${f.faction}">${esc(f.name)}</strong><span class="muted">${f.ships}</span></div>`).join('') : '<p class="empty-state">No reported formations. Enemy coverage depends on friendly scouts.</p>'}<div class="section-label">STARGATES</div><div class="neighbor-list">${s.neighbors.map(id => `<button class="gate-button faction-${sys(id).occupier}" data-system="${id}">${esc(sys(id).name)}</button>`).join('')}</div>${s.externalGateCount ? `<p class="caption">${s.externalGateCount} gate${s.externalGateCount === 1 ? '' : 's'} beyond the warzone</p>` : ''}</div>`;
}
function act(action,message) {
  try { performAction(state,action); save(); render(); if(openView) renderModal(); sound('complete'); toast(message || state.log[0]?.title || 'Order accepted.'); return true; }
  catch(e) { toast(e.message,true); return false; }
}
function issue(type,targetId = selectedSystemId,stance = $('order-stance')?.value) {
  if(type === 'rest') targetId = fleet().systemId;
  try { queueOrder(state,selectedFleetId,{type,targetId,stance}); save(); render(); sound(); toast(`${fleet().name}: ${labels[type]} in ${sys(targetId).name}.`); }
  catch(e) { toast(e.message,true); }
}
function endTurn() {
  try { advanceTurn(state); save(); render(); sound(state.lastTurn.losses ? 'structure' : 'notification');
    const reports = state.lastTurn.battles.length, captures = state.lastTurn.captures.length;
    toast(`Watch ${state.turn} resolved. ${reports} observed engagement${reports === 1 ? '' : 's'}; ${captures} system transfer${captures === 1 ? '' : 's'}.`);
    if(state.result) showResult();
  } catch(e) { toast(`Watch could not resolve: ${e.message}`,true); }
}
function closeModal() { $('modal-root').replaceChildren(); openView = null; modalRenderedView = null; focusBeforeModal?.focus(); }
function showView(view) { if(!state && view !== 'saves')return; if(!openView)focusBeforeModal = document.activeElement; openView = view; renderModal(); sound(); }
function renderModal() {
  const content = {overview:renderOverview,industry:renderIndustry,council:renderCouncil,doctrines:renderDoctrines,log:renderLog,manual:renderManual,result:renderResult,saves:renderSaves}[openView];
  if(!content)return;
  const sameView = modalRenderedView === openView;
  const expanded = sameView ? [...$('modal-root').querySelectorAll('details[open]')].map(detail => detail.querySelector('summary')?.textContent) : [];
  const scrollTop = sameView ? $('modal-root').querySelector('.modal-body')?.scrollTop || 0 : 0;
  const activeData = sameView && $('modal-root').contains(document.activeElement) ? {...document.activeElement.dataset} : {};
  $('modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${viewNames[openView] || 'Campaign report'}</h2><button class="close-button" data-close aria-label="Close window">×</button></header><div class="modal-body">${openView !== 'result' ? `<nav class="modal-tabs" aria-label="Command windows">${Object.entries(viewNames).filter(([key]) => state || key === 'saves').map(([key,label]) => `<button class="tab-button ${key === openView ? 'selected' : ''}" data-view="${key}">${label}</button>`).join('')}</nav>` : ''}${content()}</div><footer class="modal-footer"><span>${state ? esc(state.player.corporationName) : 'LOCAL CAMPAIGN ARCHIVE'}</span><span>${state ? `WATCH ${state.turn} · ${money(state.player.wallet)}` : 'BROWSER STORAGE'}</span></footer></section></div>`;
  if(sameView) $('modal-root').querySelectorAll('details').forEach(detail => detail.open = expanded.includes(detail.querySelector('summary')?.textContent));
  const focused = Object.keys(activeData).length ? [...$('modal-root').querySelectorAll('button:not(:disabled)')].find(node => Object.entries(activeData).every(([key,value]) => node.dataset[key] === value)) : null;
  (focused || $('modal-root').querySelector('[data-close]')).focus(); $('modal-root').querySelector('.modal-body').scrollTop = scrollTop; modalRenderedView = openView; updateQuotes();
}
function renderOverview() {
  const p = state.player,r = getReadiness(state);
  return `<p class="modal-copy">${esc(p.commanderName)}, your corporation stages in <strong>${esc(sys(p.stagingId).name)}</strong>. Keep pilots willing to log in, keep replacement hulls moving, and give independent allies a reason to commit.</p><div class="metrics-grid">${[[r.availablePilots,'Available pilots'],[r.freePilots,'Unassigned pilots'],[Math.round(p.morale)+'%','Morale'],[Math.round(p.fatigue)+'%','Fatigue']].map(([n,l]) => `<div class="metric"><span class="metric-value">${n}</span><span class="metric-label">${l}</span></div>`).join('')}</div><div class="split-grid"><section class="inner-panel"><h3>Pilot participation</h3>${kv('Roster',`${p.pilots} capsuleers`)}${kv('Assigned ships',String(r.assignedPilots))}${kv('Fielded / reserve hulls',`${r.fieldedShips} / ${r.reserveShips}`)}${kv('Institutional trust',`${Math.round(p.trust)}%`)}<p class="modal-copy">Surviving pilots return after ship losses. Fatigue reduces participation; resting restores readiness, but never replaces destroyed hulls.</p><div class="button-row">${button('rest','Stand down all fleets')}${button('festival',`Community night · ${money(RULES.festivalCost)}`,p.festivalCooldown ? 'disabled' : '')}${button('training',`Train 10 pilots · ${money(RULES.trainingCost)}`)}</div>${p.festivalCooldown ? `<p class="caption">Next community night in ${p.festivalCooldown} watches.</p>` : ''}</section><section class="inner-panel"><h3>Corporation institutions</h3>${[['industry','Faster production and stronger civilian contracts.'],['logistics','Safer freight and better fleet readiness. Level 2 speeds procurement.'],['command','More of your roster can participate in fleets.']].map(([key,desc]) => `<div class="upgrade-row"><div><strong>${cap(key)} · level ${p.upgrades[key]} / 3</strong><p>${desc}</p></div>${button('upgrade',p.upgrades[key] >= 3 ? 'Complete' : money(getActionQuote(state,{type:'upgrade',upgrade:key}).isk),`data-upgrade="${key}" ${p.upgrades[key] >= 3 ? 'disabled' : ''}`)}</div>`).join('')}</section></div>${renderPeople(state,{esc,money,kv,progress})}`;
}
function renderIndustry() {
  const p = state.player, jobs = state.jobs.filter(j => j.ownerId === 'player'), shipments = state.shipments.filter(j => j.ownerId === 'player');
  return `<p class="modal-copy">Replacements arrive at <strong>${esc(sys(p.stagingId).name)}</strong>. Hulls in the hangar need available pilots and a formation before they can fight.</p><div class="industry-grid"><section class="inner-panel"><h3>Build or procure fitted hulls</h3><form id="production-form"><div class="form-line"><label class="form-field">Doctrine<select name="doctrineId">${hullOptions('catalyst')}</select></label><label class="form-field">Hull count<input name="count" type="number" min="1" max="25" value="5" required></label></div><label class="form-field">Supply method<select name="type"><option value="manufacture">Manufacture from industry kits</option><option value="procure">Procure finished hulls</option></select></label><div class="quote" id="production-quote"></div><button class="button primary" type="submit">Place production order</button></form></section><section class="inner-panel"><h3>Wallet & material contracts</h3><form id="materials-form"><div class="form-line"><label class="form-field">Industry kits<input name="count" type="number" min="1" max="250" value="25" required></label><button class="button" type="submit">Buy kits</button></div><div class="quote" id="materials-quote"></div></form><form id="cashout-form"><div class="form-line"><label class="form-field">Militia LP<input name="amount" type="number" min="1" max="${Math.max(1,Math.min(p.lp,RULES.cashoutCap-p.cashoutUsed))}" value="${Math.min(10000,p.lp,RULES.cashoutCap-p.cashoutUsed)}" required></label><button class="button" type="submit">Settle LP</button></div><div class="quote" id="cashout-quote"></div></form><p class="caption">Broker capacity: ${compact(RULES.cashoutCap-p.cashoutUsed)} LP this watch. Civilian contracts earn ${money(RULES.baseIndustryIncome+p.upgrades.industry*RULES.industryIncomePerLevel)} each watch.</p></section><section class="inner-panel"><h3>Staging hangar</h3><table class="hangar-table"><thead><tr><th>Fitted hull</th><th>Reserve</th><th>Unit price</th></tr></thead><tbody>${DOCTRINES.map(d => `<tr><td><span class="hangar-hull"><img src="assets/ships/${d.id}.png" alt="">${d.hull}</span></td><td>${p.hangar[d.id]}</td><td>${money(d.cost)}</td></tr>`).join('')}</tbody></table><h3 style="margin-top:18px">Form a new fleet</h3><form id="form-fleet-form"><label class="form-field">Formation name<input name="name" maxlength="70" value="Reserve Wing" required></label><div class="form-line"><label class="form-field">Doctrine<select name="doctrineId">${hullOptions('rifter')}</select></label><label class="form-field">Ships<input name="count" type="number" min="3" max="25" value="5" required></label></div><button class="button" type="submit">Assign hulls & pilots</button></form></section><section class="inner-panel"><h3>Production · ${jobs.filter(j => j.type === 'manufacture').length} / ${2+p.upgrades.industry} slots</h3>${jobs.length ? jobs.map(j => `<div class="queue-item"><strong>${j.type === 'training' ? 'Pilot training' : `${j.count} × ${getDoctrine(j.doctrineId).hull}`}</strong><br><span>${j.remainingTurns} watch${j.remainingTurns === 1 ? '' : 'es'} remaining · ${j.status === 'evacuating' ? 'Evacuating to '+esc(sys(j.destinationId).name) : esc(sys(j.systemId).name)}</span></div>`).join('') : '<p class="empty-state">Production lines idle.</p>'}<h3 style="margin-top:18px">Incoming freight</h3>${shipments.length ? shipments.map(j => `<div class="queue-item"><strong>${j.hangar ? 'Staging reserves' : j.materials ? `${j.materials} industry kits` : `${j.count} × ${getDoctrine(j.doctrineId).hull}`}</strong><br><span>${j.remainingTurns} watches · ${esc(sys(j.systemId).name)} · ${esc(j.status)}</span></div>`).join('') : '<p class="empty-state">No outstanding freight contracts.</p>'}</section></div><section class="wallet-ledger"><h3>Wallet journal</h3>${p.ledger.slice(0,8).map(e => `<div class="kv"><span>W${e.turn} · ${esc(e.reason)}</span><strong class="${e.isk >= 0 ? 'good' : ''}">${e.isk >= 0 ? '+' : '−'}${money(Math.abs(e.isk))}</strong></div>`).join('')}</section>`;
}
function renderCouncil() {
  const report = getCouncilReport(state);
  return `<p class="modal-copy">Corporations command their own pilots and ships. Funding a joint operation supports an eight-watch commitment; allies still choose when to retreat and rebuild.</p>${state.allies.map(a => {
    const organization = report.organizations.find(organization => organization.id === a.id);
    const entity = identities.entities.find(e => e.entityType === 'corporation' && e.id === a.corporationId);
    const pilot = identities.pilotCandidates.find(p => p.id === entity?.currentObservation?.ceo_id && p.eligibleForDefault2026FactionRole);
    const alliance = identities.entities.find(e => e.entityType === 'alliance' && e.id === a.allianceId);
    return `<section class="diplomacy-row"><div class="entity-heading"><img class="entity-logo" src="${esc(entity?.localImage || '')}" alt="${esc(a.name)} logo"><div><h3>${esc(a.name)} <span class="muted">[${esc(a.ticker)}]</span></h3><p>${esc(a.allianceName)}${pilot ? '<br>'+esc(pilot.name)+' · corporation liaison' : ''}</p></div>${alliance?.localImage ? `<img class="alliance-mark" src="${alliance.localImage}" alt="${esc(a.allianceName)} logo">` : ''}${pilot?.localImage ? `<img class="portrait" src="${pilot.localImage}" alt="${esc(pilot.name)}">` : ''}</div><div class="stat-cluster"><span>Trust ${Math.round(a.trust)}%</span><span>${a.fleetIds.length} formations</span><span>${a.commitment ? `${labels[a.commitment.mission]} in ${esc(sys(a.commitment.targetId).name)} · ${a.commitment.remainingTurns} watches` : 'Operating independently'}</span></div><form class="council-orders" data-ally-form="${a.id}" style="margin-top:14px"><label class="form-field">Operation<select name="mission">${options(['offensive','defensive','patrol','advantage','hub'],'offensive',v => labels[v])}</select></label><label class="form-field">Target system<select name="targetId">${systemOptions(selectedSystemId)}</select></label><button class="button" type="submit" ${a.cooldown || organization?.support.allowed === false || state.result ? 'disabled' : ''}>${a.cooldown ? `Available in ${a.cooldown} watches` : 'Fund operation · '+money(RULES.allyRequestCost)}</button></form>${organization?.support.allowed === false ? `<p class="caption warning">${esc(organization.support.reason)}</p>` : ''}${renderPolitics(state,organization,{esc,money,sys,systemOptions,options,labels})}</section>`;
  }).join('')}<p class="caption">Public in-game identities and official logos. Named real pilots are corporation liaisons; priorities and personalities are authored scenario behavior. Dialogue, relationships, resources and decisions in this alternate-history campaign are simulated. No real endorsement is implied.</p>`;
}
function renderDoctrines() {
  const f = fleet();
  return `<section class="inner-panel" style="margin-bottom:16px"><h3>Refit ${esc(f.name)}</h3><p class="modal-copy">At ${esc(sys(f.systemId).name)} · ${f.ships} ${getDoctrine(f.doctrineId).hull} hulls. Refits and reinforcements require friendly staging at ${esc(sys(state.player.stagingId).name)}. Surviving hulls return to the reserve hangar.</p><form id="refit-form"><div class="form-line"><label class="form-field">Doctrine<select name="doctrineId">${hullOptions(f.doctrineId)}</select></label><label class="form-field">Total hulls<input name="count" type="number" min="1" max="25" value="${Math.max(3,f.ships)}" required></label><button class="button primary" type="submit">Refit formation</button></div></form><form id="reinforce-form" style="margin-top:12px"><div class="form-line"><label class="form-field">Additional ${getDoctrine(f.doctrineId).hull} hulls<input name="count" type="number" min="1" max="25" value="3" required></label><button class="button" type="submit">Reinforce</button></div></form></section>${DOCTRINES.map(d => `<section class="doctrine-card"><img src="assets/ships/${d.id}.png" alt="EVE ${d.hull}"><div><h3>${d.name} <span class="muted">· ${state.player.hangar[d.id]} in reserve</span></h3><p>${d.description}</p><div class="doctrine-facts"><span>${money(d.cost)} / hull</span><span>${d.speed} gates / watch</span><span>${d.materials} kits to build</span><span>${d.buildTurns} base build watches</span></div></div></section>`).join('')}<p class="caption">Hull geometry and names are from EVE. Formation strength, prices and production recipes are strategic game rules.</p>`;
}
function renderLog() {
  const types = [...new Set(state.log.map(entry => entry.type))].sort();
  return `<div class="log-filters"><input class="input" id="log-search" type="search" value="${esc(journalQuery)}" placeholder="Search all retained operations" aria-label="Search journal"><select id="log-type" aria-label="Journal category"><option value="">All categories</option>${options(types,journalType)}</select><button class="button" data-action="export-log">Export journal</button></div><div id="log-results">${renderJournalResults()}</div>`;
}
function renderJournalResults() {
  const query = journalQuery.trim().toLowerCase();
  const matches = state.log.filter(entry => (!journalType || entry.type === journalType) && `${entry.title} ${entry.text} ${entry.turn}`.toLowerCase().includes(query));
  const pages = Math.max(1,Math.ceil(matches.length / JOURNAL_PAGE_SIZE)); journalPage = Math.max(0,Math.min(journalPage,pages-1));
  const start = journalPage * JOURNAL_PAGE_SIZE, entries = matches.slice(start,start+JOURNAL_PAGE_SIZE);
  return `<div class="journal-pagination"><p class="caption" role="status">${matches.length ? `${start+1}–${start+entries.length}` : '0'} of ${matches.length} matching entries · ${state.log.length} retained</p><div class="button-row"><button class="button" data-action="journal-prev" ${journalPage === 0 ? 'disabled' : ''}>Newer</button><span class="caption">Page ${journalPage+1} / ${pages}</span><button class="button" data-action="journal-next" ${journalPage+1 >= pages ? 'disabled' : ''}>Older</button></div></div><div id="log-entries">${entries.length ? entries.map(entry => `<article class="event-row"><small>WATCH ${entry.turn} · ${esc(entry.type)}</small><strong>${esc(entry.title)}</strong><p>${esc(entry.text)}</p></article>`).join('') : '<p class="empty-state">No journal entries match this search.</p>'}</div>`;
}
function renderSaves() {
  try {
    const slots = readSlots(), current = localStorage.getItem(KEY), previous = localStorage.getItem(BACKUP_KEY);
    return `${state?.campaignReport ? `<section class="inner-panel"><h3>Preserved campaign report</h3><p class="modal-copy">${esc(state.campaignReport.title)} · watch ${state.campaignReport.turn} · score ${state.campaignReport.score}</p>${button('report','Read campaign report')}</section>` : ''}<p class="modal-copy">Keep up to 12 named campaigns in this browser. Loading a campaign first preserves the active autosave as a recovery copy. Export files for copies outside this browser.</p>${state ? `<form id="save-slot-form" class="inner-panel save-slot-form"><label class="form-field">Save name<input name="name" maxlength="60" placeholder="${esc(state.player.corporationName)} · watch ${state.turn}" required></label><button class="button primary" type="submit">Create named save</button></form>` : ''}<section aria-label="Recovery copies"><h3 class="archive-heading">Automatic copies</h3>${[[current,'autosave','Current autosave'],[previous,'backup','Before last replacement']].filter(([raw]) => raw).map(([raw,id,label]) => `<article class="save-row"><div><h3>${label}</h3><p class="caption">${saveDescription(raw)}</p></div><div class="button-row"><button class="button" data-save-load="${id}">Load ${id === 'backup' ? 'recovery copy' : 'autosave'}</button><button class="button" data-save-export="${id}" aria-label="Export ${label.toLowerCase()}">Export</button></div></article>`).join('') || '<p class="empty-state">No campaign has been saved in this browser yet.</p>'}</section><section aria-label="Named campaigns"><h3 class="archive-heading">Named campaigns · ${slots.length} / 12</h3>${slots.map(slot => `<article class="save-row" data-save-slot="${esc(slot.id)}"><div><h3>${esc(slot.name)}</h3><p class="caption">${esc(slot.corporation)} · ${esc(slot.faction || '')} · Watch ${slot.turn}</p></div><div class="button-row"><button class="button" data-save-load="${esc(slot.id)}" aria-label="Load ${esc(slot.name)}">Load</button><button class="button" data-save-export="${esc(slot.id)}" aria-label="Export ${esc(slot.name)}">Export</button><button class="button" data-save-delete="${esc(slot.id)}" aria-label="Delete ${esc(slot.name)}">Delete</button></div></article>`).join('') || '<p class="empty-state">Named saves keep earlier plans available while your autosave advances.</p>'}</section>`;
  } catch(error) { return `<p class="inline-notice">Could not read saved campaigns: ${esc(error.message)}</p>${state ? button('export','Export active campaign') : ''}`; }
}
function saveDescription(raw) {
  try { const stored = JSON.parse(raw).state; return `${esc(stored.player.corporationName)} · watch ${stored.turn}${stored.sandbox ? ' · sandbox' : ''}`; }
  catch { return 'Unreadable campaign · export to preserve the file'; }
}
function savedPayload(id) {
  const raw = id === 'autosave' ? localStorage.getItem(KEY) : id === 'backup' ? localStorage.getItem(BACKUP_KEY) : readSlots().find(slot => slot.id === id)?.campaign;
  if(!raw)throw new Error('This saved campaign is no longer available.');
  return raw;
}
function renderManual() {
  return `<div class="manual-copy"><p>Command a corporation inside ${state.faction === 'caldari' ? 'the State Protectorate' : 'the Federal Defense Union'}. Secure your two bridgehead objectives while keeping a fighting force and a willing roster. Orders resolve together when you end a six-hour watch.</p><h3>Your first operation</h3><ol><li>Select a formation in the fleet overview. Its real ship model appears in the fitting preview; drag to orbit it.</li><li>Select an enemy target on the map. Gold diamonds mark your mandate systems. Use the search field or the objective buttons to find them.</li><li>Choose <strong>Offensive plexing</strong>, an engagement stance, and <strong>Issue order</strong>. Your fleet follows the real gate route. Operations on the arrival watch use reduced effort.</li><li>End watches to complete sites and raise contested status. At 100%, explicitly order <strong>Assault I-Hub</strong>. Ownership changes only after hub destruction and the next downtime boundary.</li><li>Rest tired fleets, order replacements early, and hold both targets for four watches with readiness ≥35% and at least six surviving ships.</li></ol><h3>Combat and orders</h3><p>Travel moves toward a selected system. Offensive and defensive plexing change contested status and earn LP. Advantage operations improve local military pressure. Patrols look for engagements; escorts protect friendly supply. Small hulls reach restricted sites that heavier fleets cannot enter. Hulls lost in combat must be replaced.</p><p><strong>Evade</strong> favors survival, <strong>Skirmish</strong> withdraws sooner, <strong>Hold</strong> accepts more pressure, and <strong>Commit</strong> risks heavier losses. Rest recovers readiness in place; it does not make enemy space safe. Fleets travel one gate per watch, or two for frigates and destroyers. A formation with no hulls can return its pilots to staging and refit.</p><h3>Industry, morale and allies</h3><p>Manufacture with ISK and industry kits, or pay more for procured hulls. Deliveries take watches and exposed freight can be delayed or lost. Assign reserve hulls with Fleet Fitting or form another fleet in Industry. Your wallet receives finite civilian contract income each watch; LP settles through a limited broker.</p><p>Fatigue and morale determine how many pilots show up. Stand down formations, fund community nights, train pilots, and improve corporation institutions. Repeating an operation burns people out. Allies hold separate wallets, hulls and pilots. A funded commitment steers their objectives but leaves their tactical decisions independent.</p><p>The Corporation window tracks six pilot cohorts, their preferences, protected rest, recognition, and requests. Policy changes affect access, attendance and replacement assistance. Fictional officers can train deputies to share organizing work. Promises have deadlines: ignoring a request and breaking an accepted promise carry different consequences.</p><p>The Council displays authored organizational priorities, counteroffers, favors and rivalries. Negotiate one-response defense compacts, workshop access or capped replacement assistance. Read each agreement’s conditions before committing funds. Continued grievances can cause coalition withdrawal; reconciliation can rebuild a working relationship.</p><p>If staging falls, relocate to a friendly system. Reserve hulls, materials, ongoing production and incoming freight need time to evacuate. A prolonged occupation can trigger emergency evacuation. The original assets are not instantly available at the new base.</p><h3>Intelligence and the map</h3><p>Blue stars are Caldari; green stars are Gallente. Broken circles mark frontlines, gold diamonds mark objectives, and gold routes show your selected fleet’s orders. Enemy fleets appear only within friendly scouting coverage. Occupancy and contested status are public; opposing orders and private budgets are hidden. Drag the map to pan, scroll or pinch to zoom, and use Fit Warzone to restore the full theater.</p><h3>Saves and campaign length</h3><p>Campaigns autosave after orders, purchases and watches. SAVE opens a manager with 12 named slots, file exports, and the recovery copy kept before each replacement. Load saved campaigns from the enlistment screen or any command window. Imports are validated before they replace the current campaign. Search the journal across all retained entries; pages show 50 at a time. A completed mandate or campaign can continue in sandbox with its report and history preserved.</p><h3>What this simulation represents</h3><p>${esc(RULES.modelNotice)}</p><p>The 90 systems and 110 internal gates retain CCP geography and the opening ESI occupancy observed 22 September 2026. External gates are shown as counts; procurement stands in for outside-warzone trade. Frontline classification is inferred from the included gate graph. Site selection, income, participation, industry and combat are strategic abstractions. Live players’ private diplomacy, motives, stocks and availability cannot be reproduced one-to-one.</p><p>Freeciv inspired the separation of rules, map, turns and player-facing observations. This is an original browser simulation; no Freeciv engine code is bundled.</p><p><a href="PRD.md" target="_blank" rel="noopener">Game design PRD</a> · <a href="research/README.md" target="_blank" rel="noopener">Research & source index</a> · <a href="ASSETS.md" target="_blank" rel="noopener">Art, models & provenance</a> · <a href="CREDITS.md" target="_blank" rel="noopener">Credits</a></p><p>EVE Online and its artwork belong to CCP hf. This is an independent, non-commercial fan prototype.</p></div>`;
}
function renderResult() {
  const report = state.result || state.campaignReport;
  return `<div class="section-label">${state.campaignReport ? 'ARCHIVED ' : ''}${esc(report.type.toUpperCase())}</div><h3 class="result-heading">${esc(report.title)}</h3><p class="modal-copy">${esc(report.text)}</p><div class="metrics-grid"><div class="metric"><span class="metric-value">${Math.round(report.score)}</span><span class="metric-label">Campaign score</span></div><div class="metric"><span class="metric-value">${report.turn ?? state.turn}</span><span class="metric-label">Watches elapsed</span></div></div><div class="button-row">${state.result ? button('sandbox','Continue in sandbox') : ''}${button('export','Export campaign')}${button('new','New campaign')}${button('journal','Read operations journal')}</div>`;
}
function showResult() { openView = 'result'; focusBeforeModal = $('end-turn'); renderModal(); }
function updateQuotes() {
  if(!state)return;
  const form = $('production-form');
  if(form) { const q = getActionQuote(state,{type:form.elements.type.value,doctrineId:form.elements.doctrineId.value,count:Number(form.elements.count.value)||0}); $('production-quote').textContent = `${money(q.isk)}${q.materials ? ` + ${q.materials} industry kits` : ''} · ${q.turns} watches to staging`; }
  if($('materials-form')) $('materials-quote').textContent = `${money(Number($('materials-form').elements.count.value)*RULES.materialCost)} · arrives in one watch`;
  if($('cashout-form')) $('cashout-quote').textContent = `${money(Number($('cashout-form').elements.amount.value)*RULES.cashoutRate)} net broker settlement`;
  for(const joint of document.querySelectorAll('[data-ally-form]')) {
    const pending = getCouncilReport(state).organizations.find(organization => organization.id === joint.dataset.allyForm)?.pending;
    const q = getDiplomacyQuote(state,{type:'diplomacyPropose',allyId:joint.dataset.allyForm,agreement:'joint',targetId:Number(joint.elements.targetId.value),mission:joint.elements.mission.value});
    const submit = joint.querySelector('button[type="submit"]');
    submit.textContent = `Fund operation · ${money(q.requiredISK)}`;
    submit.disabled = !q.allowed || Boolean(pending) || Boolean(state.result); submit.title = pending ? 'Accept or decline the current counteroffer first.' : q.reason;
    let feedback = joint.querySelector('.joint-quote');
    if(!feedback) { feedback = document.createElement('p'); feedback.className = 'caption joint-quote'; joint.append(feedback); }
    feedback.textContent = pending ? 'Accept or decline the current counteroffer before funding another operation.' : q.allowed ? `${q.turns} watches of independent allied support.${q.requiredISK > RULES.allyRequestCost ? ' '+q.reason : ''}` : q.reason;
  }
  for(const negotiation of document.querySelectorAll('[data-negotiation-form]')) {
    const organization = getCouncilReport(state).organizations.find(item => item.id === negotiation.dataset.negotiationForm);
    const agreement = organization.agreementOptions.find(item => item.id === negotiation.elements.agreement.value);
    const q = getDiplomacyQuote(state,{type:'diplomacyPropose',allyId:organization.id,agreement:agreement.id,targetId:Number(negotiation.elements.targetId.value),mission:negotiation.elements.mission.value});
    negotiation.querySelector('.agreement-description').textContent = `${agreement.description} ${q.allowed ? `Current terms: ${money(q.requiredISK)}.` : q.reason}`;
    negotiation.elements.mission.disabled = agreement.id !== 'joint';
    negotiation.elements.targetId.disabled = agreement.id === 'access';
    negotiation.querySelector('button[type="submit"]').disabled = !q.allowed || Boolean(organization.pending) || Boolean(state.result);
  }
}

function wire() {
  $('setup-form').addEventListener('submit',e => { e.preventDefault(); try { const form = new FormData(e.currentTarget); backup(); start(createCampaign(snapshot,{faction:form.get('faction') || 'caldari',commanderName:$('commander-name').value.trim() || 'Commander',corporationName:$('corporation-name').value.trim() || 'Independent Operations',maxTurns:Number($('campaign-length').value),seed:crypto.randomUUID()})); sound('notification'); } catch(err) { toast(err.message,true); } });
  $('resume-campaign').addEventListener('click',() => { try { start(importCampaign(savedCampaign,snapshot)); } catch(e) { toast(e.message,true); } });
  $('end-turn').addEventListener('click',endTurn);
  $('map-fit').addEventListener('click',() => map.fit()); $('map-zoom-in').addEventListener('click',() => map.zoom(.75)); $('map-zoom-out').addEventListener('click',() => map.zoom(1.33));
  $('map-layer').addEventListener('change',render); $('map-search').addEventListener('input',() => { const q = $('map-search').value.trim().toLowerCase(); const match = Object.values(state.systems).find(s => s.name.toLowerCase() === q); if(match) { selectedSystemId = match.id; map.focus(match.id); } render(); });
  $('save-game').addEventListener('click',() => { save(true); showView('saves'); }); $('export-game').addEventListener('click',() => download(`eve-war-council-watch-${state.turn}.json`,exportCampaign(state)));
  $('import-game').addEventListener('click',() => $('import-file').click()); $('new-game').addEventListener('click',setup);
  $('audio-toggle').addEventListener('click',() => { toggleAudio(); updateAudio(); sound(); });
  $('import-file').addEventListener('change',async e => { const file = e.target.files[0]; if(!file)return; try { if(file.size > 8_000_000)throw new Error('Campaign file is too large'); const next = importCampaign(await file.text(),snapshot); backup(); closeModal(); const persisted = start(next); toast(persisted ? 'Campaign imported and saved.' : 'Campaign imported, but browser saving failed. Export it to keep your progress.',!persisted); } catch(err) { toast(`Import rejected: ${err.message}`,true); } finally { e.target.value = ''; } });
  document.addEventListener('click',e => {
    const target = e.target.closest('button'); if(!target)return;
    if(target.dataset.view) { showView(target.dataset.view); return; }
    if(target.hasAttribute('data-close')) { closeModal(); return; }
    if(target.dataset.saveLoad || target.dataset.saveExport || target.dataset.saveDelete) {
      try {
        if(target.dataset.saveDelete) { deleteSlot(target.dataset.saveDelete); renderModal(); toast('Named save deleted. The active autosave is unchanged.'); }
        else if(target.dataset.saveExport) download(`eve-war-council-${target.dataset.saveExport}.json`,savedPayload(target.dataset.saveExport));
        else { const next = importCampaign(savedPayload(target.dataset.saveLoad),snapshot); backup(); closeModal(); const persisted = start(next); toast(persisted ? 'Saved campaign loaded. The previous autosave is available in Saved campaigns.' : 'Campaign loaded, but browser saving failed. Export it to keep your progress.',!persisted); }
      } catch(error) { toast(`Saved campaign action failed: ${error.message}`,true); }
      return;
    }
    if(target.dataset.mobilePanel) { document.body.dataset.pane = target.dataset.mobilePanel; document.querySelectorAll('[data-mobile-panel]').forEach(b => b.setAttribute('aria-pressed',String(b === target))); return; }
    if(!state)return;
    if(target.dataset.fleet) { selectFleet(target.dataset.fleet); return; }
    if(target.dataset.system) { selectSystem(target.dataset.system,true); return; }
    if(target.id === 'issue-order') { issue($('order-type').value); return; }
    const action = target.dataset.action;
    if(['rest','festival','training'].includes(action)) act({type:action});
    else if(action === 'upgrade') act({type:action,upgrade:target.dataset.upgrade});
    else if(action === 'stage') act({type:'setStaging',systemId:selectedSystemId});
    else if(action === 'return') issue('move',state.player.stagingId,'evade');
    else if(action === 'fit') showView('doctrines');
    else if(action === 'new') setup();
    else if(action === 'export') download(`eve-war-council-watch-${state.turn}.json`,exportCampaign(state));
    else if(action === 'journal') showView('log');
    else if(action === 'report') showView('result');
    else if(action === 'sandbox') { try { backup(); continueSandbox(state); save(); closeModal(); render(); toast('Sandbox continued. Your campaign report and history are preserved.'); } catch(error) { toast(error.message,true); } }
    else if(action === 'journal-prev' || action === 'journal-next') { journalPage += action === 'journal-prev' ? -1 : 1; $('log-results').innerHTML = renderJournalResults(); ($('log-results').querySelector(`[data-action="${action}"]:not(:disabled)`) || $('log-results').querySelector('button:not(:disabled)'))?.focus(); }
    else if(action === 'peopleRespond') act({type:action,requestId:target.dataset.requestId,choiceId:target.dataset.choiceId});
    else if(action === 'peopleRest' || action === 'peopleRecognize') act({type:action,cohortId:target.dataset.cohortId});
    else if(action === 'peopleTrainOfficer') act({type:action,officerId:target.dataset.officerId});
    else if(action?.startsWith('diplomacy')) act({type:action,allyId:target.dataset.allyId,...(target.dataset.agreementId ? {agreementId:target.dataset.agreementId} : {})});
    else if(action === 'export-log') download('eve-operations-journal.txt',state.log.map(e => `WATCH ${e.turn} · ${e.title}\n${e.text}`).join('\n\n'),'text/plain');
  });
  $('modal-root').addEventListener('click',e => { if(e.target.classList.contains('modal-backdrop')) closeModal(); });
  $('modal-root').addEventListener('input',e => { updateQuotes(); if(e.target.id === 'log-search') { journalQuery = e.target.value; journalPage = 0; $('log-results').innerHTML = renderJournalResults(); } });
  $('modal-root').addEventListener('change',e => { updateQuotes(); if(e.target.id === 'log-type') { journalType = e.target.value; journalPage = 0; $('log-results').innerHTML = renderJournalResults(); } });
  $('modal-root').addEventListener('submit',e => {
    e.preventDefault(); const f = e.target, fd = new FormData(f), n = name => Number(fd.get(name));
    if(f.id === 'production-form') act({type:fd.get('type'),doctrineId:fd.get('doctrineId'),count:n('count')});
    else if(f.id === 'materials-form') act({type:'buyMaterials',count:n('count')});
    else if(f.id === 'cashout-form') act({type:'cashout',amount:n('amount')});
    else if(f.id === 'form-fleet-form') act({type:'formFleet',doctrineId:fd.get('doctrineId'),count:n('count'),name:fd.get('name')});
    else if(f.id === 'refit-form') act({type:'reship',fleetId:selectedFleetId,doctrineId:fd.get('doctrineId'),count:n('count')});
    else if(f.id === 'reinforce-form') act({type:'reinforce',fleetId:selectedFleetId,count:n('count')});
    else if(f.dataset.allyForm) act({type:'allyRequest',allyId:f.dataset.allyForm,mission:fd.get('mission'),targetId:n('targetId')});
    else if(f.dataset.policyForm) act({type:'peoplePolicy',policy:f.dataset.policyForm,value:fd.get('value')});
    else if(f.dataset.negotiationForm) { const action = {type:'diplomacyPropose',allyId:f.dataset.negotiationForm,agreement:fd.get('agreement'),mission:f.elements.mission.value,targetId:Number(f.elements.targetId.value)}; if(fd.get('offerISK') !== '')action.offerISK = n('offerISK'); act(action); }
    else if(f.id === 'save-slot-form') { try { createSlot(fd.get('name'),exportCampaign(state),state); renderModal(); toast('Named campaign saved.'); } catch(error) { toast(`Could not create named save: ${error.message}`,true); } }
  });
  document.addEventListener('keydown',e => {
    if(openView && e.key === 'Escape') { closeModal(); return; }
    if(openView && e.key === 'Tab') {
      const nodes = [...$('modal-root').querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),summary,a[href]')].filter(n => !n.hidden && n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  window.addEventListener('beforeunload',() => { if(state)save(); });
  updateAudio();
}
async function boot() {
  try {
    [snapshot,identities] = await Promise.all(['data/warzone-snapshot.json','research/identity-catalog.json'].map(async path => { const r = await fetch(new URL(path,import.meta.url)); if(!r.ok)throw new Error(`Could not load ${path}`); return r.json(); }));
    try { savedCampaign = localStorage.getItem(KEY); if(savedCampaign)importCampaign(savedCampaign,snapshot); } catch(e) { savedCampaign = null; toast(`Saved campaign could not be opened: ${e.message}`,true); }
    wire(); $('boot-screen').hidden = true; setup();
  } catch(e) { $('boot-screen').innerHTML = `<div class="inner-panel"><h1>Unable to establish command link</h1><p>${esc(e.message)}</p><p>Serve this folder with a local web server and reload.</p><button class="button" onclick="location.reload()">Retry</button></div>`; }
}
boot();
