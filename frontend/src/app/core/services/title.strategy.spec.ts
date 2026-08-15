import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { TlTitleStrategy } from './title.strategy';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('TlTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'titled', component: BlankComponent, title: 'Dashboard' },
          { path: 'untitled', component: BlankComponent },
        ]),
        { provide: TitleStrategy, useClass: TlTitleStrategy },
      ],
    });
  });

  it('sets "<route title> · TulipLot" when the route declares a title', async () => {
    await RouterTestingHarness.create('/titled');
    expect(TestBed.inject(Title).getTitle()).toBe('Dashboard · TulipLot');
  });

  it('leaves the current title alone when the route declares none', async () => {
    TestBed.inject(Title).setTitle('Pre-set · TulipLot');
    await RouterTestingHarness.create('/untitled');
    expect(TestBed.inject(Title).getTitle()).toBe('Pre-set · TulipLot');
  });
});
