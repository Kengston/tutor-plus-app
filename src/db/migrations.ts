/**
 * Schema migrations (ADR-0007). New columns/tables → bump `schema.version` and append a
 * migration here (WatermelonDB applies them on adapter setup, preserving existing data).
 *
 * v2 (ADR-0013, Phase 3): add `profiles` (single-row prefs) + `notification_reads`
 * (derived-feed read-state). Existing Phase-1/2 data (students/lessons/transactions)
 * survives — the seed back-fills the single `profiles` row on next launch.
 */
import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

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
  ],
});
