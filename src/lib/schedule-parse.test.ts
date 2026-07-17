/** Legacy schedule-string parser (UI-v2 S6 migration). */
import { describe, expect, it } from 'vitest';

import { parseScheduleString } from './schedule-parse';

describe('parseScheduleString', () => {
  it('parses «Пн, Ср · 16:00» into two slot seeds', () => {
    expect(parseScheduleString('Пн, Ср · 16:00')).toEqual([
      { weekday: 1, timeMin: 960 },
      { weekday: 3, timeMin: 960 },
    ]);
  });

  it('parses a single day «Сб · 11:00»', () => {
    expect(parseScheduleString('Сб · 11:00')).toEqual([{ weekday: 6, timeMin: 660 }]);
  });

  it('is tolerant of separators and casing', () => {
    expect(parseScheduleString('пн вт  чт 09:30')).toEqual([
      { weekday: 1, timeMin: 570 },
      { weekday: 2, timeMin: 570 },
      { weekday: 4, timeMin: 570 },
    ]);
  });

  it('dedupes repeated weekdays', () => {
    expect(parseScheduleString('Пн, Пн · 10:00')).toEqual([{ weekday: 1, timeMin: 600 }]);
  });

  it('returns [] for the placeholder «—» and empty input', () => {
    expect(parseScheduleString('—')).toEqual([]);
    expect(parseScheduleString('')).toEqual([]);
  });

  it('returns [] when there is no time', () => {
    expect(parseScheduleString('Пн, Ср')).toEqual([]);
  });

  it('returns [] for an unparseable string (no known weekday) without throwing', () => {
    expect(parseScheduleString('каждый день 12:00')).toEqual([]);
    expect(parseScheduleString('по договорённости')).toEqual([]);
  });

  it('rejects an out-of-range time', () => {
    expect(parseScheduleString('Пн · 25:00')).toEqual([]);
  });
});
