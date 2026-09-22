import { DOCTRINES, RULES } from './rules.js';

// Every priority and relationship below is authored scenario behavior, not a claim
// about the real organization whose sourced name and logo appear in the game.
export const DIPLOMACY_NOTICE = 'Organizational priorities, rivalries and decisions are authored scenario behavior. They do not describe the real players or record actual political events.';
const PRIORITIES = Object.freeze({
  home: { id: 'home', label: 'Home defense', description: 'Values threatened friendly systems and nearby deployments.' },
  offensive: { id: 'offensive', label: 'Frontline initiative', description: 'Favors offensive pressure and vulnerable infrastructure hubs.' },
  skirmish: { id: 'skirmish', label: 'Sustainable skirmishes', description: 'Favors inexpensive nearby operations and preserving room to recover.' },
  logistics: { id: 'logistics', label: 'Shared resilience', description: 'Values defensive operations, replacement support and reliable services.' }
});
const AUTHORED_PRIORITIES = Object.freeze({
  'corporation-98639548': 'home', 'corporation-98688951': 'offensive',
  'corporation-1894214152': 'logistics', 'corporation-1126669495': 'skirmish',
  'corporation-98714140': 'home'
});
export const DIPLOMACY_AGREEMENTS = Object.freeze([
  { id: 'joint', label: 'Joint operation', isk: 35_000_000, turns: 8, description: 'Fund up to eight watches of independent support at the selected objective. Ships, pilots and tactical withdrawal stay under allied control.' },
  { id: 'defense', label: 'Defensive compact', isk: 25_000_000, turns: 12, description: 'One response when the selected friendly system reaches 25% capture pressure during twelve watches. The ally offers up to eight watches of defense, subject to its actual forces and other commitments.' },
  { id: 'access', label: 'Workshop access', isk: 15_000_000, turns: 8, description: 'For eight watches, your resting fleets at this ally’s staging recover eight extra readiness points each watch. Includes workshops only; no stock or hull transfers. Access ends if the base moves or becomes hostile.' },
  { id: 'srp', label: 'Replacement assistance', isk: 40_000_000, turns: 8, description: 'Prepay a capped escrow covering 50% of this ally’s destroyed hull scenario cost for eight watches. Actual losses settle each watch; unused escrow returns to your wallet. No promise exceeds the funded ceiling.' }
]);
const ACTIONS = new Set(['diplomacyPropose', 'diplomacyAccept', 'diplomacyDecline', 'diplomacyAid', 'diplomacyCallFavor', 'diplomacyReconcile', 'diplomacyMediate', 'diplomacyRenounce']);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const copy = value => JSON.parse(JSON.stringify(value));
const actor = (state, id) => state.actors.find(a => a.id === id);
const system = (state, id) => state.systems[String(id)];
const fleets = (state, id) => state.fleets.filter(f => f.ownerId === id);
const relation = (state, id) => state.diplomacy?.organizations[id];
const descriptor = type => DIPLOMACY_AGREEMENTS.find(a => a.id === type);
const million = amount => `${(amount / 1e6).toFixed(1)}M ISK`;
function remember(state, r, event, text) {
  r.memories.unshift({ turn: state.turn, event, text }); r.memories.length = Math.min(r.memories.length, 16);
  r.lastResponse = text;
}
function announce(state, context, title, text) { context.log(state, 'council', title, text); }
function distance(state, origin, destination) {
  if (!system(state, origin) || !system(state, destination)) return Infinity;
  const visited = new Set([origin]), queue = [[origin, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [id, hops] = queue[i]; if (id === destination) return hops;
    for (const neighbor of system(state, id).neighbors) if (!visited.has(neighbor)) { visited.add(neighbor); queue.push([neighbor, hops + 1]); }
  }
  return Infinity;
}
function rivalriesFor(state, id) { return state.diplomacy.rivalries.filter(r => r.actorIds.includes(id)); }

export function initializeDiplomacy(state) {
  // Only absent legacy data is initialized. Existing malformed data is rejected
  // by validation instead of silently repairing a corrupt imported campaign.
  if (state.diplomacy !== undefined) return state.diplomacy;
  const organizations = {};
  for (const a of [...state.actors].sort((a, b) => a.id.localeCompare(b.id))) {
    organizations[a.id] = { priorityId: AUTHORED_PRIORITIES[a.id], status: a.faction === state.faction ? 'member' : 'opponent', grievance: 0, favors: 0, stressWatches: 0, withdrawnTurn: null, cooldowns: { aid: 0, favor: 0, reconcile: 0, mediate: 0 }, pending: null, agreements: [], memories: [], lastResponse: 'No agreements negotiated yet.' };
  }
  const rivalries = [];
  for (const faction of ['caldari', 'gallente']) {
    const ids = state.actors.filter(a => a.faction === faction).map(a => a.id).sort();
    for (let i = 0; i + 1 < ids.length; i++) rivalries.push({ actorIds: [ids[i], ids[i + 1]], tension: 15 });
  }
  state.diplomacy = { version: 1, lastSettledTurn: state.turn, nextAgreementId: 1, organizations, rivalries };
  return state.diplomacy;
}

export function canRequestSupport(state, allyId) {
  const a = actor(state, allyId), r = relation(state, allyId);
  if (!a || a.faction !== state.faction) return { allowed: false, reason: 'Choose an allied corporation.' };
  if (r?.status === 'withdrawn') return { allowed: false, reason: 'This corporation withdrew from the coalition. Reconcile before requesting support.' };
  if (a.cooldown > 0 || a.commitment) return { allowed: false, reason: 'This ally is still committed to its previous operation.' };
  if (a.trust < 35 || (r?.grievance ?? 0) >= 65) return { allowed: false, reason: 'Resolve the loss of confidence before asking for another operation.' };
  if (!fleets(state, allyId).some(f => f.ships >= 3)) return { allowed: false, reason: 'This ally has no deployable formation and must rebuild.' };
  if (a.fatigue > 85 || !fleets(state, allyId).some(f => f.ships >= 3 && f.readiness >= 25)) return { allowed: false, reason: 'The allied pilots need recovery before accepting another deployment.' };
  return { allowed: true, reason: 'Independent forces are available to consider a bounded operation.' };
}

function agreementQuote(state, action) {
  const a = actor(state, action.allyId), r = relation(state, action.allyId), terms = descriptor(action.agreement);
  if (!a || a.faction !== state.faction || !r || !terms) return { isk: 0, requiredISK: 0, turns: 0, allowed: false, reason: 'Choose an allied corporation and a valid agreement.' };
  const targetId = action.agreement === 'access' ? a.stagingId : Number(action.targetId ?? a.stagingId);
  const target = system(state, targetId), mission = action.mission || 'offensive';
  let reason = 'The proposed terms meet the organization’s current capacity and priorities.';
  let allowed = true;
  if (r.status !== 'member') { allowed = false; reason = 'This corporation withdrew from the coalition. Reconciliation must come first.'; }
  else if (r.agreements.some(item => item.type === action.agreement)) { allowed = false; reason = 'An agreement of this kind is already active with this ally.'; }
  else if (!target) { allowed = false; reason = 'Choose a system in this warzone.'; }
  else if (action.agreement === 'joint') {
    const support = canRequestSupport(state, a.id); allowed = support.allowed; reason = support.reason;
    if (!['offensive', 'defensive', 'patrol', 'advantage', 'hub'].includes(mission)) { allowed = false; reason = 'Choose a military support mission.'; }
    else if (['offensive', 'hub'].includes(mission) && target.occupier === a.faction) { allowed = false; reason = 'Offensive operations require enemy occupancy.'; }
    else if (mission === 'defensive' && (target.occupier !== a.faction || target.vp <= 0)) { allowed = false; reason = 'Defensive sites require friendly space with capture pressure.'; }
    else if (mission === 'hub' && (target.vp < target.threshold || target.hubPending)) { allowed = false; reason = 'The infrastructure hub must be vulnerable and not already defeated.'; }
    else if (distance(state, a.stagingId, target.id) > 12) { allowed = false; reason = 'The deployment is too distant for an eight-watch commitment. Choose a closer objective.'; }
  } else if (action.agreement === 'defense') {
    if (target.occupier !== a.faction) { allowed = false; reason = 'A defensive compact must name a friendly system.'; }
    else if (a.trust < 40 || r.grievance >= 55) { allowed = false; reason = 'A defensive compact requires 40 trust and fewer unresolved disputes.'; }
    else if (!fleets(state, a.id).some(f => f.ships >= 3) || distance(state, a.stagingId, target.id) > 9) { allowed = false; reason = 'The ally lacks a force within the compact’s practical response range.'; }
  } else if (action.agreement === 'access' && (target.occupier !== a.faction || a.trust < 35)) { allowed = false; reason = 'Workshop access needs friendly allied staging and at least 35 trust.'; }
  const strain = action.agreement === 'srp' ? 0 : (r.grievance >= 30 ? 10_000_000 : 0) + (a.fatigue >= 60 ? 10_000_000 : 0);
  const travelPremium = action.agreement === 'joint' && target && distance(state, a.stagingId, target.id) > 5 ? 10_000_000 : 0;
  const rivalryPremium = action.agreement === 'joint' && rivalriesFor(state, a.id).some(pair => pair.tension >= 60) ? 10_000_000 : 0;
  const requiredISK = terms.isk + strain + travelPremium + rivalryPremium;
  if (allowed && (strain || travelPremium || rivalryPremium)) reason = `The ${million(requiredISK)} minimum includes ${[strain ? 'recovery or dispute costs' : '', travelPremium ? 'extended deployment logistics' : '', rivalryPremium ? 'contested coalition scheduling' : ''].filter(Boolean).join(', ')}.`;
  const isk = action.offerISK === undefined ? requiredISK : action.offerISK;
  return { isk, requiredISK, turns: terms.turns, allowed, reason, targetId, mission };
}

export function getDiplomacyQuote(state, action) {
  if (!ACTIONS.has(action?.type)) return null;
  if (action.type === 'diplomacyPropose') return agreementQuote(state, action);
  if (action.type === 'diplomacyAccept') {
    const pending = relation(state, action.allyId)?.pending;
    return pending ? agreementQuote(state, { ...pending, allyId: action.allyId, offerISK: pending.requiredISK }) : { isk: 0, turns: 0, allowed: false, reason: 'There is no counteroffer to accept.' };
  }
  const isk = ({ diplomacyAid: 20_000_000, diplomacyCallFavor: -20_000_000, diplomacyReconcile: 10_000_000, diplomacyMediate: 10_000_000 })[action.type] || 0;
  return { isk, turns: 0 };
}

export function recordJointOperation(state, allyId, event) {
  const r = relation(state, allyId), a = actor(state, allyId);
  if (!r || !a || a.faction !== state.faction) return;
  if (event === 'agreed') {
    if (r.pending?.agreement === 'joint') r.pending = null;
    remember(state, r, event, 'A funded joint operation was agreed. The ally keeps control of its tactical decisions.');
    for (const pair of rivalriesFor(state, allyId)) {
      pair.tension = clamp(pair.tension + 12);
      const competitorId = pair.actorIds.find(id => id !== allyId), competitor = relation(state, competitorId);
      if (competitor.status === 'member') {
        competitor.grievance = clamp(competitor.grievance + 7);
        remember(state, competitor, 'rivalry', `Scenario scheduling dispute: another coalition organization received deployment funding. Rivalry tension is ${Math.round(pair.tension)}.`);
      }
    }
  } else if (event === 'fulfilled') {
    r.grievance = clamp(r.grievance - 8); r.favors = Math.min(3, r.favors + 1);
    remember(state, r, event, 'The agreed force provided effective support. One reciprocal favor is available, up to a maximum of three.');
  } else if (event === 'failed') {
    r.grievance = clamp(r.grievance + 12);
    remember(state, r, event, 'The support window ended without effective action. Travel, losses or recovery prevented the promised contribution.');
  }
}

function acceptAgreement(state, a, r, proposal, context) {
  const quote = agreementQuote(state, { ...proposal, allyId: a.id });
  assert(quote.allowed, quote.reason);
  assert(Number.isInteger(quote.isk) && quote.isk >= quote.requiredISK && quote.isk <= 500_000_000, 'The agreed contribution must meet the counteroffer and stay within 500M ISK.');
  if (proposal.agreement === 'joint') {
    const usable = fleets(state, a.id).find(f => f.ships >= 3);
    const error = context.orderError(state, usable, { type: quote.mission, targetId: quote.targetId }); assert(!error, error);
  }
  context.spend(state.player, quote.isk, `Coalition ${proposal.agreement}: ${a.name}`, state.turn);
  if (proposal.agreement !== 'srp') context.income(a, quote.isk, `Player-funded ${proposal.agreement}`, state.turn);
  if (proposal.agreement === 'joint') {
    a.commitment = { targetId: quote.targetId, mission: quote.mission, remainingTurns: RULES.allyRequestTurns, fulfilledWatches: 0 };
    a.cooldown = RULES.allyRequestCooldown;
    state.player.trust = clamp(state.player.trust + 2);
    recordJointOperation(state, a.id, 'agreed');
  } else {
    const agreement = { id: `diplomacy-${state.diplomacy.nextAgreementId++}`, type: proposal.agreement, targetId: quote.targetId, createdTurn: state.turn, expiresTurn: state.turn + quote.turns, paidISK: 0, escrow: proposal.agreement === 'srp' ? quote.isk : 0, budgetISK: proposal.agreement === 'srp' ? quote.isk : 0, triggered: false, lossByFleet: {} };
    if (proposal.agreement === 'srp') for (const f of fleets(state, a.id)) agreement.lossByFleet[f.id] = f.lifetimeLosses;
    r.agreements.push(agreement);
    remember(state, r, 'agreement', `${descriptor(proposal.agreement).label} agreed for ${quote.turns} watches with ${million(quote.isk)} ${proposal.agreement === 'srp' ? 'held in capped escrow' : 'transferred to the ally'}.`);
  }
  r.pending = null;
  announce(state, context, `${a.name}: agreement reached`, `${descriptor(proposal.agreement).label}: ${descriptor(proposal.agreement).description} Contribution: ${million(quote.isk)}.`);
}

function refundAgreement(state, a, agreement, context, reason) {
  if (agreement.escrow > 0) { context.income(state.player, agreement.escrow, `Unused replacement escrow: ${a.name}`, state.turn); agreement.escrow = 0; }
  remember(state, relation(state, a.id), 'agreement-ended', reason);
  announce(state, context, `${a.name}: agreement ended`, reason);
}

export function applyDiplomacyAction(state, action, context) {
  if (!ACTIONS.has(action?.type)) return false;
  assert(!state.result, 'This campaign has ended. Continue in sandbox or start a new campaign before negotiating.');
  const a = actor(state, action.allyId), r = relation(state, action.allyId);
  assert(a && a.faction === state.faction && r, 'Choose an allied corporation.');
  if (action.type === 'diplomacyPropose') {
    assert(descriptor(action.agreement), 'Choose a valid agreement.');
    assert(!r.pending, 'Accept or decline the current counteroffer before making another proposal.');
    const quote = agreementQuote(state, action);
    assert(Number.isInteger(quote.isk) && quote.isk >= 0 && quote.isk <= 500_000_000, 'Offer a whole ISK amount between zero and 500M.');
    if (!quote.allowed) { remember(state, r, 'declined', `Proposal declined: ${quote.reason}`); announce(state, context, `${a.name}: proposal declined`, quote.reason); return true; }
    if (quote.isk < quote.requiredISK) {
      r.pending = { agreement: action.agreement, targetId: quote.targetId, mission: quote.mission, offerISK: quote.isk, requiredISK: quote.requiredISK, expiresTurn: state.turn + 3, reason: `${quote.reason} The minimum contribution is ${million(quote.requiredISK)}; no funds have moved.` };
      remember(state, r, 'counteroffer', r.pending.reason); announce(state, context, `${a.name}: counteroffer`, r.pending.reason); return true;
    }
    acceptAgreement(state, a, r, action, context);
  } else if (action.type === 'diplomacyAccept') {
    assert(r.pending && state.turn < r.pending.expiresTurn, 'This counteroffer has expired or is no longer available.');
    acceptAgreement(state, a, r, { ...r.pending, offerISK: r.pending.requiredISK }, context);
  } else if (action.type === 'diplomacyDecline') {
    assert(r.pending, 'There is no counteroffer to decline.'); r.pending = null;
    remember(state, r, 'declined', 'The council declined a counteroffer without promising unaffordable support. No trust penalty.');
    announce(state, context, `${a.name}: negotiation closed`, r.lastResponse);
  } else if (action.type === 'diplomacyAid') {
    assert(r.cooldowns.aid === 0, 'Recent aid is still being put to use.');
    context.spend(state.player, 20_000_000, `Coalition aid: ${a.name}`, state.turn); context.income(a, 20_000_000, 'Coalition recovery aid', state.turn);
    r.favors = Math.min(3, r.favors + 1); r.grievance = clamp(r.grievance - 5); a.trust = clamp(a.trust + 4); r.cooldowns.aid = 4;
    remember(state, r, 'aid', '20M ISK in actual recovery aid delivered. One reciprocal favor earned, up to three. Aid does not automatically restore coalition membership.');
    announce(state, context, `${a.name}: aid delivered`, r.lastResponse);
  } else if (action.type === 'diplomacyCallFavor') {
    assert(r.status === 'member' && a.trust >= 35, 'Emergency support requires a willing coalition member.');
    assert(r.favors > 0, 'Earn a favor by providing aid or completing a joint operation first.');
    assert(r.cooldowns.favor === 0, 'The previous emergency grant is still on cooldown.');
    assert(a.wallet >= 100_000_000, 'The ally cannot provide 20M ISK while preserving its 80M operating reserve.');
    context.spend(a, 20_000_000, 'Reciprocal emergency grant', state.turn); context.income(state.player, 20_000_000, `Emergency aid: ${a.name}`, state.turn);
    r.favors--; r.cooldowns.favor = 8;
    remember(state, r, 'favor', 'A reciprocal favor funded a 20M ISK emergency grant from the ally’s actual wallet. Its 80M operating reserve is protected.');
    announce(state, context, `${a.name}: favor honored`, r.lastResponse);
  } else if (action.type === 'diplomacyReconcile') {
    assert(r.cooldowns.reconcile === 0, 'The council must give the last reconciliation meeting time to work.');
    assert(r.grievance > 0 || r.status === 'withdrawn' || a.trust < 60, 'There is no outstanding dispute to reconcile.');
    assert(r.withdrawnTurn === null || state.turn - r.withdrawnTurn >= 2, 'Allow two watches after withdrawal before reopening coalition talks.');
    context.spend(state.player, 10_000_000, `Coalition liaison: ${a.name}`, state.turn); context.income(a, 10_000_000, 'Funded reconciliation liaison', state.turn);
    r.grievance = clamp(r.grievance - 30); a.trust = clamp(a.trust + 12); r.cooldowns.reconcile = 4; r.stressWatches = 0;
    const restored = r.status === 'withdrawn' && a.trust >= 40 && r.grievance < 55;
    if (restored) { r.status = 'member'; r.withdrawnTurn = null; }
    remember(state, r, 'reconciled', restored ? 'A funded liaison and resolved grievances restored coalition membership. The corporation still chooses its own tactics.' : 'The council resolved 30 grievance points and restored 12 trust. Rejoining requires 40 trust and fewer than 55 grievance points.');
    announce(state, context, `${a.name}: reconciliation`, r.lastResponse);
  } else if (action.type === 'diplomacyMediate') {
    const pair = rivalriesFor(state, a.id).filter(p => !action.rivalId || p.actorIds.includes(action.rivalId)).sort((x, y) => y.tension - x.tension || x.actorIds.join().localeCompare(y.actorIds.join()))[0];
    assert(pair && pair.tension > 0, 'There is no active organizational rivalry to mediate.');
    const competitorId = pair.actorIds.find(id => id !== a.id), competitor = relation(state, competitorId);
    assert(r.cooldowns.mediate === 0 && competitor.cooldowns.mediate === 0, 'Give the last scheduling mediation time to work.');
    context.spend(state.player, 10_000_000, 'Coalition scheduling mediation', state.turn);
    pair.tension = clamp(pair.tension - 35);
    for (const id of pair.actorIds) { const member = relation(state, id); member.grievance = clamp(member.grievance - 10); member.cooldowns.mediate = 6; remember(state, member, 'mediation', 'A scheduling council reduced rivalry tension by 35 and outstanding grievances by 10.'); }
    announce(state, context, 'Coalition scheduling resolved', `${a.name} and ${actor(state, competitorId).name}: scenario rivalry tension is now ${Math.round(pair.tension)}.`);
  } else if (action.type === 'diplomacyRenounce') {
    const agreement = r.agreements.find(item => item.id === action.agreementId); assert(agreement, 'Choose an active agreement to cancel.');
    refundAgreement(state, a, agreement, context, `${descriptor(agreement.type).label} cancelled early by the council. Unused escrow returned; advance service fees remain with the provider.`);
    r.agreements = r.agreements.filter(item => item.id !== agreement.id); r.grievance = clamp(r.grievance + 15); a.trust = clamp(a.trust - 8);
  }
  return true;
}

export function settleDiplomacy(state, context) {
  const diplomacy = state.diplomacy;
  if (diplomacy.lastSettledTurn === state.turn) return;
  assert(diplomacy.lastSettledTurn + 1 === state.turn, 'Diplomacy must settle each watch in sequence.');
  diplomacy.lastSettledTurn = state.turn;
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    const r = relation(state, a.id);
    for (const key of Object.keys(r.cooldowns)) r.cooldowns[key] = Math.max(0, r.cooldowns[key] - 1);
    if (r.pending && state.turn >= r.pending.expiresTurn) { r.pending = null; remember(state, r, 'expired', 'The counteroffer expired without a commitment or financial penalty.'); }
    const remaining = [];
    for (const agreement of r.agreements) {
      let ended = false;
      if (agreement.type === 'srp') {
        let claim = 0;
        for (const f of fleets(state, a.id)) {
          const losses = Math.max(0, f.lifetimeLosses - (agreement.lossByFleet[f.id] ?? 0));
          claim += Math.round(losses * DOCTRINES.find(d => d.id === f.doctrineId).cost * 0.5); agreement.lossByFleet[f.id] = f.lifetimeLosses;
        }
        const paid = Math.min(agreement.escrow, claim);
        if (paid > 0) {
          agreement.escrow -= paid; agreement.paidISK += paid; context.income(a, paid, 'Escrowed coalition replacement settlement', state.turn);
          a.trust = clamp(a.trust + Math.min(3, paid / 10_000_000)); r.grievance = clamp(r.grievance - 2);
          remember(state, r, 'replacement-paid', `${million(paid)} paid against actual destroyed hulls. ${million(agreement.escrow)} remains in the capped escrow.`);
          announce(state, context, `${a.name}: replacements settled`, r.lastResponse);
        }
        if (agreement.escrow === 0) { ended = true; refundAgreement(state, a, agreement, context, `Replacement assistance reached its ${million(agreement.budgetISK)} ceiling. The finite funded promise is complete; further losses are not covered.`); }
      } else if (agreement.type === 'access') {
        const base = system(state, agreement.targetId);
        if (a.stagingId !== agreement.targetId || base.occupier !== a.faction) { ended = true; refundAgreement(state, a, agreement, context, 'Workshop access ended because the allied staging base moved or became hostile. Your fleets retain their location and stocks; order travel to an available friendly base.'); }
        else for (const f of fleets(state, 'player')) if (f.systemId === agreement.targetId && f.order.type === 'rest' && f.ships > 0) f.readiness = clamp(f.readiness + 8);
      } else if (agreement.type === 'defense' && !agreement.triggered) {
        const target = system(state, agreement.targetId);
        if (target.occupier !== a.faction) {
          ended = true; r.grievance = clamp(r.grievance + 8); a.trust = clamp(a.trust - 4);
          refundAgreement(state, a, agreement, context, 'The compact’s friendly system was lost before a defensive response. The missed defense leaves an operational dispute.');
        } else if (target.vp >= target.threshold * 0.25 && state.turn < agreement.expiresTurn) {
          const support = canRequestSupport(state, a.id);
          if (support.allowed) {
            a.commitment = { targetId: target.id, mission: 'defensive', remainingTurns: Math.min(RULES.allyRequestTurns, agreement.expiresTurn - state.turn), fulfilledWatches: 0 };
            a.cooldown = RULES.allyRequestCooldown; agreement.triggered = true;
            remember(state, r, 'defense-triggered', `The 25% pressure trigger at ${target.name} called in the compact’s single response. The allied fleet retains tactical control.`);
            announce(state, context, `${a.name}: compact activated`, r.lastResponse);
          } else if (agreement.lastBlockedReason !== support.reason) {
            agreement.lastBlockedReason = support.reason;
            remember(state, r, 'defense-delayed', `Defensive compact response delayed: ${support.reason}`); announce(state, context, `${a.name}: response delayed`, r.lastResponse);
          }
        }
      }
      if (!ended && state.turn >= agreement.expiresTurn) {
        const threatenedUnanswered = agreement.type === 'defense' && !agreement.triggered && system(state, agreement.targetId).vp >= system(state, agreement.targetId).threshold * 0.25;
        if (threatenedUnanswered) { r.grievance = clamp(r.grievance + 12); a.trust = clamp(a.trust - 5); }
        refundAgreement(state, a, agreement, context, `${descriptor(agreement.type).label} completed its agreed time window.${agreement.type === 'srp' ? ` Actual settlements: ${million(agreement.paidISK)}; unused escrow returned.` : ''}${threatenedUnanswered ? ' The response could not be fielded before expiry; the unfulfilled promise leaves a dispute.' : ''}`);
        ended = true;
      }
      if (!ended) remaining.push(agreement);
    }
    r.agreements = remaining;
    if (r.status === 'member') {
      r.stressWatches = r.grievance >= 75 || a.trust < 25 ? r.stressWatches + 1 : 0;
      if (r.stressWatches >= 2) {
        r.status = 'withdrawn'; r.withdrawnTurn = state.turn; r.pending = null; a.commitment = null;
        for (const agreement of r.agreements) refundAgreement(state, a, agreement, context, `${descriptor(agreement.type).label} ended with coalition withdrawal; unused escrow returned.`);
        r.agreements = []; state.player.trust = clamp(state.player.trust - 5);
        remember(state, r, 'withdrawn', 'Two watches of severe unresolved grievances or lost trust caused coalition withdrawal. The corporation retains its own ships, wallet, militia affiliation and independent objectives.');
        announce(state, context, `${a.name}: coalition withdrawal`, `${r.lastResponse} Reconciliation becomes available after two watches.`);
      }
    }
  }
}

export function getDiplomacyPlanningBias(state, actorId, mission, systemId) {
  const a = actor(state, actorId), r = relation(state, actorId), s = system(state, systemId);
  if (!a || !r || !s) return 0;
  // Only public occupancy, own staging/fatigue, and authored priorities are used.
  // No opposing wallet, ships, orders, scouting state or future random roll enters.
  const nearby = distance(state, a.stagingId, s.id) <= 3;
  let score = 0;
  if (r.priorityId === 'home') score += mission === 'defensive' ? 10 + (nearby ? 6 : 0) : nearby ? 2 : -4;
  if (r.priorityId === 'offensive') score += ['offensive', 'hub'].includes(mission) ? 7 : -2;
  if (r.priorityId === 'skirmish') score += (nearby ? 5 : -3) + (mission === 'hub' && a.fatigue > 45 ? -8 : 0);
  if (r.priorityId === 'logistics') score += mission === 'defensive' ? 7 : nearby ? 2 : 0;
  if (r.status === 'withdrawn') score += nearby ? 3 : -8;
  return score;
}

export function getDiplomacyReport(state) {
  return { notice: DIPLOMACY_NOTICE, organizations: state.actors.map(a => {
    const r = relation(state, a.id), pair = rivalriesFor(state, a.id).sort((x, y) => y.tension - x.tension || x.actorIds.join().localeCompare(y.actorIds.join()))[0];
    const rivalId = pair?.actorIds.find(id => id !== a.id);
    return { id: a.id, name: a.name, ticker: a.ticker, faction: a.faction, allied: a.faction === state.faction, priority: copy(PRIORITIES[r.priorityId]), trust: a.trust, grievance: r.grievance, favors: r.favors, status: r.status, stressWatches: r.stressWatches, support: canRequestSupport(state, a.id), rivalry: pair ? { actorId: rivalId, name: actor(state, rivalId).name, tension: pair.tension } : null, pending: copy(r.pending), agreements: r.agreements.map(agreement => ({ ...copy(agreement), label: descriptor(agreement.type).label, description: descriptor(agreement.type).description, remainingTurns: Math.max(0, agreement.expiresTurn - state.turn) })), memories: copy(r.memories), lastResponse: r.lastResponse, cooldowns: copy(r.cooldowns), agreementOptions: copy(DIPLOMACY_AGREEMENTS) };
  }) };
}

export function validateDiplomacy(state) {
  const d = state.diplomacy;
  assert(d && d.version === 1 && d.organizations && !Array.isArray(d.organizations), 'Invalid diplomacy state.');
  const number = (value, label, max = 100, min = 0) => assert(Number.isInteger(value) && value >= min && value <= max, `Invalid diplomacy ${label}.`);
  number(d.lastSettledTurn, 'settlement watch', state.turn); assert(d.lastSettledTurn === state.turn, 'Diplomacy settlement must match the campaign watch.'); number(d.nextAgreementId, 'agreement sequence', 100_000_000, 1);
  assert(Object.keys(d.organizations).length === state.actors.length && state.actors.every(a => Object.hasOwn(d.organizations, a.id)), 'Invalid diplomacy roster.');
  const agreementIds = new Set();
  for (const a of state.actors) {
    const r = d.organizations[a.id]; assert(r && r.priorityId === AUTHORED_PRIORITIES[a.id], 'Invalid scenario priority.');
    assert(['member', 'withdrawn', 'opponent'].includes(r.status) && (a.faction === state.faction ? r.status !== 'opponent' : r.status === 'opponent'), 'Invalid coalition membership.');
    number(r.grievance, 'grievance'); number(r.favors, 'favor balance', 3); number(r.stressWatches, 'stress watches', 1_000_000);
    assert(r.withdrawnTurn === null || r.status === 'withdrawn', 'Invalid coalition withdrawal history.');
    if (r.status === 'withdrawn') number(r.withdrawnTurn, 'withdrawal watch', state.turn);
    assert(r.cooldowns && Object.keys(r.cooldowns).length === 4, 'Invalid diplomacy cooldowns.');
    for (const key of ['aid', 'favor', 'reconcile', 'mediate']) number(r.cooldowns[key], 'cooldown', 8);
    assert(Array.isArray(r.memories) && r.memories.length <= 16 && typeof r.lastResponse === 'string' && r.lastResponse.length <= 1500, 'Invalid political memory.');
    for (const entry of r.memories) { number(entry.turn, 'memory watch', state.turn); assert(typeof entry.event === 'string' && entry.event.length <= 50 && typeof entry.text === 'string' && entry.text.length <= 1500, 'Invalid political event.'); }
    if (r.pending) {
      const p = r.pending; assert(descriptor(p.agreement) && system(state, p.targetId) && ['offensive', 'defensive', 'patrol', 'advantage', 'hub'].includes(p.mission), 'Invalid coalition counteroffer.');
      number(p.offerISK, 'offered ISK', 500_000_000); number(p.requiredISK, 'requested ISK', 500_000_000, 1); number(p.expiresTurn, 'counteroffer expiry', state.turn + 3, state.turn + 1);
      assert(p.offerISK < p.requiredISK && typeof p.reason === 'string' && p.reason.length <= 1500 && r.status === 'member', 'Invalid counteroffer terms.');
    }
    assert(Array.isArray(r.agreements) && r.agreements.length <= 3 && new Set(r.agreements.map(item => item.type)).size === r.agreements.length, 'Invalid agreement registry.');
    for (const agreement of r.agreements) {
      assert(r.status === 'member' && ['defense', 'access', 'srp'].includes(agreement.type), 'Invalid active agreement.');
      assert(typeof agreement.id === 'string' && /^diplomacy-\d+$/.test(agreement.id) && !agreementIds.has(agreement.id), 'Invalid agreement identity.'); agreementIds.add(agreement.id);
      assert(system(state, agreement.targetId), 'Invalid agreement location.'); number(agreement.createdTurn, 'agreement start', state.turn); number(agreement.expiresTurn, 'agreement expiry', agreement.createdTurn + descriptor(agreement.type).turns, state.turn + 1);
      assert(agreement.expiresTurn === agreement.createdTurn + descriptor(agreement.type).turns, 'Invalid agreement duration.');
      for (const key of ['paidISK', 'escrow', 'budgetISK']) number(agreement[key], key, 500_000_000);
      assert(typeof agreement.triggered === 'boolean' && agreement.lossByFleet && typeof agreement.lossByFleet === 'object' && !Array.isArray(agreement.lossByFleet) && Object.keys(agreement.lossByFleet).length <= 8, 'Invalid agreement settlement.');
      if (agreement.type === 'srp') assert(agreement.escrow + agreement.paidISK === agreement.budgetISK && agreement.budgetISK >= 40_000_000, 'Invalid replacement escrow accounting.');
      else assert(agreement.escrow === 0 && agreement.budgetISK === 0 && agreement.paidISK === 0 && Object.keys(agreement.lossByFleet).length === 0, 'Unexpected agreement escrow.');
      for (const [id, losses] of Object.entries(agreement.lossByFleet)) { const fleet = state.fleets.find(f => f.id === id && f.ownerId === a.id); assert(fleet, 'Invalid replacement claimant.'); number(losses, 'settled losses', fleet.lifetimeLosses); }
      if (agreement.lastBlockedReason !== undefined) assert(typeof agreement.lastBlockedReason === 'string' && agreement.lastBlockedReason.length <= 1500, 'Invalid delayed response reason.');
    }
  }
  assert(Array.isArray(d.rivalries) && d.rivalries.length <= state.actors.length, 'Invalid scenario rivalry registry.');
  const pairs = new Set();
  for (const pair of d.rivalries) {
    assert(Array.isArray(pair.actorIds) && pair.actorIds.length === 2 && pair.actorIds[0] < pair.actorIds[1], 'Invalid rivalry pair.');
    const first = actor(state, pair.actorIds[0]), second = actor(state, pair.actorIds[1]), key = pair.actorIds.join(':');
    assert(first && second && first.faction === second.faction && !pairs.has(key), 'Invalid rivalry organizations.'); pairs.add(key); number(pair.tension, 'rivalry tension');
  }
  return true;
}
