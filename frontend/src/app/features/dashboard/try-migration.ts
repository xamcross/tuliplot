import { Cell } from '../../core/models/dashboard.model';
import { TRY_STORAGE_KEY } from './anonymous-dashboard.store';

/** Cells a visitor configured on /try before signing up; [] if none or unreadable. */
export function pendingTryCells(): Cell[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(TRY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Cell[]).filter((c) => c?.type === 'APP') : [];
  } catch {
    return [];
  }
}

export function clearTryCells(): void {
  try {
    localStorage.removeItem(TRY_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Drops pending cells into the account's empty slots, never displacing anything the user
 * already has and never touching the ad slot. Returns null when there is nothing to apply.
 */
export function mergeIntoEmptySlots(current: Cell[], pending: Cell[]): Cell[] | null {
  if (pending.length === 0) return null;
  const merged = current.map((c) => ({ ...c }));
  let applied = 0;
  for (const cell of pending) {
    const target = merged.find((c) => c.type === 'EMPTY');
    if (!target) break;
    Object.assign(target, { ...cell, slot: target.slot });
    applied += 1;
  }
  return applied > 0 ? merged : null;
}
