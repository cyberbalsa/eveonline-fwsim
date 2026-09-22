# EVE Faction Warfare mechanics: evidence and simulation contract

Research accessed 22 September 2026. Target: a persistent, single-player, Civilization-style CalMil–GalMil campaign in which the player commands their corporation and influences independent militia allies. This document distinguishes published mechanics, community observations, unresolved parameters, and proposed abstractions. It is research and a design input, not a claim that a complete EVE rules engine has been implemented.

## 1. Freeze the rules before claiming 1:1 fidelity

Use the project's archived public ESI snapshot from 22 September 2026, approximately 05:11 UTC, as the initial strategic state. It predates that day's usual downtime and announced major update. The saved observation contains 90 eligible systems, 56 occupied by Caldari and 34 by Gallente; these counts belong to that snapshot, not a permanent setup. Preserve its retrieval metadata alongside the scenario.

The reviewed rolling 24.01 patch page was last updated 21 September. A 15 September announcement schedules another update for 22 September; the announcement alone does not establish which changes had deployed when the snapshot was observed. Store the announced insurgency changes in a separate, disabled rules overlay until deployment is verified. [24.01 notes](https://www.eveonline.com/news/view/patch-notes-version-24-01), [22 September announcement](https://www.eveonline.com/news/view/major-update-force-projection-revamped).

The minimum reproducibility record is: scenario timestamp; universe/SDE version; systems and gate edges; occupancy snapshot; ruleset identifier; ordered patch overlays; source provenance; explicitly assumed parameters; random seed. Save this record with every campaign. Later EVE patches must not silently change an existing save.

“1:1” should mean exact named systems, actual gate connectivity, factions, initial ownership, and documented strategic incentives. A turn-based game cannot reproduce every live pilot, human decision, second-by-second movement, or undocumented server rule. Label the temporal compression and NPC decision model as simulation choices. Offer historical and contemporary scenarios as separate profiles, rather than blending their rules.

## 2. Changes that invalidate many otherwise useful guides

| Effective date / source | Finding | Design consequence |
| --- | --- | --- |
| 8 Nov 2022, Uprising | Frontline/Command Operations/Rearguard topology replaced the old incentive structure. | Recalculate system roles from the map state. |
| 14 Mar 2023, Allegiance | Direct enlistment and separation of the two empire wars. | Corporation membership is not identical to militia identity. |
| Aug 2023 iteration | Rearguard LP multiplier became 0.01. | Do not implement the older 0.5 value. |
| 2025 Catalyst period | Defensive plexing acquired hostile NPCs and equal LP under specified system states. | Unfitted passive defenders and contested-percentage reward penalties are obsolete. |
| June–July 2026 | Seasonal complexes appeared; the experimental battlefield loot model was then reversed. | Apply July corrections to June launch content. |

The official support article, despite a May 2024 update label, still describes rearguard rewards as 50%, the older empire-alliance pairing, and overly generic five-person rewards. Its propaganda description also conflicts with the Uprising patch notes. Treat it as orientation, not an executable specification. [Support article](https://support.eveonline.com/hc/en-us/articles/203209072-Factional-Warfare).

EVE University's main page also mixes updated and historical material: a current-sized VP table coexists with statements that all plexes award equal VP, old tier examples, and pre-Catalyst defensive instructions. Its strategy page explicitly warns that navigation and plex details need updating. Resolve each claim individually against dated patches. [UniWiki mechanics](https://wiki.eveuniversity.org/Faction_warfare), [UniWiki strategy warning](https://wiki.eveuniversity.org/Faction_warfare_strategy_and_tactics).

## 3. Geography, operational depth, and supply access

Frontline systems border enemy-controlled systems; Command Operations systems border a frontline; the remaining systems are Rearguard. Frontlines concentrate opportunities and use a 1.5 LP multiplier; Command Operations use 1.0. The changing border is part of the gameplay, not a fixed map decoration. [Uprising launch](https://www.eveonline.com/news/view/uprising-expansion-now-live).

The August 2023 rebalance reduced Rearguard LP to 1% of base, increased battlefield VP from 500 to 2,000, and broadened advanced-site availability. The stated intent was to reward commitment and concentrate fights. It also expanded individual LP donations to player corporations. [FW iteration](https://www.eveonline.com/news/view/feedback-and-iteration-factional-warfare).

Uprising removed these eleven systems from capturable FW: Intaki, Vey, Brarel, Annancale, Agoze, Ostingele, Harroule, Dastryns, Uphallant, Iges, Covryn. Its docking rule allows either militia to use frontline stations; private structures still require access permission. In hostile Command Operations/Rearguard, docking, undocking, and tethering are limited to capsules. [Uprising patch](https://www.eveonline.com/news/view/patch-notes-version-20-10).

Intaki reached security 0.6 in March 2023. Caldari–Minmatar and Gallente–Amarr ceasefires removed those cross-war hostilities and former-allied-warzone capture privileges. [Allegiance patch](https://www.eveonline.com/news/view/patch-notes-version-21-03).

**Proposed Civ-style interpretation.** Systems are persistent map nodes connected by actual gates. Ownership, control pressure, safe access, intelligence, and stockpiles are separate attributes. A fleet can travel through an enemy system without owning it. Capturing a node must not automatically destroy, teleport, or transfer every player asset there. A changing frontline can isolate usable stockpiles, creating evacuation and recovery decisions. Retain noncapturable routes and highsec hubs as logistics geography even if they sit outside the 90-node conquest layer.

A captured system can improve access while simultaneously dispersing profitable combat. Evaluate both effects. Expansion should alter how far fleets must travel, which sites exist, and where allies want to deploy. Validate how non-FW neighbouring systems affect live frontline calculation before using a simplified induced graph: topology fidelity requires the surrounding universe, not only a list of capturable systems.

## 4. Capture is a contest of presence, with a separate hub assault

The archived ESI observation independently confirms a 75,000-VP threshold in all 90 systems at the snapshot time. [Observed roster and audit](04-map-data-and-projects.md). Community documentation describes the subsequent hub assault and post-downtime ownership change. Defensive captures can remove vulnerability and reset hub damage. Ordinary capture requires presence within 30 km; extra friendly ships do not accelerate the timer. Leaving pauses progress; the opponent must unwind accumulated progress. The buffer, exact transfer timing and timer details still need client corroboration. [UniWiki capture reference](https://wiki.eveuniversity.org/Faction_warfare).

**Proposed state machine:** stable → contested → vulnerable → hub defeated / transfer pending → new occupier. Defenders can move contested or vulnerable states backward before hub defeat. Record hub outcome separately from occupation. Model attacks on the hub and defense of in-system complexes concurrently: a commander committing every ship to the hub should risk losing the prerequisite control pressure.

Use three ledgers:

- **VP / contested state:** progress toward local sovereignty transfer.
- **Advantage:** preparation that changes the efficiency of relevant capture work.
- **LP / ISK / physical assets:** private and organizational rewards and resources.

Do not give ordinary kills automatic territory movement unless the selected ruleset explicitly supports that transaction. A combat win matters because it denies objective access, destroys equipment, interrupts reinforcement, and changes willingness to contest. The label “victory points” is used inconsistently in older patch prose; it is not sufficient evidence that killmail value should feed the system's capture meter.

For a large strategic turn, evaluate objective work internally in smaller event steps. Fleet arrival halfway through a turn must not receive a full turn of capture work. Resolve interruption, withdrawal, reinforcement, and hub vulnerability changes in chronological order. The player need not click through empty timer ticks.

## 5. Plex eligibility, timers, and rewards

Ordinary names encode size, technology eligibility, and reward scaling. NVY admits T1/navy, ADV extends access to T2/pirate; Open lacks the acceleration gate. Size categories constrain hulls, independently of fitting price. Uprising removed warzone reward tiers. Propaganda raises friendly advantage; listening outposts and destroying enemy depots reduce enemy advantage; Operation Centers provide inputs for deployables. [Uprising patch](https://www.eveonline.com/news/view/patch-notes-version-20-10).

The current militia-authored plex guide gives this compact baseline. Its values are corroboration candidates, not a substitute for patch-specific gate tests. The number in a site name is a payout cap, not a cap on ships entering. [Militia plex guide](https://my.minmatar.org/learning/guides/faction-warfare-plexing/).

| Ordinary site | Nominal minutes | Base LP, solo variant | Base VP |
| --- | ---: | ---: | ---: |
| Scout NVY | 10 | 10,000 | 25 |
| Small NVY | 10 | 15,000 | 50 |
| Small ADV | 10 | 17,500 | 75 |
| Medium NVY | 15 | 20,000 | 150 |
| Medium ADV | 15 | 25,000 | 175 |
| Large NVY | 15 | 25,000 | 250 |
| Large ADV | 15 | 25,000 | 300 |
| Open | 15 | 30,000 | 350 |

T3 eligibility has exceptions; validate exact hull/site combinations. The guide's Small NVY-2 frontline LP has an arithmetic discrepancy: calculate multipliers from authoritative base data.

A later patch set multiplayer caps to 2 for Scouts/Smalls, 3 for Mediums, 4 for Larges, and 5 for Opens. It also required at least three minutes inside a battlefield within 200 km of its entrance beacon for LP eligibility. Direct-enlistment retirement in a ship in space was disallowed in December 2024. [22.02 patch notes](https://www.eveonline.com/news/view/patch-notes-version-22-02).

**Proposed allocation rule:** distinguish entrance eligibility, capture contribution, and reward eligibility. Use an event's verified reward pool and eligible participants; do not reward a whole militia because one fleet completed a site. An overstaffed site can be tactically secure yet financially inefficient. “Split fleet” therefore becomes a meaningful map order, with a coordination penalty and vulnerability to defeat in detail.

**2026 seasonal overlay.** June launch parameters, before later corrections:

| Site | Spawn area | Minutes / respawn | Base LP / VP |
| --- | --- | --- | --- |
| Scout BSC-1 | Frontline | 5 / 10 | 7,500 / 50 |
| Moderate NVY-3 | Frontline | 15 / 40 | 35,000 / 600 |
| Field Research ELT-10 | Frontline | 10 / 60 | 30,000 / 300 |
| Small Interceptor-1 | Command Operations | 10 / 40 | 25,000 / 150 |

BSC restricts entry to T1 attack/combat frigates; the battlecruiser site enhances hull skill bonuses. Research permits T3 destroyers and has random room effects. [Seasonal design preview](https://www.eveonline.com/news/view/cradle-of-war-in-focus). These replace frontline Medium/Small group sites during the season. [Cradle launch notes](https://www.eveonline.com/news/view/cradle-of-war-expansion-notes).

On 1 July, Research became ELT-5; NPC counts/respawns changed and tactical destroyers gained +500 shield, armor, and structure in the room. The June battlefield experiment was reverted: no reward freighters, LP returned from 50,000 to 150,000. Therefore the pre-downtime September profile should not contain the June freighter/bubble reward model. [1 July corrections](https://www.eveonline.com/news/view/patch-notes-version-24-01).

**Proposed seasonal handling:** objective templates belong to rulesets. The map's objective generator checks system state, active season, static/roaming type, and respawn event. Avoid adding all historical plex variants at once; that would inflate VP production and reduce encounter concentration. Save partially completed objectives and their cooldowns.

## 6. Defensive gameplay now requires combat readiness

Catalyst introduced NPCs from both sides in most ordinary complexes; they contest progress, and some tackle player ships. It also added mining incentives around empire war HQs, including Onnamon and Intaki, explicitly to support local production and markets. [Catalyst expansion notes](https://www.eveonline.com/news/view/catalyst-expansion-notes).

On 20 November 2025 defense received the same LP as offense: the old 25% reduction and contested-percentage scaling were removed. On 24 November, stable-system defensive LP was removed. In 2026, promotion-derived standings penalties ended on 17 February; mission-standing penalties were removed in stages, with levels 2–3 addressed on 16 April. [23.02 dated patches](https://www.eveonline.com/news/view/patch-notes-version-23-02).

**Design implication:** run defense as an active assignment requiring suitable ships, pilot time, and contested space. It can be paid and attractive without creating an infinite safe-income button. Separately model strategic defensive demand: an ally may ignore a threatened backwater even when profitable because travel, enemies, or boredom make another assignment preferable.

## 7. Advantage creates operations beyond fleet fights

Militia practice describes two local advantage totals and a net difference. Rendezvous sites raise friendly advantage; propaganda does likewise; listening outposts reduce the enemy total. Approximate observed effects are 2% per rendezvous/deployable and 15% per battlefield. Exploration yields deployable inputs. Exact caps, geography contribution, decay, payout, and additive/multiplicative treatment require validation. [Militia advantage guide](https://my.minmatar.org/learning/guides/faction-warfare-advantage/).

The 22.02 notes doubled deployable effectiveness and Operation Center input drop rates. Thus a pre-Revenant one-percent deployable model would be stale. [22.02 balance changes](https://www.eveonline.com/news/view/patch-notes-version-22-02).

**Proposed operations chain:** assign scouts/explorers → acquire codes → convert or source deployables → transport → deploy and defend → obtain local efficiency benefit. Interdiction can interrupt any physical stage. A logistics contract creates opportunity rather than immediately raising a global war score.

Track each side's local preparation separately. This supports a different decision at mutual saturation: raising your own already capped total is wasteful, while reducing the enemy's becomes useful. Do not silently turn every advantage action into additive capture VP; preserving the distinction gives intelligence and industry an indirect strategic role.

For planning, compute expected VP per scarce fleet-hour. An advantage operation is worthwhile when its cost is exceeded by the extra future capture progress it enables before counteraction or redeployment. Display a forecast with assumptions and uncertainty, not an inscrutable “+war effort” number. This is a proposed evaluation method, not a verified server formula.

## 8. Battlefields are control-point operations, not annihilation arenas

The militia battlefield runbook describes three 30-km capture spheres, separate faction landing beacons, NPC interference, and approximately 30–45-minute clean completions. Its suggested jobs are point holders, remote repair, projected damage, tackle, and electronic support. It reports approximately three-hour respawns and two battlefield streams across its warzone; verify the Caldari/Gallente timing before adopting those constants. [Militia battlefield guide](https://my.minmatar.org/learning/guides/faction-warfare-battlefields/).

The original designer commentary describes battlefields as organized fleet content and identifies both excessive battlefield dominance and passive reward collection as design concerns. This is evidence of intended incentive tension, not proof of today's exact parameters. [CCP design commentary](https://www.eveonline.com/news/view/factional-warfare-overhaul).

**Proposed Civ-style battle model:** a battlefield is an operation attached to a system, with three persistent control objectives during its resolution. The commander chooses stance, division of roles, approach, primary-target priority, and withdrawal threshold. A defensive formation can preserve the force while losing points; a point rush can succeed at high casualty cost; a gate screen can delay reinforcements without winning the entire fight. Losing the scoreboard need not imply all ships died.

Simulate both sides' support dependencies. Killing or driving off a repair wing changes the survival of holders; disrupting range changes applied damage; neutralizing capacitor can force withdrawal. Reinforcement arrival is constrained by map travel and staging availability. The player's fleet should not pause the rest of the war while a battlefield resolves.

For a strategy-first first release, present a detailed battle forecast and event summary, with optional stance intervention, rather than requiring manual ship piloting. This preserves the FC decisions while avoiding hundreds of repetitive tactical clicks over a multi-evening campaign.

## 9. Enlistment, income, and corporation management

Direct enlistment lets an individual retain their corporation; corporations can whitelist acceptable factions. The 2023 system included a 24-hour reenlistment cooldown. [Allegiance notes](https://www.eveonline.com/news/view/patch-notes-version-21-03).

June 2026 corporation enlistment requires members above -5 faction standing; falling below triggers a downtime warning and 24-hour correction window, with CEO exceptions that can remove the organization from FW. Overall corporate/alliance 0.00 standing requirements remain. [Cradle enlistment rules](https://www.eveonline.com/news/view/cradle-of-war-expansion-notes).

The March 2026 policy increased friendly-fire standings penalties inside FW sites and reduced them outside. It explicitly discusses conflict over passive LP collection by same-militia pilots. This proves that faction membership and cooperative behaviour are different variables. [Standings and awoxing update](https://www.eveonline.com/news/view/standings-and-awoxing-update).

Viridian introduced adjustable corporation LP taxation; subsequent iteration expanded donations. [Corporation LP update](https://www.eveonline.com/news/view/feedback-and-iteration-factional-warfare).

**Proposed economic model:** retain pilot wealth, corporate wallet, LP balances, replacement obligations, liquid inventory, production jobs, and transport availability separately. LP is purchasing power in a specific store, not instantly spendable ISK. A conversion should consume the recipe's required LP, ISK, items/tags, and possibly blueprint manufacturing inputs; the output must then be sold or fitted and transported. Market depth and delivery time matter more than a universal fixed LP exchange rate.

Industrial capability should determine sustained replacements, doctrine stock availability, and deployable supply. More expensive fleets require more working capital and expose more material to loss; cheap fleets can preserve operational tempo. Goods in the wrong staging station are not equivalent to goods ready at the frontline. A destroyed hauler may therefore matter more than a larger combat killmail.

Use configurable ship-replacement policy, LP taxes, buyback offers, doctrine subsidies, and contract priorities. These policies trade treasury strength against individual participation. They should not command independent corporations automatically: offer incentives, negotiate commitments, and let allies decline or divert their pilots.

Treat morale/fun as inferred human behaviour, not a literal EVE stat. Model participation response to travel, waiting, repetitive chores, understandable purpose, wins, affordable losses, social belonging, and trust in reimbursement. Distinguish a painful but meaningful defense from a boring safe farm. Avoid teaching the player that fun can be purchased with one slider independently of the operation schedule.

## 10. Shipcasters, insurgencies, and external pressure

Empire shipcasters deploy pilots one way from HQ toward a constructed warzone beacon. The 2023 introduction specified up to three linked destinations, destructible exit beacons, no usage fee, and player construction inputs. Those published destination-cycle and reinforcement timings are historical candidates, not verified September 2026 constants. [Shipcaster introduction](https://www.eveonline.com/news/view/introducing-the-interstellar-shipcaster).

**Simulation use:** treat a shipcaster as a directed deployment edge with availability and destination risk. It is not a free return route or a universal freight network. A newly delivered ship still requires a valid route home, replacement stock, and access. Constructing and defending a useful exit should compete with other corporation spending.

Pirate insurgencies add corruption/suppression objectives and a pirate forward operating base, connected to Zarzakh by shipcaster. Pirate victory depends on corrupting enough systems; empire victory depends on reaching the required suppression condition and destroying the FOB. The support article has an ambiguous vulnerability sentence, so it should not define the precise FOB state machine. [Pirate insurgency support](https://support.eveonline.com/hc/en-us/articles/11159823457052-Pirate-Insurgencies-and-Aligning-with-Pirates).

The scheduled September update announces shorter conflicts, more directed spreading, shorter FOB reinforcement cycles, reward reweighting toward completion, and a battlecruiser site at corruption stage two or above. It provides no complete numeric table. [Major update announcement](https://www.eveonline.com/news/view/major-update-force-projection-revamped).

**Simulation use:** Guristas-aligned actors and independent pirates are separate from the two militia factions. Corruption changes local risk and incentives without automatically transferring empire ownership. CalMil and GalMil can both be distracted by the same incursion, yet retain their war against each other. Model temporary common interest as diplomacy rather than a permanent merged team. Leave exact suppression bonuses, bubble permissions, and FOB phase timings as explicit validation items; do not assume ordinary lowsec rules apply at every corruption stage.

Military Campaigns launched as seasonal objectives spanning mining, manufacturing, hacking, missions and PvP, with faction rewards and lasting narrative outcomes. They are broader than the capturable warzone. [Military Campaigns support](https://support.eveonline.com/hc/en-us/articles/27857397762588-Military-Campaigns).

**Simulation use:** if the selected era includes them, implement campaign requests as optional competing objectives with deadlines, contributions, and political rewards. They must not quietly replace territorial warfare with a generic quest bar. A campaign may help the empire's longer-term position while diverting ships from the current siege.

## 11. Fleet commander decisions to preserve

The militia fleet guide documents doctrines, staging, fleet broadcasts, primary targets, logistics watchlists, and separate wings/squads; it also warns that doctrine fits change regularly. These are organizational practices, not racial restrictions. [Fleet practice](https://my.minmatar.org/learning/guides/new-player-fleet-guide/).

The EVE University strategy material supports stocking replacements near operations and choosing ships for engagement conditions; it explicitly notes that any militia can fly any racial hull. Its dated mechanics should not be imported with this broadly applicable advice. [Strategy reference](https://wiki.eveuniversity.org/Faction_warfare_strategy_and_tactics).

Represent a doctrine by purpose and dependencies: effective damage by range and target size; tank/resists; speed and tackle; remote repair compatibility; electronic warfare; capacitor endurance; ammunition/reload; fitting and skill accessibility; replacement cost and stock. Do not give Caldari a compulsory missile-only army or Gallente a compulsory blaster-only army.

The proposed order vocabulary should cover:

1. Scout, shadow, screen, travel, escort, and intercept.
2. Offensive plexing, active defense, advantage operation, battlefield commitment, and hub siege.
3. Split across sites, concentrate, hold reserve, reinforce, and reship.
4. Brawl, hold range, kite, delay, disengage, and withdraw along a chosen route.
5. Target damage ships, repair ships, tackle, or objective holders, with the forecast explaining tradeoffs.

Retreat is an order with conditions and consequences. Fast untackled ships should escape more reliably; a slow committed wing may sacrifice ships to extract the rest. Withdrawal loses presence and possibly morale, but can save scarce pilots' fitted hulls and return sooner. Account for late orders and missing intelligence. The AI must also retreat when the expected gain cannot justify its losses.

Independent allies should have goals, operating hours, financial constraints, doctrine preferences, and reliability estimates. Their commitments are forecast contributions, not guaranteed free units. Restrict perfect information to the player's own corporation; estimate enemy force and allied attendance with confidence intervals that improve through scouts and relationships.

## 12. Real mechanic → faithful abstraction

All entries in the right column are proposed design choices derived from the evidence above, not claims about EVE's internal implementation.

| Real mechanism | Proposed persistent-strategy representation |
| --- | --- |
| Stargates and named systems | Exact graph; movement costs from travel assumptions, with explicit special edges. |
| Dynamic system role | Recomputed site availability, income, and access after occupation changes. |
| Timed plex occupation | Event-stepped control work inside a larger player turn. |
| Hull eligibility | Operation eligibility matrix, never a blanket “bigger wins” rule. |
| Group reward scaling | Distinct per-pilot earnings and force allocation incentives. |
| Active NPC defense | Minimum combat readiness and interruption risk for every capture assignment. |
| Vulnerable hub | Parallel siege and anti-defense assignments, then pending transfer. |
| Advantage preparation | Local two-sided efficiency state and supply-backed supporting operations. |
| Battlefields | Multiple control points with holding, damage, screen and repair roles. |
| Station access changes | Usable versus trapped stockpiles; emergency extraction and restaging. |
| LP taxation and conversion | Treasury policy plus physical procurement, manufacturing and trade. |
| Independent militia corps | Negotiated support, divergent interests, and voluntary attendance. |
| Real pilot availability | Participation schedules and fatigue, with transparent abstraction. |
| FC doctrine and engagement calls | Stance, primary selection, reserves, escalation and withdrawal. |
| Ship loss and reshipping | Persistent material attrition and time to return to useful strength. |
| Insurgency overlay | Separate pirate state affecting route safety and strategic attention. |
| Seasonal campaign objectives | Dated optional requests and historical outcome records. |

## 13. Validation gate for a 1:1-labelled ruleset

Do these checks before presenting any exact mechanics as live replication. This is a rules research checklist, not a request for permission or an implementation plan.

- [ ] Archive the observed ESI state, HTTP dates, selected SDE release and ruleset identifier.
- [ ] Verify the 90-system membership against the snapshot, including exclusions and all boundary gate connections.
- [ ] Compare computed frontlines/Command Operations/Rearguard with observed client states, including non-FW neighbours and islands.
- [x] Confirm the snapshot's per-system capture thresholds: all 90 observed values are 75,000. Retain per-system values rather than assuming a permanent global constant.
- [ ] Confirm VP for each active site, advancement under each net-advantage state, rounding, cap, and buffer above vulnerability.
- [ ] Confirm hub invulnerability restoration, damage reset and ownership-transfer timing at downtime.
- [ ] Test exact allowed hulls in BSC/NVY/ADV/ELT/Open/Battlefield, especially T3, support frigates, and unusual factions.
- [ ] Confirm empty-site pause, contested-site pause, reversal, tackle and cloak restrictions, and eligibility for reward on completion.
- [ ] Validate static versus roaming respawns and apply seasonal replacements rather than adding duplicate site families.
- [ ] Apply the July ELT-5 and battlefield reversions; exclude June reward freighters from the September pre-downtime profile.
- [ ] Confirm defensive LP equality only in eligible nonstable states, plus rearguard 0.01 and suppression modifiers.
- [ ] Confirm group reward caps and current battlefield presence/range eligibility; do not assume a gate population cap.
- [ ] Confirm local/geographic advantage components, cap, decay, each objective delta, deployable inputs and limits.
- [ ] Verify NPC resistance and behaviour with current patches; the militia battlefield guide still lists old racial weaknesses after June's omni-resistance change.
- [ ] Confirm station/structure access after frontline transitions, and retain private structure ACL restrictions.
- [ ] Verify current LP recipes, tags, blueprint runs, manufacturing inputs and market friction before calibrating income or replacement costs.
- [ ] Distinguish corporation LP taxes, personal balances, donations, loot, NPC insurance and player ship-replacement policy.
- [ ] Confirm enlistment/retirement/corporation-standing rules by era, without making militia loyalty override corporation identity.
- [ ] Verify current shipcaster destinations and schedule; separate empire shipcasters, pirate routes, and new-player shipcasters.
- [ ] Confirm all corruption/suppression effects and FOB timers before activating insurgency rules; keep the announced September update separate until deployed.
- [ ] Preserve saves across sessions with objective progress, production queues, travel, commitments, morale, intelligence age, and random state.
- [ ] Calibrate compressed turn duration to observed replacement and system-capture pacing; document the scaling factors.
- [ ] Simulate adversarial play: all-force blob, infinite safe defense, income-only farming, perpetual stalling, repeated retreat, cheap-ship flooding, and overtaxing allies.
- [ ] Review the model with both CalMil and GalMil participants. Treat disagreements as testable hypotheses or contrasting incentives, not evidence that one side is irrational.

The unresolved items are deliberate boundaries on fidelity. A strong first game can preserve EVE's causal structure—presence, access, preparation, money, replacements and cooperation—while clearly identifying which numeric details still require verification.
