/**
 * Reactive bridge (ADR-0007): WatermelonDB observables → React state. Screens read
 * live model instances via these hooks; writes (see ./mutations) re-emit automatically.
 * Lists use `observeWithColumns` so row-field edits (not just membership) re-render.
 *
 * Derived values (debt, payStatus, «N из M») are NOT here — compute them in render via
 * the pure `domain/aggregates` over the transactions/lessons these hooks return (ADR-0008).
 */
import { useEffect, useMemo, useState } from 'react';

import { Q } from '@nozbe/watermelondb';

import { withoutReversals } from '@/domain/undo';

import { database } from '.';
import {
  ExpectationModel,
  LessonModel,
  NotificationReadModel,
  ProfileModel,
  ScheduleSlotModel,
  StudentModel,
  StudentNoteModel,
  StudentSubjectModel,
  SubjectModel,
  TransactionModel,
} from './models';

/** Minimal structural shape of a WatermelonDB/rxjs observable (avoids an rxjs import). */
type Observableish<T> = { subscribe: (next: (value: T) => void) => { unsubscribe: () => void } };

/**
 * Subscribe to an observable, re-subscribing when `deps` change. Each emission is stored
 * in a FRESH box `{ v }`, not `setState(value)` — a single-record observable
 * (`findAndObserve`) re-emits the SAME cached model instance mutated in place, so
 * `setState(value)` would hit React's `Object.is` bail-out and never re-render (a lesson
 * detail would freeze after an in-place edit). Boxing gives every emission a new reference,
 * so record and list hooks alike re-render (list observables already emit fresh arrays).
 */
export function useObservable<T>(factory: () => Observableish<T>, deps: unknown[], initial: T): T {
  const [box, setBox] = useState<{ v: T }>(() => ({ v: initial }));
  useEffect(() => {
    const sub = factory().subscribe((value) => setBox({ v: value }));
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return box.v;
}

const studentsC = () => database.get<StudentModel>('students');
const subjectsC = () => database.get<SubjectModel>('subjects');
const lessonsC = () => database.get<LessonModel>('lessons');
const txnsC = () => database.get<TransactionModel>('transactions');
const studentSubjectsC = () => database.get<StudentSubjectModel>('student_subjects');
const slotsC = () => database.get<ScheduleSlotModel>('schedule_slots');
const notesC = () => database.get<StudentNoteModel>('student_notes');
const expectationsC = () => database.get<ExpectationModel>('expectations');

const STUDENT_COLS = ['name', 'initials', 'category', 'status', 'format', 'rate', 'schedule', 'phone'];
const SLOT_COLS = ['student_id', 'weekday', 'time_min', 'duration_min', 'format', 'price', 'subject_id', 'active_from', 'active_to'];
const LESSON_COLS = [
  'student_id', 'subject_id', 'topic', 'starts_at', 'duration_min', 'format', 'price', 'link', 'lifecycle_status',
];

/** All students, sorted by name (reactive). Filter/search/sort further in the screen. */
export function useStudents(): StudentModel[] {
  return useObservable(
    () => studentsC().query(Q.sortBy('name', Q.asc)).observeWithColumns(STUDENT_COLS),
    [],
    [],
  );
}

/** A single student (reactive); undefined until loaded. */
export function useStudent(id: string): StudentModel | undefined {
  return useObservable<StudentModel | undefined>(() => studentsC().findAndObserve(id), [id], undefined);
}

export function useSubjects(): SubjectModel[] {
  return useObservable(() => subjectsC().query(Q.sortBy('name', Q.asc)).observeWithColumns(['name']), [], []);
}

/** Lessons whose start falls in [start, end) (reactive), sorted by time. */
export function useLessonsInRange(start: number, end: number): LessonModel[] {
  return useObservable(
    () =>
      lessonsC()
        .query(Q.where('starts_at', Q.gte(start)), Q.where('starts_at', Q.lt(end)), Q.sortBy('starts_at', Q.asc))
        .observeWithColumns(LESSON_COLS),
    [start, end],
    [],
  );
}

/** Wrap a txn-list observable so subscribers see the EFFECTIVE ledger — reversal pairs
 *  (undo, `domain/undo`) dropped in one place; aggregates/screens stay reversal-blind. */
function effective(obs: Observableish<TransactionModel[]>): Observableish<TransactionModel[]> {
  return { subscribe: (next) => obs.subscribe((rows) => next(withoutReversals(rows))) };
}

/** Whole ledger (reactive) — cross-student debt + Finance/Analytics aggregates. Append-only,
 *  so inserts (new payments/debts) re-emit; observed columns cover the netting/entry fields. */
export function useAllTransactions(): TransactionModel[] {
  return useObservable(
    () =>
      effective(
        txnsC()
          .query(Q.sortBy('occurred_at', Q.desc))
          .observeWithColumns(['type', 'amount', 'student_id', 'lesson_id', 'subject_id', 'occurred_at', 'method']),
      ),
    [],
    [],
  );
}

/** All lessons (reactive), newest first — Finance entries (derived debt/expected rows) +
 *  Analytics buckets across periods. Single-practitioner scope → whole-table is cheap. */
export function useAllLessons(): LessonModel[] {
  return useObservable(
    () => lessonsC().query(Q.sortBy('starts_at', Q.desc)).observeWithColumns(LESSON_COLS),
    [],
    [],
  );
}

/** A single transaction (reactive); undefined until loaded — for the Finance operation detail.
 *  Intentionally NOT reversal-filtered: list rows come from `useAllTransactions` (effective),
 *  so no in-app path leads to a reversal's detail — a by-id read needs no pair lookup. */
export function useTransaction(id: string): TransactionModel | undefined {
  return useObservable<TransactionModel | undefined>(() => txnsC().findAndObserve(id), [id], undefined);
}

/** One student's transactions (reactive). */
export function useStudentTransactions(studentId: string): TransactionModel[] {
  return useObservable(
    () =>
      effective(
        txnsC().query(Q.where('student_id', studentId)).observeWithColumns(['type', 'amount', 'lesson_id']),
      ),
    [studentId],
    [],
  );
}

/** All expectations (reactive), latest due first — the Finance «Ожидается» union (ADR-0015).
 *  Whole-table (single-practitioner scale); `financeEntries` keeps only the OPEN ones. */
export function useExpectations(): ExpectationModel[] {
  return useObservable(
    () =>
      expectationsC()
        .query(Q.sortBy('due_at', Q.desc))
        .observeWithColumns(['student_id', 'amount', 'due_at', 'comment', 'status']),
    [],
    [],
  );
}

/** A single expectation (reactive); undefined until loaded — the settle detail (ADR-0015). */
export function useExpectation(id: string): ExpectationModel | undefined {
  return useObservable<ExpectationModel | undefined>(() => expectationsC().findAndObserve(id), [id], undefined);
}

/** Subjects/directions linked to a student via the M:N join (reactive on membership). */
export function useStudentSubjects(studentId: string): SubjectModel[] {
  const joins = useObservable<StudentSubjectModel[]>(
    () => studentSubjectsC().query(Q.where('student_id', studentId)).observe(),
    [studentId],
    [],
  );
  const all = useSubjects();
  const ids = new Set(joins.map((j) => j.subjectId));
  return all.filter((s) => ids.has(s.id));
}

/** All M:N joins (reactive) → the whole `studentId → subjectIds` mapping for the list. */
export function useStudentPrimarySubject(): Map<string, string> {
  const joins = useObservable<StudentSubjectModel[]>(() => studentSubjectsC().query().observe(), [], []);
  const subjects = useSubjects();
  return useMemo(() => {
    const nameById = new Map(subjects.map((s) => [s.id, s.name]));
    // First subject per student (join order) — the card's «Предмет» prefix.
    const primary = new Map<string, string>();
    for (const j of joins) {
      if (primary.has(j.studentId)) continue;
      const name = nameById.get(j.subjectId);
      if (name) primary.set(j.studentId, name);
    }
    return primary;
  }, [joins, subjects]);
}

/** A student's profile notes (reactive), newest first (spec 06 §6.3). */
export function useStudentNotes(studentId: string): StudentNoteModel[] {
  return useObservable(
    () => notesC().query(Q.where('student_id', studentId), Q.sortBy('created_at', Q.desc)).observeWithColumns(['text']),
    [studentId],
    [],
  );
}

/** A student's schedule slots (reactive), earliest weekday/time first — the slot editor. */
export function useStudentSlots(studentId: string): ScheduleSlotModel[] {
  return useObservable(
    () =>
      slotsC()
        .query(Q.where('student_id', studentId), Q.sortBy('weekday', Q.asc), Q.sortBy('time_min', Q.asc))
        .observeWithColumns(SLOT_COLS),
    [studentId],
    [],
  );
}

/** All lessons for a student (reactive), newest first. */
export function useStudentLessons(studentId: string): LessonModel[] {
  return useObservable(
    () =>
      lessonsC()
        .query(Q.where('student_id', studentId), Q.sortBy('starts_at', Q.desc))
        .observeWithColumns(LESSON_COLS),
    [studentId],
    [],
  );
}

/** A single lesson (reactive); undefined until loaded. */
export function useLesson(id: string): LessonModel | undefined {
  return useObservable<LessonModel | undefined>(() => lessonsC().findAndObserve(id), [id], undefined);
}

/** Transactions linked to one lesson (reactive) — for its derived payStatus. */
export function useLessonTransactions(lessonId: string): TransactionModel[] {
  return useObservable(
    () =>
      effective(
        txnsC().query(Q.where('lesson_id', lessonId)).observeWithColumns(['type', 'lesson_id']),
      ),
    [lessonId],
    [],
  );
}

// ── Profile + notification read-state (ADR-0013, Phase 3) ────────────────────

const profilesC = () => database.get<ProfileModel>('profiles');
const notifReadsC = () => database.get<NotificationReadModel>('notification_reads');

const PROFILE_COLS = [
  'name', 'activity', 'client_type', 'tz', 'theme', 'reminder_lead_min',
  'notif_lessons', 'notif_payment', 'notif_schedule', 'notif_summary',
  'notif_enabled', 'notif_debts', 'push_granted',
];

/** The single practitioner profile row (reactive); undefined until `ensureProfile` has run. */
export function useProfile(): ProfileModel | undefined {
  const rows = useObservable<ProfileModel[]>(
    () => profilesC().query().observeWithColumns(PROFILE_COLS),
    [],
    [],
  );
  return rows[0];
}

/** Read item-ids of the derived feed (reactive) — `unread = item.id ∉ this set`. */
export function useNotificationReads(): Set<string> {
  const rows = useObservable<NotificationReadModel[]>(() => notifReadsC().query().observe(), [], []);
  return useMemo(() => new Set(rows.map((r) => r.itemId)), [rows]);
}
