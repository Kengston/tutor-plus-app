/**
 * Schedule-slot persistence + series materialization (UI-v2 S6, ADR-0016).
 *
 * Three launch/edit concerns:
 *  - `ensureSlotsFromSchedule` — one-time backfill: parse each student's legacy
 *    `schedule` string into slots (idempotent — skips students who already have slots).
 *  - `materializeSchedule` — rolling-window generator: create lessons for active slots
 *    over the next 4 weeks, keyed idempotently by (slot_id, slot_date) — a repeat run
 *    creates nothing and never touches manually edited (`modified`) occurrences.
 *  - CRUD: `createSlot` / `updateSlot` / `closeSlot` for the slot editor.
 *
 * Money/lifecycle are untouched here — materialization only ever CREATES `upcoming`
 * lessons; scope edits/cancels (ScopeSheet) are slice #25.
 */
import { Q } from '@nozbe/watermelondb';

import { materializeSlots, type ExistingOccurrence } from '@/domain/schedule-slots';
import type { Duration, LessonFormat, ScheduleSlot } from '@/domain/types';
import { withoutReversals } from '@/domain/undo';
import { parseScheduleString } from '@/lib/schedule-parse';

import { database } from '.';
import { LessonModel, ScheduleSlotModel, StudentModel, TransactionModel } from './models';

const DAY = 86_400_000;
/** How far ahead lessons are materialized (ADR-0016: 2–4 weeks). */
const WINDOW_DAYS = 28;

const slotsC = () => database.get<ScheduleSlotModel>('schedule_slots');
const lessonsC = () => database.get<LessonModel>('lessons');
const studentsC = () => database.get<StudentModel>('students');

/** Local-midnight ms for the day containing `ms` (device tz; RU has no DST, ADR-0005). */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Read model → plain `ScheduleSlot` (the shape the pure generator reasons about). */
function toSlot(m: ScheduleSlotModel): ScheduleSlot {
  return {
    id: m.id,
    studentId: m.studentId,
    weekday: m.weekday,
    timeMin: m.timeMin,
    durationMin: m.durationMin,
    format: m.format,
    price: m.price,
    subjectId: m.subjectId,
    activeFrom: m.activeFrom,
    activeTo: m.activeTo,
    createdAt: m.createdAt.getTime(),
  };
}

export interface SlotInput {
  studentId: string;
  weekday: number;
  timeMin: number;
  durationMin: Duration;
  format: LessonFormat;
  price: number;
  subjectId: string | null;
  activeFrom?: number;
  activeTo?: number | null;
}

/** Create a slot (schedule editor). `activeFrom` defaults to today so it generates at once. */
export async function createSlot(input: SlotInput): Promise<ScheduleSlotModel> {
  return database.write(async () =>
    slotsC().create((s) => {
      s.studentId = input.studentId;
      s.weekday = input.weekday;
      s.timeMin = input.timeMin;
      s.durationMin = input.durationMin;
      s.format = input.format;
      s.price = input.price;
      s.subjectId = input.subjectId;
      s.activeFrom = input.activeFrom ?? startOfDay(Date.now());
      s.activeTo = input.activeTo ?? null;
    }),
  );
}

/**
 * Future occurrences of a slot that are still PURE PROJECTIONS of it — upcoming, never
 * manually edited (`modified`), carrying no effective money — from `fromDay` on. These are
 * the rows a slot-config change may rewrite or drop; everything else (past, conducted,
 * cancelled, manually moved, paid/debt-anchored) is untouchable (ADR-0016 §3–4).
 * Must be called INSIDE `database.write` (it is a read+decide step of a writer).
 */
async function regenerableLessons(slotId: string, fromDay: number): Promise<LessonModel[]> {
  const linked = await lessonsC()
    .query(Q.where('slot_id', slotId), Q.where('slot_date', Q.gte(fromDay)))
    .fetch();
  const candidates = linked.filter((l) => !l.modified && l.lifecycleStatus === 'upcoming');
  if (candidates.length === 0) return [];
  const txns = await database
    .get<TransactionModel>('transactions')
    .query(Q.where('lesson_id', Q.oneOf(candidates.map((l) => l.id))))
    .fetch();
  const moneyed = new Set(withoutReversals(txns).map((t) => t.lessonId));
  return candidates.filter((l) => !moneyed.has(l.id));
}

/**
 * Patch a slot (schedule editor) AND re-target its already-materialized future occurrences
 * (ADR-0016 §3 «перегенерация будущих немодифицированных занятий»). Without this, a weekday
 * change leaves the old-day lessons alive while materialization adds the new day — doubling
 * the week — and a time change «succeeds» on the slot while every lesson keeps the old time.
 * A weekday change DELETES the regenerable occurrences (they are pure projections; the
 * caller's `materializeSchedule` recreates them on the new day); other field changes rewrite
 * the occurrences in place.
 */
export async function updateSlot(slot: ScheduleSlotModel, patch: Partial<SlotInput>): Promise<void> {
  await database.write(async () => {
    const dayChanged = patch.weekday !== undefined && patch.weekday !== slot.weekday;
    await slot.update((s) => {
      if (patch.weekday !== undefined) s.weekday = patch.weekday;
      if (patch.timeMin !== undefined) s.timeMin = patch.timeMin;
      if (patch.durationMin !== undefined) s.durationMin = patch.durationMin;
      if (patch.format !== undefined) s.format = patch.format;
      if (patch.price !== undefined) s.price = patch.price;
      if (patch.subjectId !== undefined) s.subjectId = patch.subjectId;
      if (patch.activeFrom !== undefined) s.activeFrom = patch.activeFrom;
      if (patch.activeTo !== undefined) s.activeTo = patch.activeTo;
    });
    for (const l of await regenerableLessons(slot.id, startOfDay(Date.now()))) {
      if (dayChanged) {
        await l.destroyPermanently();
      } else {
        await l.update((m) => {
          if (patch.timeMin !== undefined && l.slotDate != null) m.startsAt = l.slotDate + patch.timeMin * 60_000;
          if (patch.durationMin !== undefined) m.durationMin = patch.durationMin;
          if (patch.format !== undefined) m.format = patch.format;
          if (patch.price !== undefined) m.price = patch.price;
          if (patch.subjectId !== undefined) m.subjectId = patch.subjectId;
        });
      }
    }
  });
}

/**
 * Close a slot from today: stop future materialization AND drop the future occurrences it
 * already materialized (pure projections only — see `regenerableLessons`). Leaving them
 * alive kept up to 28 days of lessons, and their expected income, for a series the user
 * just removed. Past/conducted/moneyed/modified lessons are untouched.
 */
export async function closeSlot(slot: ScheduleSlotModel): Promise<void> {
  await database.write(async () => {
    const today = startOfDay(Date.now());
    await slot.update((s) => {
      s.activeTo = today;
    });
    // Same boundary as the generator (`activeTo` is exclusive): today's occurrence goes too.
    for (const l of await regenerableLessons(slot.id, today)) await l.destroyPermanently();
  });
}

/**
 * Drop every future materialized projection of a student's slots (pure projections only —
 * see `regenerableLessons`). Called when the student leaves the `active` status: a paused/
 * archived student must not keep 4 weeks of lessons on the timeline and in the expected
 * income, and `materializeSchedule` (active-only) would no longer regenerate them anyway —
 * without this sweep a later slot edit would delete them one-sidedly instead.
 */
export async function dropStudentProjections(studentId: string): Promise<void> {
  await database.write(async () => {
    const today = startOfDay(Date.now());
    const slots = await slotsC().query(Q.where('student_id', studentId)).fetch();
    for (const s of slots) {
      for (const l of await regenerableLessons(s.id, today)) await l.destroyPermanently();
    }
  });
}

/**
 * Backfill slots from legacy `schedule` strings — runs once per student (idempotent:
 * a student who already has ≥1 slot is skipped, so re-running or editing slots later is
 * safe). Unparseable strings simply create no slots — the student keeps an empty editor.
 *
 * The existence snapshot is read INSIDE `write()` (mirrors `ensureProfile`) so two
 * concurrent launch runs (StrictMode / HMR double-mount) can't both see an empty slot
 * set and double-create — the writer queue serializes the read+create per invocation.
 */
export async function ensureSlotsFromSchedule(): Promise<void> {
  const today = startOfDay(Date.now());
  await database.write(async () => {
    const students = await studentsC().query().fetch();
    const withSlots = new Set((await slotsC().query().fetch()).map((s) => s.studentId));
    for (const student of students) {
      if (withSlots.has(student.id)) continue;
      const seeds = parseScheduleString(student.schedule);
      for (const seed of seeds) {
        await slotsC().create((s) => {
          s.studentId = student.id;
          s.weekday = seed.weekday;
          s.timeMin = seed.timeMin;
          s.durationMin = 60;
          s.format = student.format;
          s.price = student.rate;
          s.subjectId = null;
          s.activeFrom = today;
          s.activeTo = null;
        });
      }
    }
  });
}

/**
 * Materialize lessons from all active slots over the next `WINDOW_DAYS`. Idempotent by
 * (slot_id, slot_date): existing slot-lessons (any lifecycle, incl. cancelled/modified)
 * are the dedupe set, so a repeat run adds nothing and manual edits are preserved.
 * Returns the number of lessons created.
 */
export async function materializeSchedule(): Promise<number> {
  // The snapshot (slots + existing occurrences) is read INSIDE `write()` — the same
  // StrictMode/HMR double-mount guard `ensureSlotsFromSchedule` documents: two concurrent
  // runs must not both see an empty occurrence set and double-create (the schema has no
  // unique index on (slot_id, slot_date) to catch it after the fact).
  return database.write(async () => {
    const slotModels = await slotsC().query().fetch();
    if (slotModels.length === 0) return 0;

    // Only ACTIVE students generate lessons — a paused/archived student's slots stay
    // stored (their editor keeps them) but must not keep filling the schedule and the
    // expected-income figures.
    const students = await studentsC().query().fetch();
    const activeIds = new Set(students.filter((s) => s.status === 'active').map((s) => s.id));
    const eligible = slotModels.filter((s) => activeIds.has(s.studentId));
    if (eligible.length === 0) return 0;

    const now = Date.now();
    const windowStart = startOfDay(now);
    const windowEnd = windowStart + WINDOW_DAYS * DAY;

    // Existing (slot_id, slot_date) occurrences — only slot-linked lessons matter.
    const linked = await lessonsC().query(Q.where('slot_id', Q.notEq(null))).fetch();
    const existing: ExistingOccurrence[] = linked.map((l) => ({ slotId: l.slotId, slotDate: l.slotDate }));

    const specs = materializeSlots({
      slots: eligible.map(toSlot),
      existing,
      windowStart,
      windowEnd,
      now, // never create a past-dated «upcoming» lesson (a slot's time today already gone)
    });

    for (const spec of specs) {
      await lessonsC().create((l) => {
        l.studentId = spec.studentId;
        l.subjectId = spec.subjectId;
        l.topic = '';
        l.startsAt = spec.startsAt;
        l.durationMin = spec.durationMin;
        l.format = spec.format;
        l.price = spec.price;
        l.link = null;
        l.slotId = spec.slotId;
        l.slotDate = spec.slotDate;
        l.modified = false;
        l.lifecycleStatus = 'upcoming';
      });
    }
    return specs.length;
  });
}
