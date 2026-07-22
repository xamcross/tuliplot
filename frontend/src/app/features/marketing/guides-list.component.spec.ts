import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { GuidesListComponent } from './guides-list.component';
import { GUIDES } from './content.generated';

describe('GuidesListComponent', () => {
  it('renders one linked card per guide in the registry', async () => {
    await TestBed.configureTestingModule({
      imports: [GuidesListComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(GuidesListComponent);
    fixture.detectChanges();

    expect(GUIDES.length).toBeGreaterThanOrEqual(3);
    const cards = (fixture.nativeElement as HTMLElement)
      .querySelectorAll('a.content-card');
    expect(cards.length).toBe(GUIDES.length);
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain(GUIDES[0].title);
  });
});
