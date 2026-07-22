import type { Compatibility, OpenMode } from '../models/enums';

/** Human-readable badge shown in the catalog for each compatibility class. */
export function compatibilityBadge(c: Compatibility): string {
  switch (c) {
    case 'FRAMES_CLEAN':
      return 'works without extension';
    case 'NEEDS_EXTENSION':
      return 'needs extension';
    case 'LOGIN_IN_TAB':
    case 'REFUSES_FRAME':
      return 'opens in tab';
  }
}

/** The openMode a new cell should get when adding a catalog app. */
export function openModeFor(c: Compatibility): OpenMode {
  return c === 'REFUSES_FRAME' || c === 'LOGIN_IN_TAB' ? 'WINDOW' : 'FRAME';
}
