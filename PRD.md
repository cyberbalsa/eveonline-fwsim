# New Eden: War Council — product requirements and game design

**Status:** research-backed design specification, 22 September 2026. A first playable browser version now exists; see [implemented scope and adaptations](design/implementation.md) and [play instructions](README.md). This document remains the broader design target. Numerical pacing, starting assets, AI weights, and victory thresholds below are proposals unless explicitly identified as observed data; executable rules take precedence for the current prototype.

## 1. The game

A single-player, Civ-style strategy game on the actual Caldari–Gallente Faction Warfare map. You lead one militia through your own corporation and a coalition of independent allies. Move fleets, contest systems, build a supply network, develop doctrines, negotiate support, and make people want to join the next fleet.

The defining question is: **Can you turn money, ships, goodwill, and limited pilot time into a war effort that lasts?** Winning an expensive battle can leave tomorrow's fleet empty. A good retreat can preserve the pilots and ships needed to win a campaign. Helping an ally recover can be worth more than taking another plex yourself.

### Confirmed requirements

| Requirement | Decision |
|---|---|
| Format | Single-player web game; Civ-style strategic play |
| Hosting | Browser-only, like the existing games; adapt Freeciv ideas and suitable code |
| Combat | Map combat with doctrine, stance, and retreat orders |
| Player role | Militia leader with an owned corporation and independent allied organizations |
| Duration | Several evenings; persistent save |
| Setting | CalMil versus GalMil, with the real warzone and recognizable politics |
| Management | Fun, ISK, industry, and supporting activities must affect outcomes |
| Cast and art | Real in-game pilot, corporation, and alliance names; actual portraits/logos |
| Research | Deep mechanics, history, politics, economics, and game-theory research, using subagents |
| Project context | Follow the static web architecture and presentation family of `../eveonline-risk` and `../eveonline-monopoly` |
| Engine research | Inspect actual Freeciv/Freeciv-web code and express the design in versioned rules data |

**Working defaults, still adjustable:** latest verifiable opening map; simultaneous order resolution; six simulated hours per strategic turn; about 120 turns; a doctrine-level economy with optional detailed inspection; no separate tactical battle screen. These are design recommendations, not additional user decisions.

### The Civ connection

Civ's useful reference points are persistent development, competing strategic priorities, leader agendas, and several systems feeding long-term outcomes. Its official description connects map development, research, civics, and opponents' agendas; those are appropriate inspirations here. [Official Civilization VI overview](https://civilization.2k.com/en-GB/civ-vi/)

| Familiar Civ element | Proposed FW equivalent | What makes this EVE |
|---|---|---|
| World map | All 90 FW systems and their gate graph | Known geography; uncertainty lies in activity and intentions |
| Cities | Established staging hubs and corporation service networks | An occupied system is not your property or a source of automatic taxes |
| Units | Persistent fleet formations with real hull inventories | Pilots, hulls, fittings, and available time are separate constraints |
| Production queue | Procurement, fittings, manufacturing, hauling, training | A completed ship at the wrong station cannot join a distant fleet |
| Technology | Doctrine capability, logistics expertise, trained specialists | Existing EVE technologies are learned and supplied, not invented anew |
| Civics | Corporation policies and coalition agreements | Independent allies can refuse or renegotiate |
| Happiness | Enjoyment, trust, cohesion, and fatigue by pilot cohort | Pilots can prefer difficult fights to profitable boredom |
| Trade routes | Cargo contracts and protected reship routes | Camps threaten cargo; outside-market imports remain possible |
| Diplomacy | Access, shared operations, SRP, LP buyback, favors, local arrangements | Militia membership does not produce unified command |
| Great people | Real, dated in-game FC/adviser identities | Their campaign behavior is simulated, not a historical quotation |
| Wonders/projects | Major deployments, supply programs, empire campaign objectives | Real prerequisites, limited contributions, and visible opportunity costs |
| Victory | A successful military campaign sustained by a viable coalition | Industry and politics change battlefield outcomes |

Do not import settler colonization, food farms, unit healing that recreates destroyed ships, continent bonuses, or one-unit-per-system restrictions. A solar system is much larger than a Civ tile: opposing fleets can coexist at different locations.

## 2. Fidelity contract: what “1:1” means

Reproduce the war's **geography, identities, causal structure, and dated rules** as closely as evidence allows. The campaign branches into alternate history after its opening state. A turn-based game cannot reproduce every real-time input, private alliance agreement, or human decision.

| Layer | Required fidelity | Explicit boundary |
|---|---|---|
| Systems and gates | Exact IDs, names, internal links, and official schematic coordinates | External routes must be included in logistics or declared as abstractions |
| Opening occupancy | Actual frozen public ESI observation | Observation has a timestamp and cache age; it is not permanently live |
| Mechanics | Versioned capture, access, site, reward, and advantage rules | Unknown exact values remain unresolved; no mixing historical patches |
| Corporations and alliances | Exact ESI identities; documented dated affiliations | Current existence does not prove current militia activity |
| Named pilots | Public in-game identity and sourced historical role | Generated orders and priorities are simulation |
| Assets and turnout | Scenario assumptions with ranges | Private wallets, fittings, hangars, diplomacy, and online humans are not observed |
| Combat | Preserve relevant relationships and constraints | Grouped resolution replaces piloting and module-by-module execution |
| Time | Explicit strategic time scale and automated site activity | No claim that a six-hour turn is one six-hour plex timer |

The supplied opening observation was last modified **2026-09-22 05:11:32 UTC**, before that day's downtime. It contains **90 systems, 110 internal gate links, 15 constellations, five regions, 56 Caldari occupiers and 34 Gallente occupiers**. Geography comes from the sibling project's preserved ESI/SDE evidence and is audited internally; it has not been independently refreshed gate by gate. [Snapshot](data/warzone-snapshot.json), [provenance](research/raw/manifest.json), [map report](research/04-map-data-and-projects.md)

The opening map is not randomized or equalized. Difficulty changes disclosed scenario resources and AI planning parameters, not the actual geographic record. Offer a separately named balanced exercise later if desired.

## 3. Strategic turn and campaign pace

**Proposed standard campaign:** 120 turns × six simulated hours = 30 simulated days. Target 8–12 hours of active play across several evenings. Both targets need playtesting; 120 turns averaging four to six minutes gives that range, including heavier decision turns.

Four watches per day expose time-zone strengths without making the player stay up in real life. A commander issues standing plans across quiet watches and can advance to a relevant event. Nothing advances while the game is closed or the player is thinking.

### One turn

1. **Read the briefing.** New intel, contested systems, expiring promises, expected turnout, ships arriving, SRP arrears, and three or fewer urgent decisions. A map overlay shows what changed and why.
2. **Set priorities.** Choose a principal operation and supporting orders. Negotiate allied commitments. Repeatable tasks retain their previous orders until a stop condition is met.
3. **Commit resources.** Assign actual available pilots and compatible ships; reserve materials, ISK, cargo capacity, and FC time. See the opportunity cost before confirming.
4. **Issue fleet orders.** Route, mission, doctrine, stance, engagement limits, cargo escort, and retreat fallback. Display confidence ranges for observed opposition.
5. **End turn.** All actors start from the same simulation time and world snapshot, using their own observation state. A deterministic event timeline resolves travel, contacts, fights, sites, deliveries, and deadlines within the six-hour window.
6. **Read the consequences.** Ships and cargo lost, objectives completed, LP earned, replacement delay, changes in trust/enjoyment, and the next front. Inspect individual battles if desired.

No simultaneous-turn advantage from processing Caldari first. Industry finishing at 04:00 cannot supply a fleet that departed at 02:00. A convoy lost before reaching its destination cannot satisfy a later reship order. Replaying a turn or loading during resolution cannot award rewards twice.

**Automation is essential.** Recurring orders include defensive plexing, minimum-stock procurement, standing escorts, LP buyback, and local patrols. Stop automatically when stock or wallet thresholds are reached, intel changes materially, the site becomes ineligible, promised support fails, or a loss budget is exceeded. The player sees reservations and can cancel future work.

## 4. The map is the main screen

Retain CCP's actual two-dimensional star positions. Pan, zoom, search, constellation focus, and a jump-distance ruler follow the Risk project's established interaction pattern. At wide zoom, summarize activity; at close zoom, expose fleets and site orders without moving stars to make room for labels.

Four things can coexist in one system and must remain distinct:

- **Faction occupancy:** the formal strategic state.
- **Military presence:** friendly, hostile, neutral, and unknown fleets at particular locations.
- **Access:** which characters can use which stations or player structures.
- **Economic activity:** local stock, production contracts, cargo, and services.

Use overlays for Occupancy, Frontlines, Intel age, Fleet readiness, Supply routes, and Coalition commitments. Do not put six resource meters on every system.

### System inspector

Show name, constellation, region, occupant, contested progress, derived/verified operational state, eligible objective types, known local fleets, available docking/services, local stock, inbound cargo, recent fighting, and commitments. Unknown fields read **Unknown**, not zero.

The observed internal graph has important transit concentrations around Pynekastoh, Hikkoken, and Nennamaila. Those are graph-analysis results, not a ranking of current fighting or political influence. **31 outgoing gates reach 27 external destinations.** Removing Hikkoken–Pynekastoh divides the internal graph into 48 and 42 systems, but this does not establish a blockade across the full EVE transport network. [Reproducible analysis](research/warzone-analysis.json)

A gate camp requires detection, available ships, and an interception opportunity. Capturing occupancy does not delete a gate. High-security access, outside routes, neutral hauling, jump logistics, and shipcasters must be modeled with their own conditions when included.

## 5. Fleets and Civ-style combat

### Fleet formation

A fleet counter is an organized formation, typically **5–25 ships in the initial tuning**, with real hull counts and assigned roles. Larger operations combine formations under an FC. This display grouping is not an EVE fleet-size or site-reward rule.

Track damage hulls, tackle, logistics, EWAR, scouts, FC competence, coordination, ammunition, location, assigned pilots, and reships. A large unbalanced fleet should not automatically defeat a smaller formation that applies damage properly and controls the engagement.

Initial doctrine families:

| Doctrine | Strategic job | Constraints and responses |
|---|---|---|
| Cheap frigate/destroyer teams | Broad coverage, accessible fleets, small sites | Vulnerable to prepared counters; modest staying power |
| Navy small-ship teams | Fight for restricted sites efficiently | BPC/material pipeline and affordability matter |
| Kiting missile or turret cruisers | Control range and disengage | Requires space, competent tackle control, and suitable site access |
| Close-range brawlers | Hold an entry or objective decisively | Can be denied an engagement or controlled at range |
| Drone formations | Flexible pressure and sustained site presence | Drone travel, losses, control, and counterplay matter |
| Battlecruiser support | Heavier eligible sites and force projection | Slower concentration, greater replacement and escort burden |
| Specialist recon/ewar/logistics | Enable an operation or disrupt the opponent | Skill, hull eligibility, supply, and protection constraints |

These are design roles, not final fitted ship stats. Gate eligibility attaches to actual hull categories and the selected ruleset, not a vague strength tier. Any militia can fly hulls of other empires if pilots, skills, market supply, and site rules permit it.

### Orders the player controls

**Mission:** offensive plexing, defensive plexing, battlefield, advantage task, hub assault, reconnaissance, gate interception, escort, training roam, resupply, or reserve response.

**Stance:** evade, skirmish, hold objective, or commit. Stance changes engagement selection, preferred range, willingness to pursue, and exposure; it is not a flat attack/defense bonus.

**Standing limits:** maximum acceptable expected loss, retreat at a hull-loss threshold, do not engage without sufficient logistics, protect cargo over pursuit, and fall back to a named usable staging point.

### How a fight resolves

1. Determine whether fleets actually meet; occupancy alone does not create contact.
2. Check location and acceleration-gate eligibility. Split incompatible ships only if the order authorized a detached formation.
3. Resolve detection, entry timing, tackle, preferred range, and local numerical concentration.
4. Apply damage and support by role and matchup, with bounded seeded uncertainty. Losing tackle or logistics changes subsequent phases.
5. Evaluate each side's standing disengagement conditions. Withdrawal needs an opportunity; a button cannot free a tackled fleet automatically.
6. Resolve surviving ships, repairable damage, destroyed hulls, loot, cargo, site state, and return/reship time.

No permanent pilot death from an ordinary ship loss. Experienced pilots remain in the roster, but clones, travel, personal affordability, frustration, and availability can delay return. Destroyed hulls require replacement; repairing survivors does not recreate them.

Display a forecast such as **Favorable if enemy reinforcements do not arrive; medium confidence** with the observed reasons. Do not reveal an exact hidden enemy fleet or future random roll. The after-action report explains the largest causes: late support, failed tackle, bad range, lost logistics, missing reships, or superior execution.

Multiple actions can happen in a system during a turn. A small fleet can avoid a superior force and seek other eligible sites; an enemy can deny profitable activity without accepting a fight. Preserving this choice is fundamental to FW.

## 6. Territorial war and objectives

Model **capture pressure, advantage, hub vulnerability, occupancy transition, and operational state** separately. A kill is not automatically capture progress. Money is not a substitute for time spent completing eligible objectives.

An offensive campaign therefore has a sequence: establish staging → obtain intel → make room for site teams → sustain pressure → reduce opposition or improve advantage → reach hub eligibility → assemble the required assault → complete the ruleset's occupancy transition → prepare the new front.

Each strategic order may run several site activities during the six-hour turn. The internal scheduler consumes their actual or explicitly calibrated durations, travel, NPC-clear time, interruption, and participant time. It cannot complete unlimited plexes from one fleet assignment. Never translate one click into an unexplained 25% capture increment inherited from the Risk adaptation.

All sites need a versioned catalog: eligible hulls, participant/reward handling, spawn context, time, capture effect, LP effect, and side conditions. Advantage is its own system-level state, with cited modifiers and limits. Exact parameters still awaiting verification are listed in the mechanics report; the game must not quietly hard-code guessed official numbers. [Mechanics and validation gaps](research/01-fw-mechanics.md)

The snapshot's operational-state labels are provisional internal-adjacency calculations. They may not drive a ruleset advertised as verified until external-neighbor behavior is checked. Keep pending occupancy transfers separate from strategic turn completion; the chosen transfer boundary can occur within a watch.

Battlefields should create scheduled concentration and commitment decisions. Shipcasters and insurgencies alter movement or conditions only under a separately identified compatible ruleset. The launch announcement for a patch is not proof that an earlier snapshot already includes its behavior.

## 7. The management game

### The resources that matter

| Resource | What it buys | What it cannot replace |
|---|---|---|
| Corporation ISK | Procurement, SRP, contracts, facilities, buyback liquidity | Pilot willingness or immediate local stock |
| LP, separated by issuer and owner | Eligible redemption and trade pipelines | Instant liquid ISK at a fixed universal exchange rate |
| Ships, fittings, ammo | Actual deployed and reserve fleets | Qualified pilots and a route to the front |
| Materials and blueprints | Production options and economical reships | Factory time, fees, and haulage |
| Pilot-hours and specialists | Manning and execution | Infinite simultaneous tasks from the same person |
| Trust and cohesion | Reliable cooperation and future turnout | A binding order over independent allies |
| Enjoyment and fatigue | Retention, recruitment, and sustainable operations | Guaranteed happiness from winning or cash |
| Intel | Better decisions and response timing | Knowledge of unobserved events |

Display a compact top bar: **available ISK · LP · ready pilots · fitted reships · coalition confidence**. Open drilldowns for ledgers and cohort details. Explain imminent bottlenecks in plain language: “18 pilots can join; only 11 suitable fitted hulls are at staging.”

### Corporation and coalition ownership

By default the player creates their own corporation, while the verified real organizations remain independent NPC actors. The player directly controls their corporation's wallet, hangars, contracts, training, and officers. Allied corporations retain their own resources and priorities. Militia-wide planning communicates requests and agreements, not confiscation.

Personal and corporate resources must remain separate. An alliance budget is earmarked money in identified character/corporation custodian accounts, not a second spendable balance. A pilot's LP is not the leader's bank balance. Transfers need the appropriate supported mechanism and ledger event. An ally may contribute pilots while expecting loaned ships or partial replacement coverage.

### Supply and industry

Use a connected chain: acquisition → storage → production or fitting → cargo assignment → transit → staging → deployment → destruction/repair/salvage. Show the shortest time to a usable fitted replacement, not merely factory completion.

Offer three viable provisioning strategies:

- **Buy and deploy:** fastest when supply and cash exist; exposed to price, liquidity, and hauling risk.
- **Build selected doctrines:** requires inputs, blueprint rights/runs, qualified characters' available manufacturing-job slots, fees, and delivery; can improve cost and resilience. Do not invent a finite universal slot pool for a station.
- **Cooperate:** an allied industrial or logistics organization supplies a contract; reliability depends on capacity and fulfilled terms.

Navy hull provisioning must use the dated LP-store/BPC rules, rather than an invented immediate LP-to-ship exchange. Corporation projects, LP-related services, and replacement support are research-backed management opportunities. [Economy findings](research/03-theory-economy-ai.md)

Start with doctrine shopping lists and batches. The player selects “maintain 20 fitted frigates here”; an expanded view shows actual hulls, modules, inputs, budget, location, and reservations. This keeps a Civ queue readable while preserving the economy underneath.

Markets have limited buy/sell volume, inventory, price response, and settlement timing. Regional or market-wide evidence calibrates ranges; it does not reveal militia wallets. Do not let the player sell arbitrary LP output at a permanent best price or move cargo instantly to a market.

Production jobs reserve or consume inputs once, retain location and expected completion, and cannot reuse the same blueprint run or materials elsewhere. Losses debit actual inventories. SRP reimburses a loss; it does not independently generate a free replacement hull.

### Enjoyment, fatigue, and participation

Simulate cohorts with distinct preferences: new pilots, competitive small-gang pilots, campaign-focused veterans, industrialists, support pilots, and more income-focused participants. These are roles, not permanent labels attached to a real named individual.

Attendance responds to availability, accessible ships, leadership trust, meaningful contribution, anticipated fight quality, personal financial risk, and recent workload. A fun close loss can raise future interest; repeated one-sided wins can become dull. Different cohorts evaluate the same operation differently.

Fatigue accumulates from repeated demand and recovers with rest. Support jobs should earn recognition and material benefit; otherwise the same haulers and FCs burn out while combat pilots collect prestige. Train additional FCs and logistics organizers to reduce dependency on one volunteer.

No universal “fun” slider that buys loyalty. Policies have tradeoffs: cheap doctrine nights widen participation; high replacement coverage attracts more risk; optional fleets preserve autonomy but reduce certainty; mandatory strategic expectations can improve a particular defense while harming retention.

## 8. Politics with real names and logos

Present real alliances and corporations as recognizable actors in the council, diplomacy panel, fleet ownership, and after-action reports. Use real in-game pilot portraits for sourced FC/adviser cameos. Keep faction, alliance, corporation, and character IDs distinct.

There are three identity modes:

1. **Dated historical scenario:** use names and affiliations supported for that campaign, with era-specific assets where available.
2. **Observed opening map with researched cast:** current geography/occupancy plus a clearly disclosed roster whose affiliation evidence may be older. Do not market this as a fully observed September 2026 order of battle.
3. **Verified contemporary scenario:** requires sufficiently fresh organization-level evidence before making current-role claims.

The research package now includes nine contemporary player organizations with explicit ESI faction affiliation, two NPC militia corporations, and five eligible contemporary pilot candidates. This verifies identity and affiliation, not attendance, fleet strength, political influence, or a complete order of battle. Historical entries remain separately eligible. A current ESI logo is not evidence of the logo used in 2017. Save logo URL, identity ID, capture date, file hash, and whether the image is current or historical. A logo refresh must not silently alter saved campaigns. [Typed identity catalog](research/identity-catalog.json)

### Concrete agreements

| Agreement | Terms the player negotiates | Failure consequence |
|---|---|---|
| Joint offensive | System, time window, doctrine, contribution, fallback | Objective delay and lost confidence |
| SRP assistance | Covered hulls, percentage, budget ceiling, settlement time | Arrears, fewer future volunteers |
| Logistics service | Cargo, origin/destination, deadline, price, loss allocation | Empty staging stock or a disputed bill |
| LP buyback | Supported transfer path, quote, volume cap, settlement | Liquidity pressure and reputation loss |
| Staging access | Eligible pilots, services, stock permissions, duration | Longer routes and forced restaging |
| Defensive compact | Trigger, response commitment, maximum exposure | Trust changes based on feasible response |
| Local hostile arrangement | Narrow nonaggression, event, or deconfliction window | Only the consenting organizations are bound |

Political memories record concrete events: aid delivered, support promised and provided, credit shared, unpaid replacement, broken access, and declined requests. A reasoned refusal can be less damaging than accepting an impossible promise.

An enemy militia contains independent actors too. Third-party pirates, neutral suppliers, farmers, and outside allies pursue their own incentives. They are not automatic reinforcements or scripted random punishment.

Real-name AI priorities are **scenario parameters**, not claims about the real person's character. Historical source facts and generated decisions appear in separate panels. Do not generate fake quotations, expose real-world identities, or portray a named player as having committed an undocumented abuse. This preserves a credible historical cast without pretending the simulation is a record of actual behavior. [Political research and candidate roster](research/02-history-politics.md)

## 9. Progression and victory

### Development without a fake invention tree

Use two parallel development tracks:

- **Operational capability:** scout networks, logistics coordination, specialist training, doctrine certification, FC development, production competence.
- **Institutions:** reserve policy, LP services, transparent replacement accounting, new-pilot onboarding, shared staging, coalition planning practices.

Unlocking a capability represents making known EVE practices available to this organization. It requires relevant people, ships, training time, stock, and budget. Larger or more expensive hulls are not a universal upgrade; site access and replacement cost preserve early doctrines.

Examples: a logistics program enables more dependable remote repair formations; an industrial contract enables predictable navy reships; a trained second FC allows two concurrent operations; an open training fleet grows future turnout but uses tonight's attention.

### Standard campaign objective

At campaign creation, publish a **militia mandate**: named strategic objectives, a time horizon, and minimum coalition readiness. The player chooses an offensive or recovery-oriented mandate appropriate to the asymmetric opening map.

Proposed victory model:

- **Decisive victory:** complete the mandate's named military objectives and sustain them through a published holding period while maintaining deployable forces and honored essential contracts.
- **Campaign result at turn limit:** assess objective progress, sustainable readiness, and coalition commitments using disclosed weights. Award a partial result instead of forcing map extermination.
- **Defeat:** the mandate becomes impossible under its rules, or the player's organization loses the means and support to continue after a visible recovery window.
- **Continue sandbox:** optional after the result, with the campaign date, scores, and history preserved.

Industry and diplomacy earn success by sustaining meaningful objectives. They should not become isolated counters that can win while the war is ignored. Later historical scenarios can introduce specific empire campaign objectives with their actual dated definitions.

Bankruptcy need not be instant game over: sell reserves, downship, negotiate credit where explicitly simulated, ask allies, or relocate. Losing the capital/staging system can create an evacuation and recovery chapter. None of these recovery mechanisms guarantees rescue.

## 10. A representative decision

**Illustrative numbers and fictional situation using real geography; not an actual battle report.** A player-backed deployment near Nennamaila has 40 expected available pilots, 24 fitted cheap hulls at staging, eight incoming specialist hulls, and 600M available corporation ISK. An allied group offers 12 pilots if replacements are covered. A target system is near hub vulnerability, but the opposing prime-time watch is next.

The player can:

- Spend the reserve to buy and rush ships, attempt the objective now, and risk a camp and delayed SRP.
- Split into cheap site teams, scout the next watch, and preserve money while risking a defensive reversal.
- Ask the ally to hold nearby pressure while the main force escorts the shipment, trading immediate progress for a stronger follow-up.
- Run an accessible training operation, rest the exhausted specialist cohort, and accept a short-term territorial setback.

Each choice should have a plausible context in which it is best. The result changes stock, pressure, fatigue, trust, future turnout, and enemy expectations. The next turn presents consequences grounded in those changes, rather than an unrelated event card.

## 11. AI opponents and allies

Use independent corporation-level planners under loose militia coordination. Evaluate actions against each organization's agenda, estimates, budget, available pilots, commitments, and operational feasibility. Generate a limited set of legal plans, score them, then simulate a short horizon where useful.

Maintain separate **world state** and **observation state** for every actor. The AI can use public occupancy, its own assets, scout reports, known kills, announced commitments, and uncertain estimates. It cannot read hidden fleets, private orders, future random values, or inaccessible hangars.

Use common tactical rules and economy rules for human and AI. Difficulty adjusts planner quality, coordination reliability, or explicitly displayed scenario assistance. Do not conceal free ships, omniscient interception, or instantly replenished wallets.

Enemy choices must include decline, disengage, defend, raid logistics, spread pressure, consolidate, earn resources, and rest. An AI that attacks every unfavorable fleet is not a plausible FW opponent.

Ally behavior must include accepting, declining, counteroffering, and fulfilling bounded promises. Disagreements should arise from differing capacity and priorities, not random betrayal rolls. The theory report develops public-goods, repeated-game, information, and management models for these behaviors. [Theory, equations, and test hypotheses](research/03-theory-economy-ai.md)

## 12. Interface and player experience

Desktop layout: **map center; selected fleet/system panel on the right; compact resources and watch/date at top; orders and End Turn below; briefing/council accessible from the left**. Diplomacy uses real logos and portraits. Smaller screens switch to focused panes rather than shrinking the whole dashboard.

The main workflow should answer:

1. What is threatened or achievable this turn?
2. What do I have ready, and where?
3. Who will help, and on what terms?
4. What will this order cost or prevent?
5. What happened, and what should I reconsider?

Show maps, queue summaries, short causal explanations, and optional details. Avoid spreadsheet-only play and repeated confirmation dialogs for ordinary orders. Before End Turn, show only blocking errors and material unresolved commitments.

Use the sibling games' locally bundled icon and sound assets where relevant and preserve provenance. Sound starts after interaction, stays optional, and never blocks the simulation. All essential rules and campaign assets must work offline after loading locally; external APIs are an authoring-time data source.

### Save and accessibility requirements

Autosave at stable action boundaries; store the campaign seed, ruleset, content versions, pending orders, inventories, identities, timers, events, and RNG state. Provide manual named saves and import/export. Invalid imports must leave the prior campaign intact. Never advance game time simply because a tab was hidden.

Keyboard access, visible focus, readable contrast, non-color ownership symbols, reduced motion, adjustable audio, and scalable text are required. The event log must remain searchable and bounded in the rendered DOM without losing retained history.

## 13. Release scope and acceptance criteria

### First playable slice

The full real map; both selectable militias; one owned corporation; at least two independent friendly and two hostile organization actors; basic third-party pressure; a focused doctrine catalog; offensive/defensive sites, capture sequence, stocks, shipments, LP/ISK pipeline, replacements, participation, diplomacy commitments, save/load, and a complete short mandate.

The real identities selected for this slice must pass catalog verification. Numbers of actors are an implementation scope choice, not a claim that only those groups fight in the warzone. Background activity represents remaining participants and is bounded and disclosed. The current Caldari catalog contains two corporation/alliance pairs, not four independent forces; the player-created corporation keeps both available as independent allies. A mode taking over one of those organizations would require another verified Caldari group to retain this actor count.

The first slice proves the distinctive chain: **fulfill a logistics promise → improve readiness and trust → field a viable fleet → advance an objective → pay for losses → retain enough support to continue**.

The implementation direction is a browser simulation with declarative actions, requirements, effects, doctrines, and progression inspired by Freeciv's inspected architecture. Direct code reuse remains selective and attributed. [Freeciv code evaluation](research/06-freeciv-evaluation.md), [initial design-as-data pack](design/ruleset-proposal.json)

### Standard release

Expand doctrine variety, advantage operations, battlefield behavior, coalition agendas, markets and production, development tracks, the standard multi-evening mandate, and polished briefings. Any seasonal or insurgency module included must be verified for the pinned ruleset. Missing fidelity-critical features are listed on the scenario selection screen.

### Later extensions

Historical opening maps with independently sourced era geography; richer empire campaign scenarios; advanced jump logistics; deeper neutral-party networks; additional curated casts; more doctrine recipes. Separate tactical battles and multiplayer are outside the chosen product direction.

### Acceptance requirements

| ID | Requirement | Pass condition |
|---|---|---|
| GEO-01 | Geographic fidelity | Exact set of source system IDs and internal edges; no invented gate links |
| DATA-01 | Evidence separation | Every observed field has provenance; unknown private state never appears as measured fact |
| TURN-01 | Fair time | Resource/event ordering is deterministic; processing order cannot choose the winner |
| FW-01 | Territorial causality | Killing ships alone cannot bypass the configured site/hub capture sequence |
| FLT-01 | Real fleet constraints | Ineligible hulls cannot enter a restricted site; pilots and ships cannot double-book |
| ECO-01 | Accounting | All ISK/LP/material/hull changes reconcile to transfers, production, consumption, sinks, or explicit sources |
| LOG-01 | Location | A fleet cannot use cargo before delivery; intercepted cargo cannot be duplicated |
| SOC-01 | Participation | Losses, promises, affordability, preferences, and fatigue can alter future turnout with visible reasons |
| DIP-01 | Independent allies | An ally can legally refuse and counteroffer; accepted terms reserve feasible resources |
| AI-01 | Information fairness | Masking unseen enemy state leaves AI choices unchanged for the same observation and seed |
| CAST-01 | Real cast | Names, entity types, IDs, affiliation dates, logo/portrait sources, and simulation labels are recorded |
| SAVE-01 | Persistence | A save restores exactly, including in-transit shipments and pending commitments |
| UX-01 | Readability | A new player can identify the binding readiness constraint and issue an operation without opening a ledger |
| CAM-01 | Completion | A campaign can produce victory, partial result, recovery, and defeat without deadlock |

Validation scenarios, implementation boundaries, and build sequencing are specified in [the validation and roadmap document](research/05-validation-and-roadmap.md). Exact tuning requires a playable prototype; this research does not claim proven balance or measured human fun.

## 14. Remaining design choices

These do not block the present PRD. Defaults above allow implementation to begin after the mechanics catalog is pinned.

- Whether historical campaigns should ship alongside the latest observed map.
- Whether ordinary strategic turns should resolve simultaneously as proposed or use a more conventional immediate-move structure.
- How much fitted-ship and market detail the default UI exposes; recommendation is doctrine-level queues with drilldowns.
- Which real organizations and named FCs the user most wants featured; only eligible dated roster entries should be promoted into an observed-current scenario.
- Exact opening resources, mandate objectives, time scale, and campaign length after playtesting.

The product should be recognizable as **Civ for EVE Faction Warfare** within the first few turns, and recognizable as **Faction Warfare** in the reasons those turns succeed or fail.
