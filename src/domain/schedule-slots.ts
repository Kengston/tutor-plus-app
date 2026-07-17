/**
 * Series materialization (UI-v2 S6, ADR-0016): generate concrete lessons from a
 * student's recurring `ScheduleSlot`s into a rolling window. Pure — no persistence/
 * React/i18n, unit-tested (vitest). Local wall-clock is resolved with the device's
 * timezone via `new Date(y, m, d)` (RU has no DST, ADR-0005), matching the rest of
 * the schedule screen.
 *
 * Idempotency (ADR-0016): each materialized lesson records `slotId` + `slotDate` (the
 * local-midnight ms of its intended occurrence). The generator skips any (slotId,
 * slotDate) that already exists — so a repeat run creates nothing new, and a manually
 * edited/rescheduled lesson (which keeps its slotId+slotDate) is never regenerated.
 */
import type { Duration, LessonFormat, ScheduleSlot } from './types';

/** Local-midnight ms for the day containing `ms`. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** A lesson to create from a slot occurrence — the shape the DB writer consumes. */
export interface MaterializedLesson {
  studentId: string;
  subjectId: string | null;
  startsAt: number;
  durationMin: Duration;
  format: LessonFormat;
  price: number;
  slotId: string;
  /** Local-midnight ms of the occurrence — the idempotency key with `slotId`. */
  slotDate: number;
}

/** An already-materialized occurrence, to dedupe against (any lifecycle, incl. cancelled). */
export interface ExistingOccurrence {
  slotId: string | null;
  slotDate: number | null;
}

/** Composite key for the (slot, occurrence-day) idempotency check. */
function occKey(slotId: string, slotDate: number): string {
  return `${slotId}|${slotDate}`;
}

/**
 * Lessons to create for `slots` over `[windowStart, windowEnd)` (ms), skipping every
 * occurrence that already exists in `existing`. A slot contributes on a day when the
 * day's weekday matches and the day is within `[activeFrom, activeTo)`. Only FUTURE
 * occurrences are produced — an occurrence at or before `now` is skipped, so a slot
 * whose time on today has already passed does not create a past-dated «upcoming»
 * lesson (ADR-0016: forward generation only). Deterministic and idempotent: calling
 * it again with the freshly-created lessons in `existing` yields an empty array.
 */
export function materializeSlots(params: {
  slots: readonly ScheduleSlot[];
  existing: readonly ExistingOccurrence[];
  windowStart: number;
  windowEnd: number;
  /** Occurrences at or before this instant are skipped (no past-dated lessons). */
  now: number;
}): MaterializedLesson[] {
  const { slots, existing, windowStart, windowEnd, now } = params;
  if (slots.length === 0 || windowEnd <= windowStart) return [];

  const taken = new Set<string>();
  for (const e of existing) {
    if (e.slotId != null && e.slotDate != null) taken.add(occKey(e.slotId, e.slotDate));
  }

  const out: MaterializedLesson[] = [];
  // Iterate whole local days from the window's first day up to (not incl.) windowEnd.
  const first = new Date(startOfDay(windowStart));
  for (let d = first; d.getTime() < windowEnd; d.setDate(d.getDate() + 1)) {
    const dayMs = d.getTime();
    const weekday = d.getDay();
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      if (dayMs < slot.activeFrom) continue;
      if (slot.activeTo != null && dayMs >= slot.activeTo) continue;
      const startsAt = dayMs + slot.timeMin * 60_000;
      if (startsAt <= now) continue; // never materialize a lesson in the past
      const key = occKey(slot.id, dayMs);
      if (taken.has(key)) continue;
      taken.add(key); // guard against duplicate slots landing on the same day
      out.push({
        studentId: slot.studentId,
        subjectId: slot.subjectId,
        startsAt,
        durationMin: slot.durationMin,
        format: slot.format,
        price: slot.price,
        slotId: slot.id,
        slotDate: dayMs,
      });
    }
  }
  return out;
}
