import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AdCellComponent } from './ad-cell.component';
import { ConsentService } from '../../core/services/consent.service';

function consentStub(granted: boolean) {
  return { provide: ConsentService, useValue: { consentGranted: signal(granted) } };
}

describe('AdCellComponent', () => {
  it('renders nothing when showAd is false (Premium)', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: false, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ad-cell')).toBeNull();
  });

  it('shows the house upgrade promo when adClient is empty', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: '', adSlot: '',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Remove ad — go Premium');
    expect(el.querySelector('ins.adsbygoogle')).toBeNull();
    expect(el.querySelector('[aria-label="Advertisements"]')).toBeTruthy();
  });

  it('shows the house promo when consent is absent even with an adClient', async () => {
    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(false)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ins.adsbygoogle')).toBeNull();
    expect(el.textContent).toContain('Remove ad — go Premium');
  });

  it('creates an <ins> and pushes exactly once when adClient present + consent granted', async () => {
    const pushSpy = vi.fn();
    (window as unknown as { adsbygoogle?: unknown }).adsbygoogle = { push: pushSpy };

    await TestBed.configureTestingModule({
      imports: [AdCellComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), consentStub(true)],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdCellComponent);
    fixture.componentRef.setInput('config', {
      showAd: true, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const ins = fixture.nativeElement.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins).toBeTruthy();
    expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-1');
    expect(ins.getAttribute('data-ad-slot')).toBe('5');
    expect(ins.getAttribute('data-full-width-responsive')).toBe('false');
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});
