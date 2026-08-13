import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CellComponent } from './cell.component';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import type { Cell } from '../../core/models/dashboard.model';

function makeCell(overrides: Partial<Cell> = {}): Cell {
  return {
    slot: 0,
    type: 'APP',
    url: 'https://mail.google.com',
    title: 'Gmail',
    catalogAppId: 'gmail',
    iconUrl: '',
    openMode: 'FRAME',
    ...overrides,
  };
}

describe('CellComponent fallback states', () => {
  let bridge: ExtensionBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ExtensionBridgeService],
    });
    bridge = TestBed.inject(ExtensionBridgeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(cell: Cell, compatibility: string | null) {
    const fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('cell', cell);
    fixture.componentRef.setInput('compatibility', compatibility);
    return fixture;
  }

  it('needs-extension when NEEDS_EXTENSION and the extension is not installed', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    expect(fixture.componentInstance.frameState()).toBe('needs-extension');
  });

  it('needs-permission when installed but the origin is not granted', async () => {
    bridge.installed.set(true);
    vi.spyOn(bridge, 'checkHost').mockResolvedValue(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.frameState()).toBe('needs-permission');
  });

  it('frame when installed and the origin is granted', async () => {
    bridge.installed.set(true);
    const checkSpy = vi.spyOn(bridge, 'checkHost').mockResolvedValue(true);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(checkSpy).toHaveBeenCalledWith('https://mail.google.com');
    expect(fixture.componentInstance.frameState()).toBe('frame');
  });

  it('onEnableForThisApp() flips to frame once the grant succeeds', async () => {
    bridge.installed.set(true);
    vi.spyOn(bridge, 'checkHost').mockResolvedValue(false);
    vi.spyOn(bridge, 'requestHost').mockResolvedValue(true);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.frameState()).toBe('needs-permission');
    await fixture.componentInstance.onEnableForThisApp();
    expect(fixture.componentInstance.frameState()).toBe('frame');
  });

  it('stays in needs-permission when the grant is denied', async () => {
    bridge.installed.set(true);
    vi.spyOn(bridge, 'checkHost').mockResolvedValue(false);
    vi.spyOn(bridge, 'requestHost').mockResolvedValue(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.onEnableForThisApp();
    expect(fixture.componentInstance.frameState()).toBe('needs-permission');
  });

  it('the needs-extension state offers install but not enable', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="needs-extension"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="enable-site-btn"]')).toBeNull();
  });

  it('the needs-permission state renders the enable button and the toolbar', async () => {
    bridge.installed.set(true);
    vi.spyOn(bridge, 'checkHost').mockResolvedValue(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="needs-permission"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="enable-site-btn"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
  });

  it('login-in-tab when openMode is WINDOW', () => {
    const fixture = create(makeCell({ openMode: 'WINDOW' }), 'REFUSES_FRAME');
    expect(fixture.componentInstance.frameState()).toBe('login-in-tab');
  });

  it('login-in-tab when compatibility is LOGIN_IN_TAB', () => {
    const fixture = create(makeCell({ openMode: 'FRAME' }), 'LOGIN_IN_TAB');
    expect(fixture.componentInstance.frameState()).toBe('login-in-tab');
  });

  it('load-failed after the frame reports a load failure', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    expect(fixture.componentInstance.frameState()).toBe('frame');
    fixture.componentInstance.onFrameLoadFailed();
    expect(fixture.componentInstance.frameState()).toBe('load-failed');
  });

  it('retry() clears the load-failure flag', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    fixture.componentInstance.onFrameLoadFailed();
    expect(fixture.componentInstance.frameState()).toBe('load-failed');
    fixture.componentInstance.retry();
    expect(fixture.componentInstance.frameState()).toBe('frame');
  });

  it('openInWindow() opens the cell url in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = create(makeCell(), 'LOGIN_IN_TAB');
    fixture.componentInstance.openInWindow();
    expect(openSpy).toHaveBeenCalledWith('https://mail.google.com', '_blank', 'noopener,noreferrer');
  });

  it('onEnableForThisApp() requests host permission for the cell origin', async () => {
    const reqSpy = vi.spyOn(bridge, 'requestHost').mockResolvedValue(true);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    await fixture.componentInstance.onEnableForThisApp();
    expect(reqSpy).toHaveBeenCalledWith('https://mail.google.com');
  });

  it('onInstallExtension() opens the web store listing', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.componentInstance.onInstallExtension();
    expect(openSpy).toHaveBeenCalledWith(
      'https://chromewebstore.google.com/search/TulipLot%20Companion',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('renders the toolbar in the needs-extension state', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="needs-extension"]')).not.toBeNull();
  });

  it('renders the toolbar in the login-in-tab state', () => {
    const fixture = create(makeCell({ openMode: 'WINDOW' }), 'LOGIN_IN_TAB');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="login-in-tab"]')).not.toBeNull();
  });

  it('renders the toolbar in the load-failed state', () => {
    const fixture = create(makeCell(), 'FRAMES_CLEAN');
    fixture.detectChanges();
    fixture.componentInstance.onFrameLoadFailed();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="load-failed"]')).not.toBeNull();
  });

  it('hides frame-only toolbar actions in fallback states', () => {
    bridge.installed.set(false);
    const fixtures = [
      create(makeCell(), 'NEEDS_EXTENSION'),
      create(makeCell({ openMode: 'WINDOW' }), 'LOGIN_IN_TAB'),
    ];
    const failed = create(makeCell(), 'FRAMES_CLEAN');
    failed.detectChanges();
    failed.componentInstance.onFrameLoadFailed();
    fixtures.push(failed);
    for (const fixture of fixtures) {
      fixture.detectChanges();
      for (const id of ['tb-reload', 'tb-focus', 'tb-popout', 'tb-sleep']) {
        expect(fixture.nativeElement.querySelector(`[data-testid="${id}"]`), id).toBeNull();
      }
      for (const id of ['tb-opentab', 'tb-edit', 'tb-remove']) {
        expect(fixture.nativeElement.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
      }
    }
  });

  it('emits remove and edit with the slot from a fallback-state toolbar', () => {
    bridge.installed.set(false);
    const fixture = create(makeCell({ slot: 3 }), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    const remove = vi.fn();
    const edit = vi.fn();
    fixture.componentInstance.remove.subscribe(remove);
    fixture.componentInstance.edit.subscribe(edit);
    (fixture.nativeElement.querySelector('[data-testid="tb-remove"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="tb-edit"]') as HTMLButtonElement).click();
    expect(remove).toHaveBeenCalledWith(3);
    expect(edit).toHaveBeenCalledWith(3);
  });

  it('toolbar open-in-tab opens the cell url in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    bridge.installed.set(false);
    const fixture = create(makeCell(), 'NEEDS_EXTENSION');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="tb-opentab"]') as HTMLButtonElement).click();
    expect(openSpy).toHaveBeenCalledWith('https://mail.google.com', '_blank', 'noopener,noreferrer');
  });
});
