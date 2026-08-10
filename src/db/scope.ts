/**
 * Series scope operations (UI-v2 S7, ADR-0016 §3–4) — cancel or reschedule a lesson with
 * scope «one / following / all», applied as a single batched write with a batched undo.
 *
 * The affected set is chosen by the pure `domain/scope` (watershed + protection), so the
 * PAST is never touched and conducted/cancelled/money-carrying occurrences are preserved.
 * «following»/«all» also close (cancel) or re-time (reschedule) the underlying slot from
 * the watershed so future materialization follows the change. Every mutation captures a
 * snapshot; the returned `undo` restores all of them (the «Вернуть» snack, S1).
 */
import { Q } from '@nozbe/watermelondb';

import { scopeAffectedLessons, type Scope } from '@/domain/scope';
import { withoutReversals } from '@/domain/undo';

import { database } from '.';
import { LessonModel, ScheduleSlotModel, TransactionModel } from './models';

const lessonsC = () => database.get<LessonModel>('lessons');
const slotsC = () => database.get<ScheduleSlotModel>('schedule_slots');
const txnsC = () => database.get<TransactionModel>('transactions');

/** Local-midnight ms for the day containing `ms` (device tz; RU has no DST, ADR-0005). */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Minutes-since-local-midnight of an instant (a slot's time-of-day). */
function timeOfDayMin(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Lesson ids carrying a non-reversed money operation — protected from scope edits. */
async function protectedLessonIds(): Promise<Set<string>> {
  const all = await txnsC().query().fetch();
  const effective = withoutReversals(all);
  const ids = new Set<string>();
  for (const t of effective) if (t.lessonId) ids.add(t.lessonId);
  return ids;
}

/** Snapshot of everything a scope op touches, so it can be restored by `undo`. */
interface LessonSnapshot {
  id: string;
  lifecycleStatus: LessonModel['lifecycleStatus'];
  cancelReason: string | null;
  comment: string | null;
  startsAt: number;
  modified: boolean;
}
interface SlotSnapshot {
  id: string;
  timeMin: number;
  activeTo: number | null;
}
export interface ScopeUndo {
  affected: number;
  undo: () => Promise<void>;
  /** Why a refusal (affected === 0) happened, when the generic protection text would lie:
   *  'weekday' — a series-wide reschedule picked another day (supported via the slot editor). */
  reason?: 'weekday';
}

/** Snapshot the current state of a set of lessons (for batched undo). */
function snapshot(lessons: readonly LessonModel[]): LessonSnapshot[] {
  return lessons.map((l) => ({
    id: l.id,
    lifecycleStatus: l.lifecycleStatus,
    cancelReason: l.cancelReason,
    comment: l.comment,
    startsAt: l.startsAt,
    modified: l.modified,
  }));
}

/** Restore lessons + an optional slot to a captured snapshot (the «Вернуть» action). */
function makeUndo(lessonSnaps: LessonSnapshot[], slotSnap: SlotSnapshot | null): () => Promise<void> {
  return async () => {
    await database.write(async () => {
      for (const s of lessonSnaps) {
        const l = await lessonsC().find(s.id).catch(() => null);
        if (!l) continue;
        await l.update((m) => {
          m.lifecycleStatus = s.lifecycleStatus;
          m.cancelReason = s.cancelReason;
          m.comment = s.comment;
          m.startsAt = s.startsAt;
          m.modified = s.modified;
        });
      }
      if (slotSnap) {
        const slot = await slotsC().find(slotSnap.id).catch(() => null);
        if (slot) await slot.update((m) => {
          m.timeMin = slotSnap.timeMin;
          m.activeTo = slotSnap.activeTo;
        });
      }
    });
  };
}

/** Fetch the anchor's sibling lessons (same slot) as slices the domain reasons about. */
async function siblingsOf(slotId: string): Promise<LessonModel[]> {
  return lessonsC().query(Q.where('slot_id', slotId)).fetch();
}

/**
 * Cancel `anchor` with `scope`, writing `reason` on every affected occurrence. For
 * following/all the underlying slot is closed at the watershed so no future lessons
 * regenerate. Returns the affected count + a batched `undo`.
 */
export async function scopeCancel(anchor: LessonModel, scope: Scope, reason: string): Promise<ScopeUndo> {
  const today = startOfDay(Date.now());
  const protectedIds = await protectedLessonIds();
  const siblings = anchor.slotId ? await siblingsOf(anchor.slotId) : [];

  const affectedIds = new Set(
    scopeAffectedLessons({ anchor, siblings, scope, today, protectedIds }),
  );
  // Use the passed-in `anchor` instance for its own id — it is the one the caller's
  // detail screen observes, so mutating it (not a re-fetched sibling copy) drives the
  // live re-render; other affected occurrences come from the sibling query.
  const affected = siblings.filter((l) => affectedIds.has(l.id)).map((l) => (l.id === anchor.id ? anchor : l));
  if (!affected.some((l) => l.id === anchor.id) && affectedIds.has(anchor.id)) affected.push(anchor);

  // Everything was protected (money/conducted/cancelled) or fell outside the window → the
  // operation is a NO-OP, and that has to include the SLOT. Closing the series here would
  // stop future materialization for good while the caller reports «изменение не применено»
  // — and a refusal carries no «Вернуть», so the damage would be silent and unrecoverable.
  if (affected.length === 0) return { affected: 0, undo: async () => {} };

  const lessonSnaps = snapshot(affected);
  // Close the slot for series-wide scopes (following: from the anchor day; all: from today).
  const slot = scope !== 'one' && anchor.slotId ? await slotsC().find(anchor.slotId).catch(() => null) : null;
  const slotSnap: SlotSnapshot | null = slot ? { id: slot.id, timeMin: slot.timeMin, activeTo: slot.activeTo } : null;
  const watershed = scope === 'all' ? today : (anchor.slotDate ?? today);

  await database.write(async () => {
    for (const l of affected) {
      await l.update((m) => {
        m.lifecycleStatus = 'cancelled';
        m.cancelReason = reason;
      });
    }
    if (slot) await slot.update((m) => { m.activeTo = watershed; });
  });

  return { affected: affected.length, undo: makeUndo(lessonSnaps, slotSnap) };
}

/**
 * Reschedule `anchor` with `scope`. «one» moves just this lesson to `newStartsAt` (and
 * detaches it, ADR-0016). «following»/«all» change the SERIES time-of-day: every affected
 * future occurrence is re-timed to the new time on its own date, and the slot's `timeMin`
 * is updated (from the watershed) so future materialization follows. Returns undo.
 */
export async function scopeReschedule(anchor: LessonModel, scope: Scope, newStartsAt: number): Promise<ScopeUndo> {
  if (scope === 'one' || anchor.slotId == null) {
    // Same protection as the cancel path (ADR-0016 §4 + ADR-0008/0009): a conducted,
    // cancelled or money-carrying occurrence must not be silently flipped back to
    // «upcoming» with a new time while its payment stays anchored to the old reality.
    if (anchor.lifecycleStatus === 'done' || anchor.lifecycleStatus === 'cancelled') {
      return { affected: 0, undo: async () => {} };
    }
    const protectedIds = await protectedLessonIds();
    if (protectedIds.has(anchor.id)) return { affected: 0, undo: async () => {} };
    const snap = snapshot([anchor]);
    await database.write(async () => {
      await anchor.update((m) => {
        m.startsAt = newStartsAt;
        m.lifecycleStatus = 'upcoming';
        m.modified = true; // a single manual move detaches from regeneration
      });
    });
    return { affected: 1, undo: makeUndo(snap, null) };
  }

  const today = startOfDay(Date.now());
  const protectedIds = await protectedLessonIds();
  const siblings = await siblingsOf(anchor.slotId);
  const affectedIds = new Set(scopeAffectedLessons({ anchor, siblings, scope, today, protectedIds }));
  // Mutate the observed `anchor` instance for its own id (see scopeCancel) for a live re-render.
  const affected = siblings.filter((l) => affectedIds.has(l.id)).map((l) => (l.id === anchor.id ? anchor : l));

  // Same no-op rule as `scopeCancel`: with nothing affected the slot's time-of-day must stay
  // put too, or a refused reschedule would silently re-time the whole future series.
  if (affected.length === 0) return { affected: 0, undo: async () => {} };

  // Without the slot a series-wide retime has nothing to re-configure — refuse whole.
  const slot = await slotsC().find(anchor.slotId).catch(() => null);
  if (!slot) return { affected: 0, undo: async () => {} };
  // Series-wide reschedule changes the TIME-OF-DAY only. Moving the series to another
  // weekday is a slot-config change (ADR-0016 §3 wants a slot split from the watershed)
  // — not implemented yet, so refuse COMPLETELY rather than «succeed» while silently
  // keeping every occurrence on the old weekday (the old behaviour lied about success).
  // The slot editor (student → Расписание) is the supported way to move the weekday.
  if (new Date(newStartsAt).getDay() !== slot.weekday) {
    return { affected: 0, undo: async () => {}, reason: 'weekday' };
  }

  const newTimeMin = timeOfDayMin(newStartsAt);
  const lessonSnaps = snapshot(affected);
  const slotSnap: SlotSnapshot | null = slot ? { id: slot.id, timeMin: slot.timeMin, activeTo: slot.activeTo } : null;

  await database.write(async () => {
    for (const l of affected) {
      // A `modified` occurrence here can only be the force-included anchor: apply the new
      // time on the day the user manually moved it to, not its original slot day.
      const dayMs = l.modified ? startOfDay(l.startsAt) : (l.slotDate ?? startOfDay(l.startsAt));
      await l.update((m) => {
        m.startsAt = dayMs + newTimeMin * 60_000;
        m.lifecycleStatus = 'upcoming';
      });
    }
    // Update the slot time so future materialization uses the new time-of-day.
    if (slot) await slot.update((m) => { m.timeMin = newTimeMin; });
  });

  return { affected: affected.length, undo: makeUndo(lessonSnaps, slotSnap) };
}

/** Whether a lesson belongs to a series (drives whether the ScopeSheet is shown). */
export function isSeriesLesson(lesson: Pick<LessonModel, 'slotId'>): boolean {
  return lesson.slotId != null;
}
