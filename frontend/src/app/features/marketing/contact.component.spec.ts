import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ContactComponent } from './contact.component';

describe('ContactComponent', () => {
  it('renders a contact heading and a mailto link', async () => {
    await TestBed.configureTestingModule({
      imports: [ContactComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ContactComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Contact');
    expect(el.querySelector('a[href^="mailto:"]')).toBeTruthy();
  });
});
