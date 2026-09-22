# Freeciv source audit and design-as-code decision

**Decision:** honor the user's browser-only requirement. Use Freeciv as a concrete reference for declarative rules, action legality, effects, development, AI interfaces, and save compatibility. Build the FW simulation around its actual star graph and organizational economy. Evaluate direct source reuse per component; a full Freeciv-web fork is not the selected runtime.

This is based on source inspection, not only a project description. Read-only sparse checkouts were made in `/tmp`; no Freeciv installer, server, Docker deployment, compiled engine, or browser port was run.

## Exact versions inspected

| Repository | Pinned commit |
|---|---|
| [Freeciv](https://github.com/freeciv/freeciv) | `709467e08b800c0012a7879b0368bad29984a78c` |
| [Freeciv-web](https://github.com/freeciv/freeciv-web) | `c19ce060fadc99663f8aba3652ca94b07174467c` |

The [audit manifest](freeciv-source-audit.json) records 18 inspected files with immutable URLs and SHA-256 hashes. These are observed branch heads on 22 September 2026, not a declaration that either is the appropriate stable release.

Freeciv-web's own [`freeciv/version.txt`](https://github.com/freeciv/freeciv-web/blob/c19ce060fadc99663f8aba3652ca94b07174467c/freeciv/version.txt) pins the C server to **`add9f4e14ebf8609f369d586e42cd2ccca2bc6df`**, with web capability string `+Freeciv.Web.Devel-3.3`. This differs from the Freeciv head inspected above. A fork must use a compatible engine/web/ruleset combination; it cannot assume the latest branches are interchangeable.

## What “Freeciv as base code” actually entails

The Freeciv-web repository describes a Java web application, a patched C game server, a Python WebSocket proxy, and a Python server-process launcher. Its JavaScript client connects to `/civsocket/…`, and gameplay requests are sent over that connection. These dependencies apply to the single-player deployment too. [Architecture README](https://github.com/freeciv/freeciv-web/blob/c19ce060fadc99663f8aba3652ca94b07174467c/README.md), [actual connection code](https://github.com/freeciv/freeciv-web/blob/c19ce060fadc99663f8aba3652ca94b07174467c/freeciv-web/src/main/webapp/javascript/clinet.js)

The inspected save UI sends `/save` to the server and describes server-stored campaigns. This is not the same persistence system as the user's local saved games. Reusing the client requires replacing or supplying its simulation and persistence services. [Save implementation](https://github.com/freeciv/freeciv-web/blob/c19ce060fadc99663f8aba3652ca94b07174467c/freeciv-web/src/main/webapp/javascript/savegame.js)

Compiling a C engine to WebAssembly is a conceivable engineering route, but this research has not built it. Treating networking, filesystem persistence, Lua, dependencies, and UI integration as solved would be unjustified. It should only become the plan after a working offline proof and measured effort comparison.

## Reusable ideas grounded in actual files

| Inspected source | Useful pattern | FW implementation |
|---|---|---|
| `doc/README.rulesets` | Data-driven units, advances, improvements, governments, and settings; scenario compatibility | Versioned hull/doctrine, institution, action, and scenario catalogs |
| `data/classic/actions.ruleset`, `doc/README.actions` | Action enablers and requirements; actor and target are distinct | Legal plex entry, funded contract acceptance, valid reship, feasible withdrawal |
| `doc/README.effects` | Conditional effects with scopes and requirement vectors | Local advantage, coalition policy scope, doctrine support, service eligibility |
| `data/classic/units.ruleset` | Stable rule names, roles, classes, flags, progression | Stable IDs separate from displayed real names; hull eligibility and fleet roles |
| `data/classic/script.lua` | Scenario event hooks | Dated scenario objectives and bounded event handlers |
| `common/combat.c` | Separate legality from combat outcome | First establish whether this fleet may fight at this location |
| `doc/README.AI_modules` | AI callbacks/modules separate from base rules | Planners consume observations and emit ordinary legal orders |
| `server/savegame/savegame3.c` | Explicit save format versions and compatibility handling | Save ruleset, catalog versions, pending orders, event state, and migrations |
| Web `city.js`, `diplomacy.js` | Development/queue and treaty interface concepts | Staging logistics queue and offers with bounded commitments |

These observations are linked to exact source files in the [manifest](freeciv-source-audit.json). No Freeciv source has been copied into the game's production code during this phase.

The most valuable design lesson is to make a rule **inspectable**. When the game disallows an action, the same requirement evaluation should tell the UI why. When an effect applies, the UI should identify its scope and source. The bot, preview, execution path, and tests must share those definitions.

## Where a direct conversion would need substantial work

### The navigation model

The inspected `common/map.h` uses coordinates, directional movement, topology flags, and tile-adjacency iteration. EVE's gate network is an arbitrary graph over fixed stars. A teleport-like action exists in Freeciv, so a graph mod is not categorically impossible; however, navigation, threat estimation, movement previews, and AI all need to respect the same star edges. [Map interface](https://github.com/freeciv/freeciv/blob/709467e08b800c0012a7879b0368bad29984a78c/common/map.h), [action documentation](https://github.com/freeciv/freeciv/blob/709467e08b800c0012a7879b0368bad29984a78c/doc/README.actions)

A star cannot simply be a renamed tile if arbitrary neighboring tiles permit travel, hostile ships cannot share a large system, or every fleet is forced into one local combat position. A possible mod would represent sublocations or explicit edge actions; that requires proof in the AI and UI, not just a pleasing map.

### Who owns what

City ownership, empire-level economy, and player diplomacy offer useful analogies. The required simulation adds independent corporations inside the same militia, personal LP, corporation stocks, custodians of alliance funds, time-zone attendance, access agreements, and multiple locations within each occupied system. Ordinary city capture cannot replace the VP/hub/transfer sequence.

### The AI objective function

Freeciv's own ruleset documentation cautions that the AI may play nonstandard rules less effectively. The default planner does not become a competent FW commander merely because a unit is called a Caracal. It must value objective denial, reships, restricted gates, allies' voluntary support, market liquidity, and enjoyable participation. The AI-module interface offers a separation pattern, not evidence of an already suitable FW policy. [Ruleset documentation](https://github.com/freeciv/freeciv/blob/709467e08b800c0012a7879b0368bad29984a78c/doc/README.rulesets), [AI module documentation](https://github.com/freeciv/freeciv/blob/709467e08b800c0012a7879b0368bad29984a78c/doc/README.AI_modules)

### Runtime and user experience

The chosen game needs a static site with local campaigns, browser-side planning, and no required account or server. The current Freeciv-web client is organized around server packets and services. Some UI code could be adapted, but dependencies on packet formats, globals, and framework utilities must be traced before estimating savings. The existing EVE projects are a closer match for map controls, local sound, and browser persistence.

## Comparison after the user's hosting decision

| Approach | Potential benefit | Remaining cost | Decision |
|---|---|---|---|
| Full Freeciv-web fork | Mature Civ infrastructure and established client/server rules | Backend conflicts with chosen hosting; deep FW changes and AI adaptation | Not selected |
| Freeciv engine compiled for browser | Potential retention of C systems without a hosted game server | Unproven port, dependencies, persistence, graph semantics, and custom AI | Possible future spike, not assumed |
| Browser engine with Freeciv-style rules | Natural fit for real graph, local saves, and FW economy | Must implement and validate combat/economy/AI | Recommended foundation |
| Selective source adaptation | Could save work in a demonstrably isolated module | Dependency tracing, license compliance, tests, and semantic mismatch | Evaluate as each module is built |

This recommendation is an engineering inference from the inspected code and product requirements. No comparative prototype benchmark or development-time study has been performed.

## Licensing and art boundaries

Inspected C source headers state GPL version 2 or later; the Freeciv-web client is covered by its AGPL license. Copying or adapting covered code requires preserving notices and following the applicable source-distribution terms. A JavaScript translation is not automatically free of the original license. The AGPL also addresses corresponding-source offers for modified software used over a network. [Freeciv license](https://github.com/freeciv/freeciv/blob/709467e08b800c0012a7879b0368bad29984a78c/COPYING), [Freeciv-web license](https://github.com/freeciv/freeciv-web/blob/c19ce060fadc99663f8aba3652ca94b07174467c/LICENSE.txt), [FSF AGPL text, section 13](https://www.gnu.org/licenses/agpl-3.0.de.html)

Keep a per-file source manifest if adaptation happens. This research does not select or grant a blanket license for the new project. EVE logos, portraits, sounds, and art retain their own terms; do not label them GPL/AGPL merely because they appear alongside open-source code. Official image assets and third-party community artwork require their respective provenance. [Project credits](../CREDITS.md)

## The proposed design-as-code contract

The original [ruleset proposal](../design/ruleset-proposal.json) encodes user decisions, pacing proposals, data references, known published values, unknown values, action requirements/effects, resource ownership, state transitions, and release blockers. It is **not Freeciv's file syntax** and is not loadable by Freeciv. It is a starting contract for the browser engine.

Use three layers:

1. **Observed content:** CCP IDs, snapshot geography/occupancy, real typed identities, asset hashes.
2. **Published mechanics:** versioned eligible actions and exact parameters tied to source IDs and effective dates; unresolved mechanics remain null or disabled.
3. **Simulation design:** strategic time scale, grouped combat, attendance, market approximation, AI priorities, and victory tuning.

Do not mix them in one unexplained `balance.js` file. A future save references the immutable hashes of its selected layers.

An action definition contains an ID, actor type, target type, prerequisite predicate IDs, reservation policy, event handlers, source references, and a confidence state. Predicates are evaluated by an allowlisted engine registry, not arbitrary text evaluated as code. Explanations are generated from the failed predicate and its inputs.

For example, `offensive_plex` requires eligible location, a compatible assigned formation, enemy occupancy, an active suitable site, available time, and sufficient readiness. It schedules work; it does not immediately award a fixed fraction of the system. Completion hands the verified site outcome to separate VP, LP, and participation ledgers.

Suggested module boundaries:

```text
data/                  observed snapshot and typed identities
design/                source-linked rules and original tuning
engine/state           durable world and per-actor observations
engine/requirements    legal actions with explainable failures
engine/events          deterministic clock and simultaneous resolution
engine/warfare         sites, advantage, hubs, access, occupancy
engine/combat          formation engagements and disengagement
engine/economy         double-entry transfers and physical inventories
engine/logistics       actual routes, shipments, fitting, reships
engine/participation   availability, preferences, fatigue, confidence
engine/diplomacy       scoped commitments and institutional memory
ai/                    observations -> feasible proposed orders
ui/                    map, queues, council, forecasts, after-action reports
save/                  local storage, versioning, import/export
```

These are proposed boundaries, not folders containing implemented subsystems. Prefer a small working slice before expanding into every module.

## Evidence that would change the recommendation

A proven offline Freeciv browser port that already preserves required graph routing, local persistence, modded action semantics, and usable custom AI would justify reevaluation. A specific portable module whose dependencies and license fit the project would justify direct code adaptation. Until then, preserve the user's browser-only choice and implement the strongest Freeciv patterns directly for the actual FW model.
