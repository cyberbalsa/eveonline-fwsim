import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot, deleteSlot, readSlots, preserveCurrent, CAMPAIGN_KEY, BACKUP_KEY, SLOTS_KEY } from '../save-slots.js';

class BrowserStorage {
  values = new Map([[CAMPAIGN_KEY, 'active campaign']]);
  full = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.full) throw new Error('Storage quota exceeded');
    this.values.set(key, String(value));
  }
}
const state = { turn: 12, faction: 'caldari', player: { corporationName: 'Archive Wing' } };

test('named slots preserve each branch independently of autosave and recovery backup', () => {
  const storage = new BrowserStorage();
  const one = createSlot('Before deployment', 'watch12', state, storage);
  const two = createSlot('Alternate orders', 'watch13', { ...state, turn: 13 }, storage);
  assert.deepEqual(readSlots(storage).map(slot => slot.campaign), ['watch13', 'watch12']);
  assert.equal(storage.getItem(CAMPAIGN_KEY), 'active campaign');
  preserveCurrent(storage);
  assert.equal(storage.getItem(BACKUP_KEY), 'active campaign');
  preserveCurrent(storage, 'newer live campaign');
  assert.equal(storage.getItem(BACKUP_KEY), 'newer live campaign', 'recovery keeps in-memory progress even when autosave was previously full');
  deleteSlot(one.id, storage);
  assert.deepEqual(readSlots(storage).map(slot => slot.id), [two.id]);
  assert.equal(storage.getItem(CAMPAIGN_KEY), 'active campaign');
  assert.equal(storage.getItem(BACKUP_KEY), 'newer live campaign');
});

test('duplicate names, full archives and unavailable slots cannot overwrite a saved campaign', () => {
  const storage = new BrowserStorage();
  createSlot('Opening', 'original', state, storage);
  const before = storage.getItem(SLOTS_KEY);
  assert.throws(() => createSlot(' opening ', 'replacement', state, storage), /already exists/);
  assert.equal(storage.getItem(SLOTS_KEY), before);
  for (let index = 1; index < 12; index++) createSlot(`Branch ${index}`, `campaign-${index}`, state, storage);
  const full = storage.getItem(SLOTS_KEY);
  assert.throws(() => createSlot('Thirteenth', 'overflow', state, storage), /full/);
  assert.throws(() => deleteSlot('missing', storage), /no longer exists/);
  assert.equal(storage.getItem(SLOTS_KEY), full);
});

test('quota errors and damaged indexes leave both the current campaign and archive intact', () => {
  const storage = new BrowserStorage();
  const saved = createSlot('Keep this', 'stable campaign', state, storage);
  const before = new Map(storage.values);
  storage.full = true;
  assert.throws(() => createSlot('New branch', 'new', state, storage), /quota/);
  assert.throws(() => deleteSlot(saved.id, storage), /quota/);
  assert.throws(() => preserveCurrent(storage), /quota/);
  assert.deepEqual(storage.values, before);
  storage.full = false;
  storage.setItem(SLOTS_KEY, '{invalid');
  assert.throws(() => createSlot('Do not replace', 'new', state, storage));
  assert.equal(storage.getItem(SLOTS_KEY), '{invalid');
  assert.equal(storage.getItem(CAMPAIGN_KEY), 'active campaign');
});
