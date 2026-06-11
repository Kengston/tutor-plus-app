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

/**
 * A money-relevant row in the Finance list (ADR-0011) — a VIEW-MODEL, not a stored
 * entity. The list is a union of real `paid` transactions, derived `debt`/`expected`
 * lessons (a lesson's payStatus, not a stored row), and standalone `debt` transactions.
 * `expected` is never stored — it is always a derived lesson row (ADR-0008/0011).
 */
export type FinanceEntryKind = PayStatus; // 'paid' | 'debt' | 'expected'

export interface FinanceEntry {
  /** Stable row id: the txn id, or `lesson:<lessonId>` for a derived lesson row. */
  id: string;
  kind: FinanceEntryKind;
  studentId: string;
  /** Present for lesson-anchored rows; null for standalone operations. */
  lessonId: string | null;
  subjectId: string | null;
  amount: number;
  /** Bucket/sort instant: txn.occurredAt, or lesson.startsAt for a derived row. */
  occurredAt: number;
  method: PayMethod | null;
  /** Origin of the row — drives drill-down (open the txn vs open the lesson). */
  source: 'txn' | 'lesson';
}

// ── Notifications (Phase 3, ADR-0013) ───────────────────────────────────────
// The feed is a VIEW-MODEL (sibling of `FinanceEntry`), NOT a stored entity. Items are
// DERIVED from lessons + the append-only ledger by `domain/notifications`; the only
// persistence is read-state (`notification_reads`): `unread = item.id ∉ that table`.

/** Filter axis (the 4 feed chips + «Все»). */
export type NotificationCategory = 'lesson' | 'payment' | 'schedule' | 'system';

/** Specific item type — drives icon + title template at render (no inline strings here). */
export type NotificationKind = 'reminder' | 'payment' | 'debt' | 'cancelled' | 'summary';

/** Time bucket relative to local day bounds. */
export type NotificationGroup = 'today' | 'yesterday' | 'earlier';

/** Drill-down target (open the lesson card vs the operation detail). */
export type NotificationRef =
  | { kind: 'lesson'; id: string }
  | { kind: 'transaction'; id: string }
  | { kind: 'none' };

/**
 * A derived row in the notification feed. Carries STRUCTURED payload (studentName, amount,
 * …) — the screen composes the localized title via `useT()`, keeping the builder lexicon-free.
 */
export interface NotificationItem {
  /** Stable synthetic id: `reminder:<lessonId>` / `payment:<txnId>` / `debt:<txnId>` / `cancelled:<lessonId>` / `summary:<YYYY-MM-DD>`. */
  id: string;
  category: NotificationCategory;
  kind: NotificationKind;
  /** Source instant (ms): lesson.startsAt / txn.occurredAt / lesson.updatedAt / day-start. */
  time: number;
  group: NotificationGroup;
  /** Derived from read-state — `id ∉ notification_reads`. */
  unread: boolean;
  ref: NotificationRef;
  // Structured payload for i18n title composition:
  studentName?: string;
  studentCategory?: CatColor;
  /** payment / debt amount (whole RUB). */
  amount?: number;
  /** daily-summary lesson count. */
  count?: number;
  /** reminder / cancelled — the lesson's startsAt (for «через N» / time subtitle). */
  lessonAt?: number;
}

/** Theme choice persisted in the profile (mirrors `theme` `ThemeMode`). */
export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Reminder/notification preferences (ADR-0013), persisted on the single `profiles` row.
 * The four toggles map 1:1 to the feed filter categories.
 */
export interface ReminderPrefs {
  /** Lead-time minutes: 10 | 20 | 60 | 1440. */
  leadMin: number;
  /** «Занятия» — upcoming-lesson reminders. */
  lessons: boolean;
  /** «Оплата» — payment + debt events. */
  payment: boolean;
  /** «Расписание» — cancellations / schedule changes. */
  schedule: boolean;
  /** «Система» — daily summary. */
  summary: boolean;
  /** OS notification permission granted. */
  pushGranted: boolean;
}
