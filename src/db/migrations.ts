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
 *
 * v6 (UI-v2 S9, spec 06 §6.3): add `student_notes` (profile notes). Additive — no data change.
 *
 * v7 (UI-v2 S10, ADR-0015): add `expectations` (money promised without a lesson, «Ожидается»).
 * Additive — no data change; existing ledger/aggregates are untouched.
 *
 * v8 (UI-v2 S14, spec 09 §9.3): add `profiles.notif_enabled` + `profiles.notif_debts` —
 * NULLABLE, and null reads as TRUE in `reminderPrefsOf`, so migrating never silences the feed.
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
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'student_notes',
          columns: [
            { name: 'student_id', type: 'string', isIndexed: true },
            { name: 'text', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        createTable({
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
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'profiles',
          columns: [
            // Nullable: existing rows backfill to null, which reminderPrefsOf reads as TRUE —
            // the migration must not silence a user's feed (spec 09 §9.3 master switch).
            { name: 'notif_enabled', type: 'boolean', isOptional: true },
            { name: 'notif_debts', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
