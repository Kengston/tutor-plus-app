/** Working-days helpers (UI-v2 S15) — CSV round-trip + the range/list label rule. */
import { describe, expect, it } from 'vitest';

import { parseWorkDays, serializeWorkDays, workDaysLabel } from './work-days';

/** Short RU names for the label tests (mirrors the i18n wd.* values). */
const NAMES: Record<number, string> = { 0: 'Вс', 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб' };
const name = (d: number) => NAMES[d];

describe('parseWorkDays', () => {
  it('null/empty/garbage reads as the Пн–Пт default', () => {
    expect(parseWorkDays(null)).toEqual([1, 2, 3, 4, 5]);
    expect(parseWorkDays('')).toEqual([1, 2, 3, 4, 5]);
    expect(parseWorkDays('x,9,-1')).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses valid indices and drops out-of-range values', () => {
    expect(parseWorkDays('1,3,5')).toEqual([1, 3, 5]);
    expect(parseWorkDays('1,7,5')).toEqual([1, 5]);
  });
});

describe('serializeWorkDays', () => {
  it('stores Mon-first regardless of input order (incl. Sunday last) and dedupes', () => {
    expect(serializeWorkDays([0, 5, 1])).toBe('1,5,0');
    expect(serializeWorkDays([3, 3, 1])).toBe('1,3');
  });
});

describe('workDaysLabel', () => {
  it('compresses a consecutive Mon-first run of 3+ into a range («Пн–Пт»)', () => {
    expect(workDaysLabel('1,2,3,4,5', name)).toBe('Пн–Пт');
    expect(workDaysLabel(null, name)).toBe('Пн–Пт'); // the default
  });

  it('lists short/non-consecutive picks («Пн, Ср, Пт»; a 2-day run stays a list)', () => {
    expect(workDaysLabel('1,3,5', name)).toBe('Пн, Ср, Пт');
    expect(workDaysLabel('6,0', name)).toBe('Сб, Вс');
  });

  it('single day → its name', () => {
    expect(workDaysLabel('3', name)).toBe('Ср');
  });
});
