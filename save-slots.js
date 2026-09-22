// Named copies are isolated from the active autosave. All writes are atomic
// localStorage updates; callers validate campaign payloads before loading.
export const CAMPAIGN_KEY = 'eve-war-council-campaign-v1';
export const SLOTS_KEY = `${CAMPAIGN_KEY}-slots`;
export const BACKUP_KEY = `${CAMPAIGN_KEY}-backup`;
const MAX_SLOTS = 12;

export function readSlots(storage = localStorage) {
  const raw = storage.getItem(SLOTS_KEY);
  if (!raw) return [];
  const slots = JSON.parse(raw);
  if (!Array.isArray(slots) || slots.length > MAX_SLOTS || slots.some(slot =>
    !slot || typeof slot.id !== 'string' || typeof slot.name !== 'string' ||
    typeof slot.campaign !== 'string' || !Number.isInteger(slot.turn) || typeof slot.corporation !== 'string')) {
    throw new Error('The named-save index is damaged. Your active autosave is separate.');
  }
  return slots;
}

export function createSlot(name, campaign, state, storage = localStorage) {
  const slots = readSlots(storage), clean = String(name).trim().slice(0, 60);
  if (!clean) throw new Error('Give this save a name.');
  if (slots.length >= MAX_SLOTS) throw new Error(`All ${MAX_SLOTS} named slots are full. Export or delete a slot first.`);
  if (slots.some(slot => slot.name.toLowerCase() === clean.toLowerCase())) throw new Error('That save name already exists. Choose a new name to keep both copies.');
  const slot = {id:crypto.randomUUID(), name:clean, campaign, turn:state.turn, corporation:state.player.corporationName, faction:state.faction, savedAt:new Date().toISOString()};
  storage.setItem(SLOTS_KEY, JSON.stringify([slot, ...slots]));
  return slot;
}

export function deleteSlot(id, storage = localStorage) {
  const slots = readSlots(storage);
  if (!slots.some(slot => slot.id === id)) throw new Error('This save no longer exists.');
  storage.setItem(SLOTS_KEY, JSON.stringify(slots.filter(slot => slot.id !== id)));
}

export function preserveCurrent(storage = localStorage, current = storage.getItem(CAMPAIGN_KEY)) {
  if (current) storage.setItem(BACKUP_KEY, current);
}
