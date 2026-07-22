import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  it('discloses Google advertising cookies and consent handling', async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Google AdSense');
    expect(text.toLowerCase()).toContain('cookies');
    expect(text).toContain('consent');
  });
});
