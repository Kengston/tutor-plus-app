/**
 * Reactive bridge (ADR-0007): WatermelonDB observables → React state. Screens read
 * live model instances via these hooks; writes (see ./mutations) re-emit automatically.
 * Lists use `observeWithColumns` so row-field edits (not just membership) re-render.
 *
 * Derived values (debt, payStatus, «N из M») are NOT here — compute them in render via
 * the pure `domain/aggregates` over the transactions/lessons these hooks return (ADR-0008).
 */
import { useEffect, useState } from 'react';

import { Q } from '@nozbe/watermelondb';

import { database } from '.';
import {
  LessonModel,
  StudentModel,
  StudentSubjectModel,
  SubjectModel,
  TransactionModel,
} from './models';

/** Minimal structural shape of a WatermelonDB/rxjs observable (avoids an rxjs import). */
type Observableish<T> = { subscribe: (next: (value: T) => void) => { unsubscribe: () => void } };

/** Subscribe to an observable, re-subscribing when `deps` change. */
export function useObservable<T>(factory: () => Observableish<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = factory().subscribe(setValue);
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

const studentsC = () => database.get<StudentModel>('students');
const subjectsC = () => database.get<SubjectModel>('subjects');
const lessonsC = () => database.get<LessonModel>('lessons');
const txnsC = () => database.get<TransactionModel>('transactions');
const studentSubjectsC = () => database.get<StudentSubjectModel>('student_subjects');

const STUDENT_COLS = ['name', 'initials', 'category', 'status', 'format', 'rate', 'schedule', 'phone'];
const LESSON_COLS = [
  'student_id', 'subject_id', 'topic', 'starts_at', 'duration_min', 'format', 'price', 'lifecycle_status',
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

/** Whole ledger (reactive on the columns aggregates read) — for cross-student debt. */
export function useAllTransactions(): TransactionModel[] {
  return useObservable(
    () => txnsC().query().observeWithColumns(['type', 'amount', 'student_id', 'lesson_id']),
    [],
    [],
  );
}

/** One student's transactions (reactive). */
export function useStudentTransactions(studentId: string): TransactionModel[] {
  return useObservable(
    () => txnsC().query(Q.where('student_id', studentId)).observeWithColumns(['type', 'amount', 'lesson_id']),
    [studentId],
    [],
  );
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
    () => txnsC().query(Q.where('lesson_id', lessonId)).observeWithColumns(['type', 'lesson_id']),
    [lessonId],
    [],
  );
}
