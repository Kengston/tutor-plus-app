/**
 * WatermelonDB schema (ADR-0007), R8 model. Stable ids (WatermelonDB-generated, not
 * `name`). `lifecycle_status` is a SEPARATE axis from payment (R8). Money is the
 * append-only `transactions` ledger — there is intentionally NO `pay_status` column on
 * `lessons` nor `debt` on `students`; both are derived in `domain/aggregates` (ADR-0008).
 * Timestamps are `number` (UTC-instant ms, ADR-0005). `student_subjects` is the M:N join.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
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
  ],
});
