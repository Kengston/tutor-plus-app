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
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
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
        { name: 'lifecycle_status', type: 'string', isIndexed: true },
        { name: 'cancel_reason', type: 'string', isOptional: true },
        { name: 'comment', type: 'string', isOptional: true },
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
  ],
});
