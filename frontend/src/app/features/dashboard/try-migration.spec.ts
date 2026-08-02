import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mergeIntoEmptySlots, pendingTryCells, clearTryCells } from './try-migration';
import { TRY_STORAGE_KEY } from './anonymous-dashboard.store';
import type { Cell } from '../../core/models/dashboard.model';

const app = (slot: number, title: string): Cell =>
  ({ slot, type: 'APP', url: 'https://example.com', title, openMode: 'FRAME' });
const empty = (slot: number): Cell => ({ slot, type: 'EMPTY', openMode: 'FRAME' });
const ad = (slot: number): Cell => ({ slot, type: 'AD', openMode: 'FRAME' });

describe('try migration', () => {
  beforeEach(() => localStorage.removeItem(TRY_STORAGE_KEY));
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(TRY_STORAGE_KEY); });

  it('places pending cells into the first empty slots', () => {
    const current = [empty(0), app(1, 'Existing'), empty(2), empty(3), empty(4), ad(5)];
    const merged = mergeIntoEmptySlots(current, [app(0, 'Tried A'), app(1, 'Tried B')]);
    expect(merged!.map((c) => c.title)).toEqual(['Tried A', 'Existing', 'Tried B', undefined, undefined, undefined]);
  });

  it('never overwrites an occupied slot or the ad slot', () => {
    const current = [app(0, 'A'), app(1, 'B'), app(2, 'C'), app(3, 'D'), app(4, 'E'), ad(5)];
    expect(mergeIntoEmptySlots(current, [app(0, 'Tried')])).toBeNull();
  });

  it('fills an empty slot 5 too, e.g. a Premium account with no ad cell there', () => {
    const current = [app(0, 'A'), app(1, 'B'), app(2, 'C'), app(3, 'D'), app(4, 'E'), empty(5)];
    const merged = mergeIntoEmptySlots(current, [app(0, 'Tried')]);
    expect(merged!.map((c) => c.title)).toEqual(['A', 'B', 'C', 'D', 'E', 'Tried']);
  });

  it('returns null when there is nothing pending', () => {
    expect(mergeIntoEmptySlots([empty(0), ad(5)], [])).toBeNull();
  });

  it('reads and clears storage, tolerating garbage', () => {
    localStorage.setItem(TRY_STORAGE_KEY, JSON.stringify([app(0, 'Tried')]));
    expect(pendingTryCells().map((c) => c.title)).toEqual(['Tried']);
    clearTryCells();
    expect(pendingTryCells()).toEqual([]);
    localStorage.setItem(TRY_STORAGE_KEY, 'not json');
    expect(pendingTryCells()).toEqual([]);
  });
});
