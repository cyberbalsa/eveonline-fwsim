/** Original strategic adaptations, not official EVE fitted ship statistics or timers. */
export const RULES = Object.freeze({
  version: 1, turnHours: 6, maxTurns: 120, downtimeEveryTurns: 4,
  initialWallet: 850_000_000, initialLP: 90_000, initialMaterials: 100,
  initialPilots: 80, minFleetShips: 3, maxFleetShips: 25,
  relocationCost: 10_000_000, relocationMinimumTurns: 3, relocationGatesPerTurn: 2, emergencyEvacuationDelay: 6,
  procurementTurns: 2, maxPurchaseCount: 25, materialCost: 1_000_000,
  materialDeliveryTurns: 1, cashoutCap: 100_000, cashoutRate: 900,
  trainingCost: 65_000_000, trainingTurns: 3, trainingPilots: 10, maxPilots: 160,
  festivalCost: 30_000_000, festivalCooldown: 6,
  allyRequestCost: 35_000_000, allyRequestTurns: 8, allyRequestCooldown: 10,
  upgradeBaseCosts: { industry: 100_000_000, logistics: 90_000_000, command: 120_000_000 },
  maxUpgradeLevel: 3, hubStrength: 75, holdTurns: 4, mandateReadiness: 35,
  baseIndustryIncome: 4_000_000, industryIncomePerLevel: 3_000_000,
  modelNotice: 'Six-hour simultaneous watches, fleet statistics, prices, production recipes, NPC resources and behavior are authored game adaptations. Geography and opening occupancy use the dated EVE snapshot; identities and art are real. This campaign is alternate history.'
});
export const DOCTRINES = Object.freeze([
  { id: 'rifter', name: 'Rifter skirmish wing', hull: 'Rifter', typeId: 587, class: 'Frigate', cost: 4_000_000, materials: 2, buildTurns: 2, power: 1.0, speed: 2, plexRate: 420, description: 'Fast, inexpensive scouts and small-site teams. Can escape heavier fleets; fragile when caught.' },
  { id: 'catalyst', name: 'Catalyst assault wing', hull: 'Catalyst', typeId: 16240, class: 'Destroyer', cost: 8_000_000, materials: 4, buildTurns: 2, power: 1.6, speed: 2, plexRate: 480, description: 'Accessible close-range damage and small-site pressure; exposed against cruiser support.' },
  { id: 'caracal', name: 'Caracal missile fleet', hull: 'Caracal', typeId: 621, class: 'Cruiser', cost: 26_000_000, materials: 10, buildTurns: 3, power: 3.0, speed: 1, plexRate: 410, description: 'Flexible medium-site missile formation. Strong application against light formations.' },
  { id: 'drake', name: 'Drake shield fleet', hull: 'Drake', typeId: 24698, class: 'Battlecruiser', cost: 65_000_000, materials: 24, buildTurns: 4, power: 5.0, speed: 1, plexRate: 320, description: 'Durable large-site and hub formation. Slower and expensive to replace; medium sites are unavailable.' },
  { id: 'dominix', name: 'Dominix siege fleet', hull: 'Dominix', typeId: 645, class: 'Battleship', cost: 170_000_000, materials: 65, buildTurns: 5, power: 8.0, speed: 1, plexRate: 230, description: 'Heavy open-site and infrastructure-hub damage. Cannot enter small, medium or large restricted sites.' }
]);
export const STANCES = Object.freeze(['evade', 'skirmish', 'hold', 'commit']);
export const ORDER_TYPES = Object.freeze(['move', 'offensive', 'defensive', 'patrol', 'advantage', 'hub', 'escort', 'rest']);
export const NPC_ORGANIZATIONS = Object.freeze([
  { id: 'corporation-98639548', corporationId: 98639548, name: 'United Caldari Navy', ticker: 'UCN-', faction: 'caldari', allianceId: 99011489, allianceName: 'United Caldari Space Command.', homeName: 'Nennamaila' },
  { id: 'corporation-98688951', corporationId: 98688951, name: 'Mercury Arms Inc.', ticker: 'PROHG', faction: 'caldari', allianceId: 99009856, allianceName: 'Ghostbirds', homeName: 'Akidagi' },
  { id: 'corporation-1894214152', corporationId: 1894214152, name: 'Aideron Robotics', ticker: 'AIDER', faction: 'gallente', allianceId: 99011730, allianceName: 'Aideron Robotics.', homeName: 'Fliet' },
  { id: 'corporation-1126669495', corporationId: 1126669495, name: 'Quantum Cats Syndicate', ticker: 'QCATS', faction: 'gallente', allianceId: 99011952, allianceName: 'Of Essence', homeName: 'Heydieles' },
  { id: 'corporation-98714140', corporationId: 98714140, name: 'Fliet Pizza Delivery', ticker: '-FPD-', faction: 'gallente', allianceId: 99011952, allianceName: 'Of Essence', homeName: 'Fliet' }
]);
