import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CellComponent } from './cell.component';
import { ConsentService } from '../../core/services/consent.service';
import type { Cell } from '../../core/models/dashboard.model';

const AD_CELL: Cell = { slot: 5, type: 'AD', openMode: 'FRAME' };

function setup() {
  return TestBed.configureTestingModule({
    imports: [CellComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConsentService, useValue: { consentGranted: signal(true) } },
    ],
  }).compileComponents();
}

describe('CellComponent AD slot integration', () => {
  it('renders <dd-ad-cell> for the AD cell when the FREE ad config shows an ad', async () => {
    await setup();
    const fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('cell', AD_CELL);
    fixture.componentRef.setInput('adConfig', {
      showAd: true, adClient: '', adSlot: '',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dd-ad-cell')).toBeTruthy();
  });

  it('does not render <dd-ad-cell> when the config hides the ad (Premium)', async () => {
    await setup();
    const fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('cell', AD_CELL);
    fixture.componentRef.setInput('adConfig', {
      showAd: false, adClient: 'ca-pub-1', adSlot: '5',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dd-ad-cell')).toBeNull();
  });
});
