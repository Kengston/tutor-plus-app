/** Series materialization (UI-v2 S6, ADR-0016): rolling-window generation + idempotency. */
import { describe, expect, it } from 'vitest';

import { materializeSlots, type ExistingOccurrence } from './schedule-slots';
import type { ScheduleSlot } from './types';

/** A Mon+Wed 16:00 slot (weekday 1 & 3), open-ended from a base day. */
function slot(over: Partial<ScheduleSlot> & Pick<ScheduleSlot, 'id' | 'weekday'>): ScheduleSlot {
  return {
    studentId: 's1',
    timeMin: 16 * 60,
    durationMin: 60,
    format: 'online',
    price: 1500,
    subjectId: null,
    activeFrom: 0,
    activeTo: null,
    createdAt: 0,
    ...over,
  };
}

// A fixed week: Mon 2026-07-13 .. Sun 2026-07-19 (local midnights).
const MON = new Date(2026, 6, 13).getTime();
const day = (offset: number) => new Date(2026, 6, 13 + offset).getTime();
const WEEK_END = day(7);
// A baseline "now" = the window's first midnight, before every 16:00 occurrence.
const NOW = MON;

describe('materializeSlots', () => {
  it('generates one lesson per matching weekday in the window', () => {
    const out = materializeSlots({
      slots: [slot({ id: 'mon', weekday: 1 }), slot({ id: 'wed', weekday: 3 })],
      existing: [],
      windowStart: MON,
      windowEnd: WEEK_END,
      now: NOW,
    });
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.slotDate)).toEqual([MON, day(2)]); // Mon + Wed
    expect(out[0].startsAt).toBe(MON + 16 * 60 * 60_000);
    expect(out[0].slotId).toBe('mon');
  });

  it('is idempotent — a repeat run over the just-created occurrences yields nothing', () => {
    const slots = [slot({ id: 'mon', weekday: 1 })];
    const first = materializeSlots({ slots, existing: [], windowStart: MON, windowEnd: WEEK_END, now: NOW });
    const existing: ExistingOccurrence[] = first.map((l) => ({ slotId: l.slotId, slotDate: l.slotDate }));
    const second = materializeSlots({ slots, existing, windowStart: MON, windowEnd: WEEK_END, now: NOW });
    expect(second).toEqual([]);
  });

  it('does not regenerate a manually rescheduled lesson (same slotId+slotDate, different startsAt)', () => {
    const slots = [slot({ id: 'mon', weekday: 1 })];
    // The user moved Monday's lesson to another time but it keeps its occurrence key.
    const existing: ExistingOccurrence[] = [{ slotId: 'mon', slotDate: MON }];
    const out = materializeSlots({ slots, existing, windowStart: MON, windowEnd: WEEK_END, now: NOW });
    expect(out).toEqual([]);
  });

  it('never materializes a past-dated occurrence (slot time on today already gone)', () => {
    const slots = [slot({ id: 'mon', weekday: 1 }), slot({ id: 'wed', weekday: 3 })];
    // now = Monday 18:00 → Monday's 16:00 is in the past and must be skipped; Wed stays.
    const out = materializeSlots({
      slots,
      existing: [],
      windowStart: MON,
      windowEnd: WEEK_END,
      now: MON + 18 * 60 * 60_000,
    });
    expect(out.map((l) => l.slotId)).toEqual(['wed']);
    expect(out[0].slotDate).toBe(day(2));
  });

  it('respects activeFrom (no lessons before the slot starts)', () => {
    const out = materializeSlots({
      slots: [slot({ id: 'mon', weekday: 1, activeFrom: day(7) })], // starts next week
      existing: [],
      windowStart: MON,
      windowEnd: WEEK_END,
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it('respects activeTo (exclusive — no lesson on the closing day)', () => {
    const out = materializeSlots({
      slots: [slot({ id: 'mon', weekday: 1, activeTo: MON })], // closes on the Monday itself
      existing: [],
      windowStart: MON,
      windowEnd: WEEK_END,
      now: NOW,
    });
    expect(out).toEqual([]);
  });

  it('generates across a two-week window (each weekly slot fires twice)', () => {
    const out = materializeSlots({
      slots: [slot({ id: 'mon', weekday: 1 })],
      existing: [],
      windowStart: MON,
      windowEnd: day(14),
      now: NOW,
    });
    expect(out.map((l) => l.slotDate)).toEqual([MON, day(7)]);
  });

  it('returns nothing for an empty slot set or a non-positive window', () => {
    expect(materializeSlots({ slots: [], existing: [], windowStart: MON, windowEnd: WEEK_END, now: NOW })).toEqual([]);
    expect(materializeSlots({ slots: [slot({ id: 'mon', weekday: 1 })], existing: [], windowStart: WEEK_END, windowEnd: MON, now: NOW })).toEqual([]);
  });
});
