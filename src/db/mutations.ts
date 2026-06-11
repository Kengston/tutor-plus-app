/**
 * Write helpers (ADR-0007/0008). All writes go through `database.write`. Money is
 * APPEND-ONLY: marking a lesson paid/unpaid CREATES a transaction — transactions are
 * never edited in place; corrections would be new compensating rows (ADR-0002). Hence
 * there is no "edit transaction" here.
 */
import { Q } from '@nozbe/watermelondb';

import type { Duration, LessonFormat, PayMethod, StudentStatus, TxnType } from '@/domain/types';
import type { Activity, ClientType } from '@/i18n';
import { initialsOf } from '@/lib/format';
import type { CatColor, ThemeMode } from '@/theme';

import { database } from '.';
import {
  LessonModel,
  NotificationReadModel,
  ProfileModel,
  StudentModel,
  StudentSubjectModel,
  SubjectModel,
  TransactionModel,
} from './models';

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

export interface TransactionInput {
  studentId: string;
  /** Only `paid`/`debt` are ever stored — `expected` is derived, never a row (ADR-0011). */
  type: Exclude<TxnType, 'expected'>;
  amount: number;
  method?: PayMethod | null;
  /** UTC-instant ms; defaults to now. */
  occurredAt?: number;
  subjectId?: string | null;
  comment?: string | null;
  /** Lesson-anchored (settlement / per-lesson) when set; standalone (prepayment/general) when null. */
  lessonId?: string | null;
}

/**
 * Append a transaction — the general money-write for Phase-2 Finance (ADR-0011). Covers
 * the «Новая операция» FAB (standalone Оплата/Долг) AND settling a debt FinanceEntry
 * (pass `type:'paid'` + the debt row's `lessonId` → its lesson's payStatus flips to paid,
 * debt drops). Append-only: this only ever CREATES rows; corrections are new rows.
 */
export async function createTransaction(input: TransactionInput): Promise<TransactionModel> {
  return database.write(async () =>
    database.get<TransactionModel>('transactions').create((t) => {
      t.studentId = input.studentId;
      t.lessonId = input.lessonId ?? null;
      t.amount = input.amount;
      t.type = input.type;
      t.method = input.method ?? null;
      t.subjectId = input.subjectId ?? null;
      t.occurredAt = input.occurredAt ?? Date.now();
      t.comment = input.comment ?? null;
    }),
  );
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

// ── Profile + prefs (ADR-0013, Phase 3) ──────────────────────────────────────

/** Default single-row profile — also the Phase-3 fallback when the v2 migration back-fills. */
export const PROFILE_DEFAULTS = {
  name: '',
  activity: 'teacher' as Activity,
  clientType: 'Ученик' as ClientType,
  tz: 'Europe/Moscow', // RU has no DST (ADR-0005); informational until cross-tz (Phase 4)
  theme: 'system' as ThemeMode,
  reminderLeadMin: 60, // «за 1 час»
  notifLessons: true,
  notifPayment: true,
  notifSchedule: true,
  notifSummary: true,
  pushGranted: false,
};

/**
 * Get-or-create the single `profiles` row. Called once on launch (ProfileProvider) — creates
 * the default row on a fresh install AND back-fills it for users migrated from schema v1.
 */
export async function ensureProfile(): Promise<ProfileModel> {
  const coll = database.get<ProfileModel>('profiles');
  const existing = await coll.query().fetch();
  if (existing.length > 0) return existing[0];
  return database.write(async () =>
    coll.create((p) => {
      p.name = PROFILE_DEFAULTS.name;
      p.activity = PROFILE_DEFAULTS.activity;
      p.clientType = PROFILE_DEFAULTS.clientType;
      p.tz = PROFILE_DEFAULTS.tz;
      p.theme = PROFILE_DEFAULTS.theme;
      p.reminderLeadMin = PROFILE_DEFAULTS.reminderLeadMin;
      p.notifLessons = PROFILE_DEFAULTS.notifLessons;
      p.notifPayment = PROFILE_DEFAULTS.notifPayment;
      p.notifSchedule = PROFILE_DEFAULTS.notifSchedule;
      p.notifSummary = PROFILE_DEFAULTS.notifSummary;
      p.pushGranted = PROFILE_DEFAULTS.pushGranted;
    }),
  );
}

export interface ProfilePatch {
  name?: string;
  activity?: Activity;
  clientType?: ClientType;
  tz?: string;
  theme?: ThemeMode;
  reminderLeadMin?: number;
  notifLessons?: boolean;
  notifPayment?: boolean;
  notifSchedule?: boolean;
  notifSummary?: boolean;
  pushGranted?: boolean;
}

/** Patch the profile row (Settings writes). Persists theme/dual-mode/reminder prefs across reloads. */
export async function updateProfile(profile: ProfileModel, patch: ProfilePatch): Promise<void> {
  await database.write(async () => {
    await profile.update((p) => {
      if (patch.name !== undefined) p.name = patch.name;
      if (patch.activity !== undefined) p.activity = patch.activity;
      if (patch.clientType !== undefined) p.clientType = patch.clientType;
      if (patch.tz !== undefined) p.tz = patch.tz;
      if (patch.theme !== undefined) p.theme = patch.theme;
      if (patch.reminderLeadMin !== undefined) p.reminderLeadMin = patch.reminderLeadMin;
      if (patch.notifLessons !== undefined) p.notifLessons = patch.notifLessons;
      if (patch.notifPayment !== undefined) p.notifPayment = patch.notifPayment;
      if (patch.notifSchedule !== undefined) p.notifSchedule = patch.notifSchedule;
      if (patch.notifSummary !== undefined) p.notifSummary = patch.notifSummary;
      if (patch.pushGranted !== undefined) p.pushGranted = patch.pushGranted;
    });
  });
}

// ── Notification read-state (ADR-0013) ───────────────────────────────────────
// The feed is derived; the only persistence is which item-ids have been read.

/** Mark one feed item read (idempotent — no duplicate row for the same synthetic id). */
export async function markNotificationRead(itemId: string): Promise<void> {
  await database.write(async () => {
    const coll = database.get<NotificationReadModel>('notification_reads');
    const already = await coll.query(Q.where('item_id', itemId)).fetchCount();
    if (already > 0) return;
    await coll.create((r) => {
      r.itemId = itemId;
      r.readAt = Date.now();
    });
  });
}

/** Mark a batch of feed items read («Прочитать всё») — inserts only the missing ids. */
export async function markAllNotificationsRead(itemIds: readonly string[]): Promise<void> {
  if (itemIds.length === 0) return;
  await database.write(async () => {
    const coll = database.get<NotificationReadModel>('notification_reads');
    const existing = await coll.query(Q.where('item_id', Q.oneOf(itemIds as string[]))).fetch();
    const have = new Set(existing.map((r) => r.itemId));
    const now = Date.now();
    for (const id of itemIds) {
      if (have.has(id)) continue;
      await coll.create((r) => {
        r.itemId = id;
        r.readAt = now;
      });
    }
  });
}
