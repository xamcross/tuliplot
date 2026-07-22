import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CellComponent } from './cell.component';
import { Cell } from '../../core/models/dashboard.model';

function render(cell: Cell) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(CellComponent);
  f.componentRef.setInput('cell', cell);
  f.detectChanges();
  return f;
}

describe('CellComponent', () => {
  it('renders an add button for EMPTY', () => {
    const f = render({ slot: 0, type: 'EMPTY', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="add-btn"]')).not.toBeNull();
  });

  it('renders <tl-ad-cell> for AD when the config shows an ad', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const f = TestBed.createComponent(CellComponent);
    f.componentRef.setInput('cell', { slot: 5, type: 'AD', openMode: 'FRAME' } as Cell);
    f.componentRef.setInput('adConfig', { showAd: true, adClient: '', adSlot: '' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('tl-ad-cell')).not.toBeNull();
  });

  it('renders the toolbar and a safe-frame for APP', () => {
    const f = render({ slot: 1, type: 'APP', url: 'https://example.com', title: 'Ex', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('tl-safe-frame')).not.toBeNull();
  });
});
