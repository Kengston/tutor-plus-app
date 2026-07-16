/** «Авто» theme clock rule (UI-v2 S16, ADR-0017) — 19:00–7:00 boundaries + timer math. */
import { describe, expect, it } from 'vitest';

import { isEveningAt, msUntilThemeBoundary } from './auto-theme';

const at = (h: number, m = 0) => new Date(2026, 6, 16, h, m, 0, 0).getTime();
const MIN = 60_000;

describe('isEveningAt (Авто = Вечер с 19:00 до 7:00)', () => {
  it('flips dark exactly at 19:00 and light exactly at 7:00', () => {
    expect(isEveningAt(at(18, 59))).toBe(false);
    expect(isEveningAt(at(19, 0))).toBe(true);
    expect(isEveningAt(at(23, 59))).toBe(true);
    expect(isEveningAt(at(0, 0))).toBe(true);
    expect(isEveningAt(at(6, 59))).toBe(true);
    expect(isEveningAt(at(7, 0))).toBe(false);
    expect(isEveningAt(at(12, 0))).toBe(false);
  });
});

describe('msUntilThemeBoundary', () => {
  it('daytime → until today 19:00', () => {
    expect(msUntilThemeBoundary(at(12, 0))).toBe(7 * 60 * MIN);
    expect(msUntilThemeBoundary(at(18, 59))).toBe(1 * MIN);
  });

  it('evening → until tomorrow 07:00', () => {
    expect(msUntilThemeBoundary(at(19, 0))).toBe(12 * 60 * MIN);
    expect(msUntilThemeBoundary(at(23, 0))).toBe(8 * 60 * MIN);
  });

  it('early morning → until today 07:00; always positive', () => {
    expect(msUntilThemeBoundary(at(6, 0))).toBe(60 * MIN);
    expect(msUntilThemeBoundary(at(6, 59))).toBe(1 * MIN);
    expect(msUntilThemeBoundary(at(7, 0))).toBeGreaterThan(0); // next is 19:00
  });
});
