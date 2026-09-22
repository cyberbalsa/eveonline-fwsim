# People and politics release · 22 September 2026

The browser game implements the strategic core of the PRD. The PRD remains the broader design target; its proposed values do not override the executable rules.

| Area | Working behavior | Scope and adaptation |
|---|---|---|
| Theater | 90 actual Cal/Gal systems, 110 internal edges, unaltered schematic positions; dated occupancy | External gates are recorded, not traversable. No shipcaster, highsec, wormhole or jump-drive route simulation. |
| Time | Six-hour simultaneous watches; ownership transfers at four-watch downtime boundaries | Strategic compression, not exact EVE site timers or clock-aligned 11:00 UTC downtime. |
| Front | Internal-graph frontline/command/rearguard inference, public contest pressure, local advantage | Boundary-neighbor classification is incomplete; no individual live site population import. |
| Combat | Five doctrines, attendance-limited active hulls, meeting/escape decisions, persistent losses, explicit orders, scouting-based engagement forecasts | Forecasts use observed strength and uncertainty; they never reveal hidden forces or predict exact rolls. No module fitting optimizer, detailed damage types, grid piloting, or capital escalation. |
| Sites | Automatic hull-eligible site profile, offensive/defensive effort, LP rewards, separate hub assault | No individual timed plex counters, battlefield fleet objective, enlistment restrictions, or seasonal tournament layer. Arrival-watch operations use reduced effort. |
| Economy | Finite wallets, kits, hulls, production slots, procurement delay, LP balance and per-watch settlement cap | Recipes are kits plus ISK, not live SDE bills of materials. Fixed net LP broker rate of 900 ISK/LP and 100k/watch depth, not a simulated player order book or full LP-store barter chain. |
| Income | Finite civilian contracts: 4M ISK/watch plus industry institution bonuses | Authored off-map income, not occupancy tax or claimed EVE passive income. |
| Supply | Shipment timers, exposed-arrival risks, escort effects, reserve relocation and evacuation | Interdiction uses local exposure; outside-warzone freight is not a gate-by-gate convoy. |
| Corporations | Five verified NPC corporations across two factions, distinct inventories and autonomous planning | Authored starting assets, weights and behavior. Alliance identities are diplomatic labels and never duplicate corporation manpower. No claim the cast exhausts the real war. |
| Politics | Authored organizational priorities; proposals, refusals, counteroffers, finite aid and favors, workshop access, triggered defensive compacts, escrowed replacement assistance, rivalry, withdrawal and reconciliation | Real identities are sourced; generated political behavior is explicitly a scenario. Workshop access improves resting readiness and does not share hangars. Neutral pirate actors, hostile treaties and detailed freight/LP buyback contracts remain future scenario extensions. |
| Participation | Six preference groups, enjoyment, workload, trust, attendance, retention, protected rest, recognition, three fictional officers and training, policy tradeoffs, timed requests, disputes and promises | Cohort behavior is synthetic. Individual real players' private motives, calendars or personality profiles are not asserted. Officer programs develop volunteers without inventing new hulls or pilots. |
| Victory | Two bridgehead systems held four watches with readiness ≥35% and at least six ships; turn-limit scoring; optional sandbox continuation preserving the original report | Early completion is possible; several evenings is an intended pacing option, not a measured playtime guarantee. Sandbox retains the original mandate deadline only as history. |
| Persistence | Autosave, twelve named local slots, export/import, pre-replacement backup, automatic migration of the first published saves, 2,000 retained journal entries with bounded rendering and search | Browser storage capacity varies; portable export is available. Named saves and audio preferences belong to the current browser and origin. |
| Art | Original 2014 icons, official render/portrait/logo bytes, real CCP geometry and client nebula | Simplified meshes use project metallic materials, not full EVE client paint/shaders. Barlow typography is open-source, not EVE's proprietary font. |
| Engine | Native browser JavaScript, deterministic seed and validated saves; static hosting | Freeciv architectural inspiration, no GPL/AGPL game-engine code transplanted. No server simulation or live ESI requests. |

## Resolution and ownership

Orders are prepared without advancing time. Each watch applies scheduled ownership changes, independent NPC plans, attendance and travel, engagements, operations, production/freight, and maintenance. Orders persist until replaced or made ineligible. No automatic time advance runs while a page is left open.

Physical hulls reside in one formation, reserve hangar, or shipment. Industry consumes resources when queued; outputs appear only after completion. Ship loss does not permanently remove capsuleers. Rest recovers attendance/readiness and cannot recreate destroyed hulls. Relocating staging puts stocks in real delayed freight and moves unfinished production with evacuation time. A captured base can trigger emergency relocation after six blocked watches once the fee is affordable.

Enemy fleets are shown only through friendly scouting observations. Allied private orders are removed from the player-facing observation. The full campaign state exists locally to run the single-player simulation and is present in exported saves; this is gameplay fog, not anti-cheat secrecy.

Save checksums detect accidental payload changes. Import also validates bounds, campaign structure, real roster identity and immutable source geography. The checksum is not a cryptographic authenticity mechanism. A previous browser save is retained before new-campaign replacement or import, and invalid imports leave the active campaign intact.

## People, agreements and consequences

Pilot groups evaluate actual operations differently. Accessible sorties matter to new pilots, fights to hunters, and production and recognition to support groups. Optional fleets reduce immediate turnout but ease workload; strategic call-ups increase turnout while adding fatigue and eroding trust. A protected cohort does not contribute attendance for two watches. Persistent dissatisfaction can remove unassigned volunteers, never the pilots assigned to physical deployed hulls. Paid loss assistance debits ISK and cannot recreate ships.

Requests have visible response deadlines. An accepted promise is checked against completed work, with a greater trust cost for breaking it than declining it. Cohort and political histories retain the causes of changes. All three named officers are fictional scenario characters; sourced EVE portraits continue to represent corporation liaisons.

Coalition contributions transfer real money between wallets. Replacement assistance instead reserves a finite escrow, settles against actual hull losses and refunds unused funds. Defensive compacts trigger once when the named friendly system reaches 25% pressure, subject to force readiness and existing commitments. Workshop agreements expire or end when allied staging changes. Rivalries affect negotiation costs; severe grievances sustained for two watches cause withdrawal. Reconciliation requires time, trust and resolved grievances, while the organization continues to own its assets and plan independently.

Original version-one envelopes remain readable. New saves carry an additional schema marker and strictly validated people/diplomacy state; malformed new state cannot be silently reset through migration. Combat forecasts use the same scouting limits as the visible map. [Player guide](../docs/people-and-politics.md).

## Verification

Automated checks exercise resource conservation, capture chronology, illegal-action atomicity, shipment/evacuation recovery, pilot availability, fog, seeded replay, actor iteration independence, full autonomous campaigns and a viable player victory. Browser tests cover real UI actions and mobile geometry. Asset checks validate local files and provenance hashes. These checks establish a playable technical baseline, not proven long-term balance or measured player enjoyment.
