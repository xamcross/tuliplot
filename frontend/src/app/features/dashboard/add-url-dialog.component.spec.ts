import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AddUrlDialogComponent } from './add-url-dialog.component';

describe('AddUrlDialogComponent', () => {
  it('validates https urls and gates the Add button', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const f = TestBed.createComponent(AddUrlDialogComponent);
    f.detectChanges();
    const c = f.componentInstance;

    c.url.set('not-a-url');
    expect(c.valid()).toBe(false);

    c.url.set('http://insecure.com');
    expect(c.valid()).toBe(false);

    c.url.set('https://good.com');
    expect(c.valid()).toBe(true);
  });

  it('closes with the entered url on add', () => {
    const closeSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    });
    const c = TestBed.createComponent(AddUrlDialogComponent).componentInstance;
    c.url.set('https://good.com');
    c.add();
    expect(closeSpy).toHaveBeenCalledWith({ url: 'https://good.com', title: 'https://good.com' });
  });
});
