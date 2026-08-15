import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpgradeComponent } from './upgrade.component';
import { AuthStore } from '../../stores/auth.store';
import { FreemiusCheckoutService } from '../../core/services/freemius-checkout.service';

type SuccessCallback = () => void;

describe('UpgradeComponent', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  let loadMe: ReturnType<typeof vi.fn>;
  let tierSignal: WritableSignal<'FREE' | 'PREMIUM'>;
  let userSignal: WritableSignal<{ email: string } | null>;

  beforeEach(() => {
    openSpy = vi.fn().mockResolvedValue(undefined);
    loadMe = vi.fn();
    tierSignal = signal<'FREE' | 'PREMIUM'>('FREE');
    userSignal = signal<{ email: string } | null>({ email: 'jane@example.com' });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthStore, useValue: { tier: tierSignal, user: userSignal, loadMe } },
        { provide: FreemiusCheckoutService, useValue: { open: openSpy } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function clickUpgrade(fixture: ReturnType<typeof TestBed.createComponent>): void {
    (fixture.nativeElement.querySelector('button.cta') as HTMLButtonElement).click();
  }

  function capturedOnSuccess(): SuccessCallback {
    return openSpy.mock.calls[0][1] as SuccessCallback;
  }

  it('clicking upgrade opens the Freemius overlay with the signed-in email', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();

    clickUpgrade(fixture);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [email, onSuccess] = openSpy.mock.calls[0];
    expect(email).toBe('jane@example.com');
    expect(typeof onSuccess).toBe('function');
  });

  it('the success callback flips the component to finalizing and calls authStore.loadMe() immediately', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();

    clickUpgrade(fixture);
    capturedOnSuccess()();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="finalizing-note"]')).toBeTruthy();
    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it('polls every 2s while the tier stays FREE, then navigates to /app once it flips to PREMIUM', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    clickUpgrade(fixture);
    capturedOnSuccess()();
    fixture.detectChanges();
    expect(loadMe).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(loadMe).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(loadMe).toHaveBeenCalledTimes(3);

    tierSignal.set('PREMIUM');
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith('/app');
    expect(loadMe).toHaveBeenCalledTimes(3);
  });

  it('ignores a second success fire for the same checkout — only one poll loop runs', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    clickUpgrade(fixture);
    const onSuccess = capturedOnSuccess();
    onSuccess();
    onSuccess();
    fixture.detectChanges();
    expect(loadMe).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(loadMe).toHaveBeenCalledTimes(2);

    tierSignal.set('PREMIUM');
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/app');
  });

  it('shows the pending-activation copy after 15 polls (30s) without a flip', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();

    clickUpgrade(fixture);
    capturedOnSuccess()();
    fixture.detectChanges();

    vi.advanceTimersByTime(15 * 2000);
    fixture.detectChanges();

    const note: HTMLElement = fixture.nativeElement.querySelector('[data-testid="pending-note"]');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('activates within a few minutes');
  });

  it('no longer mentions Stripe anywhere in the rendered page', () => {
    const fixture = TestBed.createComponent(UpgradeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Stripe');
  });
});
