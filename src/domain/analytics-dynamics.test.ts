/**
 * Analytics · Динамика domain (UI-v2 S12, spec 08 §8.2). Pins issue #30: the «Ученики»
 * metric, the 4 sub-ranges the line chart is built over, metric recompute per sub-range,
 * and the «ГЛАВНОЕ ЗА ПЕРИОД» highlight (incl. its empty state).
 */
import { describe, expect, it } from 'vitest';

import { customRange, monthOf, periodQuarters, yearOf } from '@/lib/period';

import { activeStudentsInPeriod, dynamicsHighlight, incomeInPeriod } from './aggregates';

const MAY = 4;
const at = (month: number, day: number, h = 12) => new Date(2026, month, day, h, 0, 0).getTime();
const may = monthOf(at(MAY, 15));

const lesson = (studentId: string, day: number, life: 'done' | 'upcoming' | 'cancelled' = 'done') =>
  ({ studentId, lifecycleStatus: life, startsAt: at(MAY, day) });

describe('activeStudentsInPeriod (Ученики)', () => {
  it('counts DISTINCT students with a conducted lesson in period', () => {
    const n = activeStudentsInPeriod(
      [lesson('a', 5), lesson('a', 12), lesson('b', 20), lesson('c', 8, 'upcoming'), lesson('d', 9, 'cancelled')],
      may,
    );
    expect(n).toBe(2); // a (twice → once) + b; upcoming/cancelled excluded
  });
});

describe('periodQuarters', () => {
  it('splits a month into the spec intervals 1–7 / 8–14 / 15–21 / 22–end', () => {
    const q = periodQuarters(may);
    expect(q).toHaveLength(4);
    expect(new Date(q[0].start).getDate()).toBe(1);
    expect(new Date(q[1].start).getDate()).toBe(8);
    expect(new Date(q[2].start).getDate()).toBe(15);
    expect(new Date(q[3].start).getDate()).toBe(22);
    expect(q[3].end).toBe(may.end); // last absorbs the 29–31 tail
    // contiguous, no gaps
    expect(q[0].end).toBe(q[1].start);
    expect(q[1].end).toBe(q[2].start);
    expect(q[2].end).toBe(q[3].start);
  });

  it('splits a year into CALENDAR quarters (labels stay meaningful — review fix S12)', () => {
    const q = periodQuarters(yearOf(at(MAY, 15)));
    expect(q.map((x) => new Date(x.start).getMonth())).toEqual([0, 3, 6, 9]); // Янв/Апр/Июл/Окт
    expect(new Date(q[3].end).getFullYear()).toBe(2027); // last ends exactly at next Jan 1
    expect(q[0].end).toBe(q[1].start);
    expect(q[2].end).toBe(q[3].start);
  });

  it('splits a custom range into 4 DAY-ALIGNED contiguous chunks ending exactly at end', () => {
    const p = customRange(at(MAY, 1), at(MAY, 8)); // 8 inclusive days → 2+2+2+2
    const q = periodQuarters(p);
    expect(q.map((x) => new Date(x.start).getDate())).toEqual([1, 3, 5, 7]);
    expect(q[3].end).toBe(p.end);
    // midnight-aligned boundaries → day-range labels can never overlap
    for (const x of q) expect(new Date(x.start).getHours()).toBe(0);
  });
});

describe('metric series over quarters (селектор пересчитывает график)', () => {
  it('income per sub-range follows the txn dates', () => {
    const paid = (amount: number, day: number) =>
      ({ id: 'p', studentId: 's', type: 'paid' as const, amount, lessonId: null, subjectId: null, occurredAt: at(MAY, day), method: null });
    const txns = [paid(1000, 3), paid(2000, 10), paid(4000, 25)];
    const series = periodQuarters(may).map((q) => incomeInPeriod(txns, q));
    expect(series).toEqual([1000, 2000, 0, 4000]);
  });
});

describe('dynamicsHighlight (ГЛАВНОЕ ЗА ПЕРИОД)', () => {
  it('picks the sub-range with the largest divergence and signs it', () => {
    expect(dynamicsHighlight([10, 12, 11, 15], [10, 11, 12, 12])).toEqual({ quarter: 3, diff: 3, dir: 'up' });
    expect(dynamicsHighlight([8, 5, 11, 12], [10, 11, 12, 12])).toEqual({ quarter: 1, diff: 6, dir: 'down' });
  });

  it('returns null on empty/equal/zero-baseline data (correct empty state)', () => {
    expect(dynamicsHighlight([], [])).toBeNull();
    expect(dynamicsHighlight([5, 5], [5, 5])).toBeNull();
    expect(dynamicsHighlight([3, 4], [0, 0])).toBeNull(); // no baseline → nothing to compare
  });
});
