import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { RouterLink, UrlSerializer, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { TrailingSlashUrlSerializer, withTrailingSlash } from './trailing-slash-url.serializer';

describe('withTrailingSlash', () => {
  it('appends a slash to a path and keeps the root as "/"', () => {
    expect(withTrailingSlash('/guides')).toBe('/guides/');
    expect(withTrailingSlash('/blog/tuliplot-vs-toby')).toBe('/blog/tuliplot-vs-toby/');
    expect(withTrailingSlash('/guides/')).toBe('/guides/');
    expect(withTrailingSlash('/')).toBe('/');
    expect(withTrailingSlash('')).toBe('/');
  });

  it('keeps query and fragment after the slash', () => {
    expect(withTrailingSlash('/app?checkout=success')).toBe('/app/?checkout=success');
    expect(withTrailingSlash('/guides#faq')).toBe('/guides/#faq');
    expect(withTrailingSlash('/app/?checkout=success')).toBe('/app/?checkout=success');
    expect(withTrailingSlash('/?utm=x')).toBe('/?utm=x');
  });
});

describe('TrailingSlashUrlSerializer', () => {
  const s = new TrailingSlashUrlSerializer();

  it('serializes both slash forms of a parsed URL to the slash form', () => {
    expect(s.serialize(s.parse('/guides'))).toBe('/guides/');
    expect(s.serialize(s.parse('/guides/'))).toBe('/guides/');
    expect(s.serialize(s.parse('/'))).toBe('/');
    expect(s.serialize(s.parse('/app?checkout=success'))).toBe('/app/?checkout=success');
  });
});

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<a id="root" routerLink="/">Home</a><a id="guides" routerLink="/guides">Guides</a><a id="post" [routerLink]="['/blog', 'x']">Post</a>`,
})
class HostComponent {}

describe('routerLink with TrailingSlashUrlSerializer', () => {
  it('renders hrefs with a trailing slash; the root stays "/"', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
      ],
    });
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#root')?.getAttribute('href')).toBe('/');
    expect(el.querySelector('#guides')?.getAttribute('href')).toBe('/guides/');
    expect(el.querySelector('#post')?.getAttribute('href')).toBe('/blog/x/');
  });
});
