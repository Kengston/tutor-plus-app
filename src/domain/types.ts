/**
 * R8 domain types — the neutral core (ADR-0006: domain is lexicon-free; «Ученик/
 * Клиент», «занятие/встреча» differ only at DISPLAY). Persistence shapes live in
 * `src/db/models` (WatermelonDB); these are the plain read-model shapes screens and
 * the pure `aggregates` layer reason about. Field names match the model getters, so
 * a model instance structurally satisfies the relevant slice of these types.
 *
 * Money is an append-only ledger; `Lesson.payStatus` / `Student.debt` are NOT stored
 * here — they are derived in `./aggregates` (ADR-0008). Timestamps are UTC-instant ms
 * (ADR-0005), rendered in `profile.tz` at display.
 */
import type { CatColor } from '@/theme';

/** Lesson lifecycle — distinct axis from payment (R8 fix #1). */
export type LifecycleStatus = 'upcoming' | 'ongoing' | 'done' | 'cancelled';

/** Tri-state payment (ADR-0008) — shared by a lesson's derived status and a txn's type. */
export type PayStatus = 'paid' | 'debt' | 'expected';
export type TxnType = PayStatus;

export type LessonFormat = 'online' | 'inperson';
export type StudentStatus = 'active' | 'paused' | 'archived';
export type PayMethod = 'transfer' | 'cash' | 'card';

/** Allowed lesson durations (minutes) — passport quick-picks. */
export type Duration = 30 | 45 | 60 | 90;
export const DURATIONS: readonly Duration[] = [30, 45, 60, 90];

/** Central entity of the practitioner's circle. `debt` is derived, not a field. */
export interface Student {
  id: string;
  name: string;
  initials: string;
  category: CatColor;
  status: StudentStatus;
  /** Default format for new lessons. */
  format: LessonFormat;
  /** Rate per lesson/meeting (whole RUB). */
  rate: number;
  /** Free-form recurring schedule, e.g. «Пн, Ср · 16:00». */
  schedule: string;
  phone: string;
  /** Many-to-many — subject/direction ids. */
  subjectIds: string[];
  createdAt: number;
}

/** Subject (tutor mode) / Direction (client mode) — neutral name, lexicon at display. */
export interface Subject {
  id: string;
  name: string;
  createdAt: number;
}

/** A scheduled event. `payStatus` is derived from linked transactions (ADR-0008). */
export interface Lesson {
  id: string;
  studentId: string;
  subjectId: string | null;
  topic: string;
  /** UTC-instant ms (ADR-0005). */
  startsAt: number;
  durationMin: Duration;
  format: LessonFormat;
  price: number;
  lifecycleStatus: LifecycleStatus;
  cancelReason: string | null;
  comment: string | null;
  createdAt: number;
}

/** Append-only financial record (ADR-0002). Belongs to a Student; lesson link optional. */
export interface Transaction {
  id: string;
  studentId: string;
  /** Optional — prepayment/packages/general debt have no specific lesson (ADR-0008). */
  lessonId: string | null;
  amount: number;
  type: TxnType;
  method: PayMethod | null;
  subjectId: string | null;
  /** UTC-instant ms. */
  occurredAt: number;
  comment: string | null;
  createdAt: number;
}
