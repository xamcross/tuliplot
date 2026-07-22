import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  it('renders the marketing nav with a register CTA', async () => {
    TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/guides');
    expect(hrefs).toContain('/blog');
    expect(hrefs).toContain('/login');
    expect(hrefs).toContain('/register');
    expect(el.textContent).toContain('TulipLot');
  });
});
