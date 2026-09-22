# Game theory, economy, management, and AI for a Civ-style FW campaign

Research date: **22 September 2026**. Companion to [the PRD](../PRD.md). Opening rules must match the supplied **pre-downtime 22 September observation**; later patches require a separate profile. This document proposes simulation design, not an implemented or calibrated model. Source metadata and qualifications are in [the source register](theory-sources.json).

The strongest design is a game about converting **voluntary participation, liquid money, delivered ships, and credible commitments** into sustained pressure. Territory matters because it changes operations and access. It should not print a generic income or research yield merely because a map tile changes color. The player leads an organization inside a militia; independent allies retain their own objectives, inventories, and right to decline.

## 1. What the research supports

The following paragraphs distinguish published findings from our proposed applications. The mathematical and behavioral literature does **not** estimate EVE militia personalities, turnout, doctrine effectiveness, or optimal tax rates.

### Cooperation and independent allies

**Formal theory.** In repeated games, future consequences can support cooperation that would not be individually attractive in a one-shot interaction. In the illustrative infinitely repeated prisoner's dilemma with perfect monitoring, payoffs `T > R > P > S`, and permanent reversion to mutual defection, cooperation is supportable when `δ ≥ (T−R)/(T−P)`. This is a model-specific incentive condition, not a universal threshold for coalition survival. Changing states, finite horizons, altruism, and imperfect information change the analysis. [Jonathan Levin, Repeated Games I](https://www.web.stanford.edu/~jdlevin/Econ%20286/Repeated%20Games%20I.pdf) [TH-01]

**Formal qualification.** Privately observed evidence complicates coordination on rewards and punishments. A missed rendezvous observed by different parties is not equivalent to a commonly observed intentional defection. [Levin, Repeated Games III](https://web.stanford.edu/~jdlevin/Econ%20286/Repeated%20Games%20III.pdf) [TH-02]

**Behavioral evidence.** Fischbacher, Gächter, and Fehr found heterogeneous contribution patterns in a laboratory public-goods experiment, including conditional cooperation and free riding. Their sample proportions must not become the population mix of either militia. [Original study, University of Zurich copy](https://www.econ.uzh.ch/dam/jcr%3Affffffff-9758-127f-0000-00003449356a/ArePeopleCondCooperative.pdf) [TH-03]

**Institutional evidence.** Ostrom's research describes durable arrangements with multiple decision centers and context-dependent institutional practices; she explicitly cautioned that her principles were not one universal prescription. [Ostrom's own interview](https://www.nobelprize.org/prizes/economic-sciences/2009/ostrom/164465-ostrom-williamson-interview-transcript/) [TH-04]

**Design application.** Give alliances conditional offers: “we can supply 12 cruisers during the next watch if you cover replacement losses and protect our staging.” Track who promised what, to whom, by when, with which escape conditions. Allow counteroffers, partial performance, renegotiation, and evidence-based forgiveness. Maintaining trusted cooperation should sometimes beat forcing an extra immediate capture. A campaign ending on turn 120 can still value successor readiness and honored commitments through an explicit terminal score; do not pretend this proves equilibrium cooperation in a finite game.

**Illustrative public-goods model, not an EVE rule:** `u_i = y_i − c_i + (r/n) Σ_j c_j`, where an actor contributes `c_i` from an endowment `y_i` and `1 < r < n`. A contribution helps the group more than it privately returns to its contributor. Territorial security can resemble this incentive problem, while finite plex rewards and contested access are congestible resources rather than pure public goods. Our simulation therefore needs both collective campaign benefits and personally earned income. Coalition bargaining must account for who receives each benefit rather than applying this equal-sharing toy equation literally.

### Incentives and invisible work

**Formal theory.** Holmström's work on multitasking explains why strong rewards for easily measured output can distort effort away from important work measured less well. Incentives must be assessed across the agent's competing tasks. [Holmström's prize lecture, section IV](https://www.nobelprize.org/uploads/2018/06/holmstrom-lecture.pdf) [TH-05]

**Design application.** An LP-only incentive can attract farming while leaving scouting, defensive plexing, hauling, logistics ships, and FC training undersupplied. A kills-only reward can incentivize abandoning an objective. Offer bounded corporation projects and recognize delivery, timely attendance, useful scouting, and survival of the supported fleet. Avoid “repair points” paid for self-inflicted damage and delivery contracts fulfilled repeatedly by circulating the same item. The preferred task depends on preferences, marginal benefit, risk, and available time; a pilot earning money is not inherently disloyal.

### Information and politics

**Formal theory.** Crawford and Sobel model strategic communication between parties with imperfectly aligned preferences. Under their assumptions, informative but incomplete communication is possible, and greater alignment can permit more informative communication. This does not imply that every claim is false or that an expensive signal is always truthful. [Original Econometrica paper](https://www.haverford.edu/sites/default/files/CrawfordSobel1982.pdf) [TH-06]

**Design application.** Separate public announcements, direct scout observations, opponent estimates, and commitments backed by reserved assets. A stated offensive is less informative than observed staging and paid hauling, but these still permit feints. A corporation may sincerely report availability that later changes. Display observation age and confidence. Social trust affects how reports are weighted; it must never reveal hidden world state.

### Fun, attendance, and burnout

**Behavioral evidence.** Ryan, Rigby, and Przybylski's four studies connect perceived autonomy, competence, and relatedness with enjoyment and subsequent play. Their paper supports considering several motivational dimensions; it does not supply EVE-specific burnout rates or prove that NPC relationships reproduce human friendship. [Original paper](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf) [TH-07]

**Design application.** Simulate distinct cohort preferences: beginners seeking manageable losses, experienced combat pilots, industrialists, scouts, income-focused pilots, and organizers. These are scenario archetypes available on both sides, not psychological claims about named players. Some enjoy a narrow doctrine and repeated practice; others prefer variety. An exciting loss may preserve attendance, while a boring victory may not. Count waiting, repeated emergencies, unfulfilled SRP, lack of meaningful choice, and appreciation separately. The real player's enjoyment must be measured through playtests rather than inferred from the simulated satisfaction meter.

### Logistics and force concentration

**Operations research.** Wood formulates network interdiction as allocating limited disruption resources against an adversary's achievable flow. The general problem is computationally difficult; centrality alone does not solve it. [Wood, Deterministic Network Interdiction](https://calhoun.nps.edu/bitstream/handle/10945/36730/WoodDetNetInt93.pdf?sequence=3) [TH-08]

**Combat modeling.** Atkinson, Kress, and MacKay examine how targeting, deployment restrictions, and withdrawal thresholds change Lanchester-style conclusions. The elementary square law assumes conditions that need not hold in a fleet engagement. [Original paper, author-hosted copy](https://faculty.nps.edu/mpatkins/docs/lanchester.pdf) [TH-09]

**Design application.** More ships should usually improve fighting ability, but gate eligibility, availability, arrival timing, target application, remote repair, and retreat change the outcome. A site's reward count is not automatically a hard combat participation cap. There is no arbitrary “too many ships” damage penalty to manufacture balance. Concentration costs coverage elsewhere, travel time, coordination, and higher exposure. Raiding an actual convoy has an economic consequence; coloring a system hostile does not destroy its stargates or automatically close every trade route.

## 2. Real EVE economy anchors and version traps

| Verified source fact | Consequence for the model |
| --- | --- |
| LP are associated with the issuing corporation and spent in its store. | State Protectorate LP, Federal Defence Union LP, and other issuers have separate ledgers; there is no universal militia cash pool. [CCP LP help](https://support.eveonline.com/hc/en-us/articles/14141831188636-Loyalty-Points) [EV-01] |
| Viridian introduced corporation LP income; the July 2026 ESI update exposes a distinct LP tax field alongside the ISK rate. | Model separate taxes and holders. Taxes transfer earnings; they do not duplicate them. [Viridian notes](https://www.eveonline.com/de/news/view/viridian-expansion-notes) [EV-02], [ESI update](https://developers.eveonline.com/blog/a-splash-of-color-corporation-palette-and-a-few-fresh-fields) [EV-03] |
| Havoc temporarily disabled LP donations; the 20 February 2024 update restored character-to-corporation and corporation-to-corporation donations. | Preserve the enable → pause → restore chronology. Donations and negotiated LP transfers are valid management channels under the restored rule, with separate ledgers. Do not invent a donation tax from an announcement that merely contemplated one. [Havoc notes](https://www.eveonline.com/news/view/havoc-expansion-notes) [EV-05], [February 2024 restoration](https://www.eveonline.com/news/view/havoc-update-lp-trading-and-ship-balance) [EV-12], [dated patch entry](https://www.eveonline.com/news/view/patch-notes-version-21-06) [EV-13] |
| Equinox removed ship hull offers from LP stores and introduced project contributions for ship loss and LP earnings. | Navy supply uses relevant BPCs and manufacturing or market purchases. SRP and corporation LP buyback are appropriate management actions. [Equinox notes, Corporation Projects and LP Stores](https://www.eveonline.com/news/view/equinox-expansion-notes) [EV-06] |
| Manufacturing consumes materials/components using a blueprint; inputs must be at the job location, and blueprint quality and facility costs matter. Facilities do not have a universal finite job-slot pool. | Production queues must represent owned blueprint rights, skilled characters' concurrent-job limits, time, and material access. A Civ-like queue is an interface abstraction, not a claim that EVE factories accept one job at a time. [CCP Manufacturing](https://support.eveonline.com/hc/en-us/articles/203210292-Manufacturing) [EV-07] |
| Corporation projects can reward capturing/defending complexes, manufacturing, scanning, and remote repair. | Economic policy can purchase useful activity, with a funded budget and precise completion conditions. [Stronger Organizations](https://www.eveonline.com/news/view/stronger-organizations) [EV-04] |
| The August 2026 MER, published 9 September, supplies raw economic data and reports differing price-index movements. | Use dated economic series to calibrate background supply shocks, not to invent private CalMil/GalMil wallets. Aggregate values cannot identify individual motives or militia production. [August 2026 MER](https://www.eveonline.com/news/view/monthly-economic-report-august-2026) [EV-08] |
| Military Campaigns added timed objectives spanning combat and economic activities in 2026. | An optional era-specific campaign mandate can connect industry with war goals. It must preserve the official objective/reward rules for that campaign. [CCP Military Campaigns](https://support.eveonline.com/hc/en-us/articles/27857397762588-Military-Campaigns) [EV-09] |

**Source conflict:** the FW help page still lists a 50% rearguard LP multiplier, while CCP's August 2023 iteration article explicitly changed it to 1%. Do not silently choose the help-page value because its displayed update date is newer. Resolve each mechanic against patch chronology. [FW help](https://support.eveonline.com/hc/en-us/articles/203209072-Factional-Warfare) [EV-10], [2023 iteration](https://www.eveonline.com/news/view/feedback-and-iteration-factional-warfare) [EV-11]

## 3. A coupled model with explicit units

**Everything in this section is a proposed model.** Equations are implementable accounting or design specifications, not estimated laws of human behavior. Official ship, blueprint, site, and eligibility values come from the pinned catalog. All other coefficients require tuning and should be stored separately from observed data.

Use the PRD's proposed `Δ = 6 simulated hours/turn`. Resolve travel, manufacturing, encounters, and site completions on an internal event clock. Six hours is not a plex timer or a promise that each character is continuously online. Pausing the browser pauses the campaign.

| State | Unit and scope | Boundary |
| --- | --- | --- |
| `K_a` | ISK, holder `a` | Liquid wallet, separate from appraised assets |
| `L_a,j` | LP, holder and issuer `j` | Nonnegative; conversion spends the correct issuer |
| `I_a,s,k` | Integer item units, owner/system/type | Physical stock; reserved items unavailable elsewhere |
| `J_job` | Recipe, runs, inputs reserved/spent, completion timestamp | Outputs appear once, after completion |
| `F_f` | Fleet ships, fittings, damage, location, route | Human/AI use identical physical rules |
| `H_g` | Available person-hours in cohort `g` this watch | Separate human attention from character count |
| `B_g`, `M_g,d` | Fatigue and satisfaction dimension, each `[0,1]` | Synthetic scenario states; no claim of clinical measurement |
| `T_a,b` | Directed trust `[0,1]` plus evidence history | Specific to partners and commitment categories |
| `O_a` | Actor observations with timestamps/confidence | Must not include inaccessible world state |
| `C_s`, `A_s,f` | Official contestation/VP and advantage units | Updated only by legal, completed events |

### 3.1 LP, money, and opportunity cost

For a completed eligible event awarding `e_j` LP to a member of corporation `c`, with LP tax `τ_c ∈ [0,1]`:

```text
ΔL_member,j = (1 − τ_c) e_j
ΔL_corp,j   = τ_c e_j
```

Use the official rounding rule when established; otherwise make the rounding abstraction explicit and conserve the sum. The site engine calculates the legal participant award before this split. The corporation does not own every allied pilot's LP. Corporation LP buyback is a funded ISK payout tied to transferred/taxed earnings, not a second LP creation event. Under the restored donation rule, accepted transfers debit the giver's issuer-specific balance and credit the recipient corporation; transfer fees, if verified for the pinned era, are explicit sinks.

For each wallet, apply a transaction ledger:

```text
K_next = K_now + sales_received + transfers_in + explicit_NPC_ISK_rewards
         − purchases_paid − LP_store_ISK_cost − job_fees − market_fees
         − replacement_payments − project_payments − transfers_out
```

Every internal transfer debits one holder and credits another by the same amount. Sales among modeled actors conserve ISK apart from explicit taxes. NPC/external transactions are labeled imports, exports, faucets, or sinks. Destroying a ship removes an asset, not ISK from a wallet a second time. Unpaid SRP becomes a liability with a due date; it is never an automatic overdraft or a second ship. Insurance, if included, needs dated premium/payout rules and its own external ledger.

Estimate conversion economics for one LP-store offer and a specific sale/build path:

```text
net_ISK_per_LP =
  (expected_sale_receipts_after_fees − required_store_ISK
   − opportunity_cost_of_required_items − processing_costs
   − expected_transport_costs) / LP_spent
```

The result is an estimate in ISK/LP, not a fixed exchange rate. Market depth constrains volume. Self-mined minerals have an opportunity cost. A blueprint copy is not a completed hull, and an unsold hull is not liquid ISK. Show three independent quantities: estimated margin, expected delivery/sale time, and cash tied up. A high-margin operation may be wrong during an urgent reship shortage.

### 3.2 Manufacturing and stock conservation

For recipe `k`, let `b_mk` be required units of material `m` per specified batch after catalog rounding, `q_k` the output units, and `h_k` the job duration in hours. Starting a job requires all `b_mk`, applicable blueprint runs/rights, installation fees, and a free character job slot. Inputs are spent/reserved at their documented stage; outputs are created exactly once at completion. The queue cannot continue consuming the same inputs every turn.

```text
I_next = I_now + delivered_imports + completed_outputs + recovered_loot
         − consumed_inputs − departures − sold_items − destroyed_items
```

Ledger locations change during shipment. A delivered shipment is no longer in transit. A damaged surviving ship can be repaired; a destroyed ship cannot be healed back into inventory. Fitted doctrine kits reserve both hulls and modules. “Maintain 20 fitted frigates at staging” should generate orders subject to cash, inputs, delivery time, and policy limits, with a bill of materials available on demand.

Choosing buy, build, contract, or substitute doctrine is a decision, not a technology ladder. Industrial specialization should reduce a measured bottleneck or cost; local production can still lose to imports on price. Pilot training and doctrine certification consume instructor attention and equipment. They unlock organizational capabilities already known in EVE, rather than generating imaginary scientific discoveries from occupied systems.

### 3.3 Markets and transport

Start with a small real item/recipe catalog and an external market boundary. For item `k`, give external suppliers finite offered volume, lead time, and a bounded price curve. Do not allow unlimited purchases and unlimited resale at a constant favorable price.

An optional synthetic price update is:

```text
p_next = p_now × exp(clamp(η × (requested_units − offered_units)
                          / max(q_scale, offered_units), −g, +g))
```

`p` is ISK/item; `η` and `g` are dimensionless per-turn tuning parameters; `q_scale > 0` is item units. This is a stabilised game model, not an estimated EVE market equation. Keep nonnegative finite prices, bid/ask spreads, explicit transaction fees, and delayed supply response. Only funded, committed orders affect requested demand; cancelled phantom orders must not manipulate prices. At zero demand and zero offered stock it must not divide by zero. Do not apply both this imbalance surcharge and another arbitrary scarcity surcharge to the same transaction.

For a proposed cargo route, forecast delivered cost as purchase cost, freight fees, and expected cargo-loss cost; actual resolution samples a delivery or loss and updates the ledger once. Time in transit and detours matter. Hauler availability and cargo space constrain `m³/hour`; these are fleet capacities, not invented bandwidth limits on stargates. Escorting and scouting consume person-hours. Interdiction requires an actual fleet, positioning, detection, and an engagement opportunity. Neutral hauling, highsec detours, and supported jump logistics can prevent an internal-graph chokepoint from being a complete blockade.

### 3.4 Voluntary participation and fatigue

Separate characters, people, and online windows. Model a cohort with `n_g` people and a scenario-specific maximum available attention `H_g` person-hours. Linked alts share attention; do not assign one human to several simultaneous high-attention fleets merely because several characters exist. Industrial job progress can continue without continuous human attendance; installation and hauling still require appropriate availability.

Each cohort chooses between feasible activities, including staying home. One proposed choice rule is:

```text
U_g(a) = w_income × expected_net_income / income_scale
         + w_objective × perceived_objective_value
         + w_mastery × expected_mastery + w_social × expected_relatedness
         + w_autonomy × perceived_choice − w_risk × unreimbursed_loss / wealth_scale
         − w_boredom × expected_idle_fraction − w_fatigue × B_g

Pr_g(a) = exp(U_g(a)/θ) / Σ_feasible_choices exp(U_g(choice)/θ)
```

All utilities are dimensionless, scales are strictly positive, and `θ > 0` controls decision variability. Stabilize softmax by subtracting the largest utility. This is a bounded behavioral heuristic, not a solved quantal-response equilibrium. Allocate constrained hours after choices; the same hour cannot be spent both earning LP and escorting. Money motives remain one component of utility. Cohorts may disagree about what a meaningful objective or enjoyable fight is.

Update fatigue with worked hours and recovery hours:

```text
B_next = clamp(B_now + k_load × intense_hours
               + k_wait × unwanted_waiting_hours − k_rest × recovery_hours, 0, 1)
```

Each `k` has units `1/hour`. Fatigue constrains future willingness/availability; avoid charging the same fatigue twice through both a hard limit and an unexplained combat debuff. Recovery hours refer to simulated time off, not time the real player leaves the app closed. Update perceived autonomy, competence, and connection separately using bounded smoothing of activity outcomes. A loss can carry positive mastery or social feedback. No single purchase instantly repairs every dimension.

New recruits require a finite outside pool, onboarding time, affordable ships, and instructors. Experienced pilots do not become permanent casualties when ships die. SRP delays, affordability, travel, and frustration can delay their next deployment. FC overload matters separately: distributing fleets requires actual secondary commanders and coordination.

### 3.5 Trust and coalition commitments

Store each promise as `{giver, receiver, objective, window, contribution, conditions, evidence}`. On a due promise with observed evidence `e ∈ [0,1]`, a simple proposed update is `T_next = (1−α)T_now + αe`. No due promise or no adequate evidence means no automatic verdict. Record uncertainty and retain explanations. Different categories can have different histories: reliable industrial delivery does not prove accurate combat intelligence.

Ally acceptance uses its own expected utility and reservations, including outside opportunities and previous agreements. Reserving allied ships requires its acceptance; the player's map order cannot spend another organization's stock. Promise spam cannot create goodwill before performance. Public rhetoric, observed effort, and delivered results have different evidentiary weight. Historic faction identity affects available objectives and relationships only where sourced; invented personality weights are explicitly marked scenario settings.

## 4. Map combat suited to the selected design

The player chooses doctrine, stance, engagement threshold, route, target priority, and fallback on the strategic map. Resolution must distinguish **finding a fight**, **being able to enter the site**, **winning control**, **destroying ships**, and **retreating**. These are different outcomes.

A suitable first model groups identical fits into role cohorts and uses short automatic combat steps. Applied damage depends on participating ships, legal targets, range/position class, application, EWAR, and FC execution. Remote repair depends on living logistics ships, fitting capacity, range, and available resources. Alpha damage and target focus must permit breaking a repair formation; “subtract aggregate repair from total DPS forever” produces misleading invulnerability. Missile/drone/gun differences may initially use explicitly calibrated doctrine profiles, but do not label that a full EVE fitting simulation.

Compute simultaneous effects from the same step-start state. Bound kills by ships present, carry surviving damage, check retreat triggers between steps, and model losses during failed withdrawal. A fleet can leave an unfavorable site without fighting if detection, tackle, and positioning permit. Doctrine changes require fittings, travel or refit access, skills, and time. Showing an interval for expected losses is more honest than a precise victory percentage produced by uncalibrated coefficients.

The opponent must also protect its next fleet. A costly victory can remove its logistics wing, exhaust its replacement queue, or depress future turnout. Conversely, conceding a complex while preserving a fleet can be rational even when it loses territory pressure this turn.

## 5. Multiple viable strategies and their counters

These are **design hypotheses**, not empirically established optimal CalMil/GalMil strategies.

| Strategy | Conditions that could make it effective | Costs and counterplay |
| --- | --- | --- |
| Concentrated offensive | Strong prime-time turnout, staged reships, credible allied timing | Spread pressure elsewhere; decline bad fights; exploit reship routes and the next weak watch |
| Distributed affordable pressure | Several FCs, small doctrines, many eligible objectives | Coordinated interception; contested objectives; inability to finish a concentrated final objective |
| Defense and selective counterattack | Existing staging, limited cash, good local intel | Opponent earns elsewhere, alters frontage, or attacks advantage/logistics instead |
| Industrial reliability | Predictable losses and enough time to amortize setup | Liquidity squeeze, excess stock, ingredient shocks, changing doctrine demand |
| Income-first recovery | Treasury shortage and recoverable strategic position | Foregone defense, reduced LP-product prices as supply grows, lost credibility after unfulfilled promises |
| Coalition building | Complementary time zones, doctrines, industry, and objectives | Coordination time, concessions, legitimate conflicting obligations, uncertain attendance |
| High-mobility raids | Good scouting, exposed actual cargo, fragile staging | Escorts, alternate routes, smaller shipments, local reserves, contracted suppliers |
| Training and affordable content | Weak future roster or missing specialist roles | Consumes current instructor attention and ships; benefits arrive later |

Avoid forced symmetry: both sides can use all these strategies, but dated opening geography, organizations, resources, relationships, and time windows make their opportunities differ. Do not hard-code Caldari as economically rational and Gallente as intrinsically elite. A campaign should reward a disclosed combination of mandate performance, sustainable readiness, and honored obligations, with several credible ways to reach a good ending.

## 6. Opponent and ally AI for a static browser game

**Research basis.** POMCP combines sampled beliefs with Monte Carlo planning and requires a generative simulator. Its published results demonstrate performance on particular benchmarks, not a guarantee for a many-actor EVE simulation. [Silver and Veness, original conference paper](https://proceedings.neurips.cc/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html) [TH-10]

**Recommended implementation sequence:** begin with transparent hierarchical utility AI and short rollouts. Introduce richer belief search only if the simpler planner fails meaningful scenarios. The full campaign is a changing, partially observed, general-sum multi-actor problem. Treating opponents as a fixed stochastic policy permits a useful approximate POMDP, but it does not solve the full strategic game.

1. **Observe:** build each actor's view from public occupancy, its own stock, direct scouting, dated loss reports, and voluntarily shared plans. Preserve explicit uncertainty.
2. **Form feasible plans:** defend, attack, harass, scout, escort, earn, manufacture, purchase, train, rest, negotiate, or withdraw. Reject missing ships, incompatible sites, impossible travel, overcommitted hours, and insufficient funds before scoring.
3. **Estimate:** sample several hidden-state hypotheses consistent with observations; evaluate candidate operations against a portfolio of opponent responses.
4. **Allocate:** select compatible plans sharing budgets, ships, pilots, FCs, and delivery reservations. A good individually scored plan can be infeasible in combination.
5. **Commit:** negotiate allied participation; reserve resources only after acceptance. Use the same event scheduler as the player.
6. **Explain and learn:** log the top observable reasons; update opponent tendencies from observed choices with bounded recency. Do not learn from invisible outcomes or the player's unsubmitted orders.

For a prototype, try **8–16 candidates per actor, 16–64 belief samples, and a 2–4-turn horizon**, with progressively smaller sets under load. These are trial ranges, not benchmarks already achieved. Test worker execution against a stated reference laptop/mobile device; a proposed target is under 250 ms typical AI planning per turn on desktop and under one second at the 95th percentile on the selected mobile baseline. Keep the UI responsive. A fixed simulation-count budget supports deterministic replay better than a wall-time cutoff alone.

Save ruleset version, action/event log, actor beliefs, committed orders, and independent random-stream states. Separate AI planning samples from actual outcome randomness. Equivalent observations and planning seeds must produce the same decisions even when inaccessible world details differ. Historical replay uses frozen data and assets. No live LLM, external server, or live ESI request is needed during campaign play. Difficulty can change search quality and declared scenario assistance; it should not secretly give money or omniscience.

## 7. Degenerate policies to test deliberately

| Failure | Required behavior |
| --- | --- |
| Unlimited idle LP farming | Legal finite spawns, elapsed site time, attendance, interruption, participant rules, and market depth |
| Captured systems manufacture ISK | Require a documented faucet, business, or activity; no generic occupancy yield |
| Tax 100% always optimal | Member affordability, outside options, actual buyback/SRP service, trust, and cash obligations matter |
| Suicide for profitable SRP or points | Per-loss idempotency, verifiable eligibility, coverage limits, claim liabilities, and actual asset destruction |
| Permanent blob wins every watch | No teleportation; simultaneous threats, bounded attention, eligibility, and operational opportunity costs |
| Endless diplomacy reward farming | Evaluate completed or credibly costly commitments; no reputation minting for repeated announcements |
| Hoarding guarantees a victory score | Readiness values usable, delivered, crewed fits; mandate deadlines and terminal liabilities matter |
| Infinite rest recruits a huge force | Recovery caps at baseline; recruiting has an outside pool and training bottlenecks |
| Neutral ships or jump routes ignored | Explicit transport model boundaries and alternate routes; no false claims of total blockade |
| Every loss collapses the coalition | Bounded updates, multiple motives, evidence, recoverable readiness, and meaningful retreat |
| Clairvoyant ambushes or RNG manipulation | Observation isolation, independent RNG streams, deterministic replays, and no reward duplication |

## 8. Calibration and validation plan

**Observed inputs:** dated map/occupancy, official eligibility and timing, recipes and ship data, documented political events, and cautiously interpreted market/economic data. Killmails identify reported destroyed assets, not all participants, human counts, scouting, voluntary departures, private SRP, or fun. Official MER regional production is not militia production.

**Unknown inputs:** wallets, inventories, turnout, motives, doctrine quality, trust, private treaties, and production commitments. Use visible scenario ranges and sensitivity analysis. Never present an invented opening treasury as a sourced observation. Do not fit latent variables solely to reproduce a desired winner.

**Calibration trials:** assess economy first with social behavior fixed; then participation and trust with economy fixed; then coupled campaigns. Start fatigue increases at `0.02–0.08/hour` of intense attendance and recovery at `0.01–0.04/hour` of time off; trust update `α=0.05–0.20` per relevant observation; market `η=0.02–0.10` and per-turn log-price cap `g=0.03–0.10`. These deliberately broad **synthetic trial ranges** are not psychological or EVE measurements. Changing turn length requires rescaling rate parameters. Remove the fatigue system if sensitivity is dominated by arbitrary coefficients rather than meaningful choices.

| Hypothesis | Falsifiable evaluation |
| --- | --- |
| Reliable SRP and affordable fits improve usable turnout | Same starting cohorts and random seeds, different support policies; compare attended person-hours, wallet solvency, and replacement delays. Keep tax and starting resources controlled. |
| Multi-objective compensation supports neglected roles | Compare LP-only, kills-only, and bounded task contracts; measure escort/scout/logi coverage and campaign goals, including abuse attempts. |
| Logistics can change a war without fabricated gate closures | Hold combat strength constant, vary real shipments/route alternatives; compare delivered ships, lead times, and sustained pressure. |
| There is no universally dominant doctrine | Counter-matrix across site types, ranges, numbers, supply conditions, and withdrawal orders; include avoidance as a valid outcome. |
| More planning improves AI without hidden information | Compare greedy, hierarchical, and rollout planners under identical observations/resources; measure mandate performance, illegal actions, and runtime. |
| Social management contributes meaningful choices | Ablate fatigue, preferences, and trust separately; ask playtesters whether consequences become clearer or merely simpler. |
| A losing side can recover through decisions | Scenario starts with losses or weak geography but usable exits; compare targeted recovery plans against passive play. Do not force a 50% win rate for an asymmetric historical opening. |
| Campaigns remain replayable across saves | Load at every event boundary, replay seeds, and reconcile inventories, ISK, LP, claims, and promised contributions exactly. |

Run a proposed initial **200 paired seeds per scenario family**, report effect sizes and uncertainty, and increase samples where results are inconclusive. Add held-out scenarios and opponent-policy mixtures to avoid tuning against one weak opponent. Pre-register a few failure criteria: unexplained ledger imbalance, any hidden-state information leak, non-finite values, illegal ship/site combinations, or an unbounded positive economic loop blocks release. Policy win rates alone do not demonstrate Nash equilibrium, robustness against arbitrary play, or an accurate simulation of humans.

The Civ translation should be legible: **fleets instead of armies, staging and services instead of productive owned cities, capability programs instead of a universal technology race, voluntary coalition bargains instead of direct control over every friendly unit, and delivered reships instead of a generic production meter.** The result can closely preserve dated EVE geography and causal mechanics while honestly remaining an alternate-history, single-player command simulation.
