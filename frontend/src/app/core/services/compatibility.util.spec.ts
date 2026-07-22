import { describe, it, expect } from 'vitest';
import { compatibilityBadge, openModeFor } from './compatibility.util';

describe('compatibilityBadge', () => {
  it('labels FRAMES_CLEAN as works without extension', () => {
    expect(compatibilityBadge('FRAMES_CLEAN')).toBe('works without extension');
  });

  it('labels NEEDS_EXTENSION as needs extension', () => {
    expect(compatibilityBadge('NEEDS_EXTENSION')).toBe('needs extension');
  });

  it('labels LOGIN_IN_TAB as opens in tab', () => {
    expect(compatibilityBadge('LOGIN_IN_TAB')).toBe('opens in tab');
  });

  it('labels REFUSES_FRAME as opens in tab', () => {
    expect(compatibilityBadge('REFUSES_FRAME')).toBe('opens in tab');
  });
});

describe('openModeFor', () => {
  it('uses WINDOW for REFUSES_FRAME', () => {
    expect(openModeFor('REFUSES_FRAME')).toBe('WINDOW');
  });

  it('uses WINDOW for LOGIN_IN_TAB', () => {
    expect(openModeFor('LOGIN_IN_TAB')).toBe('WINDOW');
  });

  it('uses FRAME for FRAMES_CLEAN', () => {
    expect(openModeFor('FRAMES_CLEAN')).toBe('FRAME');
  });

  it('uses FRAME for NEEDS_EXTENSION', () => {
    expect(openModeFor('NEEDS_EXTENSION')).toBe('FRAME');
  });
});
