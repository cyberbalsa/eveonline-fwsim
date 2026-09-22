# EVE: War Council

A playable, single-player, browser-only strategy game about the Caldari–Gallente Faction Warfare warzone. Command your corporation’s fleets, fund independent allies, manufacture replacements, and keep pilots willing to undock.

The interface uses EVE-inspired window chrome, original colored Neocom icons, official portraits and logos, actual CCP ship geometry, and a genuine EVE nebula cubemap. All runtime resources are local. No application server, account, API key, build step, or live EVE connection is needed.

![EVE War Council command interface](docs/screenshots/command-desktop.png)

## Play

**[Play EVE: War Council](https://cyberbalsa.github.io/eveonline-fwsim/)** · [GitHub repository](https://github.com/cyberbalsa/eveonline-fwsim)

To play locally, serve this folder over HTTP; opening `index.html` as a file will not load the scenario correctly.

```sh
python3 -m http.server 8091
```

Open **http://localhost:8091/**. Choose Caldari or Gallente, name your commander and corporation, and enter the warzone.

1. Select a formation and an enemy objective system.
2. Choose **Offensive plexing**, select a stance, and **Issue order**.
3. **End watch** resolves both sides together. Ships follow real stargate routes.
4. When a system becomes vulnerable, issue **Assault I-Hub**. Ownership transfers after hub destruction and scheduled downtime.
5. Keep your force supplied through **Industry**, assign reserve ships in **Fleet Fitting**, and fund joint operations in **Council**. Rest tired pilots.
6. Open **OPS** to manage pilot groups, develop volunteer officers, set participation and replacement policies, and resolve requests before their deadlines. **Council** also offers negotiations, defensive compacts, workshop access, replacement assistance, aid, and reconciliation.

Capture both bridgehead targets and hold them for four watches with readiness at least 35% and six surviving hulls. The standard campaign has a 120-watch limit, with 48- and 180-watch options. Victory can occur before the limit. After the campaign report, **Continue in sandbox** keeps the same fleets, politics, calendar, and history while preserving the original result. The in-game handbook explains the mechanics.

Actions autosave to this browser. **SAVE** opens a manager that keeps up to twelve named campaigns without replacing other slots. **Export** creates a portable campaign file; **Import** validates it before replacing the current campaign. Starting, loading, or importing another campaign preserves the prior browser save under `eve-war-council-campaign-v1-backup`. Saves from the first published version upgrade automatically while preserving their fleets, resources, geography, and current watch. Saves are local to the current browser and origin; export before clearing browser data or changing hosts.

## Implemented features

- All **90 warzone systems and 110 internal gates**, real schematic positions, pan/zoom/search, occupancy/frontline/supply views, fog-filtered fleet counters, and system inspection.
- Five combat doctrines, eight orders, four engagement stances, travel, combat losses, withdrawal, site pressure, advantage, infrastructure hub assaults, and delayed ownership transfers.
- Independent corporation AI with separate finite wallets, reserves, attendance and strategic objectives. Real corporation/alliance names, logos and verified public character portraits appear in the council.
- Six pilot cohorts with different preferences, enjoyment, workload, trust, participation, and retention. Three fictional volunteer officers develop fleet organization, logistics, and mentoring. Requests and disagreements produce choices, deadlines, promises, and remembered consequences.
- Coalition counteroffers and refusals, finite aid and reciprocal favors, defensive compacts, allied workshop access, escrowed replacement assistance, scheduling rivalries, withdrawal, and reconciliation. Organizational priorities affect independent AI planning.
- Manufacturing, procurement, material freight, capped LP settlement, reserve hangars, fleet formation/refitting, training, institution upgrades, morale, fatigue and coalition commitments.
- Timed relocation of reserves and unfinished production, plus emergency evacuation from captured staging. A wiped force can return its pilots and rebuild.
- Seeded deterministic campaigns, portable validated saves, named local saves, searchable paginated operations history, campaign outcomes with sandbox continuation, and responsive desktop/mobile controls.
- Combat forecasts explain observed strength, pilot coverage, travel, and uncertainty without revealing unscouted forces or private orders.
- Real 3D ship previews with keyboard/pointer orbit, reduced-motion support and an official painted-render fallback. Locally cached EVE interface sounds can be muted.

This release completes the people-management and coalition interactions described in the [people and politics guide](docs/people-and-politics.md). The [larger PRD](PRD.md) also describes future scenario content and detailed MMO systems; [implementation scope and adaptations](design/implementation.md) records those boundaries. Fictional officers belong to the player-created corporation; real named EVE characters remain sourced corporation liaisons.

## Fidelity and research

The opening ESI cache was last modified **22 September 2026 at 05:11:32 UTC**, before downtime: **56 Caldari-held and 34 Gallente-held systems**. Geography comes from the Risk project’s frozen ESI/SDE evidence and was checked internally; no complete fresh gate-by-gate audit is claimed. There are also 31 outgoing gates to 27 external destinations, recorded but outside the playable theater.

Geography, opening occupancy and identities are dated observations. Six-hour watches, fleet coefficients, prices, recipes, resources, participation and NPC behavior are authored adaptations. This is an alternate-history simulation, not a claim to reproduce private player motives, current fitted assets, future decisions, or the full MMO one-to-one.

- [Game design PRD](PRD.md) and [research guide](research/README.md).
- [Mechanics](research/01-fw-mechanics.md), [history and politics](research/02-history-politics.md), and [game theory/economy/AI](research/03-theory-economy-ai.md).
- [Source index](research/SOURCES.md): 130 claim records / 124 distinct URLs, with dated evidence and uncertainty labels.
- [Warzone snapshot](data/warzone-snapshot.json), [map](research/warzone-map.svg), and [identity gallery](research/identity-gallery.html).
- [Freeciv source audit](research/06-freeciv-evaluation.md). Rules/map/turn separation and observation boundaries informed the design; no Freeciv engine code is bundled.

## Development and verification

Node is only required for tests. Runtime uses native browser modules and the checked-in local renderer bundle.

```sh
npm ci
npm test
npx playwright install chromium  # once, if not installed
npm run test:e2e
npm run validate:research
```

Node tests cover capture chronology, finite inventory, production and logistics, fog, deterministic replay, differentiated attendance, promises, political agreements and escrow, NPC campaigns, recovery, save migration, sandbox continuation, and asset provenance. Browser tests exercise the actual people, industry, council, fitting, map, orders, named saves, and mobile controls. The E2E config packages the site and starts a static server on port 8091, testing `/eveonline-fwsim/` to match the GitHub Pages project path. Stop any existing server on that port before running the tests.

## Publishing

The [Pages workflow](.github/workflows/pages.yml) runs the engine, asset, research and browser checks on pushes and pull requests to `main`. Successful pushes to `main` deploy automatically. The repository's **Settings → Pages → Source** must be **GitHub Actions**.

`npm run build:pages` copies the game, local assets and supporting documentation into `_site/eveonline-fwsim/`. This is the deployment artifact; dependencies, tests and tooling are excluded. The same artifact is tested before uploading. Packaging adds a shared content-based cache key to module and stylesheet URLs so returning browsers load a consistent release. It does not compile the modules or modify source files.

To run the browser checks against the live site:

```sh
PLAYWRIGHT_BASE_URL=https://cyberbalsa.github.io/eveonline-fwsim/ npm run test:e2e
```

Key files: `rules.js` holds the tuning and roster; `engine.js` owns state/actions/AI/resolution; `people.js` models pilot participation and requests; `diplomacy.js` owns agreements and political memory; `game.js` and `ui-social.js` bind the interface; `save-slots.js` manages named local saves; `map.js` draws the real graph. `styles.css`, `map.css`, and `game-ui.css` theme the interface. `ship-viewer.js` loads the licensed local renderer bundle. [Asset provenance and optional rebuild instructions](ASSETS.md).

Research utilities use the Python standard library:

```sh
python3 scripts/build-source-index.py
python3 scripts/analyze-warzone.py
python3 scripts/validate-research.py
```

The [original design-as-data proposal](design/ruleset-proposal.json) remains a research artifact. Implemented rules live in `rules.js` and `engine.js`.

EVE Online and its artwork belong to CCP hf.; this is an unofficial non-commercial fan prototype. [Credits and terms](CREDITS.md).
