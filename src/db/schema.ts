/**
 * WatermelonDB schema (ADR-0007), R8 model. Stable ids (WatermelonDB-generated, not
 * `name`). `lifecycle_status` is a SEPARATE axis from payment (R8). Money is the
 * append-only `transactions` ledger — there is intentionally NO `pay_status` column on
 * `lessons` nor `debt` on `students`; both are derived in `domain/aggregates` (ADR-0008).
 * Timestamps are `number` (UTC-instant ms, ADR-0005). `student_subjects` is the M:N join.
 *
 * v2 (ADR-0013, Phase 3): `+profiles` (single-row practitioner prefs — closes the in-memory
 * theme/dual-mode TODO; reminder settings live here) and `+notification_reads` (the ONLY
 * persistence the DERIVED notification feed needs — `unread = itemId ∉ this table`). The feed
 * itself is a view-model (`domain/notifications`), never a stored `notifications` table.
 *
 * v3 (UI-v2 S1, undo): `transactions.reverses_id` — a compensating row's link to the txn
 * it reverses (`domain/undo`). Undo never edits/deletes ledger rows (ADR-0002); the pair
 * is filtered out of derived values at the data boundary.
 *
 * v4 (UI-v2 S3, delta v2.1 §3.1): `lessons.link` — meeting URL on the lesson;
 * «Подключиться»/«Открыть встречу» show only for online lessons with a link.
 *
 * v5 (UI-v2 S6, ADR-0016): `+schedule_slots` (a student's recurring series) and
 * `lessons.slot_id`/`slot_date`/`modified` — lessons materialized from slots into a
 * rolling window; (slot_id, slot_date) is the idempotency key, `modified` marks a
 * manually edited occurrence the generator must not touch.
 *
 * v6 (UI-v2 S9, spec 06 §6.3): `+student_notes` — free-form notes on a student's profile.
 *
 * v7 (UI-v2 S10, ADR-0015): `+expectations` — money promised WITHOUT a lesson («Ожидается»),
 * a plain CRUD entity OUTSIDE the append-only ledger. NOT a transaction: never counted in
 * received/debt; «Отметить оплату» appends a `paid` txn and flips `status` open→closed.
 *
 * v8 (UI-v2 S14, spec 09 §9.3): `profiles.notif_enabled` (master switch) + `profiles.notif_debts`
 * (debts separated from payments). NULLABLE on purpose: addColumns backfills existing rows with
 * null, and `reminderPrefsOf` reads null as TRUE — a migrated user's feed stays on.
 *
 * v9 (UI-v2 S15, spec 10 §10.2): `profiles.phone` («Телефон / мессенджер») + `profiles.work_days`
 * (CSV of JS getDay indices; null reads as Пн–Пт). Both nullable — additive, no data change.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 9,
  tables: [
    tableSchema({
      name: 'students',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'initials', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'format', type: 'string' },
        { name: 'rate', type: 'number' },
        { name: 'schedule', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'subjects',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'lessons',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'subject_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'topic', type: 'string' },
        { name: 'starts_at', type: 'number', isIndexed: true },
        { name: 'duration_min', type: 'number' },
        { name: 'format', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'link', type: 'string', isOptional: true },
        { name: 'slot_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'slot_date', type: 'number', isOptional: true },
        { name: 'modified', type: 'boolean' },
        { name: 'lifecycle_status', type: 'string', isIndexed: true },
        { name: 'cancel_reason', type: 'string', isOptional: true },
        { name: 'comment', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // Recurring schedule slots — a student's series (ADR-0016). Lessons are materialized
    // from active slots; wall-clock (weekday/time_min) resolves in the device tz.
    tableSchema({
      name: 'schedule_slots',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'weekday', type: 'number' }, // 0=Sun … 6=Sat
        { name: 'time_min', type: 'number' }, // minutes from local midnight
        { name: 'duration_min', type: 'number' },
        { name: 'format', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'subject_id', type: 'string', isOptional: true },
        { name: 'active_from', type: 'number' },
        { name: 'active_to', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'lesson_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'method', type: 'string', isOptional: true },
        { name: 'subject_id', type: 'string', isOptional: true },
        { name: 'occurred_at', type: 'number', isIndexed: true },
        { name: 'comment', type: 'string', isOptional: true },
        { name: 'reverses_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'student_subjects',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'subject_id', type: 'string', isIndexed: true },
      ],
    }),
    // Single-row practitioner profile + prefs (ADR-0013). Hydrates theme/dual-mode and
    // houses reminder settings; becomes a real synced row in Phase 4 (ADR-0002).
    tableSchema({
      name: 'profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'activity', type: 'string' },
        { name: 'client_type', type: 'string' }, // 'Ученик' | 'Клиент' (dual-mode axis, ADR-0006)
        { name: 'tz', type: 'string' },
        { name: 'theme', type: 'string' }, // 'system' | 'light' | 'dark'
        { name: 'reminder_lead_min', type: 'number' }, // 10 | 20 | 60 | 1440
        { name: 'notif_lessons', type: 'boolean' },
        { name: 'notif_payment', type: 'boolean' },
        { name: 'notif_schedule', type: 'boolean' },
        { name: 'notif_summary', type: 'boolean' },
        // v8: master switch + debts-vs-payments split. Nullable — null reads as TRUE (see header).
        { name: 'notif_enabled', type: 'boolean', isOptional: true },
        { name: 'notif_debts', type: 'boolean', isOptional: true },
        // v9: contact + working days («Пн–Пт» when null). Nullable — additive backfill.
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'work_days', type: 'string', isOptional: true },
        { name: 'push_granted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // Read-state of the DERIVED feed (ADR-0013): one row per read item (stable synthetic id).
    // `unread = itemId ∉ this table`. No `notifications` table — the feed is a view-model.
    tableSchema({
      name: 'notification_reads',
      columns: [
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'read_at', type: 'number' },
      ],
    }),
    // Free-form notes on a student's profile (spec 06 §6.3): text + timestamp, newest first.
    tableSchema({
      name: 'student_notes',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'text', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // Expected payment without a lesson (ADR-0015): participant + amount + due date; `status`
    // open/closed. A CRUD entity, NOT the append-only ledger — never counted in received/debt.
    tableSchema({
      name: 'expectations',
      columns: [
        { name: 'student_id', type: 'string', isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'due_at', type: 'number', isIndexed: true },
        { name: 'comment', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
