import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
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

  it('renders the Advertisements placeholder for AD', () => {
    const f = render({ slot: 5, type: 'AD', openMode: 'FRAME' });
    const ad = f.nativeElement.querySelector('[data-testid="ad-slot"]');
    expect(ad).not.toBeNull();
    expect(ad!.textContent).toContain('Advertisements');
  });

  it('renders the toolbar and app body for APP', () => {
    const f = render({ slot: 1, type: 'APP', url: 'https://example.com', title: 'Ex', openMode: 'FRAME' });
    expect(f.nativeElement.querySelector('[data-testid="cell-toolbar"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('[data-testid="app-body"]')).not.toBeNull();
  });
});
