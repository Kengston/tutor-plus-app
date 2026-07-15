/**
 * Schema migrations (ADR-0007). New columns/tables → bump `schema.version` and append a
 * migration here (WatermelonDB applies them on adapter setup, preserving existing data).
 *
 * v2 (ADR-0013, Phase 3): add `profiles` (single-row prefs) + `notification_reads`
 * (derived-feed read-state). Existing Phase-1/2 data (students/lessons/transactions)
 * survives — the seed back-fills the single `profiles` row on next launch.
 *
 * v3 (UI-v2 S1, undo): add `transactions.reverses_id` — compensating-row link
 * (`domain/undo`). Existing rows get `null` (= a normal, non-reversal record).
 *
 * v4 (UI-v2 S3): add `lessons.link` (meeting URL).
 *
 * v5 (UI-v2 S6, ADR-0016): add `schedule_slots` + `lessons.slot_id`/`slot_date`/`modified`.
 * Existing lessons become standalone (`slot_id=null`, `modified=false`); a launch-time
 * backfill (`db/slots.ensureSlotsFromSchedule`) seeds slots from the legacy `schedule`
 * strings. `students.schedule` is kept (no drop-column in WatermelonDB) but superseded.
 */
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'profiles',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'activity', type: 'string' },
            { name: 'client_type', type: 'string' },
            { name: 'tz', type: 'string' },
            { name: 'theme', type: 'string' },
            { name: 'reminder_lead_min', type: 'number' },
            { name: 'notif_lessons', type: 'boolean' },
            { name: 'notif_payment', type: 'boolean' },
            { name: 'notif_schedule', type: 'boolean' },
            { name: 'notif_summary', type: 'boolean' },
            { name: 'push_granted', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'notification_reads',
          columns: [
            { name: 'item_id', type: 'string', isIndexed: true },
            { name: 'read_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'transactions',
          columns: [{ name: 'reverses_id', type: 'string', isOptional: true, isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'lessons',
          columns: [{ name: 'link', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'lessons',
          columns: [
            { name: 'slot_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'slot_date', type: 'number', isOptional: true },
            { name: 'modified', type: 'boolean' },
          ],
        }),
        createTable({
          name: 'schedule_slots',
          columns: [
            { name: 'student_id', type: 'string', isIndexed: true },
            { name: 'weekday', type: 'number' },
            { name: 'time_min', type: 'number' },
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
      ],
    },
  ],
});
