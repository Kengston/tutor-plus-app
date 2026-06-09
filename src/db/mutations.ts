/**
 * Write helpers (ADR-0007/0008). All writes go through `database.write`. Money is
 * APPEND-ONLY: marking a lesson paid/unpaid CREATES a transaction — transactions are
 * never edited in place; corrections would be new compensating rows (ADR-0002). Hence
 * there is no "edit transaction" here.
 */
import { Q } from '@nozbe/watermelondb';

import type { Duration, LessonFormat, PayMethod, StudentStatus, TxnType } from '@/domain/types';
import { initialsOf } from '@/lib/format';
import type { CatColor } from '@/theme';

import { database } from '.';
import { LessonModel, StudentModel, StudentSubjectModel, SubjectModel, TransactionModel } from './models';

export interface StudentInput {
  name: string;
  category: CatColor;
  status: StudentStatus;
  format: LessonFormat;
  rate: number;
  schedule: string;
  phone: string;
  subjectIds: string[];
}

export async function createStudent(input: StudentInput): Promise<StudentModel> {
  return database.write(async () => {
    const student = await database.get<StudentModel>('students').create((s) => {
      s.name = input.name;
      s.initials = initialsOf(input.name);
      s.category = input.category;
      s.status = input.status;
      s.format = input.format;
      s.rate = input.rate;
      s.schedule = input.schedule;
      s.phone = input.phone;
    });
    for (const subjectId of input.subjectIds) {
      await database.get<StudentSubjectModel>('student_subjects').create((j) => {
        j.studentId = student.id;
        j.subjectId = subjectId;
      });
    }
    return student;
  });
}

export async function updateStudent(student: StudentModel, patch: Partial<StudentInput>): Promise<void> {
  await database.write(async () => {
    await student.update((s) => {
      if (patch.name !== undefined) {
        s.name = patch.name;
        s.initials = initialsOf(patch.name);
      }
      if (patch.category !== undefined) s.category = patch.category;
      if (patch.status !== undefined) s.status = patch.status;
      if (patch.format !== undefined) s.format = patch.format;
      if (patch.rate !== undefined) s.rate = patch.rate;
      if (patch.schedule !== undefined) s.schedule = patch.schedule;
      if (patch.phone !== undefined) s.phone = patch.phone;
    });
    if (patch.subjectIds) {
      const existing = await database
        .get<StudentSubjectModel>('student_subjects')
        .query(Q.where('student_id', student.id))
        .fetch();
      for (const row of existing) await row.destroyPermanently();
      for (const subjectId of patch.subjectIds) {
        await database.get<StudentSubjectModel>('student_subjects').create((j) => {
          j.studentId = student.id;
          j.subjectId = subjectId;
        });
      }
    }
  });
}

/** Archive/pause/reactivate (lifecycleStatus of the student, not a lesson). */
export async function setStudentStatus(student: StudentModel, status: StudentStatus): Promise<void> {
  await database.write(async () => {
    await student.update((s) => {
      s.status = status;
    });
  });
}

export interface LessonInput {
  studentId: string;
  subjectId: string | null;
  topic: string;
  startsAt: number;
  durationMin: Duration;
  format: LessonFormat;
  price: number;
}

export async function createLesson(input: LessonInput): Promise<LessonModel> {
  return database.write(async () =>
    database.get<LessonModel>('lessons').create((l) => {
      l.studentId = input.studentId;
      l.subjectId = input.subjectId;
      l.topic = input.topic;
      l.startsAt = input.startsAt;
      l.durationMin = input.durationMin;
      l.format = input.format;
      l.price = input.price;
      l.lifecycleStatus = 'upcoming';
    }),
  );
}

/**
 * Mark a lesson conducted — LIFECYCLE ONLY (ADR-0009). Payment is a SEPARATE, explicit
 * action (`recordLessonPayment`); `payStatus` stays `expected` until then. The «Провести»
 * swipe and the card button both call this — fast, no money side-effects (R8: two axes).
 */
export async function markLessonConducted(lesson: LessonModel): Promise<void> {
  await database.write(async () => {
    await lesson.update((l) => {
      l.lifecycleStatus = 'done';
    });
  });
}

/**
 * Record a payment against a lesson — APPENDS a linked transaction (ADR-0008/0009).
 * Append-only: a correction is a NEW compensating row, never an in-place edit. Debt is
 * always explicit (chosen here), never auto-derived from a conducted-but-unpaid lesson.
 */
export async function recordLessonPayment(
  lesson: LessonModel,
  pay: { type: Exclude<TxnType, 'expected'>; method?: PayMethod },
): Promise<void> {
  await database.write(async () => {
    await database.get<TransactionModel>('transactions').create((t) => {
      t.studentId = lesson.studentId;
      t.lessonId = lesson.id;
      t.amount = lesson.price;
      t.type = pay.type;
      t.method = pay.method ?? null;
      t.subjectId = lesson.subjectId;
      t.occurredAt = Date.now();
    });
  });
}

export async function cancelLesson(lesson: LessonModel, reason?: string, comment?: string): Promise<void> {
  await database.write(async () => {
    await lesson.update((l) => {
      l.lifecycleStatus = 'cancelled';
      // Neutral by default — never persist a UI label as data (ADR-0006). A typed reason can be passed explicitly.
      l.cancelReason = reason ?? '';
      if (comment !== undefined) l.comment = comment;
    });
  });
}

export async function rescheduleLesson(lesson: LessonModel, startsAt: number): Promise<void> {
  await database.write(async () => {
    await lesson.update((l) => {
      l.startsAt = startsAt;
      l.lifecycleStatus = 'upcoming';
    });
  });
}

export async function createSubject(name: string): Promise<SubjectModel> {
  return database.write(async () => database.get<SubjectModel>('subjects').create((s) => {
    s.name = name;
  }));
}
