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
import { parseScheduleString } from '@/lib/schedule-parse';

import { database } from '.';
import { LessonModel, ScheduleSlotModel, StudentModel } from './models';

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

/** Patch a slot (schedule editor). */
export async function updateSlot(slot: ScheduleSlotModel, patch: Partial<SlotInput>): Promise<void> {
  await database.write(async () => {
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
  });
}

/** Close a slot from today (stops future materialization; past lessons are untouched). */
export async function closeSlot(slot: ScheduleSlotModel): Promise<void> {
  await database.write(async () => {
    await slot.update((s) => {
      s.activeTo = startOfDay(Date.now());
    });
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
  const slotModels = await slotsC().query().fetch();
  if (slotModels.length === 0) return 0;

  const now = Date.now();
  const windowStart = startOfDay(now);
  const windowEnd = windowStart + WINDOW_DAYS * DAY;

  // Existing (slot_id, slot_date) occurrences — only slot-linked lessons matter.
  const linked = await lessonsC().query(Q.where('slot_id', Q.notEq(null))).fetch();
  const existing: ExistingOccurrence[] = linked.map((l) => ({ slotId: l.slotId, slotDate: l.slotDate }));

  const specs = materializeSlots({
    slots: slotModels.map(toSlot),
    existing,
    windowStart,
    windowEnd,
    now, // never create a past-dated «upcoming» lesson (a slot's time today already gone)
  });
  if (specs.length === 0) return 0;

  await database.write(async () => {
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
  });
  return specs.length;
}
