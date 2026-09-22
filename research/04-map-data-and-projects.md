# Warzone data, geography, and existing-project audit

Research date: 22 September 2026. This report distinguishes direct public observations, inherited source files, locally computed results, and implementation recommendations.

## Measured opening state

The public ESI FW response was downloaded during this research. Its HTTP Date is **2026-09-22 05:18:11 UTC**, Last-Modified is **05:11:32 UTC**, and Expires is **05:41:32 UTC**. The response was a cache hit. The response uses compatibility date `2020-01-01` because the legacy URL did not request a newer API shape. This field is an API-contract date, not the age of the warzone observation.

Preserved evidence: [raw response](raw/esi-fw-systems-2026-09-22.json), [HTTP headers](raw/esi-fw-systems-2026-09-22.headers.txt), [hash manifest](raw/manifest.json). Source endpoint: [public ESI faction warfare systems](https://esi.evetech.net/latest/fw/systems/?datasource=tranquility).

Filter on **original owner faction** `500001` or `500004`, rather than current occupier. The join key is `solar_system_id`. This preserves the CalMil/GalMil theater when occupancy changes.

| Observation or calculation | Value | Evidence type |
|---|---:|---|
| FW systems in the theater | 90 | Direct public roster, joined to inherited geography |
| Caldari occupation | 56 | Direct cached ESI observation |
| Gallente occupation | 34 | Direct cached ESI observation |
| Original Caldari systems | 54 | Public roster metadata |
| Original Gallente systems | 36 | Public roster metadata |
| Internal undirected gate links | 110 | Reconstructed from inherited gate records |
| Constellations / regions | 15 / 5 | Inherited ESI metadata |
| Internal connected components | 1 | Offline graph calculation |
| Gates leaving the FW-only graph | 31 | Inherited gate records |
| Unique external destinations | 27 | Offline deduplication |
| VP threshold in this observation | 75,000 in every system | Direct roster values, not a universal constant |
| Derived frontline / command / rearguard | 22 / 21 / 47 | Adjacency inference, not an ESI-returned field |
| Internal graph diameter | 21 jumps | Offline unweighted shortest paths |
| Mean internal pairwise distance | 8.723845 jumps | Offline unweighted shortest paths |

The five regions are The Citadel, Placid, Essence, Verge Vendor, and Black Rise. This is the current captured theater, not the universe-wide faction war map or a historical 101-system map.

The 22/21/47 operational-state counts remain **provisional** pending verification of how neighboring non-FW systems affect classification. They must not silently become authoritative inputs to access, rewards, or spawns in a verified ruleset.

The canonical application data is [data/warzone-snapshot.json](../data/warzone-snapshot.json). It retains both factions, VP state, region/constellation, positions, internal neighbors, external connections, station counts, and provenance. Unobserved assets, attendance, advantage, site lists, access, and coalition diplomacy remain `null`.

## Coordinate fidelity

The Risk project had already imported SDE build **3528119** and the `mapSolarSystems.jsonl` member. Its recorded member SHA-256 is `f9975854ebf72af597e6f554389c293d9c51248aea59bb9940585583e863e0e1`. The evidence is preserved in [risk-map-layout.json](raw/risk-map-layout.json).

CCP's documentation distinguishes schematic `position2D` from geographic three-dimensional coordinates. Render the schematic map with X increasing to the right and Y reflected for a screen coordinate system; preserve relative positions with one uniform scale. Keep three-dimensional positions separately for any later jump-range calculations. [CCP-hosted map documentation](https://developers.eveonline.com/docs/guides/map-data/)

The [SVG map](warzone-map.svg) uses every source star and every internal gate. Selected labels are visual annotations, not a selected playable subset. Hover titles identify all stars in an SVG-capable viewer. The full [CSV roster](warzone-roster.csv) is available for inspection and later spreadsheet work.

## Strategic geography: useful results and their limits

The analysis measures **normalized unweighted betweenness centrality** on the 90-system internal graph. For each pair of systems, split one unit of contribution across their shortest paths, assigning that share to intermediate stars. Divide by the number of unordered pairs excluding the measured star. This describes potential transit concentration under uniform demand.

| System | Normalized betweenness |
|---|---:|
| Pynekastoh | 0.543752128 |
| Hikkoken | 0.505575417 |
| Nennamaila | 0.502468505 |
| Aldranette | 0.409644195 |
| Heydieles | 0.272301668 |
| Oinasiken | 0.268939394 |

Removing the Hikkoken–Pynekastoh link divides this restricted graph into **48 and 42 systems**. Removing Hikkoken itself produces components of **48 and 41**; removing Pynekastoh produces **47 and 42**. These statements can be checked directly in [warzone-analysis.json](warzone-analysis.json).

**Interpretation:** these systems deserve explicit route planning and staging analysis. This does not establish which is busiest, most valuable, or politically important in the live game. Route demand is not uniform; access, doctrine speed, camps, outside transport, and staging locations alter strategic value.

An internal articulation point is not automatically a real blockade. CCP's route documentation allows a broader graph and different route preferences. A logistics model must consider the full applicable transport network, not just the systems where occupancy can change. [CCP-hosted routing guide](https://developers.eveonline.com/docs/guides/route-calculation/)

For the first implementation, choose one of these explicitly:

1. Import the full ordinary-gate navigation graph, render only the FW theater, and expose outside routes as summarized legs with their underlying system sequence.
2. Freeze verified origin/destination routes for the supported supply hubs, including all external systems, and label that limited transport coverage.

The first option is preferable for flexible logistics. Neither option may invent adjacency or treat faction occupation as physically closing a gate.

## Provenance limitation discovered in the sibling project

`../eveonline-risk/scripts/import-warzone.py` first reads per-route cache files when present, then puts an assembly timestamp into the combined document's `retrievedAt`. It does not preserve a separate retrieval timestamp for every cached gate/system response.

Therefore this report describes its geometry as **inherited frozen evidence with verified internal consistency**, not a fresh 22 September gate audit. The FW roster was independently fetched, and its system IDs exactly match the inherited geography. Source timestamps and inferred freshness must not be conflated.

For future importers: record request URL, requested compatibility date, HTTP Date, Last-Modified, Expires, ETag, received timestamp, content hash, selected fields, and cache reuse. Pin the OpenAPI contract before changing endpoints. ESI's documentation specifies compatibility dates and warns that an omitted date uses the oldest available contract; new routes and fields can require a newer one. [ESI versioning](https://developers.eveonline.com/docs/services/esi/overview/)

Respect response cache lifetimes and rate-limit headers, keep concurrency bounded, and stop/back off on limit responses. [ESI rate limiting](https://developers.eveonline.com/docs/services/esi/rate-limiting/)

## What the public data does not establish

- Registered characters are not unique humans, active pilots, or fleet attendance.
- Corporation membership is not the number able or willing to undock in a particular watch.
- A killmail count is not a fleet strength, militia victory count, or complete battle history.
- A corporation's existence and current alliance do not prove current militia participation.
- ESI's present occupancy is not a record of every past change.
- A public structure listing is not a complete database of access agreements or stock.
- A regional economy report cannot reveal the liquid budget of a particular militia.
- A faction identity does not prescribe hull race, doctrine, personal motives, or leadership quality.

Public military-campaign endpoints add campaign/objective progress and participation categories; the definitions are in SDE and may lag the state API. Total signups, current commitments, and contributors are different counts. Archive the joins and timing if these are used for a scenario. [ESI campaign release, 4 August 2026](https://developers.eveonline.com/blog/military-campaigns-on-esi-joining-the-war-effort)

## Existing projects: reuse versus redesign

Both projects were inspected locally. The workspace initially contained no game code. Nothing in either sibling project was modified.

| Existing component | Recommendation | Reason |
|---|---|---|
| Risk map data and import evidence | Reuse with preserved provenance | Exact theater and official positions already assembled |
| Risk SVG map/camera conventions | Adapt after architecture decision | Search, pan, fit, zoom, and small-screen patterns match the task |
| Risk `warfare.js` | Read as a prior adaptation; rebuild simulation rules | It deliberately uses coarse operation budgets and VP scaling |
| Risk dice and territory reinforcements | Do not use as FW combat/economy | They model RISK rather than the required causal system |
| Risk public-board bot boundary | Retain the separation principle | The new game needs stronger per-actor observation masks |
| Monopoly `bot-roster.js` | Use as a source lead list | 48 sourced identities, but many are historical and need ID/era verification |
| Monopoly 12-month zKill data | Optional calibration of general activity | Includes pirates and non-militia losses; not a war outcome measure |
| Save/import/export behavior | Adapt the user experience | Persistent decisions and recovery are already familiar |
| Local event log | Adapt, extend structured causal events | A long campaign needs explainable resource and political consequences |
| Icons, portraits, small SFX | Reuse relevant files with their manifests | Maintain the existing visual family and source attribution |
| Full 3D board pieces and Monopoly rules | No need in the first strategic prototype | The new map is a graph with fleet overlays and inspector panels |

`engine.js`, `bots.js`, and the UI were separate in the sibling projects. Preserve that testability even if a different engine is selected. A browser-only build can keep the simulation in modules/worker code and use IndexedDB for growing saves. A direct Freeciv fork changes the deployment model; see [the source audit](06-freeciv-evaluation.md).

## Reproduce and verify

Run from the project root:

```sh
python3 scripts/analyze-warzone.py
```

No API calls, packages, credentials, or network are needed. The script verifies raw-file hashes; exact equality of fresh-roster, inherited-system, and position ID sets; reciprocal internal gates; edge reconstruction; positive VP thresholds; and a shortest-path accounting identity for centrality. It then regenerates the snapshot, analysis JSON, CSV, and SVG.

This verifies **the supplied evidence and calculations**. It does not validate current server behavior, in-game access, player politics, or the eventual game engine.
