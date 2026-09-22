# Validation, calibration, and implementation roadmap

This is the execution companion to [PRD.md](../PRD.md). All schedules below are sequences, not promised delivery dates. No game engine or AI campaign benchmark has been run as part of the research phase.

## Before engine implementation

Freeze a scenario manifest containing geographic snapshot ID, ruleset ID and effective interval, affiliation evidence dates, asset versions, known omissions, unknown private state, and explicit starting-resource assumptions. The supplied geography is usable now; exact site parameters and era eligibility still need the checks listed in the mechanics report.

Use a release checklist at the **feature** level, rather than declaring all mechanics current because one help article was updated. Later patch notes can supersede a specific paragraph without replacing an entire guide. Announced changes, deployed changes, and observations before deployment must be separate.

The initial observed scenario is pre-downtime on 22 September 2026. Do not apply later that day's announced behavior to it unless confirmed as an intentional alternate ruleset. Historical scenarios require historical geography too; today's 90-star graph is not evidence for an older theater.

## Data needed for implementation

| Dataset | Minimum useful content | Current status |
|---|---|---|
| Warzone | IDs, names, gates, coordinates, occupant, VP state, timestamps | Supplied, with inherited-geography caveat |
| External navigation | Gate paths to supported supply hubs and access constraints | Boundary gates supplied; full paths still needed |
| Site catalog | Gate eligibility, duration, spawn context, rewards, VP, advantage | Research report; exact gaps tracked |
| Doctrines | Real hull IDs, roles, fit ingredients, training requirements, site categories | Design families specified; final fits still needed |
| Industry | Selected blueprint inputs/runs, times, fees, output IDs | Pipeline researched; final recipe subset still needed |
| Market calibration | Dated price/depth/volume ranges for chosen doctrine inputs | Not yet a measured trading model |
| Coalition cast | Exact entity IDs, dated affiliation, real art, source confidence | Candidate catalog and verification work |
| Attendance | Scenario distributions by cohort and watch | Synthetic assumptions; public APIs do not reveal willingness |
| Politics | Dated commitments/institutions; simulated behavior parameters | Sourced case studies plus original design |

Avoid overcollecting the universe before choosing the first doctrine and scenario scope. A small, complete, auditable catalog is more useful than thousands of item records whose economic behavior has not been modeled.

## Architecture decision gate: Freeciv

Use the concrete [Freeciv evaluation](06-freeciv-evaluation.md). Do not equate the JavaScript web client with a complete browser simulation. The user selected browser-only hosting. A direct fork would therefore need an independently proven browser port and is not the selected implementation direction. Adopting selected source needs a per-file dependency and license audit.

A bounded fork spike, if pursued, must prove these five things before becoming the foundation:

1. Represent the exact 90-star gate graph with correct routing and no unintended tile adjacency.
2. Keep multiple fleets, hostile presence, and objective locations separate within a system.
3. Represent occupation separately from corporation control, stock, and docking access.
4. Save and restore a plex operation, a shipment, and an allied promise without information loss.
5. Make the AI act on those FW goals through an appropriate planner instead of unchanged city/terrain heuristics.

A successful reskin alone does not pass. Record modifications, runnable commands, actual time spent, and unsupported behavior; then compare with a minimal browser-engine slice. Do not claim a WebAssembly conversion is small until it has been built and measured.

## Suggested implementation stages

### A. Data and orders

Render the complete map, select faction and actor, create a scenario with unknowns filled only by explicit assumptions, issue legal route/mission orders, advance the shared clock, and save/load. Build a deterministic event ledger and per-actor observations at this stage.

Exit: exact-map tests, illegal-order atomicity, resource reservations, clock/event tie handling, and byte-equivalent normalized replay state all pass.

### B. The smallest complete war

Add one inexpensive doctrine, a counterdoctrine, basic sites, defense, capture eligibility, a hub sequence, reships, one convoy route, a real named allied actor, an opponent, and a short mandate. Use readable known temporary parameters where exact rules remain unresolved; label that mode an exercise rather than faithful current FW.

Exit: the player can win, lose, retreat, recover, and complete a saved campaign. Denying supplies or making an ally miss a commitment changes the outcome for a causal reason.

### C. Coalition and management

Add cohort attendance, enjoyment/fatigue, SRP obligations, LP redemption/buyback paths, bounded market transactions, manufacturing queues, access agreements, and named-cast assets. Add several independent actors per militia, with generated priorities separated from biography.

Exit: keeping more space cannot automatically generate more pilots or money; support policies have measurable and explainable consequences; markets and inventories reconcile.

### D. Full verified operations

Add the pinned advantage model, battlefield scheduling and rewards, additional doctrine roles, new-front calculations, and any chosen shipcaster/insurgency module. Expand navigation coverage before claiming blockade realism. Add development and standard multi-evening mandates.

Exit: mechanics conformance examples and several strategy families succeed under appropriate conditions; no single farming/industry/stacking loop dominates every tested scenario.

### E. Player-facing polish and release

Refine briefings, diplomacy, warnings, accessible controls, map overlays, battle explanations, automation stop conditions, and long-save performance. Preserve source and third-party asset attribution. Publish only after the intended scope is playable and appropriately verified.

## Engine invariants

These are implementation requirements, not tests already written for a nonexistent engine.

### Geography and observation

- Every normal gate movement follows a source edge; no extra links arise from drawing proximity.
- External shortcuts follow actual supported paths or explicitly modeled transport actions.
- Holding an actor's observations fixed, changes in unobserved enemy state cannot alter its decision. Hidden actions may legitimately change subsequently observed market, occupancy, or intel signals.
- Intel age grows; remembered positions are not silently converted into current positions.
- Faction occupation, character membership, corporation identity, structure access, and fleet presence remain distinct.

### Economy and time

- ISK, LP, hulls, ammo, materials, and blueprint runs reconcile to event ledgers.
- Personal/corporate accounts cannot be spent interchangeably. Alliance budgets identify custodian accounts and earmarks; they never duplicate the same funds in an additional balance.
- Input reservations prevent two jobs from spending the same materials or blueprint run.
- A shipment can be at origin, in transit, delivered, or lost; it cannot exist in two inventories.
- No use of an item before its manufacture, delivery, fitting, and reservation steps finish.
- Paying SRP settles an obligation and transfers ISK once; it does not create another hull.
- A pilot or FC cannot contribute overlapping hours to two operations.
- A six-hour watch is not six hours of free full attendance from every enrolled character.

### Combat and FW

- Eligibility checks happen before a fleet enters a restricted site.
- An oversized reward group follows the selected reward rule rather than a formation-size assumption.
- Site completion requires available time and all relevant conditions; contesting or clearing NPCs affects the timeline.
- The same completed site, cargo kill, or objective cannot pay twice after reload.
- Ship damage and destroyed hulls are distinct; retreat preserves only actual survivors.
- Tackled ships cannot teleport to safety because a retreat threshold was reached.
- Ordinary kill count cannot directly substitute for site progress or hub prerequisites.
- Simultaneous events produce stable outcomes independent of actor array order.

### Politics and persistence

- Allied promises specify deliverables, deadlines, and resource scope.
- An ally can refuse an infeasible request without corrupting shared state.
- Relationship changes identify the observed event and affected parties.
- Named pilot dialogue is generated campaign text, not presented as an authentic quote.
- Full save round trips preserve clock, PRNG, identities, requests, reservations, cargo, sites, and logs.
- Failed imports preserve the prior playable save.
- Hidden tabs and closed browsers do not advance the simulation.

## Scenario-based checks that matter

| Scenario | Expected qualitative outcome |
|---|---|
| Large slow fleet versus spread eligible small teams | Large fleet can dominate a contact but cannot cover all simultaneous objectives |
| Rich corporation with no ready hulls at staging | Money alone cannot immediately field the intended fleet |
| Small force with a local reship cache | Can sustain repeated appropriate contests better than an equally skilled distant force |
| Fleet wins but incurs unpaid replacements repeatedly | Future willingness and coalition reliability deteriorate under stated assumptions |
| Training roam gives novices useful roles and affordable losses | Can improve their future participation even without a territorial gain |
| Excessive farming produces more LP goods than the market absorbs | Marginal realizable return falls; cash conversion takes time |
| Enemy refuses a bad fight | Player can deny objectives, force a different opportunity, or accept noncombat progress |
| Support agreement arrives one watch late | The timeline distinguishes missed commitment from still-useful later aid |
| A system becomes hostile Command Operations/Rearguard despite a private structure access grant | Apply the pinned FW ship docking, undocking, and tether restrictions; an ACL does not override them |
| Eligible frontline/friendly/neutral access and any necessary private permission remain valid | Preserve usable stock and do not invent an asset transfer or universal lockout |
| A coalition takes nearly every system | The endgame remains capable of a result; boredom and spread defense affect sustainability without scripted equalization |
| Enemy enters an unscouted area | AI and player do not gain exact fleet knowledge from global state |
| A historical organization has no current eligible activity/affiliation evidence | Loader excludes it from verified-current roles or explicitly selects a historical/alternate scenario; an empty roster alone is not proof of legal disbandment |

## Balance and AI experiments

Do not claim Nash equilibrium, human realism, or optimal strategy from a few successful bot games. The economic and social functions are hypotheses.

Use a declared seed suite and rotate factions, initiative/tie seeds, watch schedules, and actor placements where the scenario permits variation. Report completed games, defeats, wins, and unresolved runs separately. Record the test horizon; never discard timeouts when calculating success.

Compare at least these policy families: territorial rush, defense/counterattack, dispersed objective teams, concentrated battle fleet, logistics-first, industry-first, opportunistic income, and cooperative coalition planning. Use several resource and attendance conditions. Faction asymmetry in the observed opening map means a 50/50 win rate is not automatically a suitable target.

Measure objective completion, replacement delay, fieldable pilots, fleet composition, ISK/LP/material sources and sinks, survival of suppliers, fulfilled commitments, attendance by cohort, concentration of workload, and campaign length. Diagnose why a strategy works; don't just optimize a composite score.

**Ablations:** disable fatigue, flatten market depth, remove independent ally choice, grant perfect intel, or remove travel delays one at a time. If those changes never alter sensible decisions, the corresponding feature is probably decorative or incorrectly connected.

**Sensitivity:** vary proposed social weights and market elasticities across wide declared ranges. A design that becomes unplayable under small changes is fragile. Calibrate tactical matchups first, then supply dynamics, then participation, then coalition behavior; changing every layer together makes diagnosis difficult.

## Human playtesting

Recruit both FW-familiar players and Civ-familiar newcomers when a playable slice exists. Observe choices and comprehension, rather than treating a single satisfaction number as proof of fun.

Questions to answer with behavior:

- Can a player explain why only eleven of eighteen willing pilots can deploy?
- Do they choose a retreat, resupply mission, or enjoyable low-stakes operation voluntarily?
- Does an ally feel independent but understandable?
- Can the player predict an LP-to-reship delay before suffering it?
- Does the next-turn report change their plan?
- Are repeat orders saving effort, and are stop reasons comprehensible?
- Do historical names add recognition without suggesting the generated events really happened?

Record active play time, number of meaningful decisions, time spent in ledgers, repeated low-information clicks, and reasons for abandoning a campaign. Proposed duration and turn count should change if the observed loop is too slow or repetitive.

## Performance and operational targets

Provisional engineering targets: responsive map interaction with all 90 systems visible, typical turn resolution under one second on a declared reference laptop, and a worker for heavier planning. These are goals, not measured performance. Measure worst-case full-theater activity and large saves before setting published requirements.

Benchmark logic separately from animation. Rendering should not influence RNG or simulation results. A reference test device, browser version, scenario seed, actor/fleet counts, and dataset versions must accompany results.

The default game should not require an EVE login or ongoing live API access. Fresh-data imports occur during content authoring and never rewrite an in-progress campaign's geography, rules, roster, or art.
