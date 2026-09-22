# Research guide

Read [the PRD](../PRD.md) first for the integrated game. The reports below supply the evidence and reasoning behind it. Research date: **22 September 2026**.

## Reports

| Report | What it answers |
|---|---|
| [01 — FW mechanics](01-fw-mechanics.md) | Which current capture, site, LP, access, advantage, battlefield, and seasonal rules need to be preserved? |
| [02 — History and politics](02-history-politics.md) | How do the real militias organize, cooperate, compete, and keep people playing? Which real identities fit which era? |
| [03 — Theory, economy, and AI](03-theory-economy-ai.md) | How can coalition incentives, fun, resources, logistics, uncertainty, and viable counterstrategies become a simulation? |
| [04 — Map and existing projects](04-map-data-and-projects.md) | What is actually observed, what does the graph show, and what can the existing EVE projects contribute? |
| [05 — Validation and roadmap](05-validation-and-roadmap.md) | What should be built first, which invariants matter, and how should balance and fidelity be tested? |
| [06 — Freeciv source evaluation](06-freeciv-evaluation.md) | Which actual Freeciv code patterns are useful, and how do they fit browser-only hosting? |

Three research workers independently covered mechanics, politics, and theory/economics. The integrating agent inspected the sibling projects, fetched the opening map observation, calculated topology, examined Freeciv source, wrote the PRD and implementation contract, downloaded the real assets, and cross-checked the results. Follow-up reviews corrected access, chronology, resource ownership, and observation-model ambiguities.

## Findings that shape the game

**Territory is a consequence of sustained operations.** The game needs timed objectives, pressure, advantage, hub eligibility, access, and reships, with ship kills affecting those systems through actual consequences.

**Militias are coalitions.** Corporate assets, pilot preferences, public FCs, time-zone availability, and commitments matter. The same faction can include groups seeking difficult fights, learners, territorial progress, and income.

**LP is not instant ISK or a finished ship.** Keep issuer/holder balances and a physical acquisition–manufacture–hauling–deployment chain. Working capital and local fitted stock can constrain a wealthy organization.

**Fun has strategic effects.** The proposed model connects autonomy, useful contribution, social trust, affordability, and fatigue to attendance. Coefficients remain synthetic; the real player's enjoyment still needs playtesting.

**Current evidence differs from familiar history.** Uprising, Havoc, Catalyst, and 2026 changes cannot be mixed casually. Several famous historical affiliations no longer hold, and names must resolve to the correct ESI entity type.

**Freeciv is useful at the rules and architecture level.** Its actual web stack requires a server. The chosen browser-only game should adopt declarative requirements/effects and selectively assessed code while keeping the correct FW graph and economy.

## Evidence and executable research utilities

- [Combined source index](SOURCES.md), [source records](sources.json), and [source-count summary](source-summary.json). There are **130 records / 124 distinct URLs**; repeated uses of one page are not independent confirmations.
- [Raw API/geography manifest](raw/manifest.json) with saved evidence and hashes.
- [Warzone snapshot](../data/warzone-snapshot.json), [analysis](warzone-analysis.json), [roster CSV](warzone-roster.csv), and [map SVG](warzone-map.svg).
- [Typed identity catalog](identity-catalog.json), [official-image gallery](identity-gallery.html), and [asset hashes](../assets/identities/provenance.json).
- [Freeciv commit/file manifest](freeciv-source-audit.json).
- [Original design-as-data proposal](../design/ruleset-proposal.json).

The opening map observation is pre-downtime, **05:11:32 UTC on 22 September 2026**. Identity and image observations occurred separately and have their own timestamps. They are not one atomic snapshot of all EVE activity.

## How to interpret confidence

**Observed:** values actually returned in a timestamped public response. **Published rule:** a dated CCP statement, interpreted through subsequent patches. **Participant account:** what a named source reports or advertises, with its perspective retained. **Inference:** an analysis that depends on assumptions. **Design proposal:** authored behavior for this game. **Unknown:** data or a rule not established by this research.

The map's 22/21/47 operational-state classification is an internal-adjacency inference, pending boundary-neighbor validation. Exact fitted doctrines, recipe subsets, complete external supply routes, private resources, social coefficients, and some site/access timing details remain future content/validation work. Their absence is explicit in the rule pack rather than filled with purported facts.

“1:1” here means preserving verifiable geography, dated identities, mechanics, and causal relationships. It does not claim a reproduction of private human motives, exact future decisions, or every second of an MMO inside a turn-based game.
