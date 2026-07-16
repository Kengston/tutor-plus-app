/** Day timeline segmentation (UI-v2 S5): lessons + free-window gaps. */
import { describe, expect, it } from 'vitest';

import { BOOKABLE_GAP_MIN, daySegments, isBookableGap } from './day-timeline';

/** Lesson stub at hour h (local UTC for the test), lasting `dur` minutes. */
const L = (id: string, h: number, dur: number) => ({ id, startsAt: Date.UTC(2026, 6, 13, h), durationMin: dur });

describe('daySegments', () => {
  it('returns just the lessons when they are back-to-back (no gap)', () => {
    const segs = daySegments([L('a', 10, 60), L('b', 11, 60)]);
    expect(segs.map((s) => s.type)).toEqual(['lesson', 'lesson']);
  });

  it('inserts a gap segment between spaced lessons with correct minutes', () => {
    const segs = daySegments([L('a', 10, 60), L('b', 13, 45)]); // 11:00 → 13:00 = 120 min
    expect(segs.map((s) => s.type)).toEqual(['lesson', 'gap', 'lesson']);
    const gap = segs[1];
    if (gap.type !== 'gap') throw new Error('expected gap');
    expect(gap.mins).toBe(120);
    expect(gap.start).toBe(Date.UTC(2026, 6, 13, 11));
    expect(gap.end).toBe(Date.UTC(2026, 6, 13, 13));
  });

  it('sorts unsorted input before segmenting', () => {
    const segs = daySegments([L('b', 15, 60), L('a', 10, 60)]);
    const ids = segs.filter((s) => s.type === 'lesson').map((s) => (s.type === 'lesson' ? s.lesson.id : ''));
    expect(ids).toEqual(['a', 'b']);
  });

  it('produces no gap for an overlapping lesson', () => {
    const segs = daySegments([L('a', 10, 120), L('b', 11, 30)]); // b starts inside a
    expect(segs.map((s) => s.type)).toEqual(['lesson', 'lesson']);
  });

  it('does not let a short lesson nested in a long one shrink the frontier', () => {
    // a: 10:00–12:00, b: 10:30–11:00 (nested), c: 13:00 → gap must be 12:00→13:00 = 60
    const segs = daySegments([L('a', 10, 120), L('b', 10.5, 30), L('c', 13, 60)]);
    const gap = segs.find((s) => s.type === 'gap');
    if (!gap || gap.type !== 'gap') throw new Error('expected a gap');
    expect(gap.start).toBe(Date.UTC(2026, 6, 13, 12));
    expect(gap.mins).toBe(60);
  });

  it('is empty for an empty day', () => {
    expect(daySegments([])).toEqual([]);
  });
});

describe('isBookableGap', () => {
  it('is true for a gap ≥ 60 min and false below', () => {
    expect(isBookableGap({ type: 'gap', start: 0, end: BOOKABLE_GAP_MIN * 60_000, mins: BOOKABLE_GAP_MIN })).toBe(true);
    expect(isBookableGap({ type: 'gap', start: 0, end: 59 * 60_000, mins: 59 })).toBe(false);
  });

  it('is false for a lesson segment', () => {
    expect(isBookableGap({ type: 'lesson', lesson: L('a', 10, 60) })).toBe(false);
  });
});
